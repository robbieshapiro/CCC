// Today's cards, as members meet them on home (and the Committee rehearses it in Admin): the Play tile in each state,
// the note before a fresh card (the card counts, practice doesn't, pick one), and the line Leave shows mid-card.
import type { CardToday } from '../api/types';
import { CARDS_A_DAY } from '../day';
import type { Course } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { esc } from '../ui';
import { holdSheet } from '../dialog';

// "Hole 3 of 5 · +1 through 2 · 2 strokes in"
export function cardStatus(course: Course, scores: number[], here = 0): string {
  const n = scores.length;
  const of = course.holes.length;
  const parts = [`Hole ${Math.min(n + 1, of)} of ${of}`];
  if (n) {
    const toPar = scores.reduce((a, b) => a + b, 0) - course.holes.slice(0, n).reduce((a, h) => a + h.par, 0);
    parts.push(`${toParLabel(toPar)} through ${n}`);
  }
  if (here) parts.push(`${here} stroke${here === 1 ? '' : 's'} in`);
  return parts.join(' · ');
}

export type TileState = 'fresh' | 'going' | 'in' | 'elsewhere';
export const tileState = (t: CardToday | null, cardIn: boolean): TileState =>
  t?.club ? 'elsewhere' : cardIn || t?.done ? 'in' : t && (t.scores.length || t.shots) ? 'going' : 'fresh';

// A card is going at another of the member's clubs: two cards a day, whichever clubs they're played in
export function elsewhereLine(t: CardToday): { head: string; line: string; go: string } {
  const club = esc(t.club ?? 'your other club');
  return t.done
    ? { head: `Today's cards are in at ${club}`, line: 'New ones at midnight.', go: `Go to ${club}` }
    : { head: `Your card is going at ${club}`, line: `Finish it there <b>before midnight ET</b>.`, go: `Continue at ${club}` };
}

// "Card 2 of 2", and the line about the better card counting
const nth = (t: CardToday | null) => Math.min((t?.n ?? 0) + 1, t?.of ?? CARDS_A_DAY);
const bestSoFar = (t: CardToday | null) => (t?.best != null ? ` (${toParLabel(t.best)})` : '');

// The buttons and lines under the course name on the Play tile. `play` and `practice` are where they go; on a fresh
// card the play button carries data-card-note, so a tap opens the note first (see bindCardNote).
// `first`: they've never posted a round, so practice leads (Hank shows them the swing there) and the card comes second.
export function cardTile(state: TileState, course: Course, t: CardToday | null, links: { play: string; practice: string }, first = false): string {
  if (state === 'elsewhere' && t) {
    const e = elsewhereLine(t);
    return `<div class="card-going"><p class="eyebrow">Two cards a day, in any club</p><b>${e.head}</b></div>
      ${t.done ? `<a class="btn big" href="${links.practice}">Practice round</a>` : `<a class="btn big" href="#/" data-go-club="${esc(t.clubId ?? '')}">${e.go}</a>`}
      <p class="fine card-line">${e.line}${t.done ? '' : ` <a href="${links.practice}">Practise here</a>`}</p>`;
  }
  if (state === 'in')
    return `<a class="btn big" href="${links.practice}">Practice round</a><p class="fine card-line">Both of today's cards are in. Your better one counts${bestSoFar(t)}. New ones at midnight.</p>`;
  if (state === 'going' && t)
    return `<div class="card-going"><p class="eyebrow">Card ${nth(t)} of ${t.of ?? CARDS_A_DAY} · in progress</p><b>${esc(cardStatus(course, t.scores, t.shots))}</b></div>
      <a class="btn big" href="${links.play}">Continue card ${nth(t)}</a>
      <p class="fine card-line">Finish it <b>before midnight ET</b>, or this card is forfeited. Practice opens once it's in.</p>`;
  // one card in: the second is waiting
  if (t?.n)
    return `<a class="btn big" href="${links.play}">Play card ${nth(t)} of ${t.of ?? CARDS_A_DAY}</a><p class="fine card-line">Card 1 is in${bestSoFar(t)}. Your better card counts. <a href="${links.practice}">Practise first</a></p>`;
  if (first)
    return `<a class="btn big" href="${links.practice}">Practise first</a><p class="fine card-line">New here? A practice round never counts, and Hank will show you the swing. Then <a href="${links.play}" data-card-note>play today's card</a>.</p>`;
  return `<a class="btn big" href="${links.play}" data-card-note>Play today's card</a><p class="fine card-line">Two cards a day. Your better one counts. <a href="${links.practice}">Practise first</a></p>`;
}

// The note before a fresh card: two choices that look nothing alike, so nobody starts the real thing by mistake.
export function cardNote(): Promise<'card' | 'practice' | null> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg card-note" role="dialog" aria-modal="true" aria-labelledby="cn-h">
      <p class="eyebrow">Before you tee off</p>
      <h2 id="cn-h">How today's card works</h2>
      <button class="cn-opt cn-card" data-pick="card">
        <span class="cn-tag">Counts</span>
        <b>Play today's card</b>
        <ul>
          <li>Two cards a day. The better one goes on the board and the Open.</li>
          <li>Each locks at its first swing. No restarts.</li>
          <li>Leave mid-round and it's saved on the hole you're on.</li>
          <li>Finish it before midnight ET, or that card is forfeited.</li>
        </ul>
        <span class="cn-go">Tee off for real →</span>
      </button>
      <button class="cn-opt cn-practice" data-pick="practice">
        <span class="cn-tag">Doesn't count</span>
        <b>Practise the course</b>
        <p>Play it as often as you like, in today's wind and pins. Nothing is kept, and your cards are still waiting after.</p>
        <span class="cn-go">Practise →</span>
      </button>
      <button class="link cn-cancel" data-pick="">Not now</button>
    </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const done = (v: 'card' | 'practice' | null) => {
      window.removeEventListener('keydown', key, true);
      back.remove();
      // picked: a sheet that holds until the course is up, rather than a moment back on home
      if (v) holdSheet(v === 'card' ? 'Heading to the first tee' : 'Opening the practice round', 'Setting out the course. It can take a few seconds.');
      resolve(v);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        done(null);
      }
    };
    window.addEventListener('keydown', key, true);
    back.onclick = (e) => e.target === back && done(null);
    back.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) => (b.onclick = () => done((b.dataset.pick || null) as 'card' | 'practice' | null)));
  });
}

// A tap on a fresh card's Play button opens the note, then goes where they picked.
export function bindCardNote(root: ParentNode, links: { play: string; practice: string }, go: (hash: string) => void) {
  root.querySelectorAll<HTMLAnchorElement>('[data-card-note]').forEach((a) => {
    a.onclick = async (e) => {
      e.preventDefault();
      const pick = await cardNote();
      if (pick) go(pick === 'card' ? links.play : links.practice);
    };
  });
}
