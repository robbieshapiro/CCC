// The Committee Room's home: the game maker's desk. Jarvis's briefing first (worked out from the numbers, no AI),
// then this week's course with how it's really playing and what to tweak, then every course week by week: the
// coming weeks, the weeks gone by, and the bench (courses on no week). Each tile opens the course: review it, play
// it, test it, and put it on a week.
import { api } from '../api';
import type { AdminKpis, CoursePlanner, HoleReport, Snapshot } from '../api/types';
import { tell } from '../dialog';
import { isWeek, nextStart, periodName, todayInGameTz } from '../day';
import { courseById, courseFor, labHoles, nextCourse, scheduleOf, tourCourses, type Course } from '../golf3d/courses';
import { hasNight } from '../golf3d/kits';
import { ratingOf } from '../golf3d/ratings';
import { SCALE } from '../golf3d/clubs';
import { board, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, navigate } from '../ui';
import { setNight } from './previewControls';

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

type Data = { kpis: AdminKpis | null; report: HoleReport[]; planner: CoursePlanner };
let data: Data = { kpis: null, report: [], planner: { approved: {}, results: {} } };
let snap0: Snapshot | null = null;
let view: string | null = null; // a course id when one is open

export const homeSections = () => `<div id="adm-needs" class="adm-needs"></div><div id="jv-home"><p class="muted">Loading…</p></div>`;

export async function loadHome(snap: Snapshot, course?: string) {
  snap0 = snap;
  view = course ?? null;
  draw();
  const s = requireSession();
  const [kpis, report, planner] = await Promise.all([
    api.adminKpis(s).catch(() => null),
    api.adminHoles(s).catch(() => [] as HoleReport[]),
    api.coursePlanner(s).catch(() => ({ approved: {}, results: {} })),
  ]);
  data = { kpis, report, planner };
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
  el.innerHTML = c ? detail(snap0, c) : home(snap0);
  bind(el, snap0);
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
    lines.push(`Day ${day} of 7 on <b>${esc(short(now))}</b>. ${played.length} of ${rows.length} have a card in.`);
  } else lines.push(`<b>${esc(short(now))}</b> is on. ${played.length} of ${rows.length} have a card in.`);
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
  else if (next.id === now.id) lines.push(`Nothing picked for next week, so ${esc(short(now))} carries on. Pick one below.`);
  else lines.push(`Next week: <b>${esc(short(next))}</b>, from the calendar.`);
  return lines;
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date()));
  return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
}

// ---- the home: briefing, this week, every week ----

function home(snap: Snapshot): string {
  const me = snap.players.find((p) => p.id === snap.me)?.name ?? '';
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
    <section class="jv-brief">
      <p class="jv-hi">${greeting()}${me ? `, ${esc(me)}` : ''}.</p>
      ${briefing(snap)
        .map((l) => `<p>${l}</p>`)
        .join('')}
    </section>

    <h2 class="jv-h">This week</h2>
    <button class="jv-now" data-open="${now.id}" style="${style(now)}">
      <div class="jv-art"><span class="jv-emoji" aria-hidden="true">${artOf(now).emoji}</span>
        <small>${esc(weekLabel(snap.month))} · playing now</small><b>${esc(short(now))}</b><em>${now.holes.length} holes · par ${now.par} · ${yards(now).toLocaleString('en-US')} yd</em></div>
      <div class="jv-now-stats">
        <div><b>${played.length}<small>/${rows.length}</small></b><span>cards in</span></div>
        <div><b>${played.length ? toParLabel(played[0].toPar) : '–'}</b><span>leading</span></div>
        <div><b>${data.kpis?.rounds ?? '–'}</b><span>rounds</span></div>
        <div><b>${notes.length}</b><span>${notes.length === 1 ? 'tweak' : 'tweaks'}</span></div>
      </div>
      <span class="jv-open">Open ›</span>
    </button>
    ${notes.length ? `<ul class="jv-notes">${notes.slice(0, 3).map((n) => `<li class="${n.level}">${esc(n.text)}</li>`).join('')}</ul>` : ''}

    <h2 class="jv-h">Coming up</h2>
    <div class="jv-weeks">${ahead.map((x) => weekTile(x)).join('')}</div>

    ${back.length ? `<h2 class="jv-h">Weeks gone by</h2><div class="jv-weeks past">${back.map((x) => weekTile(x, true)).join('')}</div>` : ''}

    ${bench.length ? `<h2 class="jv-h">The bench <small>on no week</small></h2><div class="jv-bench">${bench.map(benchTile).join('')}</div>` : ''}`;
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
    <span class="jv-chips">${chip}${c.draft && !past ? `<i class="draft">${data.planner.approved[c.id] ? 'Approved' : 'Draft'}</i>` : ''}</span>
  </button>`;
}

function benchTile(c: Course): string {
  return `<button class="jv-tile small" data-open="${c.id}" style="${style(c)}">
    <span class="jv-emoji" aria-hidden="true">${artOf(c).emoji}</span>
    <b>${esc(short(c).replace(/^Lab · /, ''))}</b>
    <em>${c.lab ? 'Hole Lab' : c.id.startsWith('room-') ? 'Design Room' : c.draft ? 'Draft' : 'Played before'} · par ${c.par}</em>
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
  if (back) back.onclick = () => (history.length > 1 ? history.back() : navigate('#/admin'));
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
  void snap;
}
