-- The Steward's daily read: the last 24 hours at the club, admin and host-only seats left out. Read only.
with w as (select now() - interval '24 hours' as since),
mem as (select p.* from players p where p.role <> 'admin' and not p.host_only),
starts as (select rs.* from round_starts rs join mem on mem.id = rs.player_id, w where rs.started_at > w.since)
select json_build_object(
  'period', game_month(),
  'today', game_today(),
  'members', (select count(*) from mem),
  'new_members', (select coalesce(json_agg(json_build_object('name', m.name, 'club', g.name)), '[]')
    from mem m join groups g on g.id = m.group_id, w where m.created_at > w.since),
  'active', (select count(distinct id) from (
      select player_id as id from rounds, w where created_at > w.since
      union select player_id from practice_sessions, w where started_at > w.since
      union select player_id from daily_shots, w where created_at > w.since
      union select id from mem, w where last_seen_at > w.since) a where a.id in (select id from mem)),
  'rounds', (select coalesce(json_agg(json_build_object('name', m.name, 'club', g.name, 'course', r.course, 'to_par', r.total - r.par, 'feats', r.feats) order by r.created_at), '[]')
    from rounds r join mem m on m.id = r.player_id join groups g on g.id = r.group_id, w where r.created_at > w.since),
  'starts', (select count(*) from starts),
  'finished', (select count(*) from starts where finished),
  -- quits split the way the plan asks: a restart is a quit on hole 1, a real abandon is a quit later on
  'restarts_hole1', (select count(*) from starts s where round_abandoned(s) and s.hole = 1),
  'abandons_later', (select count(*) from starts s where round_abandoned(s) and s.hole > 1),
  'top_restarters', (select coalesce(json_agg(t), '[]') from (
      select m.name, count(*) as quits from starts s join mem m on m.id = s.player_id
      where round_abandoned(s) group by m.name order by count(*) desc limit 3) t),
  'daily_shots', (select count(*) from daily_shots d join mem m on m.id = d.player_id, w where d.created_at > w.since),
  'daily_holed', (select coalesce(json_agg(distinct m.name), '[]') from daily_shots d join mem m on m.id = d.player_id, w where d.created_at > w.since and d.holed),
  'feedback_new', (select coalesce(json_agg(json_build_object('club', g.name, 'from', coalesce(p.name, 'A member'), 'body', left(f.body, 200))), '[]')
    from feedback f join groups g on g.id = f.group_id left join players p on p.id = f.player_id, w where f.created_at > w.since),
  'feedback_open', (select count(*) from feedback where not done),
  'ai_calls', json_build_object(
    'reginald', (select coalesce(json_object_agg(kind, n), '{}') from (select kind, count(*) n from reginald_notes, w where created_at > w.since group by kind) k),
    'designs', (select count(*) from design_calls, w where created_at > w.since)),
  'leaders', (select coalesce(json_agg(json_build_object('club', g.name, 'leader', p.name, 'to_par', b.total - b.par)), '[]')
    from groups g join lateral month_bests(g.id) b on b.month = game_month() and b.r = 1 join players p on p.id = b.player_id),
  -- last period's champions per club: on a Sunday these should be there
  'last_champs', (select coalesce(json_agg(json_build_object('club', g.name, 'period', c.month, 'champ', p.name, 'how', c.how)), '[]')
    from groups g join lateral (select * from period_champs(g.id) pc where pc.month < game_month() order by pc.month desc limit 1) c on true
    join players p on p.id = c.player_id)
) as steward;
