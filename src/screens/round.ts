// A full round: every hole of this month's course in one go, then the card goes up on the board.
// A preview round (the admin, every hole of a course still to come) and a practice round (any member, the first few holes
// of the next course) are played the same way but never posted.
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { crest } from '../brand';
import { sfx } from '../fx/sound';
import { Course3D, scoreName, type Ghost } from '../golf3d/engine';
import { todayInGameTz } from '../day';
import type { Spot } from '../api/types';
import { courseFor, type Course } from '../golf3d/courses';
import { hostChip, REGINALD } from '../host';
import { myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { esc, navigate, render } from '../ui';
import { openFeedback } from './feedback';
import { joinPractice, leavePractice } from './practice';
import { range, TARGETS } from '../golf3d/practice/range';
import { shortgame, STATIONS } from '../golf3d/practice/shortgame';
import { scoreClass } from './home';

let game: Course3D | null = null;

export function closeRound() {
  leavePractice();
  game?.destroy();
  game = null;
  document.body.classList.remove('court-open');
}

// Everyone else who has played today: their best round of the day, on today's pins and wind.
function todaysField(snap: Snapshot): Ghost[] {
  const best = new Map<string, Snapshot['rounds'][number]>();
  for (const r of snap.rounds) {
    if (r.playerId === snap.me || !r.spots || todayInGameTz(new Date(r.createdAt)) !== snap.today) continue;
    const b = best.get(r.playerId);
    if (!b || r.total < b.total) best.set(r.playerId, r);
  }
  return [...best.values()].flatMap((r) => {
    const p = snap.players.find((x) => x.id === r.playerId);
    return p ? [{ name: p.name, avatar: p.avatar, spots: r.spots!, holes: r.holes }] : [];
  });
}

export async function round(snap: Snapshot, opts: { course?: Course; holes?: number; practice?: boolean } = {}) {
  closeRound();
  const preview = !!opts.course;
  const full = opts.course ?? courseFor(snap.month);
  // a practice round plays just the first few holes
  const holes = full.holes.slice(0, opts.holes ?? full.holes.length);
  const course: Course = { ...full, holes, par: holes.reduce((a, h) => a + h.par, 0) };
  const me = snap.players.find((p) => p.id === snap.me)!;
  const before = myBest(snap);
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  let quit = false;
  try {
    game = new Course3D(el, me.avatar, () => {
      quit = true;
      closeRound();
      navigate('#/');
    });
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
    return;
  }
  // a practice round is a practice session: joined here, ended when they leave or finish
  if (opts.practice) {
    game.leaveText = 'Leave practice';
    game.onShot = joinPractice('caldera').shot;
  }
  // today's players are on this month's course, not the preview
  if (!preview) game.setGhosts(todaysField(snap));
  const scores: number[] = [];
  const spots: Spot[] = [];
  const feats = new Set<string>();
  // the admin's preview can jump to any hole, or start the one they're on over
  let jump: ((i: number) => void) | null = null;
  if (preview && !opts.practice) game.setHoleMenu(course.holes.map((h) => `${h.name} · Par ${h.par}`), (i) => jump?.(i));
  for (let i = 0; i < course.holes.length; ) {
    const h = course.holes[i];
    const par = course.holes.reduce((a, x, j) => a + (scores[j] === undefined ? 0 : x.par), 0);
    const jumped = new Promise<number>((res) => (jump = res));
    const played = game.play(h, i + 1, { strokes: scores.reduce((a, b) => a + b, 0), par }, { cart: i > 0, of: course.holes.length });
    const r = await Promise.race([played, jumped]);
    if (quit || !game) return;
    if (typeof r === 'number') {
      i = r;
      continue;
    }
    scores[i] = r.strokes;
    spots[i] = r.spot;
    r.feats.forEach((f) => feats.add(f));
    i++;
  }
  if (opts.practice) leavePractice();
  const total = scores.reduce((a, b) => a + b, 0);
  const toPar = total - course.holes.reduce((a, h, i) => a + (scores[i] === undefined ? 0 : h.par), 0);
  const best = !preview && (!before || toPar < before.total - before.par);
  let posted = true;
  if (!preview)
    try {
      await api.submitRound(requireSession(), { course: course.id, holes: scores, pars: course.holes.map((h) => h.par), feats: [...feats], spots });
    } catch {
      posted = false;
    }
  sfx(best ? 'cheer' : 'ooh');
  const sheet = document.createElement('div');
  sheet.className = 'summary';
  sheet.innerHTML = `
    <div class="summary-card">
      ${crest(70, 'sum')}
      <p class="eyebrow">${esc(course.name)}</p>
      <h1>${total} <small>${toParLabel(toPar)}</small></h1>
      ${best ? '<p class="stamp">Personal best</p>' : ''}
      <table class="scorecard"><thead><tr>${course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}<th class="num">Tot</th></tr></thead>
        <tbody><tr class="par">${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td></tr>
        <tr>${course.holes.map((_, i) => scores[i]).map((s, i) => s === undefined ? '<td class="num">–</td>' : `<td class="num" title="${scoreName(s, course.holes[i].par)}"><span class="sc ${scoreClass(s, course.holes[i].par)}">${s}</span></td>`).join('')}<td class="num tot">${total}</td></tr></tbody></table>
      ${
        opts.practice
          ? hostChip('Practice. Nobody is keeping score, least of all me. Come November it counts.', 'dry')
          : preview
            ? hostChip('A private look before the members get at it. I shall say nothing.', 'dry')
            : hostChip(REGINALD.round(toParLabel(toPar), best), best ? 'pleased' : 'dry')
      }
      <p class="fine">${opts.practice ? 'Practice round, not counted.' : preview ? 'Preview round, not counted.' : posted ? 'Posted to the board.' : "Couldn't post this round. Check your connection."}</p>
      <div class="summary-actions"><button class="btn" data-again>Play again</button><button class="btn ghost" data-back>Back to the club</button></div>
      <button class="link" data-feedback>Leave feedback</button>
    </div>`;
  el.appendChild(sheet);
  sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = async () => round(await refresh(), opts);
  sheet.querySelector<HTMLButtonElement>('[data-feedback]')!.onclick = () => openFeedback(`After a ${total} (${toParLabel(toPar)}) on ${course.name}`, el);
  sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => {
    closeRound();
    navigate('#/');
  };
}

// Before a practice round on the next course: what plays differently from the Highlands.
export function practice(snap: Snapshot, next: Course) {
  closeRound();
  const n = Math.min(next.previewHoles ?? next.holes.length, next.holes.length);
  render(`<main class="narrow"></main>`);
  const sheet = document.createElement('div');
  sheet.className = 'practice-notes';
  // a column the height of the screen: the notes scroll, the one button is always there at the bottom
  sheet.innerHTML = `
    <div class="notes-card">
      <div class="notes-body">
        <p class="eyebrow">Practice · ${n} holes · not counted</p>
        <h2>${esc(next.name)}</h2>
        <p class="muted">It plays differently from the Highlands.</p>
        <h3>The swing meter</h3>
        <ul>
          <li>It stands beside your golfer, and the club swings with it.</li>
          <li>Tap to start the backswing, tap on your gold line for power, tap in the gold at the bottom to strike.</li>
          <li>More time to find the gold than on the Highlands.</li>
          <li>Righty or lefty? Set it under Gear on your member card.</li>
        </ul>
        <h3>Putting</h3>
        <ul>
          <li>No aim line: judge the pace off the power bar.</li>
          <li>Read the break from the grid: amber is above your ball, blue below.</li>
          <li>Firm putts can hop the hole. Let it die in.</li>
        </ul>
      </div>
      <div class="notes-foot"><button class="btn" data-go>Join practice</button></div>
    </div>`;
  document.body.appendChild(sheet);
  const close = () => sheet.remove();
  sheet.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
    close();
    void round(snap, { course: next, holes: n, practice: true });
  };
  // leaving the page by any other way takes the sheet with it
  window.addEventListener('hashchange', close, { once: true });
}

// The range or the short game area at the practice facility: a session from the moment you step on to when you leave.
export function practiceArea(snap: Snapshot, kind: 'range' | 'shortgame') {
  closeRound();
  const me = snap.players.find((p) => p.id === snap.me)!;
  render(`<div class="g3" id="g3"></div>`);
  document.body.classList.add('court-open');
  const el = document.getElementById('g3')!;
  try {
    game = new Course3D(el, me.avatar, () => {
      closeRound();
      navigate('#/facility');
    });
  } catch {
    closeRound();
    render(`<main class="narrow"><h1>This device can't draw the course</h1><p class="muted">The club needs WebGL. Try a recent Safari or Chrome.</p><a class="btn" href="#/">Back to the club</a></main>`);
    return;
  }
  game.leaveText = 'Leave practice';
  game.onShot = joinPractice(kind).shot;
  if (kind === 'range') game.practiceArea(range, { title: 'Driving range', stations: [{ name: 'From the mat', at: range.tee }], targets: TARGETS });
  else game.practiceArea(shortgame, { title: 'Short game', stations: STATIONS });
}
