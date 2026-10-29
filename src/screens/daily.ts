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
  return `CCC Daily Shot #${shot.number} · ${shot.label}\n${tries.map(tryMark).join(' ')}  Best: ${resultLabel(best)}\n${location.origin}`;
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
      return `<li class="${r.mine ? 'me' : ''}"><span>${i}</span><b>${esc(r.name)}</b><small>${esc(r.club)}</small><em>${r.holed ? `Holed${r.holedTry ? ` · try ${r.holedTry}` : ''}` : resultLabel({ ft: r.ft, holed: r.holed, lost: r.ft === null && !r.holed })}</em></li>`;
    })
    .join('')}</ol>`;
}

// the card on the home page, filled in once the day's state loads
export function dailyCard() {
  return `<section class="daily-card" id="daily-card" hidden></section>`;
}

export async function bindDaily(day: string) {
  const el = document.getElementById('daily-card');
  if (!el) return;
  const state = await api.dailyState(requireSession(), day).catch(() => null);
  if (!state || !document.getElementById('daily-card')) return; // no SQL yet, or left the page
  const shot = dailyShot(day);
  const left = DAILY_TRIES - state.mine.length;
  const best = bestTry(state.mine);
  el.hidden = false;
  el.innerHTML = `
    <div class="daily-head">
      <div><p class="eyebrow">Daily Shot #${shot.number} · committee preview</p><h2>${esc(shot.label)}</h2></div>
      ${state.streak ? `<span class="daily-streak" title="Days in a row">🔥 ${state.streak}</span>` : ''}
    </div>
    <p class="muted">${shot.hole.par === 3 ? 'From the tee.' : 'An approach from the fairway.'} ${shot.wind.mph ? `${shot.wind.mph} mph wind.` : 'No wind.'} Three tries, closest to the pin wins.</p>
    ${state.mine.length ? `<p class="daily-mine">${state.mine.map(tryMark).join(' ')} <span>Your best: <b>${resultLabel(best)}</b></span></p>` : ''}
    <div class="daily-actions">
      ${left ? `<a class="btn" href="#/daily">${state.mine.length ? `Take try ${state.mine.length + 1} of ${DAILY_TRIES}` : 'Take your shot'}</a>` : `<button class="btn ghost" data-daily-share>${canShare() ? 'Share' : 'Copy result'}</button>`}
      <span class="muted">${state.players} ${state.players === 1 ? 'player' : 'players'} today</span>
    </div>
    ${board(state)}`;
  el.querySelector<HTMLButtonElement>('[data-daily-share]')?.addEventListener('click', (e) => void share(shareText(day, state.mine), e.currentTarget as HTMLButtonElement));
}

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
        <p class="eyebrow">Daily Shot #${shot.number}</p>
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
