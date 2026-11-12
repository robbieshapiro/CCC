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
  month text not null check (month ~ '^\d{4}-\d{2}(-\d{2})?$'), -- the game period: see game_month()
  course text not null,
  holes int[] not null,
  total int not null,
  par int not null,
  feats text[] not null default '{}',
  created_at timestamptz not null default now()
);
-- where each tee shot came to rest, per hole ({x, y} or null), so today's players can stand on the course
alter table rounds add column if not exists spots jsonb;
-- which club's board a round counted on, when that's no longer its club: when two clubs merge, the past weeks keep the
-- boards (and so the champions and purses) they were played on. Null means the round's own club.
alter table rounds add column if not exists board_group uuid;
-- each hole's par, for the club bonuses' birdies and eagles (rounds from before Nov 4, 2026 use course_pars)
alter table rounds add column if not exists pars int[];
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

-- The game period, still called "month" in the tables: calendar months to begin with ('2026-10'), then the Caldera
-- challenge from Friday 30 October to Saturday 7 November ('2026-10-30'), then from 8 November a week at a time,
-- Sunday to Saturday, keyed by its Sunday ('2026-11-15'). Keys sort in time order either way. src/day.ts has the
-- same rule as periodOf().
create or replace function game_month() returns text
language sql stable as $$
  select case
    when game_today() >= date '2026-11-08' then to_char(game_today() - extract(dow from game_today())::int, 'YYYY-MM-DD')
    when game_today() >= date '2026-10-30' then '2026-10-30'
    else to_char(game_today(), 'YYYY-MM') end
$$;

-- older databases have the months-only check on rounds: let it take a week too
alter table rounds drop constraint if exists rounds_month_check;
alter table rounds add constraint rounds_month_check check (month ~ '^\d{4}-\d{2}(-\d{2})?$');

-- Each member's best round per month (lowest to par, earliest breaks a tie), ranked within the month.
-- (see home_of below: a host runs a club without playing in it)
alter table players add column if not exists host_only boolean not null default false;

-- Where someone's play counts: their membership in the club they belong to, not one they only run (see below)
create or replace function home_of(me players) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
declare h players;
begin
  select * into h from players p where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash and not p.host_only
    order by p.created_at limit 1;
  return coalesce(h, me);
end $$;

-- Each member's best round of each period at a club, ranked on its board. A club that took in another keeps the old
-- boards apart for the weeks before the merge (board: see rounds.board_group).
drop function if exists month_bests(uuid);
create or replace function month_bests(p_group uuid)
returns table (month text, player_id uuid, total int, par int, r bigint, board uuid)
language sql stable security definer set search_path = public, extensions as $$
  select b.month, b.player_id, b.total, b.par, rank() over (partition by b.month, b.board order by b.total - b.par), b.board
  from (
    select distinct on (month, player_id) month, player_id, total, par, coalesce(board_group, group_id) as board
    from rounds where group_id = p_group and not exists (select 1 from players h where h.id = rounds.player_id and h.host_only)
    order by month, player_id, total - par, created_at
  ) b
$$;
revoke all on function month_bests(uuid) from public, anon, authenticated;

-- The playoff: when members tie for a club's title, the Sunday after the week closes (playoff day) each plays one
-- hole, once, then one shot at the pin. Lowest score wins, then a holed shot or the nearest; a no-show forfeits; if
-- nobody plays, the title is shared. Old monthly periods had no playoffs.
create table if not exists playoff_tries (
  group_id uuid not null references groups on delete cascade,
  period text not null,
  player_id uuid not null references players on delete cascade,
  strokes int check (strokes between 1 and 12), -- null until the hole is finished (a started hole that never finishes counts as a no-show)
  shot boolean not null default false,
  ft numeric(7, 1) check (ft is null or ft between 0 and 9999),
  holed boolean not null default false,
  lost boolean not null default false,
  started_at timestamptz not null default now(),
  primary key (group_id, period, player_id)
);
alter table playoff_tries enable row level security;

-- the day a period's playoff is played: the Sunday the next week opens
create or replace function playoff_day(p_period text) returns date
language sql immutable as $$
  select case when p_period = '2026-10-30' then date '2026-11-08' when length(p_period) = 10 then p_period::date + 7 else null end
$$;

-- Each closed period's champions at a club, and how: 'won' outright, 'playoff' (being played today), 'playoff-won',
-- or 'shared' (tied, and nobody played the playoff; or a tie from the monthly days). A playoff is decided as soon as
-- everyone in it has played the hole and taken their shot at the pin, not at midnight.
create or replace function period_champs(p_group uuid)
returns table (month text, player_id uuid, total int, par int, how text)
language sql stable security definer set search_path = public, extensions as $$
  with lead as (
    select b.month, b.player_id, b.total, b.par, b.board, count(*) over (partition by b.month, b.board) as n
    from month_bests(p_group) b where b.r = 1 and b.month < game_month()
  ), t as (
    select l.*, playoff_day(l.month) as pday, pt.strokes, pt.shot, pt.ft, pt.holed, pt.lost
    from lead l left join playoff_tries pt on pt.group_id = p_group and pt.period = l.month and pt.player_id = l.player_id
  ), ranked as (
    select t.*,
      rank() over (partition by t.month, t.board order by t.strokes asc nulls last, t.holed desc, case when t.lost then null else t.ft end asc nulls last) as pr,
      bool_or(t.strokes is not null) over (partition by t.month, t.board) as anyone,
      bool_and(t.strokes is not null and coalesce(t.shot, false)) over (partition by t.month, t.board) as everyone
    from t
  ), st as (
    select ranked.*, game_today() <= pday and not everyone as going from ranked
  )
  select month, player_id, total, par,
    case when n = 1 then 'won'
      when pday is null or not anyone and game_today() > pday then 'shared'
      when going then 'playoff'
      else 'playoff-won' end
  from st
  where n = 1 or pday is null or going or not anyone or pr = 1
$$;

-- The weekly purse (src/purse.ts): each closed period's board pays its top ten like a tour event. The purse is $1,000
-- for every member with a round that period, all of it paid to the top ten (everyone, if fewer played) in the
-- proportions of a tour purse (18% to 2.725% of a full one, scaled up so the places paid share it all). Ties share the places
-- they cover; a playoff winner takes first money and the others split the places below. Play money, for the money list.
create or replace function club_payouts(p_group uuid)
returns table (month text, player_id uuid, place int, tied boolean, payout int)
language sql stable security definer set search_path = public, extensions as $$
  -- the money: everyone who played puts $1,000 in, but only members whose home club this is take it out. Someone
  -- playing here from another club keeps their place on the board and can win the title; their home club pays them.
  with e as (select mb.month, mb.board, count(*)::int as n from month_bests(p_group) mb where mb.month < game_month() group by mb.month, mb.board),
  b as (
    select mb.month, mb.player_id, mb.board, rank() over (partition by mb.month, mb.board order by mb.total - mb.par)::int as r
    from month_bests(p_group) mb join players pl on pl.id = mb.player_id
    where mb.month < game_month() and (home_of(pl)).group_id = p_group
  ),
  f as (select b.month, b.board, count(*)::int as n from b group by b.month, b.board),
  g as (select b.month, b.board, b.r, count(*)::int as k from b group by b.month, b.board, b.r),
  w as (select c.month, c.player_id from period_champs(p_group) c join b on b.month = c.month and b.player_id = c.player_id where c.how = 'playoff-won'),
  sp as (
    select b.month, b.player_id, f.n, e.n as entries,
      case when b.r = 1 and g.k > 1 and exists (select 1 from w where w.month = b.month)
        then case when exists (select 1 from w where w.month = b.month and w.player_id = b.player_id) then 1 else 2 end
        else b.r end as p0,
      case when b.r = 1 and g.k > 1 and exists (select 1 from w where w.month = b.month)
        then case when exists (select 1 from w where w.month = b.month and w.player_id = b.player_id) then 1 else g.k - 1 end
        else g.k end as kk
    from b join f on f.month = b.month and f.board = b.board join g on g.month = b.month and g.board = b.board and g.r = b.r
      join e on e.month = b.month and e.board = b.board
  )
  select sp.month, sp.player_id, sp.p0, sp.kk > 1,
    round(sp.entries * 1000 * coalesce((
      select sum((array[0.18, 0.109, 0.069, 0.049, 0.041, 0.03625, 0.03375, 0.03125, 0.02925, 0.02725]::numeric[])[i])
      from generate_series(sp.p0, least(10, sp.p0 + sp.kk - 1)) i
    ), 0) / (
      select sum((array[0.18, 0.109, 0.069, 0.049, 0.041, 0.03625, 0.03375, 0.03125, 0.02925, 0.02725]::numeric[])[i])
      from generate_series(1, least(10, sp.n)) i
    ) / sp.kk)::int
  from sp
$$;
revoke all on function club_payouts(uuid) from public, anon, authenticated;

-- The Open purse, from the week of Sun Nov 8 (src/purse.ts): one purse across every club. Each person's best round of the
-- week, however many clubs they play in, on one board; $250 in for each of them (at least $10,000 a week) and the top ten paid as above. Ties
-- share; the Open has no playoff. Each person is paid once, on their home seat (the club the Open lists them under).
create or replace function open_purse_from() returns text language sql immutable as $$ select '2026-11-08' $$;
-- what each player puts into the Open purse (src/purse.ts OPEN_PER_PLAYER): $250, so the winner of a 25-player week
-- takes about $1,900 and the shop stays a chase as the club grows
create or replace function open_per_player() returns int language sql immutable as $$ select 250 $$;
-- the least the Open purse is worth in a week anyone plays (src/purse.ts OPEN_FLOOR): $10,000, so a quiet week of 15
-- still pays the winner about $3,000; past 40 players the $250 a head takes over
create or replace function open_purse_floor() returns int language sql immutable as $$ select 10000 $$;
create or replace function open_payouts()
returns table (month text, player_id uuid, place int, tied boolean, payout int)
language sql stable security definer set search_path = public, extensions as $$
  with people as (
    select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id
    from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
  ), best as (
    select distinct on (rd.month, pe.home_id) rd.month, pe.home_id, rd.total - rd.par as tp
    from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
    join rounds rd on rd.player_id = p.id
    where rd.month >= open_purse_from() and rd.month < game_month()
    order by rd.month, pe.home_id, rd.total - rd.par, rd.created_at
  ), b as (select best.month, best.home_id, rank() over (partition by best.month order by best.tp)::int as r from best),
  f as (select b.month, count(*)::int as n from b group by b.month),
  g as (select b.month, b.r, count(*)::int as k from b group by b.month, b.r),
  sh as (select array[0.18, 0.109, 0.069, 0.049, 0.041, 0.03625, 0.03375, 0.03125, 0.02925, 0.02725]::numeric[] as a)
  select b.month, b.home_id, b.r, g.k > 1,
    round(greatest(f.n * open_per_player(), open_purse_floor()) * coalesce((select sum(sh.a[i]) from generate_series(b.r, least(10, b.r + g.k - 1)) i), 0)
      / (select sum(sh.a[i]) from generate_series(1, least(10, f.n)) i) / g.k)::int
  from b join f on f.month = b.month join g on g.month = b.month and g.r = b.r cross join sh
$$;
revoke all on function open_payouts() from public, anon, authenticated;

-- What a club's members were paid each closed period: the club's own purse up to the Caldera challenge, then their share
-- of the Open purse (each person once, at their home club)
create or replace function period_payouts(p_group uuid)
returns table (month text, player_id uuid, place int, tied boolean, payout int)
language sql stable security definer set search_path = public, extensions as $$
  select * from club_payouts(p_group) c where c.month < open_purse_from()
  union all
  select o.* from open_payouts() o join players pl on pl.id = o.player_id where pl.group_id = p_group
$$;
revoke all on function period_payouts(uuid) from public, anon, authenticated;

-- The playoff open at your club today, if any: who's in it, and how each has done so far
create or replace function playoff_state(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); per text;
begin
  select c.month into per from period_champs(me.group_id) c where c.how = 'playoff' order by c.month desc limit 1;
  if per is null then return null; end if;
  return json_build_object(
    'period', per,
    'mine', exists (select 1 from period_champs(me.group_id) c where c.month = per and c.player_id = me.id),
    'players', (select json_agg(json_build_object('id', p.id, 'name', p.name, 'started', pt.player_id is not null, 'strokes', pt.strokes,
        'shot', pt.shot, 'ft', pt.ft, 'holed', pt.holed, 'lost', pt.lost) order by p.name)
      from period_champs(me.group_id) c join players p on p.id = c.player_id
      left join playoff_tries pt on pt.group_id = me.group_id and pt.period = per and pt.player_id = c.player_id
      where c.month = per)
  );
end $$;

-- Your one go: start the hole (once), post its score (once), then post your shot at the pin (once)
create or replace function playoff_start(p_token uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); per text;
begin
  select c.month into per from period_champs(me.group_id) c where c.how = 'playoff' and c.player_id = me.id order by c.month desc limit 1;
  if per is null then raise exception 'There''s no playoff for you today.'; end if;
  insert into playoff_tries (group_id, period, player_id) values (me.group_id, per, me.id);
exception when unique_violation then
  raise exception 'You''ve had your go at the playoff.';
end $$;

create or replace function playoff_finish(p_token uuid, p_strokes int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update playoff_tries set strokes = greatest(1, least(12, p_strokes))
  where group_id = me.group_id and player_id = me.id and strokes is null and playoff_day(period) = game_today();
end $$;

create or replace function playoff_shot(p_token uuid, p_ft numeric, p_holed boolean, p_lost boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update playoff_tries set shot = true, holed = p_holed,
    lost = p_lost and not p_holed,
    ft = case when p_holed then 0 when p_lost then null else round(least(greatest(p_ft, 0), 9999), 1) end
  where group_id = me.group_id and player_id = me.id and strokes is not null and not shot and playoff_day(period) = game_today();
end $$;

grant execute on function playoff_state(uuid) to anon;
grant execute on function playoff_start(uuid) to anon;
grant execute on function playoff_finish(uuid, int) to anon;
grant execute on function playoff_shot(uuid, numeric, boolean, boolean) to anon;
revoke all on function period_champs(uuid) from public, anon, authenticated;

-- Hosts: someone can run a club without playing in it (the admin runs several clubs and belongs to one). A
-- host-only membership is never on that club's board; their play counts at home, the same name and PIN in the club
-- they belong to.


-- One golfer, however many clubs: their seats are the players with the same name and PIN. Looks, the Pro Shop and the
-- money list follow the person, not the club.
create or replace function person_seats(p players) returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select s.id from players s where lower(s.name) = lower(p.name) and s.pin_hash = p.pin_hash
$$;

-- What the purses of a person's other clubs paid them (their home club's purse, when this seat is an away one)
create or replace function person_away_earned(p players) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object('earned', coalesce(sum(pp.payout), 0), 'top10s', count(*) filter (where pp.payout > 0))
  from (select distinct s.group_id from players s where s.id in (select person_seats(p)) and s.group_id <> p.group_id) g
  cross join lateral period_payouts(g.group_id) pp
  where pp.player_id in (select person_seats(p))
$$;

-- Where a round (and Pro Shop spending) counts: the seat you're playing from, if it's a playing seat; from a club you
-- only host, your home club. Someone with playing seats in two clubs plays for whichever club they're in. (The Daily
-- Shot, practice and the bar always count at home: see home_of.)
create or replace function play_seat(me players) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not me.host_only then return me; end if;
  return home_of(me);
end $$;


create or replace function player_for(p_token uuid) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
declare p players;
begin
  select * into p from players where token = p_token;
  if not found then raise exception 'Session expired. Rejoin with your invite link.'; end if;
  return p;
end $$;

-- An old club's code, kept working after it merged into another club: it signs people up to the club it joined
create table if not exists group_aliases (
  code text primary key,
  group_id uuid not null references groups on delete cascade
);
alter table group_aliases enable row level security;

-- Wrong PINs: five in a row locks that name for 15 minutes, and each further five doubles it, up to a day.
-- The right PIN doesn't get through a lock. A failure has to be recorded in a call that returns normally,
-- because raising an exception rolls the record back.
create table if not exists pin_failures (
  name_key text primary key,
  fails integer not null default 0,
  locked_until timestamptz
);
alter table pin_failures enable row level security;

create or replace function pin_gate(p_key text) returns void
language plpgsql set search_path = public, extensions as $$
begin
  if exists (select 1 from pin_failures where name_key = p_key and locked_until > now()) then
    raise exception 'Too many wrong PINs for that name. Try again a little later.';
  end if;
end $$;

create or replace function pin_failed(p_key text) returns void
language plpgsql set search_path = public, extensions as $$
begin
  if not exists (select 1 from players where lower(name) = p_key) then return; end if;
  insert into pin_failures (name_key, fails) values (p_key, 1)
  on conflict (name_key) do update set fails = pin_failures.fails + 1;
  update pin_failures
    set locked_until = now() + least(interval '24 hours', interval '15 minutes' * power(2, fails / 5 - 1))
    where name_key = p_key and fails % 5 = 0;
end $$;

create or replace function pin_passed(p_key text) returns void
language plpgsql set search_path = public, extensions as $$
begin
  delete from pin_failures where name_key = p_key;
end $$;

revoke all on function pin_gate(text) from public, anon, authenticated;
revoke all on function pin_failed(text) from public, anon, authenticated;
revoke all on function pin_passed(text) from public, anon, authenticated;

create or replace function join_group(p_invite text, p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare g groups; p players; inv invitations; v_code text := lower(trim(p_invite)); clean text := trim(p_name);
begin
  select * into g from groups where invite_code = v_code;
  if not found then
    select gr.* into g from group_aliases a join groups gr on gr.id = a.group_id where a.code = v_code;
  end if;
  if g.id is null then
    select * into inv from invitations where code = v_code;
    if not found then raise exception 'That invite code is not valid.'; end if;
    select * into g from groups where id = inv.group_id;
  end if;
  if char_length(clean) not between 1 and 20 then raise exception 'Name must be 1-20 characters.'; end if;
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits.'; end if;

  select * into p from players where group_id = g.id and lower(name) = lower(clean);
  if found then
    -- members sign back in with their name and PIN, whichever code they use
    perform pin_gate(lower(clean));
    if p.pin_hash <> crypt(p_pin, p.pin_hash) then
      perform pin_failed(lower(clean));
      return json_build_object('error', 'That name is taken and the PIN does not match.');
    end if;
    perform pin_passed(lower(clean));
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

-- The old one-club sign-in had no lockout. my_clubs does the job now.
drop function if exists sign_in(text, text);

-- Every club a name and PIN belong to: someone in more than one club (the admin, usually) can move between them.
create or replace function my_clubs(p_name text, p_pin text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare clean text := trim(p_name); found json;
begin
  perform pin_gate(lower(clean));
  select json_agg(json_build_object('token', p.token, 'playerId', p.id, 'groupId', p.group_id, 'groupName', g.name) order by p.created_at)
    into found
    from players p join groups g on g.id = p.group_id
    where lower(p.name) = lower(clean) and p.pin_hash = crypt(p_pin, p.pin_hash);
  if found is null then
    perform pin_failed(lower(clean));
    return '[]'::json;
  end if;
  perform pin_passed(lower(clean));
  return found;
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

-- Every hole's secret route, by the zone a ball passes through to find it (each hole's secret.zone in
-- src/golf3d/holes): recorded on the card, and worth $150 the first time a member finds each one (person_bonus)
create or replace function secret_feats() returns text[] language sql immutable as $$
  select array['cartpath', 'bridge', 'terrace', 'runway', 'plank', 'amphi', 'blowhole', 'lavatube', 'rimroad', 'ledge', 'liftoff', 'tunnel', 'ashroad', 'seaarch',
    'backbank', 'kick', 'ridge', 'sealionrock', 'shelf', 'spillway', 'walk',
    -- the Windy City
    'breakwater', 'plaza', 'lowerwacker', 'gangway', 'boardwalk']
$$;

-- Daily cards, from the week of Sun Nov 8: one round a day counts, the day's card. It locks at the first swing; if it's
-- cut short (the app closes, a call comes in) it picks up where it left off, the same day. Practice rounds of the
-- week's course are unlimited and never posted here (they're practice sessions). Before Nov 8, every round counts.
create or replace function cards_on() returns boolean
language sql stable as $$ select game_month() >= '2026-11-08' $$;
alter table rounds add column if not exists card boolean not null default false;
drop function if exists submit_round(uuid, text, int[], int[], text[]);
drop function if exists submit_round(uuid, text, int[], int[], text[], jsonb);
drop function if exists submit_round(uuid, text, int[], int[], text[], jsonb, boolean);
-- p_shots: every counted stroke (see RoundShot in src/api/types.ts), for the Committee's hole report and tuning the
-- hole checks. Kept as it comes, within limits: an array of at most 150 shots and 24 KB.
alter table rounds add column if not exists shots jsonb;
create or replace function submit_round(p_token uuid, p_course text, p_holes int[], p_pars int[], p_feats text[], p_spots jsonb default null, p_card boolean default false, p_shots jsonb default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := play_seat(player_for(p_token)); n int := coalesce(array_length(p_holes, 1), 0); clean int[] := '{}'; i int; par int := 0; f text[]; sp jsonb;
begin
  if cards_on() and card_in(me) then raise exception 'Both of today''s cards are in. Practise as much as you like.'; end if;
  -- from the daily cards, a round only counts as the card started today on that course: a round begun before midnight
  -- (last week's course, or yesterday's card) can't land on the new day's board or use up its card
  if cards_on() and (card_of(me)).player_id <> me.id then raise exception 'Today''s card is going at another club. Finish it there.'; end if;
  if cards_on() and coalesce((card_of(me)).course, '') <> left(coalesce(p_course, ''), 40) then
    raise exception 'That round started before midnight, so it can''t count now. Today''s card is waiting.';
  end if;
  if n not between 1 and 9 or n <> coalesce(array_length(p_pars, 1), 0) then raise exception 'That round is not a full card.'; end if;
  if char_length(coalesce(p_course, '')) not between 1 and 40 then raise exception 'Unknown course.'; end if;
  for i in 1..n loop
    if p_pars[i] not between 2 and 6 then raise exception 'Bad par on hole %.', i; end if;
    clean := clean || greatest(1, least(p_pars[i] + 3, p_holes[i]));
    par := par + p_pars[i];
  end loop;
  f := array(select distinct x from unnest(coalesce(p_feats, '{}')) x where x = any (array['ace', 'chipin', 'nineteenth'] || secret_feats()));
  if (select sum(x) from unnest(clean) x) < par then f := f || 'underpar'::text; end if;
  -- one spot per hole, numbers only, clamped to the map
  if jsonb_typeof(p_spots) = 'array' and jsonb_array_length(p_spots) = n then
    sp := (select jsonb_agg(case when jsonb_typeof(e->'x') = 'number' and jsonb_typeof(e->'y') = 'number'
        then jsonb_build_object('x', round(greatest(-2000, least(2000, (e->>'x')::numeric)), 1), 'y', round(greatest(-2000, least(2000, (e->>'y')::numeric)), 1))
        else 'null'::jsonb end order by k) from jsonb_array_elements(p_spots) with ordinality as t(e, k));
  end if;
  insert into rounds (player_id, group_id, month, course, holes, total, par, feats, spots, pars, card, shots)
  values (me.id, me.group_id, game_month(), p_course, clean, (select sum(x) from unnest(clean) x), par, f, sp, p_pars, cards_on(),
    case when jsonb_typeof(p_shots) = 'array' and jsonb_array_length(p_shots) <= 150 and pg_column_size(p_shots) < 24000 then p_shots end);
  if cards_on() then
    update round_starts set finished = true, finished_at = now(), hole = n, scores = clean, shots = 0 where id = (card_of(me)).id;
  end if;
end $$;

create or replace function save_avatar(p_token uuid, p_avatar jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  -- your look is the same in every club you belong to
  update players set avatar = p_avatar where id in (select person_seats(me));
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
        -- a win is the lowest best round of a finished period (ties share it, unless a playoff settles it; one being
        -- played today doesn't count yet)
        'wins', (select count(*) from period_champs(me.group_id) c where c.player_id = pl.id and c.how <> 'playoff'),
        'career', (select json_build_object('rounds', count(*), 'best', min(total - par), 'avg', round(avg(total - par), 1)) from rounds where player_id = pl.id),
        -- the money list: everything won from the weekly purses, and how many top tens
        -- the money list and the Pro Shop follow the person across their clubs
        'earnings', coalesce(pay.earned, 0) + (person_away_earned(pl)->>'earned')::int,
        'top10s', coalesce(pay.top10s, 0) + (person_away_earned(pl)->>'top10s')::int,
        'spent', person_spent(pl),
        'owned', (select coalesce(json_agg(distinct item), '[]') from purchases where player_id in (select person_seats(pl))),
        -- the side money (club bonuses): counts toward career earnings and rank, not the board's purse column
        'bonus', person_bonus(pl),
        -- playing here from another club: on the board and in for the title, but paid at home
        'away', (home_of(pl)).group_id <> pl.group_id,
        -- runs the clubs: shown as the Committee, never as a guest (display only; away still decides the purse)
        'committee', exists (select 1 from players s where s.id in (select person_seats(pl)) and s.role = 'admin'),
        'feats', (select coalesce(json_agg(distinct f), '[]') from (
            select unnest(feats) f from rounds where player_id = pl.id
            union select 'champion' where exists (select 1 from period_champs(me.group_id) c where c.player_id = pl.id and c.how <> 'playoff')
          ) fs)
      ) order by pl.created_at)
      -- the club's members, and you; someone who only runs the club isn't on its board
      from players pl
      left join (select pp.player_id, sum(pp.payout)::int as earned, count(*) filter (where pp.payout > 0)::int as top10s
        from period_payouts(me.group_id) pp group by pp.player_id) pay on pay.player_id = pl.id
      where pl.group_id = me.group_id and (not pl.host_only or pl.id = me.id)
    ), '[]'),
    -- what the last closed period paid out: the club's purse, or from Nov 8 the whole Open's (with names, since most
    -- of the field is in other clubs)
    'payouts', coalesce((
      with last as (select max(x.month) as m from (select pp.month from period_payouts(me.group_id) pp union all select o.month from open_payouts() o) x),
      src as (
        select pp.month, pp.player_id, pp.place, pp.tied, pp.payout, pl.name, pl.id = me.id as mine
          from period_payouts(me.group_id) pp join players pl on pl.id = pp.player_id, last where pp.month = last.m and last.m < open_purse_from()
        union all
        select o.month, o.player_id, o.place, o.tied, o.payout, pl.name, lower(pl.name) = lower(me.name) and pl.pin_hash = me.pin_hash
          from open_payouts() o join players pl on pl.id = o.player_id, last where o.month = last.m
      )
      select json_agg(json_build_object('month', month, 'playerId', player_id, 'place', place, 'tied', tied, 'payout', payout, 'name', name, 'mine', mine) order by place, name)
      from src where payout > 0
    ), '[]'),
    'rounds', coalesce((
      select json_agg(json_build_object('playerId', r.player_id, 'month', r.month, 'course', r.course, 'holes', r.holes,
        'total', r.total, 'par', r.par, 'feats', r.feats, 'spots', r.spots, 'createdAt', r.created_at) order by r.created_at)
      from rounds r where r.group_id = me.group_id and r.month = m
    ), '[]'),
    'champions', coalesce((
      select json_agg(c order by c.month desc) from (
        select c.month, json_agg(c.player_id) as "playerIds", min(c.total) as total, min(c.par) as par, min(c.how) as how
        from period_champs(me.group_id) c group by c.month
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
-- 'course': a practice round of the week's course, once daily cards start
alter table practice_sessions drop constraint if exists practice_sessions_kind_check;
alter table practice_sessions add constraint practice_sessions_kind_check check (kind in ('caldera', 'range', 'shortgame', 'course'));

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
      'members', coalesce((select json_agg(json_build_object('name', x.name, 'caldera', x.c, 'range', x.r, 'shortgame', x.g, 'course', x.k, 'lastAt', x.last) order by x.last desc) from (
        select name, count(*) filter (where kind = 'caldera') as c, count(*) filter (where kind = 'range') as r,
          count(*) filter (where kind = 'shortgame') as g, count(*) filter (where kind = 'course') as k, max(started_at) as last
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
declare me players := player_for(p_token);
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
            union select (created_at at time zone 'America/New_York')::date from rounds where player_id = pl.id and created_at >= since
            union select (started_at at time zone 'America/New_York')::date from practice_sessions where player_id = pl.id and started_at >= since
          ) d) as days,
        (select count(*) from rounds where player_id = pl.id and created_at >= since) as rounds,
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
-- How a person's club is shown to members: their home club's name, or 'Committee' for whoever runs the clubs (an
-- admin seat anywhere). Display only: where they play, and what counts and pays, is unchanged.
create or replace function club_label(p_k text, p_h text, p_group uuid) returns text
language sql stable security definer set search_path = public, extensions as $$
  select case when exists (select 1 from players s where lower(s.name) = p_k and s.pin_hash = p_h and s.role = 'admin') then 'Committee'
    else (select name from groups where id = p_group) end
$$;
revoke all on function club_label(text, text, uuid) from public, anon, authenticated;

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
        'playerId', b.home_id, 'name', b.name, 'club', club_label(b.k, b.h, b.home_group),
        'mine', lower(me.name) = b.k and me.pin_hash = b.h,
        'localId', (select p2.id from players p2 where p2.group_id = me.group_id and lower(p2.name) = b.k and p2.pin_hash = b.h),
        'avatar', b.avatar, 'holes', b.holes, 'total', b.total, 'par', b.par,
        'rounds', c.n, 'last', c.last, 'createdAt', b.created_at
      ) order by b.total - b.par, b.created_at)
    from best b join counts c using (home_id) join groups g on g.id = b.home_group
  ), '[]');
end $$;

-- Today's field on a course: everyone who played it today, in every club, each person once: the card they're out on
-- now if there is one, otherwise their better card in today. best: their better card in today (also while they're out on
-- their second), cards: how many of today's cards they've posted. Up to 30, your own club's first. For the golfers out on the course in a
-- round (which leaves you out: mine) and home's "On the course now" and "Today's cards". playerId: the person, as the
-- Open names them; localId: their seat in your club, if they have one (kudos and chirps stay within a club); at: when
-- the card went in, or when it was started.
create or replace function course_field(p_token uuid, p_course text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); t0 timestamptz := game_today()::timestamp at time zone 'America/New_York';
begin
  return coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group, p.avatar
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), done as (
      select distinct on (pe.home_id) pe.home_id, rd.holes, rd.spots, false as going, rd.created_at as at
      from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
      join rounds rd on rd.player_id = p.id and rd.course = p_course and rd.created_at >= t0
      where jsonb_typeof(rd.spots) = 'array'
      order by pe.home_id, rd.total - rd.par, rd.created_at
    ), going as (
      -- anyone who opened today's card and hasn't posted it counts as out on the course, from the moment they open it
      select distinct on (pe.home_id) pe.home_id, coalesce(rs.scores, '{}') as holes,
        case when jsonb_typeof(rs.spots) = 'array' then rs.spots else '[]'::jsonb end as spots, true as going, rs.started_at as at
      from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
      join round_starts rs on rs.player_id = p.id and rs.card and not rs.finished and rs.course = p_course and rs.started_at >= t0
      order by pe.home_id, rs.started_at desc
    ), field as (
      select * from going union all select * from done d where not exists (select 1 from going g where g.home_id = d.home_id)
    ), rows as (
      select pe.home_id, pe.name, club_label(pe.k, pe.h, pe.home_group) as club, pe.avatar, f.holes, f.spots, f.going, f.at,
        (select d.holes from done d where d.home_id = f.home_id) as best_holes, (select d.at from done d where d.home_id = f.home_id) as best_at,
        (select count(*) from players p join rounds rd on rd.player_id = p.id and rd.course = p_course and rd.created_at >= t0
          where lower(p.name) = pe.k and p.pin_hash = pe.h)::int as cards,
        (select p2.id from players p2 where p2.group_id = me.group_id and lower(p2.name) = pe.k and p2.pin_hash = pe.h and not p2.host_only) as local_id,
        lower(me.name) = pe.k and me.pin_hash = pe.h as mine
      from field f join people pe on pe.home_id = f.home_id join groups gr on gr.id = pe.home_group
    )
    select json_agg(json_build_object('playerId', r.home_id, 'name', r.name, 'club', r.club, 'avatar', r.avatar, 'holes', r.holes,
        'spots', r.spots, 'going', r.going, 'at', r.at, 'mine', r.mine, 'localId', r.local_id,
        'best', r.best_holes, 'bestAt', r.best_at, 'cards', r.cards) order by r.local_id is null, r.at desc)
    from (select * from rows order by local_id is null, at desc limit 30) r
  ), '[]');
end $$;
grant execute on function course_field(uuid, text) to anon;

-- Who practised the week's course today, every club, each person once (newest first): a quiet line under today's cards
-- on home. A practice round counts once it has a shot in it, or while it's still going.
create or replace function course_practice(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); t0 timestamptz := game_today()::timestamp at time zone 'America/New_York';
begin
  return coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), went as (
      select pe.home_id, max(ps.started_at) as at
      from practice_sessions ps join players p on p.id = ps.player_id join people pe on lower(p.name) = pe.k and p.pin_hash = pe.h
      where ps.kind = 'course' and ps.started_at >= t0 and (ps.shots > 0 or ps.ended_at is null)
      group by pe.home_id
    )
    select json_agg(json_build_object('playerId', w.home_id, 'name', pe.name, 'club', club_label(pe.k, pe.h, pe.home_group), 'mine', lower(me.name) = pe.k and me.pin_hash = pe.h) order by w.at desc)
    from (select * from went order by at desc limit 40) w join people pe on pe.home_id = w.home_id join groups g on g.id = pe.home_group
  ), '[]');
end $$;
grant execute on function course_practice(uuid) to anon;

-- Classic courses: the courses of weeks gone by (the Highlands, the Caldera) stay open to play any time, for the course
-- record. A free round never counts toward the Open, a title, the purse or a bonus; it's kept here for the records.
create table if not exists free_rounds (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  course text not null,
  holes int[] not null,
  total int not null,
  par int not null,
  created_at timestamptz not null default now()
);
alter table free_rounds enable row level security;
create index if not exists free_rounds_course on free_rounds (course);

create or replace function submit_free_round(p_token uuid, p_course text, p_holes int[], p_pars int[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); n int := coalesce(array_length(p_holes, 1), 0); clean int[] := '{}'; i int; par int := 0;
begin
  if me.id is null then raise exception 'Not a member.'; end if;
  if n not between 1 and 9 or n <> coalesce(array_length(p_pars, 1), 0) then raise exception 'That round is not a full card.'; end if;
  if char_length(coalesce(p_course, '')) not between 1 and 40 then raise exception 'Unknown course.'; end if;
  -- a fair cap: twenty free rounds a day each
  if (select count(*) from free_rounds where player_id = me.id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'That''s plenty of rounds for one day.';
  end if;
  for i in 1..n loop
    if p_pars[i] not between 2 and 6 then raise exception 'Bad par on hole %.', i; end if;
    clean := clean || greatest(1, least(p_pars[i] + 3, p_holes[i]));
    par := par + p_pars[i];
  end loop;
  insert into free_rounds (player_id, course, holes, total, par) values (me.id, left(p_course, 40), clean, (select sum(x) from unnest(clean) x), par);
end $$;
grant execute on function submit_free_round(uuid, text, int[], int[]) to anon;

-- Each course's record, every club and every round ever played on it (its own week's rounds and free play since), each
-- person once: the record to par, who holds it (the earliest to reach it first), your own best, how many rounds, and
-- the champions of the week it was played (each club's, and the Open's).
create or replace function course_records(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), seat as (
      select p.id, pe.home_id from players p join people pe on lower(p.name) = pe.k and p.pin_hash = pe.h
    ), played as (
      select r.course, s.home_id, r.total, r.par, r.created_at from rounds r join seat s on s.id = r.player_id
        where not exists (select 1 from players h where h.id = r.player_id and h.host_only)
      union all
      select f.course, s.home_id, f.total, f.par, f.created_at from free_rounds f join seat s on s.id = f.player_id
    ), best as (
      select distinct on (course, home_id) course, home_id, total - par as tp, total, created_at from played order by course, home_id, total - par, created_at
    ), rec as (
      select course, min(tp) as tp from best group by course
    ), periods as (
      select distinct course, month from rounds
    ), champs as (
      select pr.course, p.name, club_label(lower(p.name), p.pin_hash, gr.id) as club, c.total - c.par as tp
      from groups gr cross join lateral period_champs(gr.id) c join periods pr on pr.month = c.month join players p on p.id = c.player_id
      where c.how <> 'playoff'
    )
    select json_agg(json_build_object(
      'course', rc.course,
      'toPar', rc.tp,
      'holders', (select json_agg(json_build_object('name', pe.name, 'club', club_label(pe.k, pe.h, pe.home_group)) order by b.created_at)
        from best b join people pe on pe.home_id = b.home_id join groups g on g.id = pe.home_group where b.course = rc.course and b.tp = rc.tp),
      'mine', (select b.tp from best b join people pe on pe.home_id = b.home_id where b.course = rc.course and pe.k = lower(me.name) and pe.h = me.pin_hash),
      'rounds', (select count(*) from played pl where pl.course = rc.course),
      'champions', (select coalesce(json_agg(json_build_object('name', ch.name, 'club', ch.club, 'toPar', ch.tp) order by ch.tp, ch.club), '[]') from champs ch where ch.course = rc.course)
    ))
    from rec rc
  ), '[]');
end $$;
grant execute on function course_records(uuid) to anon;

-- Season points, FedEx Cup style: every week's Open finish earns points (src/season.ts SEASON_POINTS, the same scale), ties
-- sharing the places they cover, from the first Open (open_purse_from) through the calendar year. Each person once, at
-- their home club. Closed weeks are banked; this week's place shows as projected points until it closes.
create or replace function season_points(p_place int) returns numeric language sql immutable as $$
  select coalesce((array[500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25]::numeric[])[p_place], 20)
$$;

-- The season counts every course from the Highlands (October 2026) and the Caldera challenge on, each ranked
-- across every club as the Open is, though the Open itself only began on Nov 8
create or replace function season_from() returns text language sql immutable as $$ select '2026-10' $$;

create or replace function season_standings(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); yr text := left(game_month(), 4);
begin
  return json_build_object('year', yr::int, 'standings', coalesce((
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.id as home_id, p.name, p.group_id as home_group
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), best as (
      select distinct on (rd.month, pe.home_id) rd.month, pe.home_id, rd.total - rd.par as tp
      from people pe join players p on lower(p.name) = pe.k and p.pin_hash = pe.h
      join rounds rd on rd.player_id = p.id
      where rd.month >= season_from() and left(rd.month, 4) = yr and not p.host_only
      order by rd.month, pe.home_id, rd.total - rd.par, rd.created_at
    ), ranked as (
      select b.*, rank() over (partition by b.month order by b.tp)::int as r, count(*) over (partition by b.month, b.tp)::int as k from best b
    ), pts as (
      select r.*, (select avg(season_points(i)) from generate_series(r.r, r.r + r.k - 1) i) as pts, r.month < game_month() as banked from ranked r
    ), tot as (
      select home_id,
        round(sum(pts) filter (where banked))::int as points,
        round(sum(pts) filter (where not banked))::int as projected,
        count(*) filter (where banked)::int as events,
        count(*) filter (where banked and r = 1)::int as wins,
        count(*) filter (where banked and r <= 10)::int as top10s,
        min(r) filter (where banked) as best
      from pts group by home_id
    ), pay as (
      -- career earnings, as on the member card: every purse that paid any of the person's seats, and their club bonuses
      select pe.home_id, sum(pp.payout)::int as earned
      from groups g cross join lateral period_payouts(g.id) pp join players s on s.id = pp.player_id
      join people pe on lower(s.name) = pe.k and s.pin_hash = pe.h group by pe.home_id
    )
    select json_agg(json_build_object('playerId', t.home_id, 'name', pe.name, 'club', club_label(pe.k, pe.h, pe.home_group), 'mine', pe.k = lower(me.name) and pe.h = me.pin_hash,
        'points', coalesce(t.points, 0), 'projected', coalesce(t.projected, 0), 'events', t.events, 'wins', t.wins, 'top10s', t.top10s, 'best', t.best,
        'earnings', coalesce(pay.earned, 0) + (person_bonus(hp)->>'total')::int)
      -- standings are banked points only; this week's place shows as projected but doesn't move anyone yet
      order by coalesce(t.points, 0) desc, coalesce(t.projected, 0) desc, pe.name)
    from tot t join people pe on pe.home_id = t.home_id join groups g on g.id = pe.home_group join players hp on hp.id = t.home_id
      left join pay on pay.home_id = t.home_id
  ), '[]'));
end $$;
grant execute on function season_standings(uuid) to anon;

-- One golfer's card, from any club (tap a name on the Season standings): who they are, their home club and look, their
-- Open weeks this season (place, to par, points), career rounds, titles, earnings and feats, across all their seats.
create or replace function golfer_card(p_token uuid, p_player uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); p players; yr text := left(game_month(), 4);
begin
  select * into p from players where id = p_player;
  if not found then return null; end if;
  p := home_of(p);
  return (
    with seats as (select s.* from players s where lower(s.name) = lower(p.name) and s.pin_hash = p.pin_hash),
    people as (
      select distinct on (lower(x.name), x.pin_hash) lower(x.name) as k, x.pin_hash as h, x.id as home_id
      from players x order by lower(x.name), x.pin_hash, x.host_only, x.created_at
    ), best as (
      select distinct on (rd.month, pe.home_id) rd.month, pe.home_id, rd.total - rd.par as tp, rd.course, rd.holes, rd.total, rd.par
      from people pe join players x on lower(x.name) = pe.k and x.pin_hash = pe.h
      join rounds rd on rd.player_id = x.id
      where rd.month >= season_from() and left(rd.month, 4) = yr and not x.host_only
      order by rd.month, pe.home_id, rd.total - rd.par, rd.created_at
    ), ranked as (
      select b.*, rank() over (partition by b.month order by b.tp)::int as r, count(*) over (partition by b.month, b.tp)::int as k,
        count(*) over (partition by b.month)::int as field from best b
    ), mine as (
      select r.*, round((select avg(season_points(i)) from generate_series(r.r, r.r + r.k - 1) i))::int as pts from ranked r
      where r.home_id = (select pe.home_id from people pe where pe.k = lower(p.name) and pe.h = p.pin_hash)
    ), pay as (
      select coalesce(sum(pp.payout), 0)::int as earned, count(*) filter (where pp.payout > 0)::int as top10s
      from (select distinct group_id from seats) g cross join lateral period_payouts(g.group_id) pp where pp.player_id in (select id from seats)
    ), titles as (
      select count(*)::int as n from (select distinct group_id from seats) g cross join lateral period_champs(g.group_id) c
      where c.player_id in (select id from seats) and c.how <> 'playoff'
    )
    select json_build_object(
      'playerId', p.id, 'name', p.name, 'avatar', p.avatar,
      'club', club_label(lower(p.name), p.pin_hash, p.group_id),
      'clubs', case when club_label(lower(p.name), p.pin_hash, p.group_id) = 'Committee' then json_build_array('Committee')
        else (select json_agg(distinct g.name) from seats s join groups g on g.id = s.group_id where not s.host_only) end,
      'joined', (select min(created_at) from seats),
      'mine', lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash,
      'earnings', pay.earned + (person_bonus(p)->>'total')::int,
      'top10s', pay.top10s,
      'titles', titles.n,
      'career', (select json_build_object('rounds', count(*), 'best', min(total - par), 'avg', round(avg(total - par), 1)) from rounds where player_id in (select id from seats)),
      'feats', (select coalesce(json_agg(distinct f), '[]') from (
          select unnest(feats) f from rounds where player_id in (select id from seats)
          union select 'champion' where titles.n > 0) fs),
      'weeks', (select coalesce(json_agg(json_build_object('week', m.month, 'course', m.course, 'place', m.r, 'tied', m.k > 1, 'field', m.field,
          'toPar', m.tp, 'holes', m.holes, 'total', m.total, 'par', m.par, 'points', m.pts, 'banked', m.month < game_month()) order by m.month desc), '[]') from mine m)
    ) from pay, titles
  );
end $$;
grant execute on function golfer_card(uuid, uuid) to anon;

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
grant execute on function submit_round(uuid, text, int[], int[], text[], jsonb, boolean, jsonb) to anon;
grant execute on function save_avatar(uuid, jsonb) to anon;
revoke all on function rand_code(int) from public, anon, authenticated;
grant execute on function create_invite(uuid, text) to anon;
grant execute on function list_invites(uuid) to anon;
grant execute on function delete_invite(uuid, text) to anon;
grant execute on function peek_invite(text) to anon;
revoke all on function invite_code() from public, anon, authenticated;
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

-- The honours for a closed period at your club: champions and runners-up (ties share), the most rounds, every ace,
-- the lowest average over five rounds or more, and the highest round posted (for honesty). Hosts aren't members.
create or replace function period_honors(p_token uuid, p_period text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if p_period >= game_month() then raise exception 'That period is still open.'; end if;
  return (
    with r as (
      select p.name, rd.total - rd.par as tp, rd.feats from rounds rd join players p on p.id = rd.player_id
      where rd.group_id = me.group_id and rd.month = p_period and not p.host_only
    ), per as (
      select name, min(tp) as best, count(*) as n, round(avg(tp), 1) as av, max(tp) as worst,
        count(*) filter (where 'ace' = any(feats)) as aces
      from r group by name
    ), ranked as (
      select *, dense_rank() over (order by best) as dr from per
    ), champs as (
      -- a playoff settles a tie: its winner is champion and whoever lost it is runner-up
      select p.name, c.how from period_champs(me.group_id) c join players p on p.id = c.player_id where c.month = p_period
    ), lost as (
      select name, best from ranked where dr = 1 and name not in (select name from champs)
    )
    select json_build_object(
      'period', p_period,
      'champions', (select coalesce(json_agg(json_build_object('name', r.name, 'toPar', r.best, 'how', c.how) order by r.name), '[]')
        from ranked r join champs c on c.name = r.name),
      'runnersUp', (select coalesce(json_agg(json_build_object('name', name, 'toPar', best) order by name), '[]')
        from (select name, best from lost union all select name, best from ranked where dr = 2 and not exists (select 1 from lost)) u),
      'mostRounds', (select json_build_object('names', json_agg(name order by name), 'count', max(n)) from per where n = (select max(n) from per) having count(*) > 0),
      'aces', (select coalesce(json_agg(json_build_object('name', name, 'count', aces) order by aces desc, name), '[]') from per where aces > 0),
      'lowestAverage', (select json_build_object('names', json_agg(name order by name), 'avg', min(av)) from per where n >= 5 and av = (select min(av) from per where n >= 5) having count(*) > 0),
      'highestScore', (select json_build_object('names', json_agg(name order by name), 'toPar', max(worst)) from per where worst = (select max(worst) from per) having count(*) > 0)
    )
  );
end $$;
grant execute on function period_honors(uuid, text) to anon;
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
    -- every seat in the admin's clubs; who: the person's home seat, so a guest in two clubs is one member
    m as (
      select pl.id, (home_of(pl)).id as who, pl.group_id, g.name as club, pl.name, pl.created_at,
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
        (select coalesce(sum(lockers), 0) from member_days where player_id = m.id and day >= (since at time zone 'America/New_York')::date) as lockers,
        -- rounds started and abandoned (see round_abandoned)
        (select count(*) from round_starts rs where rs.player_id = m.id and rs.started_at >= since and round_abandoned(rs)) as unfinished
      from m
    ),
    -- one row a person: their seats' numbers added up (days counted once), shown under their home club
    people as (
      select s.who, min(s.name) filter (where s.id = s.who) as hname, min(s.name) as name,
        min(s.club) filter (where s.id = s.who) as hclub, min(s.club) as club, min(s.created_at) as created_at,
        max(s.last_seen) as last_seen, sum(s.rounds)::int as rounds, min(s.best) as best, sum(s.practice)::int as practice,
        sum(s.lockers)::int as lockers, sum(s.unfinished)::int as unfinished,
        coalesce(array_agg(s.club order by s.club) filter (where s.id <> s.who), '{}') as guest_at,
        (select count(*) from (
            select day from member_days where player_id in (select x.id from m x where x.who = s.who) and day >= (since at time zone 'America/New_York')::date
            union select (created_at at time zone 'America/New_York')::date from rounds where player_id in (select x.id from m x where x.who = s.who) and created_at >= since
            union select (started_at at time zone 'America/New_York')::date from practice_sessions where player_id in (select x.id from m x where x.who = s.who) and started_at >= since
          ) d) as days
      from stats s group by s.who
    ),
    feed as (
      select * from (
        select r.created_at as at, 'round' as kind, g.name as club, p.name, r.course, r.total, r.par, null::text as what, null::int as shots, p.id as pid
          from rounds r join players p on p.id = r.player_id join g on g.id = r.group_id where p.role <> 'admin'
        union all
        select s.started_at, 'practice', g.name, p.name, null, null, null, s.kind, s.shots, p.id
          from practice_sessions s join players p on p.id = s.player_id join g on g.id = s.group_id where p.role <> 'admin'
        union all
        select p.created_at, 'join', g.name, p.name, null, null, null, case when (home_of(p)).id <> p.id then 'guest' end, null, p.id
          from players p join g on g.id = p.group_id where p.role <> 'admin'
        union all
        -- a round started and not finished (shots: the hole they got to)
        select rs.started_at, 'quit', g.name, p.name, rs.course, null, null, null, rs.hole, p.id
          from round_starts rs join players p on p.id = rs.player_id join g on g.id = rs.group_id
          where p.role <> 'admin' and round_abandoned(rs)
        union all
        -- free play on a classic course (the Highlands, the Caldera): it counts only for the course record
        select f.created_at, 'classic', g.name, p.name, f.course, f.total, f.par, null, null, p.id
          from free_rounds f join players p on p.id = f.player_id join g on g.id = p.group_id where p.role <> 'admin'
        union all
        select f.created_at, 'feedback', g.name, coalesce(p.name, 'A member'), null, null, null, left(f.body, 80), null, p.id
          from feedback f join g on g.id = f.group_id left join players p on p.id = f.player_id
      ) e where at >= since order by at desc limit 1000
    )
    select json_build_object(
      'clubs', coalesce((select json_agg(json_build_object(
          'id', g.id, 'name', g.name,
          -- members: whose home club this is; guests: members of another club with a seat here
          'members', (select count(*) from m where m.group_id = g.id and m.id = m.who),
          'guests', (select count(*) from m where m.group_id = g.id and m.id <> m.who),
          'active', (select count(*) from stats s where s.group_id = g.id and s.days > 0),
          'rounds', (select coalesce(sum(s.rounds), 0) from stats s where s.group_id = g.id),
          'practice', (select coalesce(sum(s.practice), 0) from stats s where s.group_id = g.id),
          'newMembers', (select count(*) from m where m.group_id = g.id and m.id = m.who and m.created_at >= since)
        ) order by g.name) from g), '[]'),
      -- across the clubs, each person once
      'totals', json_build_object(
        'members', (select count(*) from people),
        'active', (select count(*) from people where days > 0),
        'rounds', (select coalesce(sum(rounds), 0) from people),
        'practice', (select coalesce(sum(practice), 0) from people),
        'newMembers', (select count(*) from m where m.id = m.who and m.created_at >= since)),
      'members', coalesce((select json_agg(json_build_object(
          'id', s.who, 'club', coalesce(s.hclub, s.club), 'guestAt', s.guest_at, 'name', coalesce(s.hname, s.name), 'joined', s.created_at,
          'lastSeen', s.last_seen, 'days', s.days, 'rounds', s.rounds, 'unfinished', s.unfinished, 'best', s.best,
          'practice', s.practice, 'lockers', s.lockers
        ) order by s.last_seen desc nulls last, s.name) from people s), '[]'),
      'feed', coalesce((select json_agg(json_build_object(
          'at', e.at, 'kind', e.kind, 'club', e.club, 'name', e.name, 'course', e.course, 'total', e.total,
          'par', e.par, 'what', e.what, 'shots', e.shots, 'id', e.pid
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

-- Weekly Players, day by day since the first member joined: for each day, how many members (across the admin's clubs,
-- the admin left out) posted a round in the 7 days to that day, and how many members there were then
create or replace function admin_trend(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return (
    -- seats, each tagged with its person (who: their home seat), so a guest in two clubs counts once
    with s as (
      select pl.id, (home_of(pl)).id as who, (pl.created_at at time zone 'America/New_York')::date as joined from players pl
      where pl.group_id in (select admin_clubs(me)) and pl.role <> 'admin' and not pl.host_only
    ), m as (
      select who, min(joined) as joined from s group by who
    ), r as (
      select distinct s.who, (rd.created_at at time zone 'America/New_York')::date as d from rounds rd join s on s.id = rd.player_id
    ), days as (
      select generate_series(coalesce((select min(joined) from m), game_today()), game_today(), interval '1 day')::date as day
    )
    select coalesce(json_agg(json_build_object(
        'day', days.day,
        'players', (select count(distinct r.who) from r where r.d > days.day - 7 and r.d <= days.day),
        'members', (select count(*) from m where m.joined <= days.day)
      ) order by days.day), '[]')
    from days
  );
end $$;
grant execute on function admin_trend(uuid) to anon;

-- The Committee Room's Today: everyone in today across the admin's clubs, each person once (a guest in two clubs is
-- one), with where their card stands (in, with the score; on the course, with the hole), practice and the Daily Shot;
-- and today's feed, newest first. "In" is any sign of life today: a visit, a round, a card started, practice, the
-- Daily Shot or the playoff.
create or replace function admin_today(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); today date := game_today();
  t0 timestamptz := today::timestamp at time zone 'America/New_York';
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return (
    with g as (select id, name from groups where id in (select admin_clubs(me))),
    mem as (
      select pl.id, pl.name, pl.group_id, pl.last_seen_at, g.name as club, (home_of(pl)).id as who
      from players pl join g on g.id = pl.group_id where pl.role <> 'admin' and not pl.host_only
    ),
    ev as (
      select m.who, m.name, m.club, r.created_at as at, 'round' as kind, r.course, r.total, r.par, null::int as n, null::numeric as ft
        from rounds r join mem m on m.id = r.player_id where r.created_at >= t0
      union all
      select m.who, m.name, m.club, rs.started_at, 'start', rs.course, null, null, null, null
        from round_starts rs join mem m on m.id = rs.player_id where rs.card and rs.started_at >= t0
      union all
      select m.who, m.name, m.club, ps.started_at, 'practice', ps.kind, null, null, ps.shots, null
        from practice_sessions ps join mem m on m.id = ps.player_id where ps.started_at >= t0
      union all
      -- the Daily Shot: one line a person, at their last try, with their best
      select m.who, m.name, m.club, max(d.created_at), 'daily', null, null, null, count(*)::int,
          min(case when d.holed then 0 when d.lost then null else d.ft end)
        from daily_shots d join mem m on m.id = d.player_id where d.day = today group by m.who, m.name, m.club
      union all
      select m.who, m.name, m.club, pt.started_at, 'playoff', null, pt.strokes, null, null, pt.ft
        from playoff_tries pt join mem m on m.id = pt.player_id where pt.started_at >= t0
      union all
      select m.who, m.name, m.club, m2.created_at, 'join', case when m.id <> m.who then 'guest' end, null, null, null, null
        from mem m join players m2 on m2.id = m.id where m2.created_at >= t0
      union all
      -- free play on a classic course, for the course record
      select m.who, m.name, m.club, f.created_at, 'classic', f.course, f.total, f.par, null, null
        from free_rounds f join mem m on m.id = f.player_id where f.created_at >= t0
      union all
      select m.who, m.name, m.club, f.created_at, 'feedback', left(f.body, 80), null, null, null, null
        from feedback f join mem m on m.id = f.player_id where f.created_at >= t0
      union all
      -- the Midway: curses sent and pockets picked (what: status:kind:their target)
      select m.who, m.name, m.club, coalesce(pu.used_at, pu.created_at), 'midway',
          pu.status || ':' || pu.kind || ':' || coalesce((select x.name from players x where x.id = pu.target_id), ''), null, null, null, null
        from powerups pu join mem m on m.id = pu.owner_id
        where pu.target_id is not null and pu.status <> 'stolen' and coalesce(pu.used_at, pu.created_at) >= t0
    ),
    -- who's in: anyone with an event today, or who opened the club today
    ins as (
      select who from ev
      union select m.who from mem m where m.last_seen_at >= t0
      union select m.who from member_days md join mem m on m.id = md.player_id where md.day = today
    ),
    -- today's cards: the better of them (one a person), and how many are in
    card as (
      select distinct on (m.who) m.who, r.total - r.par as to_par, r.total, r.created_at as at,
        count(*) over (partition by m.who) as n
      from rounds r join mem m on m.id = r.player_id where r.created_at >= t0 and r.month = game_month() order by m.who, r.total - r.par, r.created_at
    ),
    going as (
      select distinct on (m.who) m.who, coalesce(array_length(rs.scores, 1), 0) + 1 as hole, rs.started_at as at
      from round_starts rs join mem m on m.id = rs.player_id
      where rs.card and not rs.finished and rs.started_at >= t0 order by m.who, rs.started_at desc
    ),
    people as (
      select i.who,
        coalesce((select m.name from mem m where m.id = i.who), (select min(m.name) from mem m where m.who = i.who)) as name,
        coalesce((select m.club from mem m where m.id = i.who), (select min(m.club) from mem m where m.who = i.who)) as club,
        greatest((select max(at) from ev where ev.who = i.who), (select max(m.last_seen_at) from mem m where m.who = i.who and m.last_seen_at >= t0)) as last,
        case when gg.who is not null then 'going' when c.who is not null then 'in' end as card,
        c.to_par, c.total, gg.hole, coalesce(c.n, 0) as cards,
        (select count(*) from ev where ev.who = i.who and ev.kind = 'practice') as practice,
        (select ev.ft from ev where ev.who = i.who and ev.kind = 'daily' limit 1) as daily_ft,
        exists (select 1 from ev where ev.who = i.who and ev.kind = 'daily') as daily
      from ins i left join card c on c.who = i.who left join going gg on gg.who = i.who
    )
    select json_build_object(
      'today', today,
      'in', (select count(*) from people),
      'cardsIn', (select count(*) from people where card = 'in'),
      'onCourse', (select count(*) from people where card = 'going'),
      'people', coalesce((select json_agg(json_build_object('id', p.who, 'name', p.name, 'club', p.club, 'last', p.last, 'card', p.card,
          'toPar', p.to_par, 'total', p.total, 'hole', p.hole, 'cards', p.cards, 'practice', p.practice, 'daily', p.daily, 'dailyFt', p.daily_ft)
        order by p.last desc nulls last, p.name) from people p), '[]'),
      'feed', coalesce((select json_agg(json_build_object('id', e.who, 'at', e.at, 'kind', e.kind, 'name', e.name, 'club', e.club,
          'what', e.course, 'total', e.total, 'par', e.par, 'n', e.n, 'ft', e.ft) order by e.at desc) from ev e), '[]')
    )
  );
end $$;
grant execute on function admin_today(uuid) to anon;

-- The Committee Room's headline numbers, across the admin's clubs (the admin and host-only seats left out): who's in
-- today, who came back from last week, rounds per player, new members' first rounds, the money in play, AI calls, the
-- last 14 days, every week so far, and how this week's course is scoring hole by hole. One call, read-only.
create or replace function admin_kpis(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); per text := game_month(); prev text; today date := game_today();
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  select max(r.month) into prev from rounds r where r.month < per;
  return (
    -- every seat, tagged with its person (who: their home seat): a guest in two clubs is one member, and below
    -- player_id is the person, not the seat
    with mem as (select pl.*, (home_of(pl)).id as who from players pl where pl.group_id in (select admin_clubs(me)) and pl.role <> 'admin' and not pl.host_only),
    people as (select who, min(created_at) as created_at, min(name) as name from mem group by who),
    rd as (select r.*, mem.who from rounds r join mem on mem.id = r.player_id),
    -- any sign of life on a day: a visit, a round, practice or a Daily Shot
    seen as (
      select mem.who as player_id, md.day from member_days md join mem on mem.id = md.player_id
      union select r.who, (r.created_at at time zone 'America/New_York')::date from rd r
      union select mem.who, (ps.started_at at time zone 'America/New_York')::date from practice_sessions ps join mem on mem.id = ps.player_id
      union select mem.who, d.day from daily_shots d join mem on mem.id = d.player_id
    ),
    played as (select distinct r.who as player_id, (r.created_at at time zone 'America/New_York')::date as day from rd r),
    pp as (select distinct r.month, r.who as player_id from rd r),
    pars as (select r.*, coalesce(r.pars, cp.pars) as hp from rd r left join course_pars cp on cp.course = r.course where r.month = per),
    shots as (select i, p.holes[i] as s, p.hp[i] as par from pars p cross join lateral generate_subscripts(p.holes, 1) i where p.hp is not null and i <= array_length(p.hp, 1))
    select json_build_object(
      'period', per, 'prevPeriod', prev, 'today', today,
      'members', (select count(*) from people),
      'visitedToday', (select count(distinct player_id) from seen where day = today),
      'playedToday', (select count(*) from played where day = today),
      'visitedWeekAgo', (select count(distinct player_id) from seen where day = today - 7),
      'playedWeekAgo', (select count(*) from played where day = today - 7),
      'lastPlayers', (select count(*) from pp where month = prev),
      'cameBack', (select count(*) from pp a where a.month = prev and exists (select 1 from pp b where b.month = per and b.player_id = a.player_id)),
      'rounds', (select count(*) from rd where month = per),
      'players', (select count(*) from pp where month = per),
      'prevRounds', (select count(*) from rd where month = prev),
      'prevPlayers', (select count(*) from pp where month = prev),
      'joined14', (select count(*) from people where created_at > now() - interval '14 days'),
      'firstRound14', (select count(*) from people pe where created_at > now() - interval '14 days' and exists (select 1 from rd where rd.who = pe.who)),
      'neverPlayed14', (select coalesce(json_agg(pe.name order by pe.created_at), '[]') from people pe where created_at > now() - interval '14 days' and not exists (select 1 from rd where rd.who = pe.who)),
      -- the purse a week is worth: from Nov 8 the Open's, every person in any club; before, every club's added up
      'purse', (case when per >= open_purse_from()
        then (select case when n = 0 then 0 else greatest(n * open_per_player(), open_purse_floor()) end
          from (select count(distinct (lower(p.name), p.pin_hash)) as n from rounds r join players p on p.id = r.player_id where r.month = per) c)
        else 1000 * (select count(*) from pp where month = per) end),
      'shop7', (select coalesce(sum(pu.price), 0) from purchases pu join mem on mem.id = pu.player_id where pu.created_at > now() - interval '7 days'),
      'shopAll', (select coalesce(sum(pu.price), 0) from purchases pu join mem on mem.id = pu.player_id),
      'ai', json_build_object(
        'today', (select coalesce(json_object_agg(kind, n), '{}') from (select kind, count(*) n from reginald_notes where (created_at at time zone 'America/New_York')::date = today group by kind) k),
        'designsToday', (select count(*) from design_calls where (created_at at time zone 'America/New_York')::date = today),
        'month', (select count(*) from reginald_notes where created_at >= date_trunc('month', now()))
          + (select count(*) from design_calls where created_at >= date_trunc('month', now()))
          + (select count(*) from chronicles where created_at >= date_trunc('month', now()))),
      'days', (select json_agg(json_build_object('day', d, 'played', (select count(*) from played where day = d),
          'visited', (select count(distinct player_id) from seen where day = d)) order by d)
        from generate_series(today - 13, today, interval '1 day') g(x), lateral (select x::date as d) dd),
      'weeks', (select coalesce(json_agg(json_build_object('period', w.month, 'players', w.players, 'rounds', w.rounds,
          'back', (select count(*) from pp a where a.month = w.before and exists (select 1 from pp b where b.month = w.month and b.player_id = a.player_id)),
          'before', (select count(*) from pp a where a.month = w.before)) order by w.month), '[]')
        from (select r.month, count(distinct r.who) as players, count(*) as rounds, lag(r.month) over (order by r.month) as before
          from rd r group by r.month) w),
      'holes', (select coalesce(json_agg(json_build_object('hole', i, 'par', par, 'n', n, 'avg', av, 'eagle', e, 'birdie', b, 'pars', pz, 'bogey', bo, 'worse', wo) order by i), '[]')
        from (select i, min(par) as par, count(*) as n, round(avg(s - par), 2) as av,
            count(*) filter (where s <= par - 2) as e, count(*) filter (where s = par - 1) as b, count(*) filter (where s = par) as pz,
            count(*) filter (where s = par + 1) as bo, count(*) filter (where s >= par + 2) as wo
          from shots group by i) h)
    )
  );
end $$;
grant execute on function admin_kpis(uuid) to anon;

-- The Committee's hole report for this week's course, from the shots members post with their cards (admin and
-- host-only seats left out): per hole, putts and three-putts, penalties, the club off the tee, the lies shots were
-- hit from, and where tee shots and penalties finished (for the plan in Admin).
create or replace function admin_holes(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return (
    with rd as (
      select r.id, r.shots from rounds r join players p on p.id = r.player_id
      where r.month = game_month() and r.group_id in (select admin_clubs(me)) and p.role <> 'admin' and not p.host_only and jsonb_typeof(r.shots) = 'array'
    ), sh as (
      select rd.id, (e->>'h')::int as h, k, e->>'c' as c, e->>'l' as l, (e->>'x')::int as x, e->'t' as t
      from rd cross join lateral jsonb_array_elements(rd.shots) with ordinality as a(e, k)
      where e ? 'h'
    ), per as (
      select id, h, count(*) filter (where c = 'putter') as putts, count(*) filter (where x = 1) as pens, min(k) as first from sh group by id, h
    ), holes as (select distinct h from sh)
    select coalesce(json_agg(json_build_object(
        'hole', ho.h + 1,
        'rounds', (select count(*) from per where per.h = ho.h),
        'putts', (select round(avg(putts), 2) from per where per.h = ho.h),
        'threePutts', (select round(avg(case when putts >= 3 then 1 else 0 end), 2) from per where per.h = ho.h),
        'penalties', (select round(avg(pens), 2) from per where per.h = ho.h),
        'teeClubs', (select coalesce(json_object_agg(c, n), '{}') from (select sh.c, count(*) n from sh join per on per.id = sh.id and per.h = sh.h and per.first = sh.k where sh.h = ho.h group by sh.c) t),
        'lies', (select coalesce(json_object_agg(l, n), '{}') from (select l, count(*) n from sh where sh.h = ho.h group by l) t),
        'tee', (select coalesce(json_agg(sh.t), '[]') from (select sh.t from sh join per on per.id = sh.id and per.h = sh.h and per.first = sh.k where sh.h = ho.h limit 200) sh),
        'wet', (select coalesce(json_agg(t), '[]') from (select t from sh where sh.h = ho.h and x = 1 limit 200) w)
      ) order by ho.h), '[]')
    from holes ho
  );
end $$;
grant execute on function admin_holes(uuid) to anon;

-- Every posted shot of the last four weeks, for tuning the hole checks' steady bot to how members really swing
-- (npm run check-holes -- calibrate <file>). Not for the app: only the database's own roles can call it.
create or replace function shot_export() returns json
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(json_agg(json_build_object('course', r.course, 'period', r.month, 'shot', e)), '[]')
  from rounds r join players p on p.id = r.player_id, jsonb_array_elements(r.shots) e
  where jsonb_typeof(r.shots) = 'array' and r.created_at > now() - interval '28 days' and p.role <> 'admin'
$$;
revoke all on function shot_export() from public, anon, authenticated;

-- Reginald's morning read of those numbers for the Committee (api/insights.ts writes it, once a day): a few plain
-- takeaways. Only the server reads and writes it.
create table if not exists admin_insights (
  day date primary key,
  body jsonb not null,
  created_at timestamptz not null default now()
);
alter table admin_insights enable row level security;

-- Ask Reginald, in the Committee Room (api/ask.ts): each question the Committee asks and his answer, kept for the daily
-- cap and a look back. Only the server reads and writes it.
create table if not exists admin_asks (
  id bigserial primary key,
  player_id uuid references players on delete set null,
  question text not null,
  answer text,
  created_at timestamptz not null default now()
);
alter table admin_asks enable row level security;
create index if not exists admin_asks_recent on admin_asks (created_at);

-- Rounds started and not finished: every counted round logs its start and the furthest hole it reached, and is
-- marked finished when the card goes in. The admin sees started vs finished, where people stop, and who.
create table if not exists round_starts (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  group_id uuid not null references groups on delete cascade,
  period text not null,
  course text not null,
  hole int not null default 1,
  finished boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
-- a card in progress: the holes finished so far, strokes on the hole being played, and the tee-shot spots and feats
alter table round_starts add column if not exists card boolean not null default false;
alter table round_starts add column if not exists scores int[] not null default '{}';
alter table round_starts add column if not exists shots int not null default 0;
alter table round_starts add column if not exists spots jsonb;
alter table round_starts add column if not exists feats text[] not null default '{}';

-- Two cards a day per person (from Nov 10), not per club: one to warm up, one to go at it; the better one is the day's
-- score. A guest's cards in one club are their cards in every club they play in (person_seats).
create or replace function cards_a_day() returns int language sql immutable as $$ select 2 $$;
-- the card in progress today, if one is open (started and not posted yet)
create or replace function card_of(me players) returns round_starts
language sql stable security definer set search_path = public, extensions as $$
  select * from round_starts rs where rs.player_id in (select person_seats(me)) and rs.card and not rs.finished
    and (rs.started_at at time zone 'America/New_York')::date = game_today()
  order by rs.started_at desc limit 1
$$;
revoke all on function card_of(players) from public, anon, authenticated;
-- how many of today's cards are in
create or replace function cards_today(me players) returns int
language sql stable security definer set search_path = public, extensions as $$
  select count(*)::int from rounds r where r.player_id in (select person_seats(me)) and (r.created_at at time zone 'America/New_York')::date = game_today() and r.month = game_month()
$$;
revoke all on function cards_today(players) from public, anon, authenticated;
-- all of today's cards are in
create or replace function card_in(me players) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select cards_today(me) >= cards_a_day()
$$;
revoke all on function card_in(players) from public, anon, authenticated;

alter table round_starts enable row level security;
create index if not exists round_starts_recent on round_starts (started_at);

-- A round is abandoned once it's unfinished and the member has started another one since (a restart), or it's two
-- hours old. Until then it may still be going.
create or replace function round_abandoned(rs round_starts) returns boolean
language sql stable as $$
  select not rs.finished and (rs.started_at < now() - interval '2 hours'
    or exists (select 1 from round_starts n where n.player_id = rs.player_id and n.started_at > rs.started_at))
$$;

-- p_card: start one of today's cards, or carry on with the one already going
drop function if exists start_round(uuid, text);
create or replace function start_round(p_token uuid, p_course text, p_card boolean default false) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); new_id bigint; c round_starts;
begin
  if p_card and cards_on() then
    me := play_seat(me);
    if card_in(me) then raise exception 'Both of today''s cards are in. Practise as much as you like.'; end if;
    c := card_of(me);
    if c.player_id <> me.id then raise exception 'Today''s card is going at %. Finish it there.', (select g.name from groups g join players p on p.group_id = g.id where p.id = c.player_id); end if;
    if c.id is not null then return c.id; end if;
    insert into round_starts (player_id, group_id, period, course, card) values (me.id, me.group_id, game_month(), left(p_course, 40), true)
    returning id into new_id;
    return new_id;
  end if;
  insert into round_starts (player_id, group_id, period, course) values (me.id, me.group_id, game_month(), left(p_course, 40))
  returning id into new_id;
  return new_id;
end $$;

-- Today's card: null before cards start; otherwise whether it's in, and where a card in progress stands
create or replace function card_today(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := play_seat(player_for(p_token)); c round_starts; at_id uuid; at_name text;
begin
  if not cards_on() then return null; end if;
  c := card_of(me);
  -- the club of a card going at another of the person's clubs (or, once all of today's cards are in, where they were played)
  select g.id, g.name into at_id, at_name from groups g where g.id = coalesce(
    (select p.group_id from players p where p.id = c.player_id),
    (select r.group_id from rounds r where card_in(me) and r.player_id in (select person_seats(me)) and (r.created_at at time zone 'America/New_York')::date = game_today()
      and r.month = game_month() order by r.created_at desc limit 1));
  return json_build_object('done', card_in(me), 'n', cards_today(me), 'of', cards_a_day(),
    'best', (select min(r.total - r.par) from rounds r where r.player_id in (select person_seats(me)) and (r.created_at at time zone 'America/New_York')::date = game_today() and r.month = game_month()),
    'id', c.id, 'course', c.course, 'scores', coalesce(c.scores, '{}'),
    'shots', coalesce(c.shots, 0), 'spots', c.spots, 'feats', coalesce(c.feats, '{}'),
    'clubId', case when at_id <> me.group_id then at_id end, 'club', case when at_id <> me.group_id then at_name end);
end $$;

-- A card's progress after every counted stroke. It only moves forward: a swing can't be taken back.
create or replace function card_progress(p_token uuid, p_id bigint, p_scores int[], p_shots int, p_spots jsonb, p_feats text[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := play_seat(player_for(p_token)); n int := coalesce(array_length(p_scores, 1), 0);
begin
  if n > 9 or p_shots not between 0 and 12 or exists (select 1 from unnest(coalesce(p_scores, '{}')) x where x not between 1 and 12) then
    raise exception 'That card doesn''t add up.';
  end if;
  update round_starts rs set scores = coalesce(p_scores, '{}'), shots = p_shots, hole = greatest(rs.hole, least(n + 1, 18)),
    spots = case when jsonb_typeof(p_spots) = 'array' and pg_column_size(p_spots) < 4000 then p_spots else rs.spots end,
    feats = (select coalesce(array_agg(distinct x), '{}') from unnest(coalesce(p_feats, '{}')) x where char_length(x) <= 20)
  where rs.id = p_id and rs.player_id = me.id and rs.card and not rs.finished
    and (rs.started_at at time zone 'America/New_York')::date = game_today()
    and (n > coalesce(array_length(rs.scores, 1), 0) or (n = coalesce(array_length(rs.scores, 1), 0) and p_shots >= rs.shots));
end $$;

-- the furthest hole reached, and finished once the card is in
create or replace function round_progress(p_token uuid, p_id bigint, p_hole int, p_finished boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update round_starts set hole = greatest(hole, least(p_hole, 18)),
    finished = finished or p_finished,
    finished_at = case when p_finished and not finished then now() else finished_at end
  where id = p_id and player_id = me.id;
end $$;

-- (Not shown in the app since #104, which folded unfinished rounds into Admin's stats; kept for a closer look.)
-- For the admin, across their clubs (the admin left out): started, finished, still going (not abandoned yet),
-- where unfinished rounds stopped, and member by member
create or replace function admin_round_starts(p_token uuid, p_window text) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
  since timestamptz := case p_window
    when 'week' then now() - interval '7 days'
    when 'month' then (date_trunc('month', now() at time zone 'America/New_York')) at time zone 'America/New_York'
    else '-infinity'::timestamptz end;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return (
    with s as (
      select rs.*, p.name, g.name as club, (not rs.finished and not round_abandoned(rs)) as going
      from round_starts rs join players p on p.id = rs.player_id join groups g on g.id = rs.group_id
      where rs.group_id in (select admin_clubs(me)) and p.role <> 'admin' and rs.started_at >= since
    )
    select json_build_object(
      'started', (select count(*) from s),
      'finished', (select count(*) from s where finished),
      'going', (select count(*) from s where going),
      'quitAt', (select coalesce(json_agg(json_build_object('course', course, 'hole', hole, 'count', n) order by n desc, course, hole), '[]')
        from (select course, hole, count(*) as n from s where not finished and not going group by course, hole) q),
      'members', (select coalesce(json_agg(json_build_object('name', name, 'club', club, 'started', st, 'finished', fi) order by st - fi desc, name), '[]')
        from (select name, club, count(*) as st, count(*) filter (where finished) as fi from s group by name, club) m),
      'recent', (select coalesce(json_agg(json_build_object('name', name, 'club', club, 'course', course, 'hole', hole, 'at', started_at) order by started_at desc), '[]')
        from (select * from s where not finished and not going order by started_at desc limit 12) r)
    )
  );
end $$;
grant execute on function start_round(uuid, text, boolean) to anon;
grant execute on function card_today(uuid) to anon;
grant execute on function card_progress(uuid, bigint, int[], int, jsonb, text[]) to anon;
grant execute on function round_progress(uuid, bigint, int, boolean) to anon;
grant execute on function admin_round_starts(uuid, text) to anon;
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
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.name, p.group_id, p.id as home_id
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
      'board', coalesce((select json_agg(json_build_object('playerId', pe.home_id, 'name', pe.name, 'club', club_label(pe.k, pe.h, pe.group_id), 'ft', b.fts[1], 'holed', b.holed, 'holedTry', b.htry, 'tries', b.n,
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

-- The crown: yesterday's Closest to the Pin winner across every club, ranked as daily_state ranks the board (holed
-- first, holed sooner, then nearest, then the next-best try, then the earlier player). ids: that person's member ids
-- in the viewer's club, if they belong to it, so the app can put the crown by their name. Null if nobody scored.
create or replace function daily_crown(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); d date := (now() at time zone 'America/New_York')::date - 1;
begin
  return (
    with people as (
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.name, p.group_id
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), tries as (
      select pe.k, pe.h, s.* from daily_shots s join players p on p.id = s.player_id
      join people pe on pe.k = lower(p.name) and pe.h = p.pin_hash where s.day = d
    ), best as (
      select t.k, t.h, bool_or(t.holed) as holed, min(t.try) filter (where t.holed) as htry,
        array_agg(case when t.holed then 0 when t.lost then null else t.ft end order by case when t.holed then 0 when t.lost then null else t.ft end asc nulls last) as fts,
        min(t.created_at) as first_at
      from tries t group by t.k, t.h
    )
    select json_build_object('day', d, 'name', pe.name, 'club', club_label(pe.k, pe.h, pe.group_id), 'ft', b.fts[1], 'holed', b.holed,
      'ids', coalesce((select json_agg(p.id) from players p where p.group_id = me.group_id and lower(p.name) = b.k and p.pin_hash = b.h), '[]'))
    from best b join people pe on pe.k = b.k and pe.h = b.h join groups g on g.id = pe.group_id
    where b.holed or b.fts[1] is not null
    order by b.holed desc, b.htry asc nulls last, b.fts[1] asc nulls last, b.fts[2] asc nulls last, b.fts[3] asc nulls last, b.first_at
    limit 1
  );
end $$;
grant execute on function daily_crown(uuid) to anon;
grant execute on function daily_admin(uuid) to anon;

-- The Nineteenth Hole's weekly contests: mini golf (the putting contest before it) and long drive. Every score is
-- kept; the week's best per person counts (higher is better: mini golf is kept as minus the strokes), and the week runs Monday to Sunday, Eastern. One person across clubs is the same name
-- and PIN hash, as on the Open.
create table if not exists bar_scores (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  game text not null check (game in ('putting', 'drive', 'minigolf', 'members', 'midway')),
  week date not null,
  score numeric(8, 1) not null,
  created_at timestamptz not null default now()
);
alter table bar_scores enable row level security;
create index if not exists bar_scores_week on bar_scores (game, week);
-- the games on the wall (the Midway joined on Nov 10)
alter table bar_scores drop constraint if exists bar_scores_game_check;
alter table bar_scores add constraint bar_scores_game_check check (game in ('putting', 'drive', 'minigolf', 'members', 'midway'));

create or replace function submit_bar(p_token uuid, p_game text, p_score numeric) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token));
begin
  if p_game not in ('minigolf', 'drive', 'members', 'midway') then raise exception 'No such game.'; end if;
  -- a long drive is 0 to 450 yd; mini golf, the Members' Course and the Midway are minus the strokes
  if (p_game = 'drive' and p_score not between 0 and 450) or (p_game = 'minigolf' and p_score not between -60 and -6)
    or (p_game = 'members' and p_score not between -90 and -1) or (p_game = 'midway' and p_score not between -40 and -3) then
    raise exception 'That score doesn''t look right.';
  end if;
  -- the Midway: one counting round a day (any more are for fun, and never sent)
  if p_game = 'midway' and exists (select 1 from bar_scores b join players p on p.id = b.player_id
      where b.game = 'midway' and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash
        and (b.created_at at time zone 'America/New_York')::date = game_today()) then
    raise exception 'Your Midway round for today is in. Back tomorrow.';
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
      select distinct on (lower(p.name), p.pin_hash) lower(p.name) as k, p.pin_hash as h, p.name, p.id as home_id
      from players p order by lower(p.name), p.pin_hash, p.host_only, p.created_at
    ), best as (
      select lower(p.name) as k, p.pin_hash as h, max(b.score) as score, min(b.created_at) as first_at
      from bar_scores b join players p on p.id = b.player_id
      where b.game = p_game and b.week = wk group by lower(p.name), p.pin_hash
    )
    select json_build_object(
      'week', wk,
      'board', coalesce((select json_agg(json_build_object('playerId', pe.home_id, 'name', pe.name, 'score', b.score, 'mine', b.k = lower(me.name) and b.h = me.pin_hash)
        order by b.score desc, b.first_at) from best b join people pe on pe.k = b.k and pe.h = b.h), '[]'),
      'mine', (select score from best where k = lower(me.name) and h = me.pin_hash),
      'players', (select count(*) from best),
      -- whether you've played this game today (the Midway counts one round a day)
      'playedToday', exists (select 1 from bar_scores b join players p on p.id = b.player_id
        where b.game = p_game and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash
          and (b.created_at at time zone 'America/New_York')::date = game_today())
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
-- the champion's word (one per club per title, kept under the champion's name) joined the kinds after the table was made
alter table reginald_notes drop constraint if exists reginald_notes_kind_check;
alter table reginald_notes add constraint reginald_notes_kind_check check (kind in ('daily', 'round', 'chronicle', 'design', 'champion'));

-- The Clubhouse Chronicle: Reginald's weekly letter to each club, written by Claude (api/chronicle.ts) on Monday
-- morning from the week just gone, and kept. Members read their club's editions; only the server writes them.
create table if not exists chronicles (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  week date not null, -- the Monday it was written
  body jsonb not null, -- { headline, dek, items: [{ title, body }], signoff }
  created_at timestamptz not null default now(),
  unique (group_id, week)
);
alter table chronicles enable row level security;

-- The clubs that had any play in the last seven days (the server writes an edition for each)
create or replace function chronicle_clubs() returns setof uuid
language sql stable security definer set search_path = public, extensions as $$
  select distinct p.group_id from players p
  where not p.host_only and (
    exists (select 1 from rounds r where r.player_id = p.id and r.created_at > now() - interval '7 days')
    or exists (select 1 from daily_shots d where d.player_id = p.id and d.created_at > now() - interval '7 days')
    or exists (select 1 from bar_scores b where b.player_id = p.id and b.created_at > now() - interval '7 days')
    or p.created_at > now() - interval '7 days')
$$;

-- Everything that happened at one club in the last seven days, for Reginald to write up
create or replace function chronicle_facts(p_group uuid) returns json
language sql stable security definer set search_path = public, extensions as $$
  with m as (select game_month() as month), members as (
    select * from players where group_id = p_group and not host_only
  ), last as (
    -- the period that just closed: the latest before this one that anybody played
    select max(b.month) as month from month_bests(p_group) b where b.month < (select month from m)
  )
  select json_build_object(
    'club', (select name from groups where id = p_group),
    'members', (select count(*) from members),
    'new_members', (select coalesce(json_agg(name), '[]') from members where created_at > now() - interval '7 days'),
    'period', (select month from m),
    'rounds_this_week', (select coalesce(json_agg(json_build_object('who', p.name, 'course', r.course, 'score', r.total, 'to_par', r.total - r.par,
        'feats', r.feats, 'day', to_char(r.created_at at time zone 'America/New_York', 'Dy')) order by r.created_at), '[]')
      from rounds r join members p on p.id = r.player_id where r.created_at > now() - interval '7 days'),
    'standings_so_far', (select coalesce(json_agg(json_build_object('who', p.name, 'best_to_par', b.total - b.par, 'place', b.r) order by b.r), '[]')
      from month_bests(p_group) b join members p on p.id = b.player_id where b.month = (select month from m)),
    'last_period', (select month from last),
    'last_period_final', (select coalesce(json_agg(json_build_object('who', p.name, 'best_to_par', b.total - b.par, 'place', b.r) order by b.r), '[]')
      from month_bests(p_group) b join members p on p.id = b.player_id where b.month = (select month from last)),
    'closest_to_the_pin', (select json_build_object('players', count(distinct d.player_id), 'holed', coalesce(json_agg(distinct p.name) filter (where d.holed), '[]'))
      from daily_shots d join members p on p.id = d.player_id where d.created_at > now() - interval '7 days'),
    'mini_golf_best', (select json_build_object('who', p.name, 'strokes', -max(b.score)) from bar_scores b join members p on p.id = b.player_id
      where b.game = 'minigolf' and b.created_at > now() - interval '7 days' group by p.name order by max(b.score) desc limit 1),
    'long_drive_best', (select json_build_object('who', p.name, 'yards', max(b.score)) from bar_scores b join members p on p.id = b.player_id
      where b.game = 'drive' and b.created_at > now() - interval '7 days' group by p.name order by max(b.score) desc limit 1),
    'past_champions', (select coalesce(json_agg(json_build_object('month', c.month, 'who', p.name, 'how', c.how) order by c.month desc), '[]')
      from period_champs(p_group) c join members p on p.id = c.player_id)
  )
$$;

-- A member's club's editions, newest first
create or replace function chronicles(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((select json_agg(json_build_object('week', c.week, 'body', c.body) order by c.week desc)
    from (select * from chronicles where group_id = me.group_id order by week desc limit 8) c), '[]');
end $$;

revoke all on function chronicle_clubs() from public, anon, authenticated;
revoke all on function chronicle_facts(uuid) from public, anon, authenticated;
grant execute on function chronicles(uuid) to anon;

-- The Design Desk: members' mini golf holes. Claude lays each one out (api/design.ts writes the drafts); the member
-- plays it, can ask for changes, and submits it; the admin approves it onto the Members' Course at the bar.
create table if not exists designs (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  prompt text not null,
  spec jsonb not null,
  par int check (par is null or par between 2 and 5),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz
);
alter table designs enable row level security;
-- Someone else finishing your hole on the Members' Course: $100 to the designer, once per member per hole per week,
-- up to $500 a week (person_bonus). week: the Sunday it was played.
create table if not exists design_plays (
  design_id bigint not null references designs on delete cascade,
  player_id uuid not null references players on delete cascade,
  week date not null,
  created_at timestamptz not null default now(),
  primary key (design_id, player_id, week)
);
alter table design_plays enable row level security;

-- one row per call to the architect, for the daily caps
create table if not exists design_calls (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  created_at timestamptz not null default now()
);
alter table design_calls enable row level security;

-- your holes (as one person across clubs), newest first
create or replace function my_designs(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((select json_agg(json_build_object('id', d.id, 'prompt', d.prompt, 'spec', d.spec, 'par', d.par, 'status', d.status, 'createdAt', d.created_at) order by d.created_at desc)
    from (select d.* from designs d join players p on p.id = d.player_id
      where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash order by d.created_at desc limit 30) d), '[]');
end $$;

-- send a draft to the Committee, with the par the test golfer set
create or replace function submit_design(p_token uuid, p_id bigint, p_par int) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update designs d set status = 'submitted', submitted_at = now(), par = greatest(2, least(5, p_par))
  from players p
  where d.id = p_id and d.status = 'draft' and p.id = d.player_id and lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash;
  if not found then raise exception 'That hole can''t be submitted.'; end if;
end $$;

-- the admin's queue: holes waiting, and the ones already on the course
create or replace function design_queue(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see this.'; end if;
  return coalesce((select json_agg(json_build_object('id', d.id, 'prompt', d.prompt, 'spec', d.spec, 'par', d.par, 'status', d.status,
      'by', p.name, 'club', g.name, 'submittedAt', d.submitted_at) order by d.status = 'submitted' desc, d.submitted_at desc)
    from designs d join players p on p.id = d.player_id join groups g on g.id = p.group_id
    where d.status in ('submitted', 'approved') and p.group_id in (select admin_clubs(me))), '[]');
end $$;

create or replace function review_design(p_token uuid, p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can do this.'; end if;
  update designs d set status = case when p_ok then 'approved' else 'rejected' end, reviewed_at = now()
  from players p where d.id = p_id and p.id = d.player_id and p.group_id in (select admin_clubs(me)) and d.status in ('submitted', 'approved');
end $$;

-- The Members' Course: approved holes, up to nine, as they stood on Monday so the week's board is fair (in its
-- first week, everything approved so far)
create or replace function members_course(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); monday timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
begin
  return coalesce((
    with ok as (select d.*, p.name as by from designs d join players p on p.id = d.player_id where d.status = 'approved'),
    week as (select * from ok where reviewed_at < monday),
    pick as (select * from week union all select * from ok where not exists (select 1 from week))
    select json_agg(json_build_object('id', x.id, 'spec', x.spec, 'par', x.par, 'by', x.by) order by x.reviewed_at)
    from (select * from pick order by reviewed_at desc limit 9) x
  ), '[]');
end $$;

grant execute on function my_designs(uuid) to anon;
grant execute on function submit_design(uuid, bigint, int) to anon;
grant execute on function design_queue(uuid) to anon;
grant execute on function review_design(uuid, bigint, boolean) to anon;
grant execute on function members_course(uuid) to anon;

-- A member finished a hole on the Members' Course: log the play for its designer (never their own hole). True when it
-- was a new play this week, so the app can say the designer's been paid.
create or replace function record_design_play(p_token uuid, p_design bigint) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); owner players; n int;
begin
  select pl.* into owner from designs d join players pl on pl.id = d.player_id where d.id = p_design and d.status = 'approved';
  if owner.id is null or owner.id in (select person_seats(me)) then return false; end if;
  insert into design_plays (design_id, player_id, week) values (p_design, me.id, game_today() - extract(dow from game_today())::int)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
grant execute on function record_design_play(uuid, bigint) to anon;

-- The Pro Shop (src/shop.ts): looks bought with purse money and club bonuses. Career earnings (period_payouts plus
-- person_bonus) never go down; what a member spends comes out of their balance. Club Pro ($5,000 earned) and Club
-- Legend ($25,000) have racks of their own.
-- The prices here must match src/shop.ts.
create table if not exists shop_items (
  id text primary key,
  price int not null check (price > 0),
  rack text not null check (rack in ('member', 'pro', 'legend'))
);
alter table shop_items enable row level security;
-- the Pro Shop catalogue (src/shop.ts ITEMS): about 60 pieces, mirrored here so the server can check every purchase
insert into shop_items (id, price, rack) values
  ('stripepolo', 300, 'member'),
  ('hawaiian', 400, 'member'),
  ('mockneck', 450, 'member'),
  ('retro', 650, 'member'),
  ('argyle', 750, 'member'),
  ('rugby', 900, 'member'),
  ('tourpolo', 1500, 'pro'),
  ('goldlame', 12000, 'legend'),
  ('windbreaker', 500, 'member'),
  ('gilet', 700, 'member'),
  ('rainjacket', 1100, 'member'),
  ('puffer', 3500, 'pro'),
  ('velvet', 6000, 'pro'),
  ('overcoat', 14000, 'legend'),
  ('whites', 600, 'member'),
  ('checks', 800, 'member'),
  ('leather', 4000, 'pro'),
  ('goldpants', 10000, 'legend'),
  ('sneaker', 300, 'member'),
  ('spectator', 700, 'member'),
  ('crocshoes', 3000, 'pro'),
  ('goldshoes', 11000, 'legend'),
  ('blackglove', 150, 'member'),
  ('pairgloves', 350, 'member'),
  ('goldglove', 2000, 'pro'),
  ('beanie', 200, 'member'),
  ('printbucket', 250, 'member'),
  ('tourcap', 500, 'member'),
  ('straw', 600, 'member'),
  ('cowboy', 1200, 'pro'),
  ('goldvisor', 2000, 'pro'),
  ('fedora', 2500, 'pro'),
  ('tophat', 10000, 'legend'),
  ('sportshades', 300, 'member'),
  ('aviators', 350, 'member'),
  ('roundspecs', 450, 'member'),
  ('shieldshades', 2200, 'pro'),
  ('diamondframes', 18000, 'legend'),
  ('sportwatch', 250, 'member'),
  ('bracelet', 500, 'member'),
  ('watch', 900, 'member'),
  ('chain', 2500, 'pro'),
  ('earring', 4500, 'pro'),
  ('diamondwatch', 25000, 'legend'),
  ('icedchain', 30000, 'legend'),
  ('chrome', 600, 'member'),
  ('mallet', 800, 'member'),
  ('hickory', 1200, 'member'),
  ('blackout', 2500, 'pro'),
  ('diamondputter', 20000, 'legend'),
  ('persimmon', 700, 'member'),
  ('carbon', 3000, 'pro'),
  ('golddriver', 12000, 'legend'),
  ('pompoms', 250, 'member'),
  ('tigers', 2000, 'pro'),
  ('pencil', 300, 'member'),
  ('schoolbag', 1000, 'member'),
  ('goldstaff', 3000, 'pro'),
  ('leatherbag', 4000, 'pro'),
  ('crocbag', 16000, 'legend'),
  ('caddie', 50000, 'legend'),
  -- the Tour Collection, on the shop floor (src/shop.ts tourItems)
  ('tourzip', 1800, 'member'),
  ('finalred', 2500, 'member'),
  ('hoodie', 1600, 'member'),
  ('crewneck', 1200, 'member'),
  ('quiltvest', 2200, 'member'),
  ('joggers', 1300, 'member'),
  ('slimtour', 1500, 'member'),
  ('tourspike', 2000, 'member'),
  ('hightop', 1700, 'member'),
  ('ropecap', 1000, 'member'),
  ('flatbrim', 1100, 'member'),
  ('tourbucket', 1200, 'member'),
  ('halfrims', 1400, 'member'),
  ('tourglove', 1000, 'member'),
  ('tourstaff', 3500, 'member'),
  ('standbag', 1500, 'member'),
  ('bladeputter', 2200, 'member'),
  ('mattedriver', 2800, 'member')
on conflict (id) do update set price = excluded.price, rack = excluded.rack;

create table if not exists purchases (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade,
  item text not null references shop_items,
  price int not null,
  created_at timestamptz not null default now(),
  unique (player_id, item)
);
alter table purchases enable row level security;
-- taken off the Legend rack before anyone bought them (kept if someone ever did)
delete from shop_items where id in ('sequin', 'stud', 'blackdiamond') and id not in (select item from purchases);

-- ---------- Club bonuses (src/bonus.ts): the side money on top of the purse ----------

-- each hole's par on the courses played before rounds kept their own (and the ones since, as a fallback)
create table if not exists course_pars (course text primary key, pars int[] not null);
alter table course_pars enable row level security;
insert into course_pars (course, pars) values ('highlands', '{5,3,4}'), ('caldera', '{4,5,5,3,4,4}'), ('pacificbluffs', '{4,5,3}')
on conflict (course) do update set pars = excluded.pars;

-- every past day's Closest to the Pin winner across all clubs, as a person (lower name, PIN hash), ranked as
-- daily_crown ranks a day: holed first, holed sooner, then nearest, then the next-best try, then the earlier player
create or replace function ctp_winners() returns table (day date, k text, h text)
language sql stable security definer set search_path = public, extensions as $$
  with t as (
    select s.day, lower(p.name) as k, p.pin_hash as h, s.try, s.holed, s.lost, s.ft, s.created_at
    from daily_shots s join players p on p.id = s.player_id
    where s.day < (now() at time zone 'America/New_York')::date
  ), best as (
    select t.day, t.k, t.h, bool_or(t.holed) as holed, min(t.try) filter (where t.holed) as htry,
      array_agg(case when t.holed then 0 when t.lost then null else t.ft end order by case when t.holed then 0 when t.lost then null else t.ft end asc nulls last) as fts,
      min(t.created_at) as first_at
    from t group by t.day, t.k, t.h
  )
  select distinct on (b.day) b.day, b.k, b.h from best b
  where b.holed or b.fts[1] is not null
  order by b.day, b.holed desc, b.htry asc nulls last, b.fts[1] asc nulls last, b.fts[2] asc nulls last, b.fts[3] asc nulls last, b.first_at
$$;
revoke all on function ctp_winners() from public, anon, authenticated;

-- what a person has earned on the side, across their clubs: $50 a day they finish a round, $100 on the third day running
-- at the club and $250 every seventh, $150 a Closest to the Pin win, and $25 a birdie, $100 an eagle, $500 an ace on
-- the day's first finished round (so replaying a short course isn't a money farm). From the shots on their cards: $75 a
-- holed putt from 30 ft, $200 from 60 ft, $100 a chip-in from off the green. $150 the first time they find each hole's
-- secret on a card. And $100 each time another member finishes one of their Members' Course holes (once per member per
-- hole per week, up to $500 a week). From Nov 8 a day has one card, so none of this grows with replays.
-- One-off credits to a person's club bonus, by name and PIN (one person across their clubs): a correction the Committee
-- makes, with its reason. Counted in person_bonus (grants), so it lands in career earnings and the spending balance.
create table if not exists bonus_grants (
  id bigserial primary key,
  k text not null,
  h text not null,
  amount int not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table bonus_grants enable row level security;

-- Trophy money: what each plaque paid a person (see claim_trophies further down)
create table if not exists trophy_pay (
  k text not null,
  h text not null,
  plaque text not null,
  amount int not null default 0,
  created_at timestamptz not null default now(),
  primary key (k, h, plaque)
);
alter table trophy_pay enable row level security;

create or replace function person_bonus(p players) returns json
language sql stable security definer set search_path = public, extensions as $$
  with seats as (select person_seats(p) as id),
  r as (
    select r.holes, r.created_at, coalesce(r.pars, cp.pars) as hp,
      row_number() over (partition by (r.created_at at time zone 'America/New_York')::date order by r.created_at) as nth
    from rounds r left join course_pars cp on cp.course = r.course where r.player_id in (select id from seats)
  ),
  shots as (
    select r.holes[i] as s, r.hp[i] as par, r.created_at from r cross join lateral generate_subscripts(r.holes, 1) i
    where r.nth = 1 and array_length(r.hp, 1) = array_length(r.holes, 1)
  ),
  strokes as (
    select x.id, (e->>'c') as c, coalesce((e->>'i')::int, 0) as i, e->>'l' as l,
      row_number() over (partition by x.id, e->>'h' order by k) as nth,
      sqrt(power(coalesce((e->'f'->>0)::numeric, 0) - coalesce((e->'t'->>0)::numeric, 0), 2) + power(coalesce((e->'f'->>1)::numeric, 0) - coalesce((e->'t'->>1)::numeric, 0), 2)) as d
    from rounds x cross join lateral jsonb_array_elements(case when jsonb_typeof(x.shots) = 'array' then x.shots else '[]'::jsonb end) with ordinality a(e, k)
    -- daily cards only: one a day, so a long putt or a chip-in can't be farmed on replays
    where x.player_id in (select id from seats) and x.card
  ),
  days as (
    select distinct d from (
      select md.day as d from member_days md where md.player_id in (select id from seats)
      union select (x.created_at at time zone 'America/New_York')::date from rounds x where x.player_id in (select id from seats)
      union select (ps.started_at at time zone 'America/New_York')::date from practice_sessions ps where ps.player_id in (select id from seats)
    ) u
  ),
  runs as (select count(*)::int as n from (select d - (row_number() over (order by d))::int as grp from days) z group by grp),
  b as (
    select
      50 * (select count(distinct (r.created_at at time zone 'America/New_York')::date) from r)::int as rounds,
      (select coalesce(sum(case when n >= 3 then 100 else 0 end + (n / 7) * 250), 0) from runs)::int as streaks,
      150 * (select count(*) from ctp_winners() w where w.k = lower(p.name) and w.h = p.pin_hash)::int as ctp,
      -- birdie $100, eagle $500, albatross $1,000, ace $2,500 (src/bonus.ts) for holes from Nov 10 2026; before that the
      -- old rates, $25, $100 (an albatross too) and $500: the raise isn't paid back
      (select coalesce(sum(case when created_at >= timestamp '2026-11-10 00:00' at time zone 'America/New_York'
        then case when s = 1 then 2500 when s <= par - 3 then 1000 when s = par - 2 then 500 when s = par - 1 then 100 else 0 end
        else case when s = 1 then 500 when s <= par - 2 then 100 when s = par - 1 then 25 else 0 end end), 0) from shots)::int as shots,
      (select coalesce(sum(case when d >= 60 then 200 when d >= 30 then 75 else 0 end), 0) from strokes where c = 'putter' and i = 1)::int as putts,
      100 * (select count(*) from strokes where c <> 'putter' and i = 1 and coalesce(l, '') <> 'green' and nth > 1)::int as chipins,
      150 * (select count(distinct f) from rounds x cross join lateral unnest(x.feats) f where x.player_id in (select id from seats) and x.card and f = any (secret_feats()))::int as secrets,
      (select coalesce(sum(least(500, 100 * n)), 0) from (select dp.week, count(*) as n from design_plays dp join designs d on d.id = dp.design_id where d.player_id in (select id from seats) group by dp.week) w)::int as designs,
      (select coalesce(sum(amount), 0) from bonus_grants g where g.k = lower(p.name) and g.h = p.pin_hash)::int as grants,
      -- plaques earned from Nov 12 (trophy_pay, above)
      (select coalesce(sum(amount), 0) from trophy_pay t where t.k = lower(p.name) and t.h = p.pin_hash)::int as trophies
  )
  select json_build_object('rounds', b.rounds, 'streaks', b.streaks, 'ctp', b.ctp, 'shots', b.shots,
    'putts', b.putts, 'chipins', b.chipins, 'secrets', b.secrets, 'designs', b.designs, 'grants', b.grants, 'trophies', b.trophies,
    'total', b.rounds + b.streaks + b.ctp + b.shots + b.putts + b.chipins + b.secrets + b.designs + b.grants + b.trophies) from b
$$;
revoke all on function person_bonus(players) from public, anon, authenticated;

create or replace function buy_item(p_token uuid, p_item text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := play_seat(player_for(p_token)); it shop_items; earned int; spent int;
begin
  select * into it from shop_items where id = p_item;
  if it.id is null then raise exception 'That isn''t in the shop.'; end if;
  -- one wallet and one closet, whichever club you shop from
  if exists (select 1 from purchases where player_id in (select person_seats(me)) and item = p_item) then return; end if;
  select coalesce(sum(pp.payout), 0) into earned
    from (select distinct s.group_id from players s where s.id in (select person_seats(me))) g
    cross join lateral period_payouts(g.group_id) pp where pp.player_id in (select person_seats(me));
  earned := earned + (person_bonus(me)->>'total')::int;
  spent := person_spent(me);
  -- the Club Legend rack also needs a weekly title, at any of their clubs
  if it.rack = 'legend' and not exists (
    select 1 from (select distinct s.group_id from players s where s.id in (select person_seats(me))) g
    cross join lateral period_champs(g.group_id) c where c.player_id in (select person_seats(me)) and c.how <> 'playoff'
  ) then
    raise exception 'The Club Legend rack opens with a weekly title.';
  end if;
  if (it.rack = 'pro' and earned < 5000) or (it.rack = 'legend' and earned < 25000) then
    raise exception 'That rack is for higher ranks.';
  end if;
  if earned - spent < it.price then raise exception 'Not enough in the bank for that.'; end if;
  insert into purchases (player_id, item, price) values (me.id, p_item, it.price);
end $$;
grant execute on function buy_item(uuid, text) to anon;

-- The Midway's power-ups (Eli's game, from Nov 10): bought at the Prize Counter with the same money as the Pro Shop,
-- held in your locker (three at most), and used on a Midway tee, one a hole. The Magnet: a ball that stops on the green
-- within 6 ft drops. The Express Lane: a tee shot into the painted circle on the Lane goes straight to the front of the
-- green. (Curses, the Pickpocket, the Prenup and Pass It On come next; the ledger already has room for them.)
create table if not exists powerups (
  id bigserial primary key,
  owner_id uuid not null references players on delete cascade,
  kind text not null,
  price int not null default 0,
  status text not null default 'held' check (status in ('held', 'used', 'stolen', 'blocked', 'pending', 'landed', 'passed')),
  from_id uuid references players on delete set null,
  target_id uuid references players on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
alter table powerups enable row level security;
create index if not exists powerups_owner on powerups (owner_id, status);

-- what each costs at the Prize Counter (null: not for sale)
create or replace function powerup_price(p_kind text) returns int language sql immutable as $$
  select case p_kind when 'magnet' then 400 when 'express' then 500 when 'prenup' then 200 when 'passon' then 250
    when 'pickpocket' then 350
    when 'goggles' then 200 when 'shortpour' then 300 when 'lid' then 300 when 'ironsonly' then 250 when 'bouncer' then 350 end
$$;
-- the ones you keep in your locker (three at most), and the curses you send
create or replace function powerup_held(p_kind text) returns boolean language sql immutable as $$ select p_kind in ('magnet', 'express', 'prenup', 'passon') $$;
create or replace function powerup_curse(p_kind text) returns boolean language sql immutable as $$ select p_kind in ('goggles', 'shortpour', 'lid', 'ironsonly', 'bouncer') $$;

-- what a person has spent, across their seats: the Pro Shop and the Prize Counter
-- Games against Mo: every bet, and what came back (see bj_deal and friends further down)
create table if not exists casino (
  id bigserial primary key,
  player_id uuid not null references players on delete cascade, -- the person's home seat
  game text not null check (game in ('blackjack', 'popashot', 'billiards')),
  stake int not null check (stake > 0),
  payout int, -- null while the bet is open
  state jsonb not null default '{}',
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
alter table casino enable row level security;
create index if not exists casino_player on casino (player_id, created_at);

create or replace function person_spent(me players) returns int
language sql stable security definer set search_path = public, extensions as $$
  select (coalesce((select sum(price) from purchases where player_id in (select person_seats(me))), 0)
    + coalesce((select sum(price) from powerups where owner_id in (select person_seats(me))), 0)
    -- the net of every bet against Mo (an open bet counts in full; a win counts as money back)
    + coalesce((select sum(stake - coalesce(payout, 0)) from casino where player_id in (select person_seats(me))), 0))::int
$$;
revoke all on function person_spent(players) from public, anon, authenticated;

create or replace function buy_powerup(p_token uuid, p_kind text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); cost int := powerup_price(p_kind); earned int;
begin
  if cost is null or not powerup_held(p_kind) then raise exception 'That isn''t at the Prize Counter.'; end if;
  if (select count(*) from powerups where owner_id in (select person_seats(me)) and status = 'held') >= 3 then
    raise exception 'Your locker holds three. Use one first.';
  end if;
  select coalesce(sum(pp.payout), 0) into earned
    from (select distinct s.group_id from players s where s.id in (select person_seats(me))) g
    cross join lateral period_payouts(g.group_id) pp where pp.player_id in (select person_seats(me));
  earned := earned + (person_bonus(me)->>'total')::int;
  if earned - person_spent(me) < cost then raise exception 'Not enough in the bank for that.'; end if;
  insert into powerups (owner_id, kind, price) values (me.id, p_kind, cost);
end $$;
grant execute on function buy_powerup(uuid, text) to anon;

-- what's left in a person's bank: everything earned less everything spent
create or replace function person_bank(me players) returns int
language plpgsql stable security definer set search_path = public, extensions as $$
declare earned int;
begin
  select coalesce(sum(pp.payout), 0) into earned
    from (select distinct s.group_id from players s where s.id in (select person_seats(me))) g
    cross join lateral period_payouts(g.group_id) pp where pp.player_id in (select person_seats(me));
  return earned + (person_bonus(me)->>'total')::int - person_spent(me);
end $$;
revoke all on function person_bank(players) from public, anon, authenticated;

-- your locker at the Midway, how many curses are waiting for your next round (not what or who: that's the surprise),
-- and the last week's news: pockets picked, curses sent and landed, Prenups that held
create or replace function powerup_state(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token));
  wk timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
begin
  return json_build_object(
    'locker', coalesce((select json_agg(json_build_object('id', pu.id, 'kind', pu.kind) order by pu.created_at)
      from powerups pu where pu.owner_id in (select person_seats(me)) and pu.status = 'held'), '[]'),
    'waiting', (select count(*) from powerups pu where pu.target_id in (select person_seats(me)) and pu.status = 'pending')::int,
    'sentThisWeek', (select count(*) from powerups pu where pu.owner_id in (select person_seats(me)) and powerup_curse(pu.kind) and pu.price > 0 and pu.created_at >= wk)::int,
    'news', coalesce((select json_agg(n order by n.at desc) from (
        select pu.kind, pu.status, pu.owner_id in (select person_seats(me)) as mine,
          (select x.name from players x where x.id = case when pu.owner_id in (select person_seats(me)) then pu.target_id else pu.owner_id end) as who,
          coalesce(pu.used_at, pu.created_at) as at
        from powerups pu
        where coalesce(pu.used_at, pu.created_at) > now() - interval '7 days'
          and pu.target_id is not null
          and (pu.owner_id in (select person_seats(me)) or pu.target_id in (select person_seats(me)))
          -- what happened to you, and what came of what you sent (a curse still waiting stays a surprise; a pocket picked
          -- shows once, as the power-up that went)
          and not (pu.status = 'pending' and pu.target_id in (select person_seats(me)))
          and not (pu.kind = 'pickpocket' and pu.status = 'used')
        order by coalesce(pu.used_at, pu.created_at) desc limit 12
      ) n), '[]'));
end $$;

-- a member to aim at: anyone in one of your clubs but you, as their home seat
create or replace function powerup_target(me players, p_target uuid) returns players
language plpgsql stable security definer set search_path = public, extensions as $$
declare t players;
begin
  select * into t from players where id = p_target;
  if t.id is null or not exists (select 1 from players s where s.id in (select person_seats(me)) and s.group_id = t.group_id) then
    raise exception 'Pick a member of your club.';
  end if;
  t := home_of(t);
  if lower(t.name) = lower(me.name) and t.pin_hash = me.pin_hash then raise exception 'Not yourself. Pick someone else.'; end if;
  return t;
end $$;
revoke all on function powerup_target(players, uuid) from public, anon, authenticated;

-- the target's Prenup, if they're holding one: it's used up stopping this
create or replace function prenup_holds(t players) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare n bigint;
begin
  update powerups set status = 'used', used_at = now()
    where id = (select id from powerups where owner_id in (select person_seats(t)) and kind = 'prenup' and status = 'held' order by created_at limit 1)
    returning id into n;
  return n is not null;
end $$;
revoke all on function prenup_holds(players) from public, anon, authenticated;

-- send a curse: it waits for their next counting Midway round (one hole each; the Bouncer, their power-ups that round).
-- Three a week from you, two waiting on anyone at once. A Prenup stops it, and you've still paid.
create or replace function send_curse(p_token uuid, p_kind text, p_target uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); t players; cost int := powerup_price(p_kind);
  wk timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
begin
  if cost is null or not powerup_curse(p_kind) then raise exception 'That isn''t a curse.'; end if;
  t := powerup_target(me, p_target);
  if (select count(*) from powerups where owner_id in (select person_seats(me)) and powerup_curse(kind) and price > 0 and created_at >= wk) >= 3 then
    raise exception 'Three curses a week. Save some malice for next week.';
  end if;
  if (select count(*) from powerups where target_id in (select person_seats(t)) and status = 'pending') >= 2 then
    raise exception '% already has two curses waiting. Let them suffer those first.', t.name;
  end if;
  if person_bank(me) < cost then raise exception 'Not enough in the bank for that.'; end if;
  if prenup_holds(t) then
    insert into powerups (owner_id, kind, price, status, target_id, used_at) values (me.id, p_kind, cost, 'blocked', t.id, now());
    return 'blocked';
  end if;
  insert into powerups (owner_id, kind, price, status, target_id) values (me.id, p_kind, cost, 'pending', t.id);
  return 'sent';
end $$;
grant execute on function send_curse(uuid, text, uuid) to anon;

-- the Pickpocket: take one power-up at random from a member's locker (a Prenup stops it, and you've still paid)
create or replace function pick_pocket(p_token uuid, p_target uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); t players; cost int := powerup_price('pickpocket'); got powerups;
begin
  t := powerup_target(me, p_target);
  if not exists (select 1 from powerups where owner_id in (select person_seats(t)) and status = 'held') then
    raise exception '%''s locker is empty. Nothing to pick.', t.name;
  end if;
  if (select count(*) from powerups where owner_id in (select person_seats(me)) and status = 'held') >= 3 then
    raise exception 'Your locker holds three. Use one first.';
  end if;
  if person_bank(me) < cost then raise exception 'Not enough in the bank for that.'; end if;
  if prenup_holds(t) then
    insert into powerups (owner_id, kind, price, status, target_id, used_at) values (me.id, 'pickpocket', cost, 'blocked', t.id, now());
    return 'blocked';
  end if;
  select * into got from powerups where owner_id in (select person_seats(t)) and status = 'held' order by random() limit 1;
  -- theirs is gone (they paid for it), and a copy lands in your locker for nothing
  update powerups set status = 'stolen', target_id = me.id, used_at = now() where id = got.id;
  insert into powerups (owner_id, kind, price, status, from_id) values (me.id, got.kind, 0, 'held', t.id);
  insert into powerups (owner_id, kind, price, status, target_id, used_at) values (me.id, 'pickpocket', cost, 'used', t.id, now());
  return got.kind;
end $$;
grant execute on function pick_pocket(uuid, uuid) to anon;

-- at the start of your counting Midway round: the curses waiting for you land, and you see who sent what
create or replace function land_curses(p_token uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); out json;
begin
  select coalesce(json_agg(json_build_object('id', pu.id, 'kind', pu.kind, 'from', (select name from players where id = coalesce(pu.from_id, pu.owner_id)),
      'via', case when pu.from_id is not null then (select name from players where id = pu.owner_id) end) order by pu.created_at), '[]')
    into out from powerups pu where pu.target_id in (select person_seats(me)) and pu.status = 'pending';
  update powerups set status = 'landed', used_at = now() where target_id in (select person_seats(me)) and status = 'pending';
  return out;
end $$;
grant execute on function land_curses(uuid) to anon;

-- Pass It On: a curse that just landed on you goes to someone else instead (your Pass It On is used up). It waits for
-- their next round, under the same caps; their Prenup stops it.
create or replace function pass_curse(p_token uuid, p_curse bigint, p_target uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); t players; c powerups; pass bigint;
begin
  select * into c from powerups where id = p_curse and target_id in (select person_seats(me)) and status = 'landed' and used_at > now() - interval '1 hour';
  if c.id is null then raise exception 'That curse can''t be passed on now.'; end if;
  t := powerup_target(me, p_target);
  if (select count(*) from powerups where target_id in (select person_seats(t)) and status = 'pending') >= 2 then
    raise exception '% already has two curses waiting.', t.name;
  end if;
  update powerups set status = 'used', used_at = now()
    where id = (select id from powerups where owner_id in (select person_seats(me)) and kind = 'passon' and status = 'held' order by created_at limit 1)
    returning id into pass;
  if pass is null then raise exception 'You need a Pass It On in your locker.'; end if;
  update powerups set status = 'passed' where id = c.id;
  if prenup_holds(t) then
    insert into powerups (owner_id, kind, price, status, target_id, from_id, used_at) values (me.id, c.kind, 0, 'blocked', t.id, c.owner_id, now());
    return 'blocked';
  end if;
  insert into powerups (owner_id, kind, price, status, target_id, from_id) values (me.id, c.kind, 0, 'pending', t.id, c.owner_id);
  return 'passed';
end $$;
grant execute on function pass_curse(uuid, bigint, uuid) to anon;
grant execute on function powerup_state(uuid) to anon;

-- use one from your locker on a Midway tee: it's spent whatever happens on the hole
create or replace function use_powerup(p_token uuid, p_id bigint) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); k text;
begin
  update powerups set status = 'used', used_at = now()
    where id = p_id and owner_id in (select person_seats(me)) and status = 'held'
    returning kind into k;
  if k is null then raise exception 'That power-up isn''t in your locker.'; end if;
  return k;
end $$;
grant execute on function use_powerup(uuid, bigint) to anon;


-- Kudos and chirps: tap another member out on the course, see their card, and send them a kudos or a chirp (one of
-- the ready-made lines, or your own in 80 characters). It shows on their home page next time they open the app,
-- until they clear it (one at a time, or all), or for a day at most. Members of the same club only; 20 a day from a
-- member and 3 a day to any one member. The Committee can take any down from Admin.
create table if not exists shoutouts (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  from_id uuid not null references players on delete cascade,
  to_id uuid not null references players on delete cascade,
  kind text not null check (kind in ('kudos', 'chirp')),
  body text not null check (char_length(body) between 1 and 80),
  seen boolean not null default false,
  removed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shoutouts_to on shoutouts (to_id, created_at desc);
create index if not exists shoutouts_from on shoutouts (from_id, created_at desc);
alter table shoutouts enable row level security;

create or replace function send_shoutout(p_token uuid, p_to uuid, p_kind text, p_body text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); them players; clean text := trim(regexp_replace(coalesce(p_body, ''), '\s+', ' ', 'g'));
  today timestamptz := (game_today()::timestamp) at time zone 'America/New_York';
begin
  if p_kind not in ('kudos', 'chirp') then raise exception 'Kudos or a chirp, nothing else.'; end if;
  if char_length(clean) not between 1 and 80 then raise exception 'Keep it to 80 characters.'; end if;
  select * into them from players where id = p_to;
  if not found or them.group_id <> me.group_id then raise exception 'They are not in your club.'; end if;
  if them.id = me.id then raise exception 'You cannot chirp yourself. Well, you can, but not here.'; end if;
  if (select count(*) from shoutouts where from_id = me.id and created_at >= today) >= 20 then
    raise exception 'That is twenty for today. Save some for tomorrow.'; end if;
  if (select count(*) from shoutouts where from_id = me.id and to_id = them.id and created_at >= today) >= 3 then
    raise exception 'Three to one member is plenty for one day.'; end if;
  insert into shoutouts (group_id, from_id, to_id, kind, body) values (me.group_id, me.id, them.id, p_kind, clean);
end $$;

-- what's waiting for me, in every club I'm a member of: unseen, from the last 24 hours (they clear themselves after a
-- day), newest first
create or replace function my_shoutouts(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((
    select json_agg(json_build_object('id', s.id, 'kind', s.kind, 'body', s.body, 'from', f.name, 'fromAvatar', f.avatar,
      'createdAt', s.created_at) order by s.created_at desc)
    from (select * from shoutouts s
      where s.to_id in (select p.id from players p where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash)
        and not s.seen and not s.removed and s.created_at > now() - interval '24 hours'
      order by s.created_at desc limit 12) s
    join players f on f.id = s.from_id
  ), '[]');
end $$;

create or replace function seen_shoutouts(p_token uuid, p_ids bigint[]) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  update shoutouts set seen = true
  where id = any(p_ids) and to_id in (select p.id from players p where lower(p.name) = lower(me.name) and p.pin_hash = me.pin_hash);
end $$;

-- the Committee's view: the last fortnight's, across their clubs, with a way to take one down
create or replace function admin_shoutouts(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see the admin tab.'; end if;
  return coalesce((
    select json_agg(json_build_object('id', s.id, 'kind', s.kind, 'body', s.body, 'from', f.name, 'to', t.name,
      'seen', s.seen, 'removed', s.removed, 'createdAt', s.created_at) order by s.created_at desc)
    from (select * from shoutouts where group_id in (select admin_clubs(me)) and created_at > now() - interval '14 days'
      order by created_at desc limit 60) s
    join players f on f.id = s.from_id join players t on t.id = s.to_id
  ), '[]');
end $$;

create or replace function remove_shoutout(p_token uuid, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can take these down.'; end if;
  update shoutouts set removed = true where id = p_id and group_id in (select admin_clubs(me));
end $$;

grant execute on function send_shoutout(uuid, uuid, text, text) to anon;
grant execute on function my_shoutouts(uuid) to anon;
grant execute on function seen_shoutouts(uuid, bigint[]) to anon;
grant execute on function admin_shoutouts(uuid) to anon;
grant execute on function remove_shoutout(uuid, bigint) to anon;

-- The Committee's course picks: which course a week plays, chosen in the Committee Room (src/golf3d/courses.ts
-- setSchedule). A week without a pick follows the calendar in the code. Only future weeks can be picked or changed,
-- so a week's board never changes course under it.
create table if not exists course_schedule (
  period text primary key check (period ~ '^\d{4}-\d{2}-\d{2}$'),
  course text not null check (char_length(course) between 1 and 40),
  set_by uuid references players on delete set null,
  set_at timestamptz not null default now()
);
alter table course_schedule enable row level security;

create or replace function course_schedule(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((select json_object_agg(period, course) from course_schedule), '{}'::json);
end $$;
grant execute on function course_schedule(uuid) to anon;

create or replace function set_course_schedule(p_token uuid, p_period text, p_course text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can pick the course.'; end if;
  if coalesce(p_period, '') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'A week starts on a Sunday.'; end if;
  if extract(dow from p_period::date) <> 0 then raise exception 'A week starts on a Sunday.'; end if;
  if p_period <= game_month() then raise exception 'That week has already started.'; end if;
  if nullif(p_course, '') is null then
    delete from course_schedule where period = p_period;
  else
    if char_length(p_course) > 40 then raise exception 'Unknown course.'; end if;
    insert into course_schedule (period, course, set_by) values (p_period, p_course, me.id)
    on conflict (period) do update set course = excluded.course, set_by = excluded.set_by, set_at = now();
  end if;
end $$;
grant execute on function set_course_schedule(uuid, text, text) to anon;

-- The Trophy Room (src/trophies.ts has the plaques and their thresholds): one person's progress, across all their seats,
-- from what's already recorded. p_player: anyone's card (a seat in any club); null for your own.
create or replace function trophy_progress(p_token uuid, p_player uuid default null) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); p players;
begin
  if p_player is null then p := home_of(me);
  else
    select * into p from players where id = p_player;
    if not found then return null; end if;
    p := home_of(p);
  end if;
  return (
    with seats as (select id, group_id from players where lower(name) = lower(p.name) and pin_hash = p.pin_hash),
    rd as (
      select r.*, coalesce(r.pars, cp.pars) as hp from rounds r left join course_pars cp on cp.course = r.course
      where r.player_id in (select id from seats)
    ),
    holes as (
      select rd.id, rd.course, i as n, rd.holes[i] as s, rd.hp[i] as par from rd cross join lateral generate_subscripts(rd.holes, 1) i
      where array_length(rd.hp, 1) = array_length(rd.holes, 1)
    ),
    strokes as (
      select x.id, (e->>'c') as c, coalesce((e->>'i')::int, 0) as i, e->>'l' as l,
        row_number() over (partition by x.id, e->>'h' order by k) as nth,
        sqrt(power(coalesce((e->'f'->>0)::numeric, 0) - coalesce((e->'t'->>0)::numeric, 0), 2) + power(coalesce((e->'f'->>1)::numeric, 0) - coalesce((e->'t'->>1)::numeric, 0), 2)) as d
      from rd x cross join lateral jsonb_array_elements(case when jsonb_typeof(x.shots) = 'array' then x.shots else '[]'::jsonb end) with ordinality a(e, k)
    ),
    days as (
      select distinct d from (
        select md.day as d from member_days md where md.player_id in (select id from seats)
        union select (x.created_at at time zone 'America/New_York')::date from rounds x where x.player_id in (select id from seats)
        union select (ps.started_at at time zone 'America/New_York')::date from practice_sessions ps where ps.player_id in (select id from seats)
      ) u
    ),
    runs as (select count(*)::int as n from (select d - (row_number() over (order by d))::int as grp from days) z group by grp),
    people as (
      select distinct on (lower(x.name), x.pin_hash) lower(x.name) as k, x.pin_hash as h, x.id as home_id
      from players x order by lower(x.name), x.pin_hash, x.host_only, x.created_at
    ),
    obest as (
      select distinct on (r.month, pe.home_id) r.month, pe.home_id, r.total - r.par as tp
      from people pe join players x on lower(x.name) = pe.k and x.pin_hash = pe.h join rounds r on r.player_id = x.id
      where r.month >= open_purse_from() and r.month < game_month() and not x.host_only
      order by r.month, pe.home_id, r.total - r.par, r.created_at
    ),
    open_ranked as (select o.*, rank() over (partition by o.month order by o.tp)::int as r from obest o),
    mine_open as (select * from open_ranked where home_id = p.id),
    birdie_holes as (select course, json_agg(distinct n order by n) as ns from holes where s <= par - 1 group by course)
    select json_build_object(
      'playerId', p.id,
      'name', p.name,
      'birdies', (select count(*) from holes where s = par - 1 and s <> 1),
      'eagles', (select count(*) from holes where s <= par - 2 and s <> 1),
      'albatross', (select count(*) from holes where s <= par - 3 and s <> 1),
      'aces', (select count(*) from holes where s = 1),
      'cards', (select count(*) from rd),
      'underpar', (select count(*) from rd where total < par),
      'bogeyfree', (select count(*) from (select id from holes group by id having bool_and(s <= par)) b),
      'putts30', (select count(*) from strokes where c = 'putter' and i = 1 and d >= 30),
      'putts60', (select count(*) from strokes where c = 'putter' and i = 1 and d >= 60),
      'chipins', (select count(*) from strokes where c <> 'putter' and i = 1 and coalesce(l, '') <> 'green' and nth > 1),
      'pinseeker', (select count(*) from daily_shots s where s.player_id in (select id from seats) and (s.holed or s.ft <= 3)),
      'longdrive', (select coalesce(max(score), 0) from bar_scores b where b.player_id in (select id from seats) and b.game = 'drive'),
      'streak', (select coalesce(max(n), 0) from runs),
      'ctpwins', (select count(*) from ctp_winners() w where w.k = lower(p.name) and w.h = p.pin_hash),
      'designplayers', (select count(distinct dp.player_id) from design_plays dp join designs d on d.id = dp.design_id
        where d.player_id in (select id from seats) and dp.player_id not in (select id from seats)),
      'titles', (select count(*) from (select distinct group_id from seats) g cross join lateral period_champs(g.group_id) c
        where c.player_id in (select id from seats) and c.how <> 'playoff'),
      'openwins', (select count(*) from mine_open where r = 1),
      'opentop10', (select count(*) from mine_open where r <= 10),
      'secrets', (select coalesce(json_agg(distinct f), '[]') from rd cross join lateral unnest(rd.feats) f where f = any (secret_feats())),
      'birdieHoles', (select coalesce(json_object_agg(course, ns), '{}') from birdie_holes)
    )
  );
end $$;
grant execute on function trophy_progress(uuid, uuid) to anon;

-- Nominate a friend: a member puts someone up for membership with a first name and a mobile number, from home. Only
-- the Committee reads them (admin_nominations). Approving makes the personal invitation, for the Committee to text
-- from their own phone; declining clears it. Either way the number is wiped once decided: the club keeps no phone
-- numbers of people who haven't joined. The member who put them up hears only when the friend joins.
create table if not exists nominations (
  id bigserial primary key,
  group_id uuid not null references groups on delete cascade,
  nominated_by uuid references players on delete set null,
  name text not null check (char_length(name) between 1 and 20),
  phone text check (char_length(phone) <= 20), -- e.g. '+15551234567'; null once decided
  status text not null default 'pending' check (status in ('pending', 'invited', 'declined')),
  invite_id text references invitations on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table nominations enable row level security;
create index if not exists nominations_by on nominations (nominated_by, created_at);

-- A mobile number, tidied: 10 digits (or 11 starting with 1) is a US number; anything else needs its + and country code
create or replace function clean_phone(p_phone text) returns text
language plpgsql immutable set search_path = public, extensions as $$
declare d text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  if char_length(d) = 10 then return '+1' || d; end if;
  if char_length(d) = 11 and left(d, 1) = '1' then return '+' || d; end if;
  if left(trim(coalesce(p_phone, '')), 1) = '+' and char_length(d) between 8 and 15 then return '+' || d; end if;
  raise exception 'That number doesn''t look right. A mobile number, please, with the country code if it''s not American.';
end $$;

create or replace function nominate_friend(p_token uuid, p_name text, p_phone text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); clean text := trim(p_name); ph text := clean_phone(p_phone);
begin
  if char_length(clean) not between 1 and 20 then raise exception 'Their first name, please (up to 20 letters).'; end if;
  -- three a day each is plenty
  if (select count(*) from nominations where nominated_by = me.id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Three in a day is generous enough. Do come back tomorrow.';
  end if;
  if exists (select 1 from nominations where group_id = me.group_id and phone = ph and status = 'pending') then
    raise exception 'Someone has already put them up. The Committee has their name.';
  end if;
  insert into nominations (group_id, nominated_by, name, phone) values (me.group_id, me.id, clean, ph);
end $$;

-- A member's own nominations, for the tile on home: who's waiting, and who has joined. Declines aren't shown.
create or replace function my_nominations(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  return coalesce((
    select json_agg(json_build_object('name', n.name,
        'status', case when i.used_by is not null then 'joined' else 'waiting' end,
        'at', coalesce(i.used_at, n.created_at)) order by coalesce(i.used_at, n.created_at) desc)
    from nominations n left join invitations i on i.id = n.invite_id
    where n.nominated_by = me.id and n.status <> 'declined' and n.created_at > now() - interval '60 days'
  ), '[]');
end $$;

-- The Committee's list: every nomination waiting in the clubs they run, and the friends who joined from one lately
create or replace function admin_nominations(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := player_for(p_token);
begin
  if me.role <> 'admin' then raise exception 'Only the committee can see nominations.'; end if;
  return json_build_object(
    'pending', coalesce((select json_agg(json_build_object('id', n.id, 'club', g.name, 'name', n.name, 'phone', n.phone,
        'from', p.name, 'fromId', case when p.id is null then null else (home_of(p)).id end, 'createdAt', n.created_at) order by n.created_at)
      from nominations n join groups g on g.id = n.group_id left join players p on p.id = n.nominated_by
      where n.status = 'pending' and n.group_id in (select admin_clubs(me))), '[]'),
    'joined', coalesce((select json_agg(json_build_object('club', g.name, 'name', j.name, 'id', j.id,
        'from', p.name, 'fromId', case when p.id is null then null else (home_of(p)).id end, 'at', i.used_at) order by i.used_at desc)
      from nominations n join groups g on g.id = n.group_id join invitations i on i.id = n.invite_id
        join players j on j.id = i.used_by left join players p on p.id = n.nominated_by
      where n.group_id in (select admin_clubs(me)) and i.used_at > now() - interval '14 days'), '[]'));
end $$;

-- Approve: the personal invitation is made (in the friend's club), and the number comes back once for the text.
-- Decline: it's cleared. Both wipe the number.
create or replace function decide_nomination(p_token uuid, p_id bigint, p_approve boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := player_for(p_token); n nominations; v_code text; v_id text;
begin
  if me.role <> 'admin' then raise exception 'Only the committee can decide nominations.'; end if;
  select * into n from nominations where id = p_id and group_id in (select admin_clubs(me)) and status = 'pending' for update;
  if not found then raise exception 'That nomination has already been dealt with.'; end if;
  if not p_approve then
    update nominations set status = 'declined', phone = null, decided_at = now() where id = n.id;
    return null;
  end if;
  loop
    v_code := invite_code();
    exit when not exists (select 1 from invitations where code = v_code) and not exists (select 1 from groups where invite_code = v_code);
  end loop;
  v_id := rand_code(10);
  insert into invitations (id, group_id, name, code, created_by) values (v_id, n.group_id, n.name, v_code, me.id);
  update nominations set status = 'invited', invite_id = v_id, phone = null, decided_at = now() where id = n.id;
  return json_build_object('inviteId', v_id, 'code', v_code, 'name', n.name, 'phone', n.phone,
    'from', (select name from players where id = n.nominated_by));
end $$;

revoke all on function clean_phone(text) from public, anon, authenticated;
grant execute on function nominate_friend(uuid, text, text) to anon;
grant execute on function my_nominations(uuid) to anon;
grant execute on function admin_nominations(uuid) to anon;
grant execute on function decide_nomination(uuid, bigint, boolean) to anon;

-- Trophy money (from Nov 12): a plaque earned from then on pays once, by its rung. Plaques already held on Nov 12 were
-- recorded at $0 when this went in (the baseline), so only new ones pay. One person across their clubs (by name and
-- PIN, as bonus_grants). Counted in person_bonus as 'trophies', so it lands in career earnings and the spending balance.
-- (trophy_pay is made above, before person_bonus, which reads it)

-- Every plaque: its id (as src/trophies.ts names it), the trophy_progress field it reads, what earns it, and what it
-- pays. Keep in step with plaques() in src/trophies.ts and TROPHY_PAY there. A ladder pays $250, $750 and $2,000 by rung.
create or replace function plaque_catalog() returns table (id text, field text, need int, amount int)
language sql immutable as $$
  values
    ('titles1', 'titles', 1, 250), ('titles3', 'titles', 3, 750), ('titles5', 'titles', 5, 2000),
    ('openwin', 'openwins', 1, 2000),
    ('opentop1', 'opentop10', 1, 250), ('opentop5', 'opentop10', 5, 750), ('opentop10', 'opentop10', 10, 2000),
    ('birdies10', 'birdies', 10, 250), ('birdies25', 'birdies', 25, 750), ('birdies100', 'birdies', 100, 2000),
    ('eagles1', 'eagles', 1, 250), ('eagles5', 'eagles', 5, 750), ('eagles15', 'eagles', 15, 2000),
    ('albatross', 'albatross', 1, 2000), ('ace', 'aces', 1, 750), ('aceclub', 'aces', 3, 2000),
    ('underpar1', 'underpar', 1, 250), ('underpar5', 'underpar', 5, 750), ('underpar20', 'underpar', 20, 2000),
    ('bogeyfree', 'bogeyfree', 1, 750),
    ('cards10', 'cards', 10, 250), ('cards50', 'cards', 50, 750), ('cards100', 'cards', 100, 2000),
    ('putt30', 'putts30', 1, 250), ('putt30x10', 'putts30', 10, 750), ('putt60', 'putts60', 1, 750),
    ('chipins1', 'chipins', 1, 250), ('chipins5', 'chipins', 5, 750), ('chipins15', 'chipins', 15, 2000),
    ('pinseeker', 'pinseeker', 1, 250),
    ('drive325', 'longdrive', 325, 250), ('drive350', 'longdrive', 350, 750), ('drive400', 'longdrive', 400, 2000),
    ('streak7', 'streak', 7, 250), ('streak30', 'streak', 30, 750),
    ('ctp1', 'ctpwins', 1, 250), ('ctp5', 'ctpwins', 5, 750),
    ('designer', 'designplayers', 10, 750)
$$;

-- The plaques a trophy_progress reading has earned, with what each pays: the catalogue, each hole's secret ($250), and
-- a birdie on every hole of a course of three or more holes ($750)
create or replace function plaques_met(pr json) returns table (id text, amount int)
language sql stable set search_path = public, extensions as $$
  -- (numeric: the long drive is kept to a decimal, e.g. 280.0)
  select c.id, c.amount from plaque_catalog() c where coalesce((pr->>c.field)::numeric, 0) >= c.need
  union all
  select 'secret-' || z, 250 from json_array_elements_text(coalesce(pr->'secrets', '[]'::json)) z
  union all
  select 'master-' || b.key, 750 from json_each(coalesce(pr->'birdieHoles', '{}'::json)) b
  where json_array_length(b.value) >= 3
    and json_array_length(b.value) >= coalesce((select max(array_length(r.pars, 1)) from rounds r where r.course = b.key), 99)
$$;

-- Pay what's newly earned: called after a round, in the Trophy Room and after a bar game. Returns what it just paid.
create or replace function claim_trophies(p_token uuid) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); pr json := trophy_progress(p_token); paid json;
begin
  if pr is null then return '[]'; end if;
  with fresh as (
    insert into trophy_pay (k, h, plaque, amount)
    select lower(me.name), me.pin_hash, m.id, m.amount from plaques_met(pr) m
    on conflict (k, h, plaque) do nothing
    returning plaque, amount
  )
  select coalesce(json_agg(json_build_object('plaque', plaque, 'amount', amount)), '[]') into paid from fresh;
  return paid;
end $$;

-- What each plaque paid this person (the Trophy Room shows it)
create or replace function trophy_paid(p_token uuid) returns json
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(json_object_agg(t.plaque, t.amount), '{}') from trophy_pay t, home_of(player_for(p_token)) me
  where t.k = lower(me.name) and t.h = me.pin_hash
$$;

revoke all on function plaque_catalog() from public, anon, authenticated;
revoke all on function plaques_met(json) from public, anon, authenticated;
grant execute on function claim_trophies(uuid) to anon;
grant execute on function trophy_paid(uuid) to anon;

-- Games against Mo at the bar, for club money (from Nov 13): blackjack first, then Pop-a-Shot and 8-ball. It's play money:
-- nobody can buy club money or cash it out (keep it that way). Every bet is a row: the stake comes out of the bank when
-- it's placed (payout null), and what comes back is the payout (0 lost, the stake on a push, more on a win). The net
-- counts in person_spent, so it moves the spending balance but never career earnings or rank. $10 to $500 a bet, at
-- most $2,000 lost in a day (net, Eastern time), and never more than the bank holds. Cards are dealt on the server.
-- (the casino table is made above, before person_spent, which reads it)

-- what a person has lost to Mo today (net, Eastern time; open bets count in full)
create or replace function casino_lost_today(me players) returns int
language sql stable security definer set search_path = public, extensions as $$
  select coalesce(sum(stake - coalesce(payout, 0)), 0)::int from casino
  where player_id in (select person_seats(me)) and (created_at at time zone 'America/New_York')::date = game_today()
$$;

-- may this person put up this much more? (raises with the reason if not)
create or replace function casino_check(me players, p_more int) returns void
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_more is null or p_more <= 0 then raise exception 'Pick a stake.'; end if;
  if person_bank(me) < p_more then raise exception 'Not enough in the bank for that.'; end if;
  if casino_lost_today(me) + p_more > 2000 then
    raise exception 'That would put you over $2,000 down today. Mo''s cutting you off till tomorrow.';
  end if;
end $$;

-- a blackjack hand's value: aces count 11 unless that busts
create or replace function bj_value(cards int[]) returns int
language sql immutable as $$
  select case when t.total + 10 <= 21 and t.aces > 0 then t.total + 10 else t.total end from (
    select coalesce(sum(case when c % 13 = 0 then 1 when c % 13 >= 9 then 10 else c % 13 + 1 end), 0)::int as total,
      count(*) filter (where c % 13 = 0)::int as aces
    from unnest(cards) c
  ) t
$$;

-- what the player sees: their cards, Mo's (the hole card hidden until it's over), the totals, and how it ended
create or replace function bj_view(h casino, me players) returns json
language sql stable security definer set search_path = public, extensions as $$
  select json_build_object(
    'id', h.id, 'stake', h.stake, 'payout', h.payout, 'done', h.payout is not null,
    'outcome', h.state->>'outcome', 'doubled', coalesce((h.state->>'doubled')::boolean, false),
    'player', h.state->'p', 'playerTotal', bj_value(array(select jsonb_array_elements_text(h.state->'p')::int)),
    'dealer', case when h.payout is null then jsonb_build_array(h.state->'d'->0) else h.state->'d' end,
    'dealerTotal', case when h.payout is null then bj_value(array[(h.state->'d'->>0)::int])
      else bj_value(array(select jsonb_array_elements_text(h.state->'d')::int)) end,
    'bank', person_bank(me), 'lostToday', casino_lost_today(me))
$$;

-- settle a hand: Mo draws to 17 (he stands on every 17), then pay. 3 to 2 on a blackjack, even money on a win, the
-- stake back on a push, nothing on a loss. A doubled hand's stake is already doubled.
create or replace function bj_settle(p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare h casino; deck int[]; p int[]; d int[]; pv int; dv int; pbj boolean; dbj boolean; outcome text; pay int;
begin
  select * into h from casino where id = p_id for update;
  deck := array(select jsonb_array_elements_text(h.state->'deck')::int);
  p := array(select jsonb_array_elements_text(h.state->'p')::int);
  d := array(select jsonb_array_elements_text(h.state->'d')::int);
  pv := bj_value(p);
  pbj := pv = 21 and array_length(p, 1) = 2 and not coalesce((h.state->>'doubled')::boolean, false);
  dbj := bj_value(d) = 21 and array_length(d, 1) = 2;
  -- Mo plays his hand only if there's something to play against
  if pv <= 21 and not pbj then
    while bj_value(d) < 17 loop
      d := d || deck[1];
      deck := deck[2:];
    end loop;
  end if;
  dv := bj_value(d);
  if pv > 21 then outcome := 'bust'; pay := 0;
  elsif pbj and dbj then outcome := 'push'; pay := h.stake;
  elsif pbj then outcome := 'blackjack'; pay := h.stake + (h.stake * 3) / 2;
  elsif dbj then outcome := 'mo-blackjack'; pay := 0;
  elsif dv > 21 then outcome := 'mo-bust'; pay := h.stake * 2;
  elsif pv > dv then outcome := 'win'; pay := h.stake * 2;
  elsif pv = dv then outcome := 'push'; pay := h.stake;
  else outcome := 'lose'; pay := 0;
  end if;
  update casino set payout = pay, settled_at = now(),
    state = h.state || jsonb_build_object('deck', to_jsonb(deck), 'd', to_jsonb(d), 'outcome', outcome)
  where id = p_id;
end $$;

-- the table as it stands: an open hand if there is one, the bank, and today's losses
create or replace function bj_state(p_token uuid) returns json
language plpgsql stable security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); h casino;
begin
  select * into h from casino where player_id in (select person_seats(me)) and game = 'blackjack' and payout is null order by id desc limit 1;
  if found then return bj_view(h, me); end if;
  return json_build_object('bank', person_bank(me), 'lostToday', casino_lost_today(me));
end $$;

-- deal a hand: a fresh shuffled deck, two cards each; a blackjack on either side settles at once
create or replace function bj_deal(p_token uuid, p_stake int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); deck int[]; h casino;
begin
  if p_stake not between 10 and 500 then raise exception 'Bets are $10 to $500.'; end if;
  if exists (select 1 from casino where player_id in (select person_seats(me)) and game = 'blackjack' and payout is null) then
    raise exception 'Finish the hand in front of you first.';
  end if;
  perform casino_check(me, p_stake);
  deck := array(select c from generate_series(0, 51) c order by random());
  insert into casino (player_id, game, stake, state)
  values (me.id, 'blackjack', p_stake, jsonb_build_object('p', to_jsonb(array[deck[1], deck[3]]), 'd', to_jsonb(array[deck[2], deck[4]]), 'deck', to_jsonb(deck[5:])))
  returning * into h;
  if bj_value(array[deck[1], deck[3]]) = 21 or bj_value(array[deck[2], deck[4]]) = 21 then
    perform bj_settle(h.id);
    select * into h from casino where id = h.id;
  end if;
  return bj_view(h, me);
end $$;

-- hit, stand or double down (on the first two cards: the stake doubles, one more card, then Mo plays)
create or replace function bj_act(p_token uuid, p_id bigint, p_action text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); h casino; deck int[]; p int[];
begin
  select * into h from casino where id = p_id and player_id in (select person_seats(me)) and game = 'blackjack' for update;
  if not found then raise exception 'No such hand.'; end if;
  if h.payout is not null then return bj_view(h, me); end if;
  deck := array(select jsonb_array_elements_text(h.state->'deck')::int);
  p := array(select jsonb_array_elements_text(h.state->'p')::int);
  if p_action = 'double' then
    if array_length(p, 1) <> 2 then raise exception 'You can only double on your first two cards.'; end if;
    perform casino_check(me, h.stake);
    p := p || deck[1];
    update casino set stake = stake * 2, state = state || jsonb_build_object('p', to_jsonb(p), 'deck', to_jsonb(deck[2:]), 'doubled', true) where id = h.id;
    perform bj_settle(h.id);
  elsif p_action = 'hit' then
    p := p || deck[1];
    update casino set state = state || jsonb_build_object('p', to_jsonb(p), 'deck', to_jsonb(deck[2:])) where id = h.id;
    if bj_value(p) >= 21 then perform bj_settle(h.id); end if;
  elsif p_action = 'stand' then
    perform bj_settle(h.id);
  else
    raise exception 'Hit, stand or double.';
  end if;
  select * into h from casino where id = p_id;
  return bj_view(h, me);
end $$;

revoke all on function casino_lost_today(players) from public, anon, authenticated;
revoke all on function casino_check(players, int) from public, anon, authenticated;
revoke all on function bj_view(casino, players) from public, anon, authenticated;
revoke all on function bj_settle(bigint) from public, anon, authenticated;
grant execute on function bj_state(uuid) to anon;
grant execute on function bj_deal(uuid, int) to anon;
grant execute on function bj_act(uuid, bigint, text) to anon;

-- Pop-a-Shot against Mo (from Nov 13): 30 seconds at the hoop, 2 points a basket and 3 in the last 8 seconds. Mo posts
-- his score first; beat it and the stake comes back with 90% on top, tie and it comes back. The phone reports the score,
-- so the server keeps it honest where it can: a game takes at least 28 seconds, no more than 10 minutes, and no score
-- above 120. One game at a time; a game left unfinished is lost when the next one starts. Same limits as blackjack.
create or replace function pas_start(p_token uuid, p_stake int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); mo int; h casino;
begin
  if p_stake not between 10 and 500 then raise exception 'Bets are $10 to $500.'; end if;
  update casino set payout = 0, settled_at = now(), state = state || '{"outcome": "left"}'
  where player_id in (select person_seats(me)) and game = 'popashot' and payout is null;
  perform casino_check(me, p_stake);
  -- Mo's score: 36 to 64, in twos
  mo := 36 + 2 * floor(random() * 15)::int;
  insert into casino (player_id, game, stake, state) values (me.id, 'popashot', p_stake, jsonb_build_object('mo', mo))
  returning * into h;
  return json_build_object('id', h.id, 'mo', mo, 'stake', p_stake, 'bank', person_bank(me), 'lostToday', casino_lost_today(me));
end $$;

create or replace function pas_finish(p_token uuid, p_id bigint, p_score int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); h casino; mo int; pay int; outcome text; secs numeric;
begin
  select * into h from casino where id = p_id and player_id in (select person_seats(me)) and game = 'popashot' for update;
  if not found then raise exception 'No such game.'; end if;
  if h.payout is not null then raise exception 'That game is already settled.'; end if;
  secs := extract(epoch from now() - h.created_at);
  if secs < 28 then raise exception 'That was quicker than the clock.'; end if;
  if secs > 600 or p_score is null or p_score < 0 or p_score > 120 then
    update casino set payout = 0, settled_at = now(), state = state || '{"outcome": "void"}' where id = h.id;
    raise exception 'Mo didn''t believe that one. The stake stays on the bar.';
  end if;
  mo := (h.state->>'mo')::int;
  if p_score > mo then outcome := 'win'; pay := h.stake + (h.stake * 9) / 10;
  elsif p_score = mo then outcome := 'push'; pay := h.stake;
  else outcome := 'lose'; pay := 0;
  end if;
  update casino set payout = pay, settled_at = now(), state = state || jsonb_build_object('score', p_score, 'outcome', outcome) where id = h.id;
  return json_build_object('id', h.id, 'mo', mo, 'score', p_score, 'outcome', outcome, 'stake', h.stake, 'payout', pay,
    'bank', person_bank(me), 'lostToday', casino_lost_today(me), 'best', (select max((state->>'score')::int) from casino where player_id in (select person_seats(me)) and game = 'popashot'));
end $$;

grant execute on function pas_start(uuid, int) to anon;
grant execute on function pas_finish(uuid, bigint, int) to anon;

-- 8-ball against Mo (from Nov 13): a full game of 8-ball, played on the phone. Win and the stake comes back with 90% on
-- top; lose and it's Mo's. The phone reports the result, so the server keeps it honest where it can: a game takes at
-- least 45 seconds and no more than an hour, one at a time, and one left unfinished is lost when the next starts.
create or replace function bil_start(p_token uuid, p_stake int) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); h casino;
begin
  if p_stake not between 10 and 500 then raise exception 'Bets are $10 to $500.'; end if;
  update casino set payout = 0, settled_at = now(), state = state || '{"outcome": "left"}'
  where player_id in (select person_seats(me)) and game = 'billiards' and payout is null;
  perform casino_check(me, p_stake);
  insert into casino (player_id, game, stake, state) values (me.id, 'billiards', p_stake, jsonb_build_object('breaks', case when random() < 0.5 then 'you' else 'mo' end))
  returning * into h;
  return json_build_object('id', h.id, 'stake', p_stake, 'breaks', h.state->>'breaks', 'bank', person_bank(me), 'lostToday', casino_lost_today(me));
end $$;

create or replace function bil_finish(p_token uuid, p_id bigint, p_won boolean) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare me players := home_of(player_for(p_token)); h casino; secs numeric; pay int;
begin
  select * into h from casino where id = p_id and player_id in (select person_seats(me)) and game = 'billiards' for update;
  if not found then raise exception 'No such game.'; end if;
  if h.payout is not null then raise exception 'That game is already settled.'; end if;
  secs := extract(epoch from now() - h.created_at);
  if p_won and secs < 45 then raise exception 'Nobody clears a table that fast. Not even Mo.'; end if;
  pay := case when p_won and secs <= 3600 then h.stake + (h.stake * 9) / 10 else 0 end;
  update casino set payout = pay, settled_at = now(), state = state || jsonb_build_object('outcome', case when pay > 0 then 'win' else 'lose' end) where id = h.id;
  return json_build_object('id', h.id, 'stake', h.stake, 'payout', pay, 'won', pay > 0, 'bank', person_bank(me), 'lostToday', casino_lost_today(me));
end $$;

grant execute on function bil_start(uuid, int) to anon;
grant execute on function bil_finish(uuid, bigint, boolean) to anon;
