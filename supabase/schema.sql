-- Claude Country Club schema. Paste into Supabase: SQL Editor > New query > Run.
-- Tables are locked down with RLS; the browser only talks to the functions below.

create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  pin_hash text not null,
  token uuid not null unique default gen_random_uuid(),
  avatar jsonb not null default '{"color":"#4f6d8f","equip":{}}',
  created_at timestamptz not null default now()
);
create unique index if not exists players_group_name on players (group_id, lower(name));

-- One row per finished round. The course itself lives in the app, one per month.
create table if not exists rounds (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  group_id uuid not null references groups on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  course text not null,
  holes int[] not null,
  total int not null,
  par int not null,
  feats text[] not null default '{}',
  created_at timestamptz not null default now()
);
-- where each tee shot came to rest, per hole ({x, y} or null), so today's players can stand on the course
alter table rounds add column if not exists spots jsonb;
create index if not exists rounds_group_month on rounds (group_id, month);

drop table if exists hole_scores cascade;
drop function if exists submit_hole(uuid, int, int, int, text[]);
drop function if exists day_totals(uuid, date);

alter table groups enable row level security;
alter table players enable row level security;
alter table rounds enable row level security;

-- Invitations: only the club's admin can put up new members, one single-use code per person.
-- The group's own code (e.g. 'gentlemen') still signs existing members in, but can't create new ones.
alter table players add column if not exists role text not null default 'member' check (role in ('admin', 'member'));

create table if not exists invitations (
  id text primary key, -- the private link: #/invite/<id>
  group_id uuid not null references groups on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  code text not null unique, -- what they scratch off, e.g. k7q-4m2
  created_by uuid references players on delete set null,
  created_at timestamptz not null default now(),
  used_by uuid references players on delete set null,
  used_at timestamptz
);
alter table invitations enable row level security;

-- Feedback: any member can send the Committee a note; only the admin reads and clears them.
create table if not exists feedback (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  player_id uuid references players on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  context text check (char_length(context) <= 120), -- e.g. 'After a 13 (+1) on The Highlands Course'
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;

-- Notices: the admin posts club news to every member, signed as Reginald or as themselves.
create table if not exists notices (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  author_id uuid references players on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  as_reginald boolean not null default true,
  live boolean not null default true,
  created_at timestamptz not null default now()
);
alter table notices enable row level security;

-- random lowercase letters and digits, no look-alikes (no i, l, o, 0, 1)
create or replace function rand_code(n int) returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(x.b, i) % 31), 1), '')
  from (select gen_random_bytes(n) as b) x, generate_series(0, n - 1) i
$$;


-- Invitation codes look like K7Q-4M2: letters and digits alternating, so they never spell anything.
create or replace function invite_code() returns text
language sql volatile set search_path = public, extensions as $$
  select string_agg(
    case when i = 3 then '-'
         when i % 2 = 0 then substr('abcdefghjkmnpqrstuvwxyz', 1 + (get_byte(x.b, i) % 23), 1)
         else substr('23456789', 1 + (get_byte(x.b, i) % 8), 1) end, '' order by i)
  from (select gen_random_bytes(7) as b) x, generate_series(0, 6) i
$$;

-- The game day rolls over at midnight Eastern.
create or replace function game_today() returns date
language sql stable as $$ select (now() at time zone 'America/New_York')::date $$;

create or replace function game_month() returns text
language sql stable as $$ select to_char(game_today(), 'YYYY-MM') $$;

-- Each member's best round per month (lowest to par, earliest breaks a tie), ranked within the month.
-- (see home_of below: a host runs a club without playing in it)
alter table players add column if not exists host_only boolean not null default false;

create or replace function month_bests(p_group uuid)
returns table (month text, player_id uuid, total int, par int, r bigint)
language sql stable security definer set search_path = public, extensions as $$
  select b.month, b.player_id, b.total, b.par, rank() over (partition by b.month order by b.total - b.par)
  from (
    select distinct on (month, player_id) month, player_id, total, par
    from rounds where group_id = p_group and not exists (select 1 from players h where h.id = rounds.player_id and h.host_only)
    order by month, player_id, total - par, created_at
  ) b
$$;

-- Hosts: someone can run a club without playing in it (the admin runs several clubs and belongs to one). A
-- host-only membership is never on that club's board; their play counts at home, the same name and PIN in the club
-- they belong to.

create or replace function home_of(me players) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
declare h players;
begin
  select * into h from players p where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash and not p.host_only
    order by p.created_at limit 1;
  return coalesce(h, me);
end $$;


create or replace function player_for(p_token uuid) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
declare p players;
begin
  select * into p from players where token = p_token;
  if not found then raise exception 'Session expired. Rejoin with your invite link.'; end if;
  return p;
end $$;

create or replace function join_group(p_invite text, p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g groups; p players; inv invitations; v_code text := lower(trim(p_invite)); clean text := trim(p_name);
begin
  select * into g from groups where invite_code = v_code;
  if not found then
    select * into inv from invitations where code = v_code;
    if not found then raise exception 'That invite code is not valid.'; end if;
    select * into g from groups where id = inv.group_id;
  end if;
  if char_length(clean) not between 1 and 20 then raise exception 'Name must be 1-20 characters.'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits.'; end if;

  select * into p from players where group_id = g.id and lower(name) = lower(clean);
  if found then
    -- members sign back in with their name and PIN, whichever code they use
    if p.pin_hash <> crypt(p_pin, p.pin_hash) then
      raise exception 'That name is taken and the PIN does not match.';
    end if;
  elsif not exists (select 1 from players where group_id = g.id) then
    -- the first member of a new club runs it
    insert into players (group_id, name, pin_hash, role) values (g.id, clean, crypt(p_pin, gen_salt('bf')), 'admin') returning * into p;
  else
    if inv.id is null then raise exception 'New members need a personal invitation from the committee.'; end if;
    if inv.used_by is not null then raise exception 'That invitation has already been accepted.'; end if;
    insert into players (group_id, name, pin_hash) values (g.id, clean, crypt(p_pin, gen_salt('bf'))) returning * into p;
    update invitations set used_by = p.id, used_at = now() where id = inv.id;
  end if;

  return json_build_object('token', p.token, 'playerId', p.id, 'groupId', g.id, 'groupName', g.name);
end $$;

-- Members sign back in with just their name and PIN. Codes are only for joining.
create or replace function sign_in(p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare p players; n int; clean text := trim(p_name);
begin
  select count(*) into n from players where lower(name) = lower(clean) and pin_hash = crypt(p_pin, pin_hash);
  if n = 0 then raise exception 'No member by that name and PIN. Check both and try again.'; end if;
  if n > 1 then raise exception 'More than one member by that name. Ask the committee for help.'; end if;
  select * into p from players where lower(name) = lower(clean) and pin_hash = crypt(p_pin, pin_hash);
  return json_build_object('token', p.token, 'playerId', p.id, 'groupId', p.group_id, 'groupName', (select name from groups where id = p.group_id));
end $$;

-- Every club a name and PIN belong to: someone in more than one club (the admin, usually) can move between them.
create or replace function my_clubs(p_name text, p_pin text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare clean text := trim(p_name);
begin
  return coalesce((
    select json_agg(json_build_object('token', p.token, 'playerId', p.id, 'groupId', p.group_id, 'groupName', g.name) order by p.created_at)
    from players p join groups g on g.id = p.group_id
    where lower(p.name) = lower(clean) and p.pin_hash = crypt(p_pin, p.pin_hash)
  ), '[]');
end $$;

-- The admin starts a new club: its own members, board, champions and committee panels, invisible to every
-- other club. They join it straight away as its admin, with the same name, PIN and golfer.
create or replace function create_club(p_token uuid, p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_name); g groups; p players; v_code text;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can start a new club.'; end if;
  if char_length(clean) not between 1 and 40 then raise exception 'Club name must be 1-40 characters.'; end if;
  loop
    v_code := rand_code(10);
    exit when not exists (select 1 from groups where invite_code = v_code) and not exists (select 1 from invitations where code = v_code);
  end loop;
  insert into groups (name, invite_code) values (clean, v_code) returning * into g;
  -- the creator runs the new club; they keep playing for the club they belong to
  insert into players (group_id, name, pin_hash, avatar, role, host_only) values (g.id, me.name, me.pin_hash, me.avatar, 'admin', true) returning * into p;
  return json_build_object('token', p.token, 'playerId', p.id, 'groupId', g.id, 'groupName', g.name);
end $$;

create or replace function create_invite(p_token uuid, p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_name); v_code text; v_id text;
begin
  -- any member can put up a friend for their own club: three unused invitations at a time (the admin, as many as they like)
  if me.role <> 'admin' and (select count(*) from invitations where created_by = me.id and used_by is null) >= 3 then
    raise exception 'Three invitations at a time, I''m afraid. One must be accepted, or taken back, first.';
  end if;
  if char_length(clean) not between 1 and 20 then raise exception 'Name must be 1-20 characters.'; end if;
  loop
    v_code := invite_code();
    exit when not exists (select 1 from invitations where code = v_code) and not exists (select 1 from groups where invite_code = v_code);
  end loop;
  v_id := rand_code(10);
  insert into invitations (id, group_id, name, code, created_by) values (v_id, me.group_id, clean, v_code, me.id);
  return json_build_object('id', v_id, 'name', clean, 'code', v_code);
end $$;

create or replace function list_invites(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  -- the admin sees every invitation in the club; a member, the ones they made
  return coalesce((
    select json_agg(json_build_object('id', i.id, 'name', i.name, 'code', i.code, 'createdAt', i.created_at,
      'usedBy', (select name from players where id = i.used_by), 'usedAt', i.used_at) order by i.created_at desc)
    from invitations i where i.group_id = me.group_id and (me.role = 'admin' or i.created_by = me.id)
  ), '[]');
end $$;

-- The admin can take back any invitation nobody has used yet, a member their own; the link stops working.
create or replace function delete_invite(p_token uuid, p_id text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  delete from invitations where id = p_id and group_id = me.group_id and used_by is null and (me.role = 'admin' or created_by = me.id);
end $$;

-- What an invitation link shows: who it's for and the code under the foil. The link itself is the secret.
create or replace function peek_invite(p_id text) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('name', i.name, 'code', i.code, 'groupName', g.name, 'used', i.used_by is not null)
  from invitations i join groups g on g.id = i.group_id where i.id = p_id
$$;



create or replace function submit_feedback(p_token uuid, p_body text, p_context text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_body);
begin
  if char_length(clean) not between 1 and 2000 then raise exception 'Keep it under 2000 characters, and not empty.'; end if;
  -- a little rate limit: no more than 10 notes an hour each
  if (select count(*) from feedback where player_id = me.id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'That is plenty for one hour. The Committee will read them, eventually.';
  end if;
  insert into feedback (group_id, player_id, body, context) values (me.group_id, me.id, clean, left(nullif(trim(p_context), ''), 120));
end $$;

create or replace function list_feedback(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can read feedback.'; end if;
  return coalesce((
    select json_agg(json_build_object('id', f.id, 'from', (select name from players where id = f.player_id), 'body', f.body,
      'context', f.context, 'done', f.done, 'createdAt', f.created_at) order by f.done, f.created_at desc)
    from feedback f where f.group_id = me.group_id
  ), '[]');
end $$;

create or replace function set_feedback_done(p_token uuid, p_id bigint, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can manage feedback.'; end if;
  update feedback set done = p_done where id = p_id and group_id = me.group_id;
end $$;

create or replace function post_notice(p_token uuid, p_body text, p_as_reginald boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_body);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can post notices.'; end if;
  if char_length(clean) not between 1 and 1000 then raise exception 'Keep it under 1000 characters, and not empty.'; end if;
  insert into notices (group_id, author_id, body, as_reginald) values (me.group_id, me.id, clean, p_as_reginald);
end $$;

-- every member reads the live notices, newest first
create or replace function list_notices(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((
    select json_agg(json_build_object('id', n.id, 'body', n.body, 'asReginald', n.as_reginald,
      'author', (select name from players where id = n.author_id), 'createdAt', n.created_at) order by n.created_at desc)
    from (select * from notices where group_id = me.group_id and live order by created_at desc limit 5) n
  ), '[]');
end $$;

create or replace function take_down_notice(p_token uuid, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can take notices down.'; end if;
  update notices set live = false where id = p_id and group_id = me.group_id;
end $$;

drop function if exists submit_round(uuid, text, int[], int[], text[]);
create or replace function submit_round(p_token uuid, p_course text, p_holes int[], p_pars int[], p_feats text[], p_spots jsonb default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); n int := coalesce(array_length(p_holes, 1), 0); clean int[] := '{}'; i int; par int := 0; f text[]; sp jsonb;
begin
  if n not between 1 and 9 or n <> coalesce(array_length(p_pars, 1), 0) then raise exception 'That round is not a full card.'; end if;
  if char_length(coalesce(p_course, '')) not between 1 and 40 then raise exception 'Unknown course.'; end if;
  for i in 1..n loop
    if p_pars[i] not between 2 and 6 then raise exception 'Bad par on hole %.', i; end if;
    clean := clean || greatest(1, least(p_pars[i] + 3, p_holes[i]));
    par := par + p_pars[i];
  end loop;
  f := array(select distinct x from unnest(coalesce(p_feats, '{}')) x where x in ('ace', 'chipin', 'cartpath', 'bridge', 'terrace', 'runway', 'plank', 'amphi', 'blowhole', 'lavatube', 'rimroad', 'ledge', 'liftoff', 'tunnel', 'ashroad', 'seaarch', 'nineteenth'));
  if (select sum(x) from unnest(clean) x) < par then f := f || 'underpar'::text; end if;
  -- one spot per hole, numbers only, clamped to the map
  if jsonb_typeof(p_spots) = 'array' and jsonb_array_length(p_spots) = n then
    sp := (select jsonb_agg(case when jsonb_typeof(e->'x') = 'number' and jsonb_typeof(e->'y') = 'number'
        then jsonb_build_object('x', round(greatest(-2000, least(2000, (e->>'x')::numeric)), 1), 'y', round(greatest(-2000, least(2000, (e->>'y')::numeric)), 1))
        else 'null'::jsonb end order by k) from jsonb_array_elements(p_spots) with ordinality as t(e, k));
  end if;
  insert into rounds (player_id, group_id, month, course, holes, total, par, feats, spots)
  values (me.id, me.group_id, game_month(), p_course, clean, (select sum(x) from unnest(clean) x), par, f, sp);
end $$;

create or replace function save_avatar(p_token uuid, p_avatar jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update players set avatar = p_avatar where id = me.id;
end $$;

create or replace function get_snapshot(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); m text := game_month();
begin
  return json_build_object(
    'today', game_today(),
    'month', m,
    'groupName', (select name from groups where id = me.group_id),
    'me', me.id,
    'admin', me.role = 'admin',
    'homeGroupId', (home_of(me)).group_id,
    'homeName', (select name from groups where id = (home_of(me)).group_id),
    'players', coalesce((
      select json_agg(json_build_object(
        'id', pl.id, 'name', pl.name, 'avatar', pl.avatar, 'joined', pl.created_at, 'host', pl.host_only,
        -- a win is the lowest best round of a finished month; ties all win
        'wins', (select count(*) from month_bests(me.group_id) b where b.player_id = pl.id and b.r = 1 and b.month < m),
        'career', (select json_build_object('rounds', count(*), 'best', min(total - par), 'avg', round(avg(total - par), 1)) from rounds where player_id = pl.id),
        'feats', (select coalesce(json_agg(distinct f), '[]') from (
            select unnest(feats) f from rounds where player_id = pl.id
            union select 'champion' where exists (select 1 from month_bests(me.group_id) b where b.player_id = pl.id and b.r = 1 and b.month < m)
          ) fs)
      ) order by pl.created_at)
      -- the club's members, and you; someone who only runs the club isn't on its board
      from players pl where pl.group_id = me.group_id and (not pl.host_only or pl.id = me.id)
    ), '[]'),
    'rounds', coalesce((
      select json_agg(json_build_object('playerId', r.player_id, 'month', r.month, 'course', r.course, 'holes', r.holes,
        'total', r.total, 'par', r.par, 'feats', r.feats, 'spots', r.spots, 'createdAt', r.created_at) order by r.created_at)
      from rounds r where r.group_id = me.group_id and r.month = m
    ), '[]'),
    'champions', coalesce((
      select json_agg(c order by c.month desc) from (
        select b.month, json_agg(b.player_id) as "playerIds", min(b.total) as total, min(b.par) as par
        from month_bests(me.group_id) b where b.r = 1 and b.month < m group by b.month
      ) c
    ), '[]')
  );
end $$;

-- Practice: a session each time a member joins the range, the short game area or a practice round of the next
-- course, ended when they leave. Nothing here touches the board; the admin sees who has been practising.
create table if not exists practice_sessions (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  player_id uuid not null references players on delete cascade,
  kind text not null check (kind in ('caldera', 'range', 'shortgame')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  shots int not null default 0
);
alter table practice_sessions enable row level security;

create or replace function start_practice(p_token uuid, p_kind text) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); new_id bigint;
begin
  insert into practice_sessions (group_id, player_id, kind) values (me.group_id, me.id, p_kind) returning id into new_id;
  return new_id;
end $$;

create or replace function end_practice(p_token uuid, p_id bigint, p_shots int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token));
begin
  update practice_sessions set ended_at = now(), shots = greatest(0, least(p_shots, 5000))
  where id = p_id and player_id = me.id and ended_at is null;
end $$;

-- This month's practice, members only (the admin's own sessions are left out).
create or replace function practice_report(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); since timestamptz := (date_trunc('month', now() at time zone 'America/New_York')) at time zone 'America/New_York';
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the practice log.'; end if;
  return (
    with s as (
      select ps.*, p.name from practice_sessions ps join players p on p.id = ps.player_id
      where ps.group_id = me.group_id and p.role <> 'admin' and ps.started_at >= since
    )
    select json_build_object(
      'kinds', coalesce((select json_agg(json_build_object('kind', k.kind, 'sessions', k.n, 'members', k.m, 'minutes', k.mins)) from (
        select kind, count(*) as n, count(distinct player_id) as m,
          round(coalesce(sum(least(extract(epoch from ended_at - started_at), 10800)), 0) / 60)::int as mins
        from s group by kind) k), '[]'),
      'members', coalesce((select json_agg(json_build_object('name', x.name, 'caldera', x.c, 'range', x.r, 'shortgame', x.g, 'lastAt', x.last) order by x.last desc) from (
        select name, count(*) filter (where kind = 'caldera') as c, count(*) filter (where kind = 'range') as r,
          count(*) filter (where kind = 'shortgame') as g, max(started_at) as last
        from s group by player_id, name) x), '[]'),
      'recent', coalesce((select json_agg(json_build_object('name', r.name, 'kind', r.kind, 'startedAt', r.started_at, 'endedAt', r.ended_at, 'shots', r.shots) order by r.started_at desc) from (
        select * from s order by started_at desc limit 20) r), '[]')
    )
  );
end $$;

-- Member activity, for the admin only and kept coarse: when each member was last in, and one row per member
-- per day with counts. No screens, no timings, nothing about shots. Rows older than 90 days are cleared.
alter table players add column if not exists last_seen_at timestamptz;

create table if not exists member_days (
  player_id uuid not null references players on delete cascade,
  group_id uuid not null references groups on delete cascade,
  day date not null,
  visits int not null default 0,
  lockers int not null default 0,
  primary key (player_id, day)
);
alter table member_days enable row level security;

-- The app calls this at most once an hour per kind: 'visit' when a member opens it, 'locker' in the locker room.
create or replace function touch(p_token uuid, p_kind text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if p_kind not in ('visit', 'locker') then return; end if;
  update players set last_seen_at = now() where id = me.id;
  insert into member_days (player_id, group_id, day, visits, lockers)
  values (me.id, me.group_id, game_today(), (p_kind = 'visit')::int, (p_kind = 'locker')::int)
  on conflict (player_id, day) do update set visits = member_days.visits + excluded.visits, lockers = member_days.lockers + excluded.lockers;
  delete from member_days where player_id = me.id and day < game_today() - 90;
end $$;

-- This month, member by member (the admin left out): last in, days active, rounds, practice, locker visits.
create or replace function activity_report(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); m text := game_month();
  since timestamptz := (date_trunc('month', now() at time zone 'America/New_York')) at time zone 'America/New_York';
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see member activity.'; end if;
  return coalesce((
    select json_agg(x order by x."lastSeen" desc nulls last, x.name) from (
      select pl.name,
        greatest(pl.last_seen_at,
          (select max(created_at) from rounds where player_id = pl.id),
          (select max(started_at) from practice_sessions where player_id = pl.id)) as "lastSeen",
        (select count(*) from (
            select day from member_days where player_id = pl.id and day >= since::date
            union select (created_at at time zone 'America/New_York')::date from rounds where player_id = pl.id and month = m
            union select (started_at at time zone 'America/New_York')::date from practice_sessions where player_id = pl.id and started_at >= since
          ) d) as days,
        (select count(*) from rounds where player_id = pl.id and month = m) as rounds,
        (select count(*) from practice_sessions where player_id = pl.id and started_at >= since) as practice,
        (select coalesce(sum(lockers), 0) from member_days where player_id = pl.id and day >= since::date) as lockers
      from players pl where pl.group_id = me.group_id and pl.role <> 'admin'
    ) x
  ), '[]');
end $$;

-- The Open: one board across every club. One person is one entry, however many clubs they're in: the same
-- name with the same PIN hash (create_club copies it), shown under the club they joined first. Their best round
-- this month across all their clubs counts; lowest to par, earliest breaks a tie, as on a club board.
-- localId: their member id in the viewer's club, if they're in it (so the card can be opened); null otherwise.
create or replace function open_board(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); m text := game_month();
begin
  return coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group, p.avatar
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), r as (
      select pe.*, rd.holes, rd.total, rd.par, rd.created_at
      from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
      join rounds rd on rd.player_id = p.id and rd.month = m
    ), best as (
      select distinct on (home_id) * from r order by home_id, total - par, created_at
    ), counts as (
      select home_id, count(*) as n, max(created_at) as last from r group by home_id
    )
    select json_agg(json_build_object(
        'playerId', b.home_id, 'name', b.name, 'club', g.name,
        'mine', lower(me.name) = b.k and me.pin_hash = b.h,
        'localId', (select p2.id from players p2 where p2.group_id = me.group_id and lower(p2.name) = b.k and p2.pin_hash = b.h),
        'avatar', b.avatar, 'holes', b.holes, 'total', b.total, 'par', b.par,
        'rounds', c.n, 'last', c.last, 'createdAt', b.created_at
      ) order by b.total - b.par, b.created_at)
    from best b join counts c using (home_id) join groups g on g.id = b.home_group
  ), '[]');
end $$;

-- Past Open champions: the lowest best round of each finished month across every club. Ties share it.
create or replace function open_champions(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); m text := game_month();
begin
  return coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), best as (
      select distinct on (rd.month, pe.home_id) rd.month, pe.home_id, pe.name, g.name as club, rd.total, rd.par
      from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
      join rounds rd on rd.player_id = p.id and rd.month < m
      join groups g on g.id = pe.home_group
      order by rd.month, pe.home_id, rd.total - rd.par, rd.created_at
    ), ranked as (
      select *, rank() over (partition by month order by total - par) as rk from best
    )
    select json_agg(c order by c.month desc) from (
      select month, json_agg(name || ' · ' || club order by name) as names, min(total) as total, min(par) as par
      from ranked where rk = 1 group by month
    ) c
  ), '[]');
end $$;

-- The Clubhouse's clubs table: every club with members, how many have played this month, the best round to par
-- and who holds it. Hosts aren't members. mine: the club you belong to. Names only; nobody's card is shown.
create or replace function club_list(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); home uuid := (home_of(me)).group_id; m text := game_month();
begin
  return coalesce((
    select json_agg(c order by c.best is null, c.best, c.name) from (
      select g.id, g.name, g.id = home as mine,
        (select count(*) from players p where p.group_id = g.id and not p.host_only) as members,
        (select count(*) from month_bests(g.id) b where b.month = m) as played,
        (select min(b.total - b.par) from month_bests(g.id) b where b.month = m) as best,
        (select json_agg(p.name order by p.name) from month_bests(g.id) b join players p on p.id = b.player_id where b.month = m and b.r = 1) as leaders
      from groups g
    ) c where c.members > 0
  ), '[]');
end $$;

revoke all on function player_for(uuid) from public, anon, authenticated;
revoke all on function month_bests(uuid) from public, anon, authenticated;
grant execute on function join_group(text, text, text) to anon;
grant execute on function get_snapshot(uuid) to anon;
grant execute on function submit_round(uuid, text, int[], int[], text[], jsonb) to anon;
grant execute on function save_avatar(uuid, jsonb) to anon;
revoke all on function rand_code(int) from public, anon, authenticated;
grant execute on function create_invite(uuid, text) to anon;
grant execute on function list_invites(uuid) to anon;
grant execute on function delete_invite(uuid, text) to anon;
grant execute on function peek_invite(text) to anon;
revoke all on function invite_code() from public, anon, authenticated;
grant execute on function sign_in(text, text) to anon;
grant execute on function my_clubs(text, text) to anon;
grant execute on function create_club(uuid, text) to anon;
grant execute on function submit_feedback(uuid, text, text) to anon;
grant execute on function list_feedback(uuid) to anon;
grant execute on function set_feedback_done(uuid, bigint, boolean) to anon;
grant execute on function post_notice(uuid, text, boolean) to anon;
grant execute on function list_notices(uuid) to anon;
grant execute on function take_down_notice(uuid, bigint) to anon;
grant execute on function start_practice(uuid, text) to anon;
grant execute on function end_practice(uuid, bigint, int) to anon;
grant execute on function practice_report(uuid) to anon;
grant execute on function touch(uuid, text) to anon;
grant execute on function activity_report(uuid) to anon;
grant execute on function open_board(uuid) to anon;
grant execute on function open_champions(uuid) to anon;
grant execute on function club_list(uuid) to anon;

-- Create your group (change the name and code). The first person to join with the code runs the club;
-- after that, new members need a personal invitation from them. Share https://YOUR-SITE/#/join/<code> to start:
-- insert into groups (name, invite_code) values ('Claude Country Club', 'gentlemen');

-- The admin tab: every club you run, on one page. "You" across clubs is the same name and PIN hash with the
-- admin role in each (create_club copies them), as on the Open. p_window: 'week', 'month' or 'all'.
create or replace function admin_clubs(me players) returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select distinct p.group_id from players p
  where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash and p.role = 'admin'
$$;

create or replace function admin_overview(p_token uuid, p_window text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
  since timestamptz := case p_window
    when 'week' then now() - interval '7 days'
    when 'month' then (date_trunc('month', now() at time zone 'America/New_York')) at time zone 'America/New_York'
    else '-infinity'::timestamptz end;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return (
    with g as (select id, name from groups where id in (select admin_clubs(me))),
    m as (
      select pl.id, pl.group_id, g.name as club, pl.name, pl.created_at,
        greatest(pl.last_seen_at,
          (select max(created_at) from rounds where player_id = pl.id),
          (select max(started_at) from practice_sessions where player_id = pl.id)) as last_seen
      from players pl join g on g.id = pl.group_id where pl.role <> 'admin'
    ),
    stats as (
      select m.*,
        (select count(*) from (
            select day from member_days where player_id = m.id and day >= (since at time zone 'America/New_York')::date
            union select (created_at at time zone 'America/New_York')::date from rounds where player_id = m.id and created_at >= since
            union select (started_at at time zone 'America/New_York')::date from practice_sessions where player_id = m.id and started_at >= since
          ) d) as days,
        (select count(*) from rounds where player_id = m.id and created_at >= since) as rounds,
        (select min(total - par) from rounds where player_id = m.id and created_at >= since) as best,
        (select count(*) from practice_sessions where player_id = m.id and started_at >= since) as practice,
        (select coalesce(sum(lockers), 0) from member_days where player_id = m.id and day >= (since at time zone 'America/New_York')::date) as lockers
      from m
    ),
    feed as (
      select * from (
        select r.created_at as at, 'round' as kind, g.name as club, p.name, r.course, r.total, r.par, null::text as what, null::int as shots
          from rounds r join players p on p.id = r.player_id join g on g.id = r.group_id where p.role <> 'admin'
        union all
        select s.started_at, 'practice', g.name, p.name, null, null, null, s.kind, s.shots
          from practice_sessions s join players p on p.id = s.player_id join g on g.id = s.group_id where p.role <> 'admin'
        union all
        select p.created_at, 'join', g.name, p.name, null, null, null, null, null
          from players p join g on g.id = p.group_id where p.role <> 'admin'
        union all
        select f.created_at, 'feedback', g.name, coalesce(p.name, 'A member'), null, null, null, left(f.body, 80), null
          from feedback f join g on g.id = f.group_id left join players p on p.id = f.player_id
      ) e order by at desc limit 25
    )
    select json_build_object(
      'clubs', coalesce((select json_agg(json_build_object(
          'id', g.id, 'name', g.name,
          'members', (select count(*) from m where m.group_id = g.id),
          'active', (select count(*) from stats s where s.group_id = g.id and s.days > 0),
          'rounds', (select coalesce(sum(s.rounds), 0) from stats s where s.group_id = g.id),
          'practice', (select coalesce(sum(s.practice), 0) from stats s where s.group_id = g.id),
          'newMembers', (select count(*) from m where m.group_id = g.id and m.created_at >= since)
        ) order by g.name) from g), '[]'),
      'members', coalesce((select json_agg(json_build_object(
          'club', s.club, 'name', s.name, 'joined', s.created_at, 'lastSeen', s.last_seen, 'days', s.days,
          'rounds', s.rounds, 'best', s.best, 'practice', s.practice, 'lockers', s.lockers
        ) order by s.last_seen desc nulls last, s.name) from stats s), '[]'),
      'feed', coalesce((select json_agg(json_build_object(
          'at', e.at, 'kind', e.kind, 'club', e.club, 'name', e.name, 'course', e.course, 'total', e.total,
          'par', e.par, 'what', e.what, 'shots', e.shots
        ) order by e.at desc) from feed e), '[]'),
      'feedback', coalesce((select json_agg(json_build_object(
          'id', f.id, 'club', g.name, 'from', p.name, 'body', f.body, 'context', f.context, 'createdAt', f.created_at
        ) order by f.created_at desc) from feedback f join g on g.id = f.group_id left join players p on p.id = f.player_id
        where not f.done), '[]'),
      'invites', coalesce((select json_agg(json_build_object(
          'id', i.id, 'club', g.name, 'name', i.name, 'code', i.code, 'createdAt', i.created_at
        ) order by i.created_at desc) from invitations i join g on g.id = i.group_id where i.used_by is null), '[]')
    )
  );
end $$;

-- Clear (or reopen) a note from any club you run, without switching to it.
create or replace function admin_feedback_done(p_token uuid, p_id bigint, p_done boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can manage feedback.'; end if;
  update feedback set done = p_done where id = p_id and group_id in (select admin_clubs(me));
end $$;

revoke all on function admin_clubs(players) from public, anon, authenticated;
grant execute on function admin_overview(uuid, text) to anon;
grant execute on function admin_feedback_done(uuid, bigint, boolean) to anon;

-- The Daily Shot: one shot a day for everyone in every club, three tries, best counts. The shot itself is seeded from
-- the date in the app (src/daily.ts). One person across clubs is the same name and PIN hash, as on the Open.
create table if not exists daily_shots (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  day date not null,
  try int not null check (try between 1 and 3),
  ft numeric(7, 1) check (ft is null or ft between 0 and 9999),
  holed boolean not null default false,
  lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (player_id, day, try)
);
alter table daily_shots enable row level security;

create or replace function submit_daily(p_token uuid, p_day date, p_try int, p_ft numeric, p_holed boolean, p_lost boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); used int;
begin
  if p_day <> (now() at time zone 'America/New_York')::date then raise exception 'That''s not today''s shot.'; end if;
  if p_try not between 1 and 3 then raise exception 'Three tries a day.'; end if;
  select count(*) into used from daily_shots d join players p on p.id = d.player_id
    where d.day = p_day and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash;
  if used >= 3 then raise exception 'You''ve had your three tries today.'; end if;
  insert into daily_shots (player_id, day, try, ft, holed, lost)
    values (me.id, p_day, p_try, case when p_holed then 0 when p_lost then null else round(least(greatest(p_ft, 0), 9999), 1) end, p_holed, p_lost and not p_holed);
end $$;

create or replace function daily_state(p_token uuid, p_day date) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); streak int := 0; d date := p_day;
begin
  -- the streak: consecutive days with a try, up to today (or yesterday, if today's not played yet)
  if not exists (select 1 from daily_shots s join players p on p.id = s.player_id where s.day = d and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash) then
    d := d - 1;
  end if;
  while exists (select 1 from daily_shots s join players p on p.id = s.player_id where s.day = d and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash) loop
    streak := streak + 1;
    d := d - 1;
  end loop;
  return (
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.name, p.group_id
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), tries as (
      select pe.k, pe.h, s.* from daily_shots s join players p on p.id = s.player_id
      join people pe on pe.k = lower(p.name) and pe.h = p.pin_hash where s.day = p_day
    ), best as (
      -- one row a person: holed (and on which try), then their tries nearest first, for the tie-break
      select t.k, t.h, bool_or(t.holed) as holed, min(t.try) filter (where t.holed) as htry, count(*) as n,
        array_agg(case when t.holed then 0 when t.lost then null else t.ft end order by case when t.holed then 0 when t.lost then null else t.ft end asc nulls last) as fts,
        min(t.created_at) as first_at
      from tries t group by t.k, t.h
    )
    select json_build_object(
      'mine', coalesce((select json_agg(json_build_object('try', t.try, 'ft', t.ft, 'holed', t.holed, 'lost', t.lost) order by t.try)
        from tries t where t.k = lower(me.name) and t.h = me.pin_hash), '[]'),
      -- ranked: holed beats everything, holed sooner beats later, then nearest, then the next-best try, then the earlier player
      'board', coalesce((select json_agg(json_build_object('name', pe.name, 'club', g.name, 'ft', b.fts[1], 'holed', b.holed, 'holedTry', b.htry, 'tries', b.n,
          'mine', b.k = lower(me.name) and b.h = me.pin_hash)
        order by b.holed desc, b.htry asc nulls last, b.fts[1] asc nulls last, b.fts[2] asc nulls last, b.fts[3] asc nulls last, b.first_at)
        from best b join people pe on pe.k = b.k and pe.h = b.h join groups g on g.id = pe.group_id), '[]'),
      'players', (select count(*) from best),
      'streak', streak
    )
  );
end $$;

-- the admin: Daily Shot players and tries a day for the last week, across their clubs
create or replace function daily_admin(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); today date := (now() at time zone 'America/New_York')::date;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see this.'; end if;
  return (select json_agg(json_build_object('day', d, 'players', (
      select count(distinct (lower(p.name), p.pin_hash)) from daily_shots s join players p on p.id = s.player_id
      where s.day = d and p.group_id in (select admin_clubs(me)) and p.role <> 'admin'),
    'tries', (select count(*) from daily_shots s join players p on p.id = s.player_id
      where s.day = d and p.group_id in (select admin_clubs(me)) and p.role <> 'admin')) order by d desc)
    from generate_series(today - 6, today, interval '1 day') g(d0), lateral (select g.d0::date as d) x);
end $$;

grant execute on function submit_daily(uuid, date, int, numeric, boolean, boolean) to anon;
grant execute on function daily_state(uuid, date) to anon;
grant execute on function daily_admin(uuid) to anon;

-- The Nineteenth Hole's weekly contests: mini golf (the putting contest before it) and long drive. Every score is
-- kept; the week's best per person counts (higher is better: mini golf is kept as minus the strokes), and the week runs Monday to Sunday, Eastern. One person across clubs is the same name
-- and PIN hash, as on the Open.
create table if not exists bar_scores (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  game text not null check (game in ('putting', 'drive', 'minigolf')),
  week date not null,
  score numeric(8, 1) not null,
  created_at timestamptz not null default now()
);
alter table bar_scores enable row level security;
create index if not exists bar_scores_week on bar_scores (game, week);
alter table bar_scores drop constraint if exists bar_scores_game_check;
alter table bar_scores add constraint bar_scores_game_check check (game in ('putting', 'drive', 'minigolf'));

create or replace function submit_bar(p_token uuid, p_game text, p_score numeric) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token));
begin
  if p_game not in ('minigolf', 'drive') then raise exception 'No such game.'; end if;
  -- a long drive is 0 to 450 yd; mini golf is minus the strokes, six holes picked up at par + 3 at worst
  if (p_game = 'drive' and p_score not between 0 and 450) or (p_game = 'minigolf' and p_score not between -60 and -6) then
    raise exception 'That score doesn''t look right.';
  end if;
  insert into bar_scores (player_id, game, week, score)
    values (me.id, p_game, date_trunc('week', now() at time zone 'America/New_York')::date, p_score);
end $$;

create or replace function bar_board(p_token uuid, p_game text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); wk date := date_trunc('week', now() at time zone 'America/New_York')::date;
begin
  return (
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.name
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), best as (
      select lower(p.name) as k, p.pin_hash as h, max(b.score) as score, min(b.created_at) as first_at
      from bar_scores b join players p on p.id = b.player_id
      where b.game = p_game and b.week = wk group by lower(p.name), p.pin_hash
    )
    select json_build_object(
      'week', wk,
      'board', coalesce((select json_agg(json_build_object('name', pe.name, 'score', b.score, 'mine', b.k = lower(me.name) and b.h = me.pin_hash)
        order by b.score desc, b.first_at) from best b join people pe on pe.k = b.k and pe.h = b.h), '[]'),
      'mine', (select score from best where k = lower(me.name) and h = me.pin_hash),
      'players', (select count(*) from best)
    )
  );
end $$;

grant execute on function submit_bar(uuid, text, numeric) to anon;
grant execute on function bar_board(uuid, text) to anon;

-- Reginald's own words, written by Claude (api/reginald.ts) and kept: a line for each member's Play page each day,
-- and a note on each round's card. Only the server function (with the service role key) reads or writes them, so
-- there are no policies and nothing is granted to the app.
create table if not exists reginald_notes (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  kind text not null check (kind in ('daily', 'round', 'chronicle', 'design')),
  key text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (player_id, kind, key)
);
alter table reginald_notes enable row level security;
create index if not exists reginald_notes_recent on reginald_notes (created_at);
