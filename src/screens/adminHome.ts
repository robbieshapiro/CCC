// The Committee Room's Metrics, Agents and Courses tabs. Metrics: the headline strip and players per day (the rest
// is in adminKpis.ts). Agents: each agent's latest note, anything that needs you first, older ones folded. Courses:
// every week's tile (this week, the weeks ahead, the weeks gone by, the bench), and each course's page: put it on a
// week, play it, how it plays, ask the Architect, and the hand dials, folded.
import { api } from '../api';
import type { AdminKpis, AgentNote, CoursePlanner, CourseRequest, HoleReport, Snapshot } from '../api/types';
import { planCanvas } from '../designer/plan';
import { applyTweak, FAIRWAY_STEPS, hasTweak, TEE_MAX, teeAt, teeOk, WIND_STEPS, type Tweak } from '../golf3d/tweaks';
import { tell } from '../dialog';
import { nextStart, periodName } from '../day';
import { asBuilt, courseById, courseFor, labHoles, nextCourse, scheduleOf, tourCourses, tweaksOf, type Course } from '../golf3d/courses';
import { hasNight } from '../golf3d/kits';
import { ratingOf } from '../golf3d/ratings';
import { SCALE } from '../golf3d/clubs';
import { board, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, navigate } from '../ui';
import { setNight } from './previewControls';
import { setNeeds } from './admin';

const AHEAD = 6;
const FIRST_WEEK = '2026-11-01';
const BACK = 4;
const short = (c: Course) => c.name.replace(/ Course$/, '');
const weekLabel = (w: string) => periodName(w).replace(/^Week of /, '');
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

// each course's look: its colours and an emoji, from its holes' theme
const ART: Record<string, { from: string; to: string; ink: string; emoji: string }> = {
  volcanic: { from: '#3a0f0a', to: '#c4361b', ink: '#ffd2a6', emoji: '🌋' },
  coastal: { from: '#0b3a5a', to: '#e0894a', ink: '#ffe9c9', emoji: '🌊' },
  autumn: { from: '#2a3d1c', to: '#c86a1e', ink: '#ffe3b8', emoji: '🍁' },
  chicago: { from: '#101a33', to: '#4a6aa8', ink: '#dfe8ff', emoji: '🏙️' },
  carnival: { from: '#3a1446', to: '#e8792a', ink: '#ffe6c2', emoji: '🎡' },
  desert: { from: '#5a2e14', to: '#e2a14a', ink: '#fff0d6', emoji: '🌵' },
  highland: { from: '#1c3328', to: '#5f8f6a', ink: '#eef6e4', emoji: '🌲' },
  links: { from: '#1f3a2c', to: '#7fa36a', ink: '#eef6e4', emoji: '⛰️' },
};
export const artOf = (c: Course) => ART[c.holes[0]?.theme ?? ''] ?? ART.links;
const yardsOf = (h: Course['holes'][number]) => h.yards ?? Math.round((Math.hypot(h.cup.x - h.tee.x, h.cup.y - h.tee.y) * SCALE) / 3);
const yards = (c: Course) => c.holes.reduce((a, h) => a + yardsOf(h), 0);
const style = (c: Course) => {
  const a = artOf(c);
  return `--from:${a.from};--to:${a.to};--ink:${a.ink}`;
};

type Data = { kpis: AdminKpis | null; report: HoleReport[]; planner: CoursePlanner; requests: CourseRequest[]; notes: AgentNote[] };
let data: Data = { kpis: null, report: [], planner: { approved: {}, results: {} }, requests: [], notes: [] };
let snap0: Snapshot | null = null;
let view: string | null = null; // a course id when one is open

// Metrics: the headline numbers, every club together, and players a day
export const metricsSections = () => `<section class="jv-pulse" id="jv-pulse">
    <div id="jv-pulse-top"></div>
    <div class="adm-card adm-charts" id="jv-pulse-chart" hidden></div>
  </section>`;
// Agents: each agent's latest note
export const agentsSections = () => `<div id="jv-agents"><p class="muted">Loading…</p></div>`;
// Courses: every week's tile, and a course's own page
export const coursesSections = () => `<div id="jv-home"><p class="muted">Loading…</p></div>`;

export async function loadHome(snap: Snapshot, course?: string) {
  snap0 = snap;
  view = course ?? null;
  draw();
  const s = requireSession();
  const [kpis, report, planner, requests, notes] = await Promise.all([
    api.adminKpis(s).catch(() => null),
    api.adminHoles(s).catch(() => [] as HoleReport[]),
    api.coursePlanner(s).catch(() => ({ approved: {}, results: {} })),
    api.courseRequests(s).catch(() => [] as CourseRequest[]),
    api.agentNotes(s).catch(() => [] as AgentNote[]),
  ]);
  data = { kpis, report, planner, requests, notes };
  draw();
}

// open a course (or go back to every week) without reloading the numbers
export function showCourse(id: string | null) {
  const moved = view !== id;
  view = id;
  draw();
  if (moved) toTabs();
}
// bring the tab bar to the top of the screen, if it's scrolled away above (the who's-in box sits above it)
export function toTabs() {
  const bar = document.getElementById('adm-tabs');
  if (bar && bar.getBoundingClientRect().top < 0) bar.scrollIntoView({ block: 'start' });
  else if (bar && bar.getBoundingClientRect().top > innerHeight * 0.4) bar.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function draw() {
  const el = document.getElementById('jv-home');
  if (!el || !snap0) return;
  const c = view ? courseById(view) : null;
  const agents = document.getElementById('jv-agents');
  if (agents) agents.innerHTML = agentsBox();
  pulse();
  el.innerHTML = c ? detail(snap0, c) : home(snap0);
  bind(el, snap0);
  courseNeeds(snap0);
}

// From the agents: the Architect, the Greenkeeper and the Steward, one card each with its latest note, the ones that
// need Robbie first (in red). Everything older is folded under Earlier. A course's preview link plays it here; anything
// else (a PR) opens in a new tab.
const AGENT_ICON: Record<string, string> = { Architect: '🏗️', Greenkeeper: '🌱', Steward: '🎩' };
const AGENTS = ['Architect', 'Greenkeeper', 'Steward'];
function agentsBox() {
  const all = [...(data.notes ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  const latest = new Map<string, AgentNote>();
  for (const n of all) if (!latest.has(n.agent)) latest.set(n.agent, n);
  const names = [...new Set([...AGENTS, ...latest.keys()])];
  const cards = names.map((a) => ({ a, n: latest.get(a) })).sort((x, y) => Number(!!y.n?.needsYou) - Number(!!x.n?.needsYou));
  setNeeds('agents', cards.filter((c) => c.n?.needsYou).length);
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  const go = (n: AgentNote) => {
    if (!n.link) return '';
    const preview = n.link.match(/^#\/preview\/([a-z0-9-]+)$/);
    const label = preview ? `▶ Play ${esc(courseById(preview[1])?.name ?? 'it')}` : 'Open';
    return n.link.startsWith('#/') ? `<a class="btn small" href="${esc(n.link)}">${label}</a>` : `<a class="btn ghost small" href="${esc(n.link)}" target="_blank" rel="noopener">See what changed</a>`;
  };
  const card = (a: string, n?: AgentNote) =>
    n
      ? `<article class="jv-agent${n.needsYou ? ' needs' : ''}">
          <p class="jv-agent-who">${AGENT_ICON[a] ?? '🤖'} <b>${esc(a)}</b><small>${when(n.at)}</small>${n.needsYou ? '<em>Needs you</em>' : ''}</p>
          <p class="jv-agent-title">${esc(n.title)}</p>
          ${n.body ? `<p class="jv-agent-body">${esc(n.body)}</p>` : ''}
          ${go(n)}
        </article>`
      : `<article class="jv-agent quiet"><p class="jv-agent-who">${AGENT_ICON[a] ?? '🤖'} <b>${esc(a)}</b><small>no note yet</small></p></article>`;
  const older = all.filter((n) => latest.get(n.agent) !== n).slice(0, 20);
  return `<section class="jv-agents">
    ${cards.map((c) => card(c.a, c.n)).join('')}
    ${
      older.length
        ? `<details class="adm-more jv-earlier"><summary>Earlier <small>${older.length} older ${older.length === 1 ? 'note' : 'notes'}</small></summary>
        <ul class="adm-list">${older.map((n) => `<li><div>${AGENT_ICON[n.agent] ?? '🤖'} <b>${esc(n.agent)}</b> <small>${when(n.at)}</small><p>${esc(n.title)}</p></div></li>`).join('')}</ul></details>`
        : ''
    }
  </section>`;
}

// what's waiting on the course side: next week with nothing picked (it would carry on), and new courses on no week
function courseNeeds(snap: Snapshot) {
  const nw = nextStart(snap.month);
  const ahead: string[] = [];
  let w = snap.month;
  for (let i = 0; i < AHEAD; i++) ahead.push((w = nextStart(w)));
  setNeeds('nopick', !scheduleOf()[nw] && courseFor(nw).id === courseFor(snap.month).id ? 1 : 0);
  setNeeds('unplaced', tourCourses().filter((c) => c.draft && !ahead.some((x) => courseFor(x).id === c.id)).length);
}

// the headline numbers, every club together: today against the same day last week, this week, who came back
function pulse() {
  const el = document.getElementById('jv-pulse-top');
  const k = data.kpis;
  if (!el) return;
  if (!k) {
    el.innerHTML = '<p class="muted">Loading…</p>';
    return;
  }
  const vs = (now: number, then: number) => (now === then ? '<small>same as last week</small>' : `<small class="${now > then ? 'up' : 'down'}">${now > then ? '▲' : '▼'} ${Math.abs(now - then)} on last week</small>`);
  const back = k.lastPlayers ? `${Math.round((k.cameBack / k.lastPlayers) * 100)}%` : '–';
  el.innerHTML = `<div class="jv-kpis">
    <div><b>${k.visitedToday}</b><span>in today</span>${vs(k.visitedToday, k.visitedWeekAgo)}</div>
    <div><b>${k.playedToday}</b><span>played today</span>${vs(k.playedToday, k.playedWeekAgo)}</div>
    <div><b>${k.players}<small>/${k.members}</small></b><span>played this week</span><small>${k.rounds} rounds${k.prevPlayers ? `, ${k.prevPlayers} played last week` : ''}</small></div>
    <div><b>${back}</b><span>came back</span><small>${k.lastPlayers ? `${k.cameBack} of last week's ${k.lastPlayers}` : 'no last week yet'}</small></div>
    <div><b>${k.firstRound14}<small>/${k.joined14}</small></b><span>new members playing</span><small>joined in 14 days</small></div>
  </div>`;
}

// ---- the home: this week, every week ----

function home(snap: Snapshot): string {
  const now = courseFor(snap.month);
  const back: string[] = [];
  // weeks only: the months before Nov 2026 aren't weeks
  for (let i = 1; i <= BACK; i++) if (addDays(snap.month, -7 * i) >= FIRST_WEEK) back.push(addDays(snap.month, -7 * i));
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  return `
    <h2 class="jv-h">This week</h2>
    <button class="jv-now" data-open="${now.id}" style="${style(now)}">
      <div class="jv-art"><span class="jv-emoji" aria-hidden="true">${artOf(now).emoji}</span>
        <small>${esc(weekLabel(snap.month))} · playing now</small><b>${esc(short(now))}</b><em>${now.holes.length} holes · par ${now.par} · ${yards(now).toLocaleString('en-US')} yd</em></div>
      <div class="jv-now-stats">
        <div><b>${played.length}<small>/${rows.length}</small></b><span>cards in</span></div>
        <div><b>${played.length ? toParLabel(played[0].toPar) : '–'}</b><span>leading</span></div>
        <div><b>${data.kpis?.rounds ?? '–'}</b><span>rounds</span></div>
      </div>
      <span class="jv-open">Open ›</span>
    </button>

    <h2 class="jv-h" id="jv-coming">The weeks ahead <small>pick a course on any week</small></h2>
    ${calendar(snap)}

    ${
      back.length
        ? `<details class="jv-past"><summary>Weeks gone by</summary><ul>${back
            .map((x) => {
              const c = courseFor(x);
              const res = data.planner.results[c.id];
              return `<li><span>${esc(weekLabel(x))}</span><button class="link" data-open="${c.id}">${artOf(c).emoji} ${esc(short(c))}</button><small>${res ? `${toParLabel(res.avg)} avg` : ''}</small></li>`;
            })
            .join('')}</ul></details>`
        : ''
    }

    <h2 class="jv-h" id="jv-benchh">Courses</h2>
    ${courseList(snap)}`;
}

// the next weeks, one row each: the dates, the course, why it's there, and a picker to change it there and then
const WEEKS = 8;
const aheadOf = (snap: Snapshot, n = WEEKS) => {
  const out: string[] = [];
  let w = snap.month;
  for (let i = 0; i < n; i++) out.push((w = nextStart(w)));
  return out;
};
const dates = (w: string) => {
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const end = f(addDays(w, 6));
  return `${f(w)} to ${end.slice(0, 3) === f(w).slice(0, 3) ? end.slice(4) : end}`;
};
function calendar(snap: Snapshot): string {
  const weeks = aheadOf(snap);
  const all = tourCourses();
  return `<ol class="jv-cal">${weeks
    .map((w) => {
      const c = courseFor(w);
      const pick = scheduleOf()[w];
      const prev = courseFor(addDays(w, -7));
      const carry = !pick && prev.id === c.id;
      const chip = pick ? '<i class="ok">Picked</i>' : carry ? '<i class="dim">Carries on</i>' : '<i>Calendar</i>';
      const options = `<option value="">${carry || !pick ? 'No pick (as now)' : 'Clear the pick'}</option>${all
        .map((x) => `<option value="${x.id}"${pick === x.id ? ' selected' : ''}>${esc(short(x))}${x.draft ? ' (draft)' : ''}</option>`)
        .join('')}`;
      return `<li class="${carry ? 'carry' : ''}">
        <div class="jv-cal-wk"><b>${esc(dates(w))}</b>${chip}</div>
        ${
          carry
            ? `<p class="jv-cal-course dim">↳ ${esc(short(c))} carries on</p>`
            : `<button class="jv-cal-course" data-open="${c.id}" style="${style(c)}"><span aria-hidden="true">${artOf(c).emoji}</span><b>${esc(short(c))}</b><small>${c.holes.length} holes · par ${c.par}</small></button>`
        }
        <select data-pick="${w}" aria-label="Course for ${esc(dates(w))}">${options}</select>
      </li>`;
    })
    .join('')}</ol>`;
}

// every course once: where it's on, and how it plays; then the Hole Lab's test holes
function courseList(snap: Snapshot): string {
  const weeks = [snap.month, ...aheadOf(snap)];
  const row = (c: Course) => {
    const on = weeks.filter((w) => courseFor(w).id === c.id);
    const r = ratingOf(c);
    const tweaked = Object.keys(tweaksOf()[c.id] ?? {}).length;
    return `<li><button data-open="${c.id}" style="${style(c)}">
      <span class="jv-sw" aria-hidden="true">${artOf(c).emoji}</span>
      <span class="jv-cl-main"><b>${esc(short(c).replace(/^Lab · /, ''))}</b><small>${c.lab ? 'Hole Lab' : `${c.holes.length} holes · par ${c.par}${r ? ` · slope ${r.slope}` : ''}`}</small></span>
      <span class="jv-chips">${c.lab ? '' : on.length ? `<i class="ok">${on[0] === snap.month ? 'Now' : esc(weekLabel(on[0]))}${on.length > 1 ? ` +${on.length - 1}` : ''}</i>` : '<i class="dim">On no week</i>'}${c.draft ? `<i class="draft">${data.planner.approved[c.id] ? 'Approved' : 'Draft'}</i>` : ''}${tweaked ? '<i>🎛️</i>' : ''}</span>
    </button></li>`;
  };
  const labs = labHoles();
  return `<ul class="jv-clist">${tourCourses().map(row).join('')}</ul>
    ${labs.length ? `<details class="jv-past"><summary>Hole Lab <small>${labs.length} test ${labs.length === 1 ? 'hole' : 'holes'}</small></summary><ul class="jv-clist">${labs.map(row).join('')}</ul></details>` : ''}`;
}

// ---- one course: review, play and test, plan ----

function detail(snap: Snapshot, c: Course): string {
  const now = courseFor(snap.month);
  const isNow = c.id === now.id;
  const isNext = c.id === nextCourse(snap.month)?.id;
  const r = ratingOf(c);
  const res = data.planner.results[c.id];
  const ahead = aheadOf(snap);
  const playing = ahead.filter((x) => courseFor(x).id === c.id);
  const kh = (i: number) => (isNow ? data.kpis?.holes.find((h) => h.hole === i + 1) : undefined);
  const rh = (i: number) => (isNow ? data.report.find((h) => h.hole === i + 1) : undefined);
  const where = isNow ? `Playing now${playing.length ? `, and ${playing.map(weekLabel).join(', ')}` : ''}` : playing.length ? `On ${playing.map(weekLabel).join(', ')}` : 'On no week';
  return `
    <button class="link jv-back" data-back>‹ Every week</button>
    <section class="jv-hero" style="${style(c)}">
      <span class="jv-emoji" aria-hidden="true">${artOf(c).emoji}</span>
      <small>${esc(where)}</small>
      <h2>${esc(short(c))}</h2>
      <p>${esc(c.tagline)}</p>
      <em>${c.holes.length} holes · par ${c.par} · ${yards(c).toLocaleString('en-US')} yd${c.draft ? ` · ${data.planner.approved[c.id] ? 'approved draft' : 'draft'}` : ''}</em>
    </section>

    ${
      c.lab
        ? ''
        : `<section class="jv-sec">
      <h3>Schedule</h3>
      <p class="fine">${isNow ? 'Playing this week. ' : ''}Tap a week to put it on; tap again to take your pick off.</p>
      <ul class="jv-weekpick">${ahead
        .map((x) => {
          const there = courseFor(x);
          const picked = scheduleOf()[x] === c.id;
          const on = there.id === c.id;
          return `<li><button class="${on ? 'on' : ''}" data-weekput="${x}" data-to="${picked ? '' : c.id}"><b>${esc(dates(x))}</b><small>${on ? (picked ? '✓ Picked' : '✓ On (calendar or carries on)') : `Now: ${esc(short(there))}`}</small></button></li>`;
        })
        .join('')}</ul>
      ${c.draft ? `<button class="link" data-approve>${data.planner.approved[c.id] ? 'Un-approve the draft' : '✓ Approve the draft'}</button>` : ''}
    </section>`
    }

    <section class="jv-sec">
      <h3>Play and test</h3>
      <div class="jv-acts">
        <a class="btn" href="#/preview/${c.id}">▶ Play it, with the controls</a>
        ${isNext ? '<a class="btn ghost" href="#/rehearse">Rehearse Sunday\'s card</a>' : ''}
      </div>
      ${hasNight(c.holes[0]) ? `<div class="adm-chips" role="group" aria-label="Time of day"><small>Time</small><button data-night="day">☀️ Day</button><button data-night="night">🌙 Night</button><button data-night="">By the clock</button></div>` : ''}
      <p class="fine">In play, Controls sets the time of day, the wind and the pin, pours any drink, puts a shot back and drops the ball anywhere. Nothing is posted or paid.</p>
    </section>

    <section class="jv-sec">
      <h3>How it plays</h3>
      <dl class="jv-stats">
        <div><dt>CCC Rating</dt><dd>${r ? r.rating.toFixed(1) : '–'}</dd></div>
        <div><dt>Slope</dt><dd>${r ? r.slope : '–'}</dd></div>
        <div><dt>Members avg</dt><dd>${res ? toParLabel(res.avg) : '–'}</dd></div>
        <div><dt>Best</dt><dd>${res ? toParLabel(res.best) : '–'}</dd></div>
      </dl>
      <p class="fine">${res ? `${res.rounds} rounds from ${res.members} ${res.members === 1 ? 'member' : 'members'}${res.bestBy ? `, best by ${esc(res.bestBy)}` : ''}.` : 'No member rounds yet.'}${r ? ` The robot rated it ${esc(new Date(`${r.at}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))}${r.hardest ? `; hardest for it: ${esc(r.hardest)}` : ''}.` : ''}</p>
      <table class="jv-holes">
        <thead><tr><th>Hole</th><th class="num">Par</th><th class="num">Yd</th>${isNow ? '<th class="num">Avg</th><th class="num">3-putt</th><th class="num">Pen</th>' : ''}</tr></thead>
        <tbody>${c.holes
          .map((h, i) => {
            const k = kh(i);
            const p = rh(i);
            const avg = k && k.n ? toParLabel(Math.round(k.avg * 10) / 10) : '–';
            return `<tr><td>${i + 1}. ${esc(h.name)}</td><td class="num">${h.par}</td><td class="num">${yardsOf(h)}</td>${
              isNow
                ? `<td class="num ${k && k.avg >= 1 ? 'hard' : k && k.avg <= -0.6 ? 'easy' : ''}">${avg}</td><td class="num">${p && p.rounds ? `${Math.round(p.threePutts * 100)}%` : '–'}</td><td class="num">${p && p.rounds ? p.penalties.toFixed(1) : '–'}</td>`
                : ''
            }</tr>`;
          })
          .join('')}</tbody>
      </table>
    </section>

    ${c.lab ? '' : askSection(c)}
    ${c.lab ? '' : `<details class="jv-sec jv-dials"><summary>Hand dials <small>tee, fairway, pins, wind. The Greenkeeper tunes these each week</small></summary><div id="jv-tweak"></div></details>`}`;
}

function bind(el: HTMLElement, snap: Snapshot) {
  el.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => (b.onclick = () => navigate(`#/admin/course/${b.dataset.open}`)));
  const back = el.querySelector<HTMLButtonElement>('[data-back]');
  if (back) back.onclick = () => navigate('#/admin/courses');
  const nights = [...el.querySelectorAll<HTMLButtonElement>('[data-night]')];
  const showNight = () => nights.forEach((b) => b.classList.toggle('on', (store.get('ccc-preview-night') ?? '') === b.dataset.night));
  nights.forEach((b) => (b.onclick = () => (setNight(b.dataset.night as 'day' | 'night' | ''), showNight())));
  showNight();
  const save = async (week: string, course: string | null) => {
    try {
      await api.setCourseSchedule(requireSession(), week, course);
      await refresh();
    } catch (e) {
      void tell("That didn't save", `<p>${esc((e as Error).message)}</p>`);
    }
    const y = scrollY;
    draw();
    scrollTo({ top: y });
  };
  el.querySelectorAll<HTMLSelectElement>('[data-pick]').forEach((sel) => (sel.onchange = () => void save(sel.dataset.pick!, sel.value || null)));
  el.querySelectorAll<HTMLButtonElement>('[data-weekput]').forEach((b) => (b.onclick = () => void save(b.dataset.weekput!, b.dataset.to || null)));
  const put = el.querySelector<HTMLButtonElement>('[data-put]');
  if (put && view) put.onclick = () => void save(el.querySelector<HTMLSelectElement>('#jv-week')!.value, view);
  el.querySelectorAll<HTMLButtonElement>('[data-off]').forEach((b) => (b.onclick = () => void save(b.dataset.off!, null)));
  const approve = el.querySelector<HTMLButtonElement>('[data-approve]');
  if (approve && view)
    approve.onclick = async () => {
      const id = view!;
      await api.setCourseApproved(requireSession(), id, !data.planner.approved[id]).catch(() => {});
      data.planner = await api.coursePlanner(requireSession()).catch(() => data.planner);
      draw();
    };
  if (view && el.querySelector('#jv-tweak')) {
    const c = asBuilt(view);
    if (c) {
      if (tw.course !== c.id) tw = { course: c.id, hole: 0, t: { ...(tweaksOf()[c.id]?.['1'] ?? {}) } };
      drawTweak(c);
    }
  }
  bindAsk(el);
  void snap;
}

// ---- the dials: one hole at a time, saved for everyone ----

let tw: { course: string; hole: number; t: Tweak } = { course: '', hole: 0, t: {} };

const same = (a: Tweak, b: Tweak) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
// only the dials that are off "as built", in a fixed order
function clean(t: Tweak): Tweak {
  const o: Tweak = {};
  if (t.tee) o.tee = t.tee;
  if (t.fairway) o.fairway = t.fairway;
  if (t.pins?.length) o.pins = [...t.pins].sort((a, b) => a - b);
  if (t.wind != null) o.wind = t.wind;
  if (t.time) o.time = t.time;
  return o;
}

function drawTweak(c: Course) {
  const el = document.getElementById('jv-tweak');
  if (!el) return;
  const n = tw.hole + 1;
  const base = c.holes[tw.hole];
  const saved = tweaksOf()[c.id]?.[String(n)] ?? {};
  const t = tw.t;
  const tee = t.tee ?? 0;
  const teeSpot = tee ? teeAt(base, tee) : base.tee;
  const teeBad = !!tee && !teeOk(base, teeSpot);
  const shown = applyTweak(base, clean(t));
  const pins = base.pins ?? [];
  const on = (i: number) => !t.pins?.length || t.pins.includes(i);
  const dirty = !same(t, saved);
  const isNow = snap0 && courseFor(snap0.month).id === c.id;
  const chip = <T,>(attr: string, v: T, label: string, cur: T) => `<button data-${attr}="${String(v)}" class="${cur === v ? 'on' : ''}">${label}</button>`;
  el.innerHTML = `
    <p class="fine">One hole at a time. Live for everyone once saved.</p>
    <div class="jv-hole-tabs">${c.holes.map((_, i) => `<button data-twhole="${i}" class="${i === tw.hole ? 'on' : ''}">${i + 1}${hasTweak(tweaksOf()[c.id]?.[String(i + 1)]) ? '<i></i>' : ''}</button>`).join('')}</div>
    <div class="jv-tweak">
      <div class="jv-tw-plan" id="jv-tw-plan"></div>
      <div class="jv-tw-dials">
        <p class="jv-tw-name"><b>${n}. ${esc(base.name)}</b> · par ${base.par} · ${yardsOf(shown)} yd${shown.yards !== base.yards || tee ? ` <small>(as built ${yardsOf(base)})</small>` : ''}</p>
        <label class="jv-dial"><span>Tee <output id="jv-tee-out">${tee ? `${Math.abs(tee)} yd ${tee > 0 ? 'back' : 'forward'}` : 'As built'}</output></span>
          <input type="range" id="jv-tee" min="${-TEE_MAX}" max="${TEE_MAX}" step="5" value="${tee}"></label>
        ${teeBad ? '<p class="jv-warn">That spot is off the property, wet or in sand. The tee stays where it was.</p>' : ''}
        <div class="jv-dial"><span>Fairway</span><div class="adm-chips">${FAIRWAY_STEPS.map(([v, l]) => chip('fw', v, l, t.fairway ?? 0)).join('')}</div></div>
        ${pins.length > 1 ? `<div class="jv-dial"><span>Pin spots in the rotation</span><div class="adm-chips">${pins.map((_, i) => `<button data-pin="${i}" class="${on(i) ? 'on' : ''}">Spot ${i + 1}</button>`).join('')}</div></div>` : ''}
        <div class="jv-dial"><span>Wind</span><div class="adm-chips">${WIND_STEPS.map(([v, l]) => chip('wind', v, l, t.wind ?? null)).join('')}</div></div>
        ${hasNight(base) ? `<div class="jv-dial"><span>Time of day</span><div class="adm-chips">${chip('time', '', 'By the clock', t.time ?? '')}${chip('time', 'day', 'Always day', t.time ?? '')}${chip('time', 'night', 'Always night', t.time ?? '')}</div></div>` : ''}
        ${isNow && dirty ? '<p class="jv-warn">This is the course being played now: members who already have a card in played it as it was.</p>' : ''}
        <div class="jv-acts">
          <button class="btn" data-twsave ${dirty && !teeBad ? '' : 'disabled'}>${dirty ? 'Save this hole' : 'Saved'}</button>
          ${hasTweak(saved) || dirty ? '<button class="link" data-twreset>Back to as built</button>' : ''}
        </div>
      </div>
    </div>`;
  try {
    const dots = [
      ...pins.map((p, i) => ({ p, color: on(i) ? '#ffd23f' : '#7c7c7c' })),
      { p: shown.tee, color: '#ffffff' },
      ...(tee ? [{ p: base.tee, color: '#9aa' }] : []),
    ];
    document.getElementById('jv-tw-plan')!.appendChild(planCanvas(shown, 220, dots));
  } catch {
    /* no canvas: the dials still work */
  }
  el.querySelectorAll<HTMLButtonElement>('[data-twhole]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.twhole);
        tw = { course: c.id, hole: i, t: { ...(tweaksOf()[c.id]?.[String(i + 1)] ?? {}) } };
        drawTweak(c);
      }),
  );
  const teeIn = el.querySelector<HTMLInputElement>('#jv-tee')!;
  teeIn.oninput = () => {
    const v = Number(teeIn.value);
    el.querySelector('#jv-tee-out')!.textContent = v ? `${Math.abs(v)} yd ${v > 0 ? 'back' : 'forward'}` : 'As built';
  };
  teeIn.onchange = () => ((tw.t = { ...tw.t, tee: Number(teeIn.value) || undefined }), drawTweak(c));
  el.querySelectorAll<HTMLButtonElement>('[data-fw]').forEach((b) => (b.onclick = () => ((tw.t = { ...tw.t, fairway: Number(b.dataset.fw) || undefined }), drawTweak(c))));
  el.querySelectorAll<HTMLButtonElement>('[data-wind]').forEach((b) => (b.onclick = () => ((tw.t = { ...tw.t, wind: b.dataset.wind === 'null' ? undefined : Number(b.dataset.wind) }), drawTweak(c))));
  el.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((b) => (b.onclick = () => ((tw.t = { ...tw.t, time: (b.dataset.time || undefined) as Tweak['time'] }), drawTweak(c))));
  el.querySelectorAll<HTMLButtonElement>('[data-pin]').forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.pin);
        const cur = tw.t.pins?.length ? tw.t.pins : pins.map((_, k) => k);
        let next = cur.includes(i) ? cur.filter((k) => k !== i) : [...cur, i];
        if (!next.length) return void tell('Keep at least one pin spot.');
        if (next.length === pins.length) next = [];
        tw.t = { ...tw.t, pins: next.length ? next : undefined };
        drawTweak(c);
      }),
  );
  const save = async (t: Tweak) => {
    try {
      const keep = clean(t);
      await api.setCourseTweak(requireSession(), c.id, n, Object.keys(keep).length ? keep : null);
      await refresh();
      tw.t = { ...keep };
    } catch (e) {
      void tell("That didn't save", `<p>${esc((e as Error).message)}</p>`);
    }
    drawTweak(c);
  };
  el.querySelector<HTMLButtonElement>('[data-twsave]')!.onclick = () => void save(tw.t);
  const reset = el.querySelector<HTMLButtonElement>('[data-twreset]');
  if (reset) reset.onclick = () => void save({});
}

// ---- bigger changes: ask the Architect ----

function askSection(c: Course): string {
  const mine = data.requests.filter((r) => r.course === c.id);
  return `<section class="jv-sec" id="jv-ask">
    <h3>Ask the Architect</h3>
    <p class="fine">For anything a dial can't do: move a hazard, reshape a green, add a hole. The Architect reads these on its next run and answers with a change to approve.</p>
    <div class="jv-ask">
      <select id="jv-ask-hole" aria-label="Which hole"><option value="">The whole course</option>${c.holes.map((h, i) => `<option value="${i + 1}">${i + 1}. ${esc(h.name)}</option>`).join('')}</select>
      <textarea id="jv-ask-body" rows="3" maxlength="600" placeholder="Move the river bunker 10 yards left so the layup has room."></textarea>
      <button class="btn" data-ask>Send to the Architect</button>
    </div>
    ${mine.length ? `<ul class="jv-reqs">${mine.map((r) => `<li class="${r.done ? 'done' : ''}"><span>${r.hole ? `<b>Hole ${r.hole}</b> ` : ''}${esc(r.body)}</span><button class="link" data-reqdone="${r.id}" data-to="${r.done ? '' : '1'}">${r.done ? 'Reopen' : '✓ Done'}</button></li>`).join('')}</ul>` : ''}
  </section>`;
}

function bindAsk(el: HTMLElement) {
  const send = el.querySelector<HTMLButtonElement>('[data-ask]');
  if (send && view)
    send.onclick = async () => {
      const body = el.querySelector<HTMLTextAreaElement>('#jv-ask-body')!.value.trim();
      const hole = Number(el.querySelector<HTMLSelectElement>('#jv-ask-hole')!.value) || null;
      if (!body) return;
      send.disabled = true;
      try {
        await api.addCourseRequest(requireSession(), view!, hole, body);
        data.requests = await api.courseRequests(requireSession()).catch(() => data.requests);
        draw();
      } catch (e) {
        send.disabled = false;
        void tell("That didn't send", `<p>${esc((e as Error).message)}</p>`);
      }
    };
  el.querySelectorAll<HTMLButtonElement>('[data-reqdone]').forEach(
    (b) =>
      (b.onclick = async () => {
        await api.courseRequestDone(requireSession(), Number(b.dataset.reqdone), b.dataset.to === '1').catch(() => {});
        data.requests = await api.courseRequests(requireSession()).catch(() => data.requests);
        draw();
      }),
  );
}
