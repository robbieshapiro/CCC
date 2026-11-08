// Today's card, as members meet it on home (and the Committee rehearses it in Admin): the Play tile in each state,
// the note before a fresh card (the card counts, practice doesn't, pick one), and the line Leave shows mid-card.
import type { CardToday } from '../api/types';
import type { Course } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { esc } from '../ui';

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

// Today's card is at another of the member's clubs: one card a day, whichever club it's played in
export function elsewhereLine(t: CardToday): { head: string; line: string; go: string } {
  const club = esc(t.club ?? 'your other club');
  return t.done
    ? { head: `Today's card is in at ${club}`, line: 'A new one at midnight.', go: `Go to ${club}` }
    : { head: `Today's card is going at ${club}`, line: `Finish it there <b>before midnight ET</b>.`, go: `Continue at ${club}` };
}

// The buttons and lines under the course name on the Play tile. `play` and `practice` are where they go; on a fresh
// card the play button carries data-card-note, so a tap opens the note first (see bindCardNote).
export function cardTile(state: TileState, course: Course, t: CardToday | null, links: { play: string; practice: string }): string {
  if (state === 'elsewhere' && t) {
    const e = elsewhereLine(t);
    return `<div class="card-going"><p class="eyebrow">One card a day, in any club</p><b>${e.head}</b></div>
      ${t.done ? `<a class="btn big" href="${links.practice}">Practice round</a>` : `<a class="btn big" href="#/" data-go-club="${esc(t.clubId ?? '')}">${e.go}</a>`}
      <p class="fine card-line">${e.line}${t.done ? '' : ` <a href="${links.practice}">Practise here</a>`}</p>`;
  }
  if (state === 'in')
    return `<a class="btn big" href="${links.practice}">Practice round</a><p class="fine card-line">Today's card is in. A new one at midnight.</p>`;
  if (state === 'going' && t)
    return `<div class="card-going"><p class="eyebrow">Today's card · in progress</p><b>${esc(cardStatus(course, t.scores, t.shots))}</b></div>
      <a class="btn big" href="${links.play}">Continue today's card</a>
      <p class="fine card-line">Finish it <b>before midnight ET</b>, or it's forfeited and today doesn't count. Practice opens once it's in.</p>`;
  return `<a class="btn big" href="${links.play}" data-card-note>Play today's card</a><p class="fine card-line">One card a day counts. <a href="${links.practice}">Practise first</a></p>`;
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
          <li>One card a day goes on the board and the Open.</li>
          <li>It locks at your first swing. No restarts.</li>
          <li>Leave mid-round and it's saved on the hole you're on.</li>
          <li>Finish it before midnight ET, or it's forfeited.</li>
        </ul>
        <span class="cn-go">Tee off for real →</span>
      </button>
      <button class="cn-opt cn-practice" data-pick="practice">
        <span class="cn-tag">Doesn't count</span>
        <b>Practise the course</b>
        <p>Play it as often as you like. Nothing is kept, and today's card is still waiting after.</p>
        <span class="cn-go">Practise →</span>
      </button>
      <button class="link cn-cancel" data-pick="">Not now</button>
    </div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('in'));
    const done = (v: 'card' | 'practice' | null) => {
      window.removeEventListener('keydown', key, true);
      back.remove();
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
