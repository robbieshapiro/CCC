// The Daily Shot on the home page and after your last try: today's shot, your tries, your streak, the board across
// every club, and a result to share.
import { api } from '../api';
import type { DailyState, DailyTry } from '../api/types';
import { bestTry, DAILY_TRIES, dailyShot, resultLabel, tryMark } from '../daily';
import { requireSession } from '../state';
import { esc } from '../ui';

const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

export function shareText(day: string, tries: DailyTry[]) {
  const shot = dailyShot(day);
  const best = bestTry(tries);
  return `CCC Closest to the Pin #${shot.number} · ${shot.label}\n${tries.map(tryMark).join(' ')}  Best: ${resultLabel(best)}\n${location.origin}`;
}

export async function share(text: string, btn?: HTMLButtonElement) {
  try {
    if (canShare()) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      if (btn) btn.textContent = 'Copied';
    }
  } catch {
    window.prompt('Copy your result', text);
  }
}

function board(state: DailyState, top = 5) {
  if (!state.board.length) return '<p class="muted">Nobody yet. First on the board?</p>';
  const rows = state.board.slice(0, top);
  const me = state.board.findIndex((r) => r.mine);
  if (me >= top) rows.push(state.board[me]);
  return `<ol class="daily-board">${rows
    .map((r) => {
      const i = state.board.indexOf(r) + 1;
      return `<li class="${r.mine ? 'me' : ''}"><span>${i}</span><b>${esc(r.name)}</b><small></small><em>${r.holed ? `Holed${r.holedTry ? ` · try ${r.holedTry}` : ''}` : resultLabel({ ft: r.ft, holed: r.holed, lost: r.ft === null && !r.holed })}</em></li>`;
    })
    .join('')}</ol>`;
}

// the tile on the Play page, filled in once the day's state loads: today's shot and where you stand
export function dailyCard() {
  return `<a class="tile daily" id="daily-card" href="#/daily" hidden></a>`;
}

export async function bindDaily(day: string) {
  const el = document.getElementById('daily-card');
  if (!el) return;
  const state = await api.dailyState(requireSession(), day).catch(() => null);
  if (!state || !document.getElementById('daily-card')) return; // no SQL yet, or left the page
  const shot = dailyShot(day);
  const left = DAILY_TRIES - state.mine.length;
  const rank = state.board.findIndex((r) => r.mine) + 1;
  const status = !state.mine.length
    ? `${shot.yards} yd · 3 tries`
    : left
      ? `Best ${resultLabel(bestTry(state.mine))} · ${left} ${left === 1 ? 'try' : 'tries'} left`
      : `Best ${resultLabel(bestTry(state.mine))}${rank ? ` · ${ordinal(rank)} of ${state.players}` : ''}`;
  el.hidden = false;
  el.innerHTML = `<i>🎯</i><b>Closest to the Pin</b><span>${esc(status)}</span>${state.streak ? `<em class="tile-badge">🔥 ${state.streak}</em>` : ''}`;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// after the last try: how it went, the board, and the share
export async function dailySummary(day: string, onClose: () => void) {
  const state = await api.dailyState(requireSession(), day).catch(() => null);
  const shot = dailyShot(day);
  const tries = state?.mine ?? [];
  const sheet = document.createElement('div');
  sheet.className = 'practice-notes daily-summary';
  sheet.innerHTML = `
    <div class="notes-card">
      <div class="notes-body">
        <p class="eyebrow">Closest to the Pin · #${shot.number}</p>
        <h2>${esc(shot.label)}</h2>
        <p class="daily-mine big">${tries.map(tryMark).join(' ')}</p>
        <p>Your best: <b>${resultLabel(bestTry(tries))}</b>${state?.streak ? ` · 🔥 ${state.streak} ${state.streak === 1 ? 'day' : 'days in a row'}` : ''}</p>
        <h3>Today's board</h3>
        ${state ? board(state, 10) : '<p class="muted">The board is on its way.</p>'}
        <p class="fine">A new shot at midnight, Eastern.</p>
      </div>
      <div class="notes-foot daily-foot"><button class="btn" data-share>${canShare() ? 'Share' : 'Copy result'}</button><button class="btn ghost" data-close>Back to the club</button></div>
    </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector<HTMLButtonElement>('[data-share]')!.onclick = (e) => void share(shareText(day, tries), e.currentTarget as HTMLButtonElement);
  sheet.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => {
    sheet.remove();
    onClose();
  };
  window.addEventListener('hashchange', () => sheet.remove(), { once: true });
}
