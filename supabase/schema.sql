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
create or replace function month_bests(p_group uuid)
returns table (month text, player_id uuid, total int, par int, r bigint)
language sql stable security definer set search_path = public, extensions as $$
  select b.month, b.player_id, b.total, b.par, rank() over (partition by b.month order by b.total - b.par)
  from (
    select distinct on (month, player_id) month, player_id, total, par
    from rounds where group_id = p_group
    order by month, player_id, total - par, created_at
  ) b
$$;

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

create or replace function create_invite(p_token uuid, p_name text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_name); v_code text; v_id text;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can put up new members.'; end if;
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
  if me.role <> 'admin' then raise exception 'Only the committee can see invitations.'; end if;
  return coalesce((
    select json_agg(json_build_object('id', i.id, 'name', i.name, 'code', i.code, 'createdAt', i.created_at,
      'usedBy', (select name from players where id = i.used_by), 'usedAt', i.used_at) order by i.created_at desc)
    from invitations i where i.group_id = me.group_id
  ), '[]');
end $$;

-- What an invitation link shows: who it's for and the code under the foil. The link itself is the secret.
create or replace function peek_invite(p_id text) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('name', i.name, 'code', i.code, 'groupName', g.name, 'used', i.used_by is not null)
  from invitations i join groups g on g.id = i.group_id where i.id = p_id
$$;



create or replace function submit_round(p_token uuid, p_course text, p_holes int[], p_pars int[], p_feats text[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); n int := coalesce(array_length(p_holes, 1), 0); clean int[] := '{}'; i int; par int := 0; f text[];
begin
  if n not between 1 and 9 or n <> coalesce(array_length(p_pars, 1), 0) then raise exception 'That round is not a full card.'; end if;
  if char_length(coalesce(p_course, '')) not between 1 and 40 then raise exception 'Unknown course.'; end if;
  for i in 1..n loop
    if p_pars[i] not between 2 and 6 then raise exception 'Bad par on hole %.', i; end if;
    clean := clean || greatest(1, least(p_pars[i] + 3, p_holes[i]));
    par := par + p_pars[i];
  end loop;
  f := array(select distinct x from unnest(coalesce(p_feats, '{}')) x where x in ('ace', 'chipin', 'cartpath', 'bridge', 'terrace', 'runway', 'plank', 'amphi', 'nineteenth'));
  if (select sum(x) from unnest(clean) x) < par then f := f || 'underpar'::text; end if;
  insert into rounds (player_id, group_id, month, course, holes, total, par, feats)
  values (me.id, me.group_id, game_month(), p_course, clean, (select sum(x) from unnest(clean) x), par, f);
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
    'players', coalesce((
      select json_agg(json_build_object(
        'id', pl.id, 'name', pl.name, 'avatar', pl.avatar, 'joined', pl.created_at,
        -- a win is the lowest best round of a finished month; ties all win
        'wins', (select count(*) from month_bests(me.group_id) b where b.player_id = pl.id and b.r = 1 and b.month < m),
        'feats', (select coalesce(json_agg(distinct f), '[]') from (
            select unnest(feats) f from rounds where player_id = pl.id
            union select 'champion' where exists (select 1 from month_bests(me.group_id) b where b.player_id = pl.id and b.r = 1 and b.month < m)
          ) fs)
      ) order by pl.created_at)
      from players pl where pl.group_id = me.group_id
    ), '[]'),
    'rounds', coalesce((
      select json_agg(json_build_object('playerId', r.player_id, 'month', r.month, 'course', r.course, 'holes', r.holes,
        'total', r.total, 'par', r.par, 'feats', r.feats, 'createdAt', r.created_at) order by r.created_at)
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

revoke all on function player_for(uuid) from public, anon, authenticated;
revoke all on function month_bests(uuid) from public, anon, authenticated;
grant execute on function join_group(text, text, text) to anon;
grant execute on function get_snapshot(uuid) to anon;
grant execute on function submit_round(uuid, text, int[], int[], text[]) to anon;
grant execute on function save_avatar(uuid, jsonb) to anon;
revoke all on function rand_code(int) from public, anon, authenticated;
grant execute on function create_invite(uuid, text) to anon;
grant execute on function list_invites(uuid) to anon;
grant execute on function peek_invite(text) to anon;
revoke all on function invite_code() from public, anon, authenticated;
grant execute on function sign_in(text, text) to anon;

-- Create your group (change the name and code). The first person to join with the code runs the club;
-- after that, new members need a personal invitation from them. Share https://YOUR-SITE/#/join/<code> to start:
-- insert into groups (name, invite_code) values ('Claude Country Club', 'gentlemen');
