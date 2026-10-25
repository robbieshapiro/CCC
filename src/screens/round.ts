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
import { scoreClass } from './home';

let game: Course3D | null = null;

export function closeRound() {
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
  // today's players are on this month's course, not the preview
  if (!preview) game.setGhosts(todaysField(snap));
  const scores: number[] = [];
  const spots: Spot[] = [];
  const feats = new Set<string>();
  for (let i = 0; i < course.holes.length; i++) {
    const h = course.holes[i];
    const par = course.holes.slice(0, i).reduce((a, x) => a + x.par, 0);
    const r = await game.play(h, i + 1, { strokes: scores.reduce((a, b) => a + b, 0), par }, { cart: i > 0, of: course.holes.length });
    if (quit || !game) return;
    scores.push(r.strokes);
    spots.push(r.spot);
    r.feats.forEach((f) => feats.add(f));
  }
  const total = scores.reduce((a, b) => a + b, 0);
  const toPar = total - course.par;
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
        <tr>${scores.map((s, i) => `<td class="num" title="${scoreName(s, course.holes[i].par)}"><span class="sc ${scoreClass(s, course.holes[i].par)}">${s}</span></td>`).join('')}<td class="num tot">${total}</td></tr></tbody></table>
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
  sheet.innerHTML = `
    <div class="summary-card">
      <button class="notes-close" data-back aria-label="Close">✕</button>
      <p class="eyebrow">Practice · ${n} holes · not counted</p>
      <h2>${esc(next.name)}</h2>
      <p class="muted">It plays differently from the Highlands. Two things to know before you tee off.</p>
      <h3>The swing meter</h3>
      <ul>
        <li>It stands beside your golfer, and the club swings with it.</li>
        <li>Tap once to start the backswing, again on your gold line to set the power, and again in the gold at the bottom to strike it.</li>
        <li>You have more time to find the gold than on the Highlands.</li>
        <li>Righty or lefty? Set it under Gear on your member card. The meter sits on the left for righties, the right for lefties.</li>
      </ul>
      <h3>Putting</h3>
      <ul>
        <li>There is no aim line. Judge the pace off the power bar as you pull back.</li>
        <li>Read the break from the grid on the green: amber is above your ball, blue is below.</li>
        <li>Firm putts can hop the hole. Let it die in.</li>
      </ul>
      <div class="summary-actions"><button class="btn" data-go>Continue to round</button><button class="btn ghost" data-back>Not now</button></div>
    </div>`;
  document.body.appendChild(sheet);
  const close = () => sheet.remove();
  sheet.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
    close();
    void round(snap, { course: next, holes: n, practice: true });
  };
  // the ✕, Not now, or a tap on the dimmed backdrop all take you back to the club
  const back = () => {
    close();
    navigate('#/');
  };
  sheet.querySelectorAll<HTMLButtonElement>('[data-back]').forEach((b) => (b.onclick = back));
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) back();
  });
  // leaving the page by any other way takes the sheet with it
  window.addEventListener('hashchange', close, { once: true });
}
