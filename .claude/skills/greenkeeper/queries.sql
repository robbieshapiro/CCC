-- The Greenkeeper's read of the week's shots. Read-only: run each statement as it is, with execute_sql.
-- All of them leave out the admin and host-only seats, and cover the current week (game_month()).

-- 1. The week against the weeks before: cards, members, average to par, how many cards carry shots
select r.course, r.month, count(*) as cards, count(*) filter (where jsonb_typeof(r.shots) = 'array') as with_shots,
  count(distinct r.player_id) as members, round(avg(r.total - r.par), 2) as avg_to_par, min(r.total - r.par) as best, max(r.total - r.par) as worst
from rounds r join players p on p.id = r.player_id
where p.role <> 'admin' and not p.host_only
group by 1, 2 order by 2 desc limit 6;

-- 2. Each hole's scoring
with rd as (select r.id, r.holes, r.pars from rounds r join players p on p.id = r.player_id
  where r.month = game_month() and p.role <> 'admin' and not p.host_only),
h as (select rd.id, i as hole, rd.holes[i] as s, rd.pars[i] as par from rd, generate_series(1, array_length(rd.holes, 1)) i)
select hole, max(par) as par, count(*) as n, round(avg(s - par), 2) as to_par,
  count(*) filter (where s <= par - 1) as birdies_or_better, count(*) filter (where s = par) as pars,
  count(*) filter (where s = par + 1) as bogeys, count(*) filter (where s >= par + 2) as doubles_plus, max(s) as worst
from h group by hole order by hole;

-- 3. Each hole tee to green: putts, three-putts, penalties, greens hit in regulation, the first putt, and where
--    tee shots finish (the lie the second shot was hit from)
with rd as (select r.id, r.pars, r.shots from rounds r join players p on p.id = r.player_id
  where r.month = game_month() and p.role <> 'admin' and not p.host_only and jsonb_typeof(r.shots) = 'array'),
sh as (select rd.id, rd.pars, (e->>'h')::int + 1 as hole, k, e->>'c' as c, e->>'l' as l, (e->>'x')::int as x,
    sqrt(power((e->'t'->>0)::numeric - (e->'f'->>0)::numeric, 2) + power((e->'t'->>1)::numeric - (e->'f'->>1)::numeric, 2)) as dist
  from rd cross join lateral jsonb_array_elements(rd.shots) with ordinality a(e, k)),
seq as (select *, row_number() over (partition by id, hole order by k) as n, lead(l) over (partition by id, hole order by k) as next_lie from sh),
per as (select id, hole, max(pars[hole]) as par, count(*) filter (where c = 'putter') as putts, sum(x) as pens,
    min(n) filter (where l = 'green') as on_green_at, (array_agg(dist order by n) filter (where l = 'green'))[1] as first_putt_ft,
    (array_agg(coalesce(next_lie, 'holed') order by n))[1] as tee_result
  from seq group by id, hole)
select hole, max(par) as par, count(*) as cards, round(avg(putts), 2) as putts, round(avg((putts >= 3)::int), 2) as three_putts,
  round(avg(pens), 2) as penalties, round(avg((coalesce(on_green_at, 99) - 1 <= par - 2)::int), 2) as greens_in_reg,
  round(avg(first_putt_ft), 0) as first_putt_ft,
  (select jsonb_object_agg(tee_result, c) from (select tee_result, count(*) c from per p2 where p2.hole = per.hole group by 1) t) as tee_shots_finish
from per group by hole order by hole;

-- 4. Each club: how hard it's swung, how wild, how often it costs a penalty. And the overswing: full swings past 100%
with sh as (select e->>'c' as c, (e->>'p')::numeric as p, (e->>'e')::numeric as err, (e->>'x')::int as x
  from rounds r join players pl on pl.id = r.player_id, jsonb_array_elements(r.shots) e
  where r.month = game_month() and pl.role <> 'admin' and not pl.host_only and jsonb_typeof(r.shots) = 'array')
select c as club, count(*) as n, round(avg(p), 2) as avg_power, round(sqrt(avg(err * err)), 3) as rms_error,
  round(avg((err = 0)::int), 2) as pure, round(avg(x), 3) as penalty_rate,
  round(avg((p >= 1.05)::int), 2) as past_100, round(avg((abs(err) >= 0.95)::int) filter (where p >= 1.05), 2) as full_miss_when_past_100,
  round(avg((abs(err) >= 0.95)::int) filter (where p < 1.05), 2) as full_miss_otherwise
from sh group by c order by n desc;

-- 5. Putting by length, and the short game
with sh as (select e->>'c' as c, e->>'l' as l, (e->>'i')::int as holed,
    sqrt(power((e->'t'->>0)::numeric - (e->'f'->>0)::numeric, 2) + power((e->'t'->>1)::numeric - (e->'f'->>1)::numeric, 2)) as dist
  from rounds r join players pl on pl.id = r.player_id, jsonb_array_elements(r.shots) e
  where r.month = game_month() and pl.role <> 'admin' and not pl.host_only and jsonb_typeof(r.shots) = 'array')
select 'putt ' || case when dist < 5 then '0-5 ft' when dist < 10 then '05-10 ft' when dist < 20 then '10-20 ft' when dist < 40 then '20-40 ft' else '40+ ft' end as shot,
  count(*) as n, round(avg(holed), 2) as holed, null::numeric as moved_under_15ft
from sh where c = 'putter' group by 1
union all
select c || ' from ' || l, count(*), round(avg(holed), 2), round(avg((dist < 15 and holed = 0)::int), 2)
from sh where c in ('wedge', 'chip') group by 1 having count(*) >= 4
order by 1;

-- 6. What a blow-up hole (double or worse) is made of, against the rest
with rd as (select r.id, r.pars, r.holes, r.shots from rounds r join players p on p.id = r.player_id
  where r.month = game_month() and p.role <> 'admin' and not p.host_only and jsonb_typeof(r.shots) = 'array'),
sh as (select rd.id, rd.pars, rd.holes, (e->>'h')::int + 1 as hole, k, e->>'c' as c, e->>'l' as l, (e->>'x')::int as x, (e->>'i')::int as holed,
    sqrt(power((e->'t'->>0)::numeric - (e->'f'->>0)::numeric, 2) + power((e->'t'->>1)::numeric - (e->'f'->>1)::numeric, 2)) as dist
  from rd cross join lateral jsonb_array_elements(rd.shots) with ordinality a(e, k)),
seq as (select *, row_number() over (partition by id, hole order by k) as n from sh)
select (holes[hole] - pars[hole] >= 2) as blow_up, count(distinct (id, hole)) as holes,
  round(sum(x)::numeric / count(distinct (id, hole)), 2) as penalties,
  round(count(*) filter (where l = 'rough' and n > 1)::numeric / count(distinct (id, hole)), 2) as shots_from_rough,
  round(count(*) filter (where l = 'sand')::numeric / count(distinct (id, hole)), 2) as shots_from_sand,
  round(count(*) filter (where c <> 'putter' and x = 0 and dist < 15 and holed = 0)::numeric / count(distinct (id, hole)), 2) as shots_that_went_nowhere,
  round(count(*) filter (where c = 'putter')::numeric / count(distinct (id, hole)), 2) as putts
from seq group by 1;

-- 7. Every full swing, packed small, for calibrating the robot (see unpack.py)
select 'course=' || max(course) || ' ' || string_agg(c || ':' || p || ':' || e || ':' || n, ' ') as packed from (
  select r.course, e->>'c' as c, round((e->>'p')::numeric, 1) as p, round((e->>'e')::numeric, 1) as e, count(*) as n
  from rounds r join players pl on pl.id = r.player_id, jsonb_array_elements(r.shots) e
  where r.month = game_month() and pl.role <> 'admin' and not pl.host_only and jsonb_typeof(r.shots) = 'array' and e->>'c' <> 'putter'
  group by 1, 2, 3, 4) t;

-- 8. Cards missing shots for a hole they scored (a logging bug if it isn't zero)
with rd as (select r.id, r.holes, r.shots from rounds r join players p on p.id = r.player_id
  where r.month = game_month() and p.role <> 'admin' and not p.host_only and jsonb_typeof(r.shots) = 'array')
select i as hole, count(*) as cards, count(*) filter (where not exists (select 1 from jsonb_array_elements(rd.shots) e where (e->>'h')::int = i - 1)) as missing_shots
from rd, generate_series(1, array_length(rd.holes, 1)) i group by i order by i;
