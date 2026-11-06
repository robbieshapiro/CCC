// The Committee Room's headline numbers, above Weekly Players: Reginald's morning read (api/insights.ts, once a day),
// tiles for today, last week's players coming back, rounds per player, new members' first rounds, money and AI calls,
// then three charts: players per day, week over week, and how this week's course is scoring hole by hole.
import { api, useSupabase } from '../api';
import type { AdminInsights, AdminKpis } from '../api/types';
import { periodName, periodOf, todayInGameTz } from '../day';
import { planCanvas } from '../designer/plan';
import { courseFor } from '../golf3d/courses';
import { money } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';
import { setNeeds } from './admin';

export const kpiSections = () => `<section class="adm-kpis" id="adm-kpis"><p class="muted">Loading…</p></section>`;
// Reginald's read, in a tab of its own
export const briefSection = () => `<section class="adm-card adm-brief" id="adm-brief"><h2>Reginald's morning read</h2><p class="muted">Loading…</p></section>`;
export const chartSections = () => `<section class="adm-kpis adm-kpis-more" id="adm-kpis-more"></section>
  <section class="adm-card adm-charts" id="adm-charts" hidden></section>`;
// the Course tab: how this week's course is scoring, then the hole report from members' shots
export const courseSections = () => `<section class="adm-card adm-charts" id="adm-course-chart" hidden></section>
  <section class="adm-card adm-report" id="adm-report" hidden></section>`;

// The hole report: from the shots members post with their cards, how each hole is really being played, with where tee
// shots (cream) and penalties (red) finished drawn on the hole
export async function loadHoleReport() {
  const el = document.getElementById('adm-report');
  if (!el) return;
  const rows = await api.adminHoles(requireSession()).catch(() => null);
  if (!rows || !document.getElementById('adm-report')) return;
  el.hidden = false;
  const course = courseFor(kpis?.period ?? periodOf(todayInGameTz()));
  if (!rows.some((r) => r.rounds)) {
    el.innerHTML = `<h2>Hole report</h2><p class="muted">Fills in as members post cards on ${esc(course.name)}: putts, penalties, the club off the tee, and where shots finish on each hole.</p>`;
    return;
  }
  el.innerHTML = `<h2>Hole report <small>${esc(course.name)} · from members' shots</small></h2><div class="hole-report" id="hole-report"></div>`;
  const grid = document.getElementById('hole-report')!;
  for (const r of rows) {
    const hole = course.holes[r.hole - 1];
    if (!hole) continue;
    const card = document.createElement('div');
    card.className = 'hr-card';
    const dots = [...r.tee.map((t) => ({ p: { x: t[0], y: t[1] }, color: '#f3ecdc' })), ...r.wet.map((t) => ({ p: { x: t[0], y: t[1] }, color: '#e2543d' }))];
    const top = (o: Record<string, number>, n = 3) =>
      Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${esc(k)} ${v}`)
        .join(' · ');
    card.innerHTML = `<h3>${r.hole}. ${esc(hole.name)} <small>par ${hole.par}</small></h3>
      <p class="hr-stats"><span><b>${r.putts}</b> putts</span><span><b>${Math.round(r.threePutts * 100)}%</b> three-putts</span><span><b>${r.penalties}</b> penalties</span><span><b>${r.rounds}</b> rounds</span></p>
      <p class="muted hr-line">Off the tee: ${top(r.teeClubs) || 'n/a'}</p>
      <p class="muted hr-line">Hit from: ${top(r.lies, 4) || 'n/a'}</p>`;
    try {
      card.prepend(planCanvas(hole, 150, dots));
    } catch {
      /* no canvas: the numbers still show */
    }
    grid.appendChild(card);
  }
}

let kpis: AdminKpis | null = null;

export async function loadKpis() {
  kpis = await api.adminKpis(requireSession()).catch(() => kpis);
  drawKpis();
}

// Reginald's read: once a day, kept on the server, so this is cheap to ask whenever Admin opens
export async function loadBrief() {
  const el = document.getElementById('adm-brief');
  if (!el) return;
  if (!useSupabase) {
    el.innerHTML = `<h2>Reginald's morning read</h2><p class="muted">Reginald reads the live club's numbers, so there's nothing here in local mode.</p>`;
    return;
  }
  el.innerHTML = `<h2>Reginald's morning read</h2><p class="muted reg-thinking">Reading the numbers…</p>`;
  try {
    const res = await fetch('/api/insights', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: requireSession().token }) });
    const r = (await res.json()) as AdminInsights & { why?: string };
    if (!document.getElementById('adm-brief')) return;
    if (!r.points?.length) {
      el.innerHTML = `<h2>Reginald's morning read</h2><p class="muted">${r.why === 'not configured' ? 'Shows up once the AI key is set in Vercel.' : 'Nothing from Reginald just now. He tries again next time you open Admin.'}</p>`;
      return;
    }
    el.innerHTML = `<h2>Reginald's morning read</h2><ul class="adm-brief-list">${r.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`;
  } catch {
    el.innerHTML = `<h2>Reginald's morning read</h2><p class="muted">Nothing from Reginald just now. He tries again next time you open Admin.</p>`;
  }
}

// a change on last week, as an arrow and a number (or a percentage point change)
const delta = (now: number, before: number | null, unit = '') => {
  if (before === null) return '';
  const d = Math.round((now - before) * 10) / 10;
  return `<em class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${d > 0 ? '+' : ''}${d}${unit} on last week</em>`;
};
const tile = (big: string, label: string, sub: string, change = '') => `<div class="kpi"><b>${big}</b><span>${label}</span><small>${sub}</small>${change}</div>`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function drawKpis() {
  const el = document.getElementById('adm-kpis');
  if (!el) return;
  const k = kpis;
  if (!k) {
    el.innerHTML = `<p class="muted">The headline numbers show up once their SQL has been run in Supabase.</p>`;
    return;
  }
  const back = pct(k.cameBack, k.lastPlayers);
  const rpp = k.players ? Math.round((k.rounds / k.players) * 10) / 10 : 0;
  const rppBefore = k.prevPlayers ? Math.round((k.prevRounds / k.prevPlayers) * 10) / 10 : null;
  const aiToday = Object.values(k.ai.today).reduce((a, n) => a + n, 0) + k.ai.designsToday;
  el.innerHTML = `
    <div class="kpi-grid">
      ${tile(String(k.visitedToday), 'In today', `${k.playedToday} played a round`, delta(k.visitedToday, k.visitedWeekAgo))}
      ${tile(k.lastPlayers ? `${back}%` : '–', 'Came back', k.lastPlayers ? `${k.cameBack} of last week's ${k.lastPlayers} players have played this week` : 'no last week to compare yet')}
      ${tile(String(rpp), 'Rounds per player', `${k.rounds} rounds by ${k.players} players this week`, rppBefore === null ? '' : delta(rpp, rppBefore))}
      ${tile(money(k.purse), 'Purse in play', `Pro Shop: ${money(k.shop7)} in 7 days, ${money(k.shopAll)} ever`)}
    </div>`;
  // the rest, in the Overview tab
  const more = document.getElementById('adm-kpis-more');
  if (more) more.innerHTML = `<div class="kpi-grid">
      ${tile(`${k.firstRound14} of ${k.joined14}`, 'New members playing', k.neverPlayed14.length ? `yet to play: ${k.neverPlayed14.slice(0, 4).map(esc).join(', ')}${k.neverPlayed14.length > 4 ? ` and ${k.neverPlayed14.length - 4} more` : ''}` : k.joined14 ? 'joined in the last 14 days, all have played' : 'nobody new in the last 14 days')}
      ${tile(String(aiToday), 'AI calls today', `${k.ai.today.daily ?? 0} daily lines · ${k.ai.today.round ?? 0} round notes · ${k.ai.designsToday} designs · ${k.ai.month} this month`)}
    </div>`;
  drawCharts(k);
}

function drawCharts(k: AdminKpis) {
  const el = document.getElementById('adm-charts');
  if (!el) return;
  el.hidden = false;
  el.innerHTML = `${perDay(k)}${weeks(k)}`;
  const course = document.getElementById('adm-course-chart');
  if (course) {
    course.hidden = false;
    course.innerHTML = holes(k);
  }
  setNeeds('unplayed', k.neverPlayed14.length);
}

// the last 14 days: who played a round, and who only came in, stacked
function perDay(k: AdminKpis) {
  const top = Math.max(1, ...k.days.map((d) => d.visited));
  const bars = k.days
    .map((d) => {
      const wd = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
      return `<div class="bar" title="${d.day}: ${d.played} played, ${d.visited} in"><i class="b-in" style="height:${pct(d.visited - d.played, top)}%"></i><i class="b-played" style="height:${pct(d.played, top)}%"></i><span>${wd}</span></div>`;
    })
    .join('');
  return `<h3 class="adm-sub">Players per day <small>the last 14 days</small></h3>
    <div class="bars">${bars}</div>
    <p class="trend-key"><i class="k-played"></i> played a round <i class="k-in"></i> came in, didn't play</p>`;
}

// every week so far: players and rounds, and how many of the week before's players came back
function weeks(k: AdminKpis) {
  if (!k.weeks.length) return '';
  const rows = k.weeks
    .slice(-8)
    .reverse()
    .map((w) => `<tr><td>${esc(periodName(w.period))}</td><td class="num">${w.players}</td><td class="num">${w.rounds}</td><td class="num">${w.players ? Math.round((w.rounds / w.players) * 10) / 10 : 0}</td><td class="num">${w.before ? `${pct(w.back, w.before)}%` : '–'}</td></tr>`)
    .join('');
  return `<h3 class="adm-sub">Week over week</h3>
    <div class="table-wrap"><table class="practice-table"><thead><tr><th></th><th class="num">Players</th><th class="num">Rounds</th><th class="num">Per player</th><th class="num">Came back</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// this week's course, hole by hole: the average against par and the spread of scores
function holes(k: AdminKpis) {
  const course = courseFor(k.period);
  if (!k.holes.length) return `<h3 class="adm-sub">How ${esc(course.name)} is playing</h3><p class="muted">No rounds on it yet.</p>`;
  const rows = k.holes
    .map((h) => {
      const name = course.holes[h.hole - 1]?.name ?? `Hole ${h.hole}`;
      const seg = (n: number, cls: string) => (n ? `<i class="${cls}" style="width:${pct(n, h.n)}%" title="${n}"></i>` : '');
      const avg = h.avg > 0 ? `+${h.avg}` : `${h.avg}`;
      return `<tr><td>${h.hole}. ${esc(name)} <small>par ${h.par}</small></td><td class="num ${h.avg < -0.5 ? 'easy' : h.avg > 0.75 ? 'hard' : ''}">${avg}</td><td class="spread-cell"><div class="spread">${seg(h.eagle, 's-eagle')}${seg(h.birdie, 's-birdie')}${seg(h.pars, 's-par')}${seg(h.bogey, 's-bogey')}${seg(h.worse, 's-worse')}</div></td></tr>`;
    })
    .join('');
  return `<h3 class="adm-sub">How ${esc(course.name)} is playing <small>average against par, members aim for about even</small></h3>
    <div class="table-wrap"><table class="practice-table adm-holes"><thead><tr><th>Hole</th><th class="num">Avg</th><th>Spread</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="trend-key spread-key"><i class="s-eagle"></i> eagle <i class="s-birdie"></i> birdie <i class="s-par"></i> par <i class="s-bogey"></i> bogey <i class="s-worse"></i> worse</p>`;
}
