// The Committee Room's home: the game maker's desk. Jarvis's briefing first (worked out from the numbers, no AI),
// then this week's course with how it's really playing and what to tweak, then every course week by week: the
// coming weeks, the weeks gone by, and the bench (courses on no week). Each tile opens the course: review it, play
// it, test it, and put it on a week.
import { api } from '../api';
import type { AdminKpis, CoursePlanner, CourseRequest, HoleReport, Snapshot } from '../api/types';
import { planCanvas } from '../designer/plan';
import { applyTweak, FAIRWAY_STEPS, hasTweak, TEE_MAX, teeAt, teeOk, WIND_STEPS, type Tweak } from '../golf3d/tweaks';
import { tell } from '../dialog';
import { isWeek, nextStart, periodName, todayInGameTz } from '../day';
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

type Data = { kpis: AdminKpis | null; report: HoleReport[]; planner: CoursePlanner; requests: CourseRequest[] };
let data: Data = { kpis: null, report: [], planner: { approved: {}, results: {} }, requests: [] };
let snap0: Snapshot | null = null;
let view: string | null = null; // a course id when one is open

// Overview: the briefing, what's waiting, then the Pulse (one strip of headline numbers, every club side by side, one
// chart). who: who's in and the feed (adminToday.ts); more: the rest of the numbers (adminKpis.ts), folded.
export const overviewSections = (who = '', more = '') => `<div id="jv-top"></div>
  <div id="adm-needs" class="adm-needs" hidden></div>
  <section class="jv-pulse" id="jv-pulse">
    <h2 class="jv-h">The pulse <small>every club</small></h2>
    <div id="jv-pulse-top"></div>
    <div id="adm-pulse-clubs"></div>
    <div class="adm-card adm-charts" id="jv-pulse-chart" hidden></div>
  </section>
  ${who}
  ${more}`;
// Courses: every week's tile, and a course's own page
export const coursesSections = () => `<div id="jv-home"><p class="muted">Loading…</p></div>`;

export async function loadHome(snap: Snapshot, course?: string) {
  snap0 = snap;
  view = course ?? null;
  draw();
  const s = requireSession();
  const [kpis, report, planner, requests] = await Promise.all([
    api.adminKpis(s).catch(() => null),
    api.adminHoles(s).catch(() => [] as HoleReport[]),
    api.coursePlanner(s).catch(() => ({ approved: {}, results: {} })),
    api.courseRequests(s).catch(() => [] as CourseRequest[]),
  ]);
  data = { kpis, report, planner, requests };
  draw();
}

// open a course (or go back to every week) without reloading the numbers
export function showCourse(id: string | null) {
  view = id;
  draw();
  window.scrollTo({ top: 0 });
}

function draw() {
  const el = document.getElementById('jv-home');
  if (!el || !snap0) return;
  const c = view ? courseById(view) : null;
  const top = document.getElementById('jv-top');
  if (top) top.innerHTML = brief(snap0);
  pulse();
  el.innerHTML = c ? detail(snap0, c) : home(snap0);
  bind(el, snap0);
  courseNeeds(snap0);
}

// what's waiting on the course side: next week with nothing picked (it would carry on), and new courses on no week
function courseNeeds(snap: Snapshot) {
  const nw = nextStart(snap.month);
  const ahead: string[] = [];
  let w = snap.month;
  for (let i = 0; i < AHEAD; i++) ahead.push((w = nextStart(w)));
  setNeeds('nopick', !scheduleOf()[nw] && courseFor(nw).id === courseFor(snap.month).id ? 1 : 0);
  setNeeds('unplaced', tourCourses().filter((c) => c.draft && !c.id.startsWith('room-') && !ahead.some((x) => courseFor(x).id === c.id)).length);
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

// ---- Jarvis: what matters now, in a line or two each ----

type Note = { hole: number; text: string; level: 'hard' | 'easy' | 'note' };

// what to tweak on this week's course, from members' real scores and shots (a few rounds before it says anything)
function notesFor(c: Course): Note[] {
  const out: Note[] = [];
  for (const h of data.kpis?.holes ?? []) {
    const hole = c.holes[h.hole - 1];
    if (!hole || h.n < 3) continue;
    const r = data.report.find((x) => x.hole === h.hole);
    const name = `${h.hole}. ${hole.name}`;
    if (h.avg >= 1) out.push({ hole: h.hole, level: 'hard', text: `${name} plays ${toParLabel(Math.round(h.avg * 10) / 10)} a round. Ease it: move the tee up or widen where the drive lands.` });
    else if (h.avg <= -0.6) out.push({ hole: h.hole, level: 'easy', text: `${name} plays ${toParLabel(Math.round(h.avg * 10) / 10)}. Too kind: push the tee back or tuck the pin.` });
    if (r && r.rounds >= 3 && r.threePutts >= 0.3) out.push({ hole: h.hole, level: 'note', text: `${name}: ${Math.round(r.threePutts * 100)}% three-putt. Soften the green's slope.` });
    if (r && r.rounds >= 3 && r.penalties >= 0.35) out.push({ hole: h.hole, level: 'note', text: `${name}: ${r.penalties.toFixed(1)} penalties a hole. Give the hazard more room.` });
  }
  return out;
}

function briefing(snap: Snapshot): string[] {
  const now = courseFor(snap.month);
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const lines: string[] = [];
  if (isWeek(snap.month)) {
    const day = Math.min(7, Math.max(1, Math.round((Date.parse(`${todayInGameTz()}T12:00:00Z`) - Date.parse(`${snap.month}T12:00:00Z`)) / 86400000) + 1));
    lines.push(`Day ${day} of 7 on <b>${esc(short(now))}</b>.`);
  } else lines.push(`<b>${esc(short(now))}</b> is on.`);
  if (played.length) {
    const top = played.filter((r) => r.rank === 1);
    const who = top.map((r) => snap.players.find((p) => p.id === r.playerId)?.name ?? '?');
    lines.push(`${esc(who.join(' and '))} ${top.length > 1 ? 'lead' : 'leads'} at ${toParLabel(top[0].toPar)}.`);
  }
  const notes = notesFor(now);
  if (notes.length) lines.push(`${notes.length === 1 ? 'One thing' : `${notes.length} things`} to look at on this course. ${esc(notes[0].text)}`);
  const nw = nextStart(snap.month);
  const next = courseFor(nw);
  if (scheduleOf()[nw]) lines.push(`Next week: <b>${esc(short(next))}</b>, picked.${next.draft ? ' Still a draft: play it before Sunday.' : ''}`);
  else if (next.id === now.id) lines.push(`Nothing picked for next week, so ${esc(short(now))} carries on.`);
  else lines.push(`Next week: <b>${esc(short(next))}</b>, from the calendar.`);
  return lines;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date()));
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

// ---- the home: briefing, this week, every week ----

function brief(snap: Snapshot): string {
  const me = snap.players.find((p) => p.id === snap.me)?.name ?? '';
  return `<section class="jv-brief">
      <p class="jv-hi">${greeting()}${me ? `, ${esc(me)}` : ''}.</p>
      ${briefing(snap)
        .map((l) => `<p>${l}</p>`)
        .join('')}
    </section>`;
}

function home(snap: Snapshot): string {
  const now = courseFor(snap.month);
  const notes = notesFor(now);
  const ahead: string[] = [];
  let w = snap.month;
  for (let i = 0; i < AHEAD; i++) ahead.push((w = nextStart(w)));
  const back: string[] = [];
  // weeks only: the months before Nov 2026 aren't weeks
  for (let i = 1; i <= BACK; i++) if (addDays(snap.month, -7 * i) >= FIRST_WEEK) back.push(addDays(snap.month, -7 * i));
  const onWeek = new Set([snap.month, ...ahead, ...back].map((x) => courseFor(x).id));
  const bench = [...tourCourses(), ...labHoles()].filter((c) => !onWeek.has(c.id));
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
        <div><b>${notes.length}</b><span>to look at</span></div>
      </div>
      <span class="jv-open">Open ›</span>
    </button>
    ${notes.length ? `<ul class="jv-notes">${notes.slice(0, 3).map((n) => `<li class="${n.level}">${esc(n.text)}</li>`).join('')}</ul>` : ''}

    <h2 class="jv-h" id="jv-coming">Coming up</h2>
    <div class="jv-weeks">${ahead.map((x) => weekTile(x)).join('')}</div>

    ${back.length ? `<h2 class="jv-h">Weeks gone by</h2><div class="jv-weeks past">${back.map((x) => weekTile(x, true)).join('')}</div>` : ''}

    ${bench.length ? `<h2 class="jv-h" id="jv-benchh">The bench <small>on no week</small></h2><div class="jv-bench">${bench.map(benchTile).join('')}</div>` : ''}
    <p class="jv-foot"><a href="#/room">🛰️ Build a course from scratch in the Design Room</a></p>`;
}

function weekTile(w: string, past = false): string {
  const c = courseFor(w);
  const picked = scheduleOf()[w] === c.id;
  const prev = courseFor(addDays(w, -7));
  const res = data.planner.results[c.id];
  const r = ratingOf(c);
  const chip = past
    ? res
      ? `<i>${toParLabel(res.avg)} avg</i>`
      : ''
    : picked
      ? `<i class="ok">Picked</i>`
      : prev.id === c.id
        ? `<i class="dim">Carries on</i>`
        : `<i>Calendar</i>`;
  return `<button class="jv-tile" data-open="${c.id}" style="${style(c)}">
    <small class="jv-wk">${esc(weekLabel(w))}</small>
    <span class="jv-emoji" aria-hidden="true">${artOf(c).emoji}</span>
    <b>${esc(short(c))}</b>
    <em>${c.holes.length} holes · par ${c.par}${r ? ` · slope ${r.slope}` : ''}</em>
    <span class="jv-chips">${chip}${Object.keys(tweaksOf()[c.id] ?? {}).length && !past ? '<i>🎛️ Tweaked</i>' : ''}${c.draft && !past ? `<i class="draft">${data.planner.approved[c.id] ? 'Approved' : 'Draft'}</i>` : ''}</span>
  </button>`;
}

function benchTile(c: Course): string {
  return `<button class="jv-tile small" data-open="${c.id}" style="${style(c)}">
    <span class="jv-emoji" aria-hidden="true">${artOf(c).emoji}</span>
    <b>${esc(short(c).replace(/^Lab · /, ''))}</b>
    <em>${c.lab ? 'Hole Lab' : c.id.startsWith('room-') ? 'Design Room' : c.draft ? 'Draft' : 'Played before'} · par ${c.par}</em>
    ${Object.keys(tweaksOf()[c.id] ?? {}).length ? '<span class="jv-chips"><i>🎛️ Tweaked</i></span>' : ''}
  </button>`;
}

// ---- one course: review, play and test, plan ----

function detail(snap: Snapshot, c: Course): string {
  const now = courseFor(snap.month);
  const isNow = c.id === now.id;
  const isNext = c.id === nextCourse(snap.month)?.id;
  const r = ratingOf(c);
  const res = data.planner.results[c.id];
  const notes = isNow ? notesFor(c) : [];
  const ahead: string[] = [];
  let w = snap.month;
  for (let i = 0; i < AHEAD; i++) ahead.push((w = nextStart(w)));
  const mine = ahead.filter((x) => scheduleOf()[x] === c.id);
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

    <section class="jv-sec">
      <h3>Play and test</h3>
      <div class="jv-acts">
        <a class="btn" href="#/preview/${c.id}">▶ Play it, with the controls</a>
        ${isNext ? '<a class="btn ghost" href="#/rehearse">Rehearse Sunday\'s card</a>' : ''}
        ${c.id.startsWith('room-') ? `<a class="btn ghost" href="#/room/${c.id.slice(5)}">🛰️ Open on the holo-table</a>` : ''}
      </div>
      ${hasNight(c.holes[0]) ? `<div class="adm-chips" role="group" aria-label="Time of day"><small>Time</small><button data-night="day">☀️ Day</button><button data-night="night">🌙 Night</button><button data-night="">By the clock</button></div>` : ''}
      <p class="fine">In play, Controls sets the time of day, the wind and the pin, pours any drink, puts a shot back and drops the ball anywhere. Nothing is posted or paid.</p>
    </section>

    ${c.lab ? '' : `<section class="jv-sec" id="jv-tweak"></section>`}
    ${c.lab ? '' : askSection(c)}

    ${
      c.lab
        ? ''
        : `<section class="jv-sec">
      <h3>Plan</h3>
      <p>${mine.length ? `Picked for ${mine.map(weekLabel).join(', ')}.` : isNow ? 'This week. Pick it again for a coming week to keep it on.' : 'Not picked for a coming week.'}</p>
      <div class="jv-plan">
        <select id="jv-week" aria-label="Week">${ahead
          .map((x) => `<option value="${x}">${esc(weekLabel(x))}${scheduleOf()[x] ? ` (now ${esc(short(courseFor(x)))})` : ''}</option>`)
          .join('')}</select>
        <button class="btn" data-put>Put it on that week</button>
      </div>
      ${mine.length ? `<div class="jv-off">${mine.map((x) => `<button class="link" data-off="${x}">Take it off ${esc(weekLabel(x))}</button>`).join('')}</div>` : ''}
      ${c.draft ? `<button class="link" data-approve>${data.planner.approved[c.id] ? 'Un-approve the draft' : '✓ Approve the draft'}</button>` : ''}
    </section>`
    }

    <section class="jv-sec">
      <h3>How it plays</h3>
      <dl class="jv-stats">
        <div><dt>CCC Rating</dt><dd>${r ? r.rating.toFixed(1) : '–'}</dd></div>
        <div><dt>Slope</dt><dd>${r ? r.slope : '–'}</dd></div>
        <div><dt>Members avg</dt><dd>${res ? toParLabel(res.avg) : '–'}</dd></div>
        <div><dt>Best</dt><dd>${res ? toParLabel(res.best) : '–'}</dd></div>
      </dl>
      <p class="fine">${res ? `${res.rounds} rounds from ${res.members} ${res.members === 1 ? 'member' : 'members'}${res.bestBy ? `, best by ${esc(res.bestBy)}` : ''}.` : 'No member rounds yet.'}${r ? ` The robot rated it ${esc(new Date(`${r.at}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))}${r.hardest ? `; hardest for it: ${esc(r.hardest)}` : ''}.` : ''}</p>
      ${notes.length ? `<ul class="jv-notes">${notes.map((n) => `<li class="${n.level}">${esc(n.text)}</li>`).join('')}</ul>` : ''}
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
    </section>`;
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
    draw();
  };
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
    <h3>Tweak <small>live for everyone once saved</small></h3>
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
