// The Daily Shot on the home page and after your last try: today's shot, your tries, your streak, the board across
// every club, and a result to share.
import { face } from '../faces';
import { prizesLine } from '../bonus';
import { api } from '../api';
import type { DailyCrown, DailyState, DailyTry, ShotBoard, ShotTry } from '../api/types';
import { dailyHoles, ftLabel, SHOT_HOLES, totalFt } from '../dailyholes';
import { money } from '../purse';
import { bestTry, DAILY_TRIES, dailyShot, resultLabel, tryMark } from '../daily';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';
import { copyBox } from '../dialog';

export const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

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
    void copyBox('Copy your result', text);
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
      return `<li class="${r.mine ? 'me' : ''}"><span>${i}</span>${face(r, 24)}<b>${r.playerId ? `<a href="${golferHref(r.playerId, r.mine)}">${esc(r.name)}</a>` : esc(r.name)}</b><small></small><em>${r.holed ? `Holed${r.holedTry ? ` · try ${r.holedTry}` : ''}` : resultLabel({ ft: r.ft, holed: r.holed, lost: r.ft === null && !r.holed })}</em></li>`;
    })
    .join('')}</ol>`;
}

// the tile on the Play page, filled in once the day's state loads: today's shot and where you stand
export function dailyCard() {
  return `<a class="tile daily" id="daily-card" href="#/daily" hidden></a>`;
}

export async function bindDaily(day: string, crown?: DailyCrown | null) {
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
  // yesterday's winner, across every club
  const king = crown ? `<span class="tile-crown">🎯 ${esc(crown.name)} · ${esc(resultLabel({ ft: crown.ft, holed: crown.holed, lost: false }))} yesterday</span>` : '';
  // today's leader, across every club, as the long drive tile shows its own
  const top = state.board[0];
  const lead = `<em class="pm-lead">${top ? `Leader: ${esc(top.name)}, ${esc(top.holed ? 'holed it' : resultLabel({ ft: top.ft, holed: false, lost: top.ft === null }))}${top.mine ? ' (you)' : ''}` : 'Nobody yet today'}</em>`;
  el.innerHTML = `<i>🎯</i><b>Closest to the Pin</b><span>${esc(status)} · pays ${esc(prizesLine())}</span>${lead}${king}${state.streak ? `<em class="tile-badge">🔥 ${state.streak}</em>` : ''}`;
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
        <p class="fine">Today's top three are paid ${prizesLine()} at midnight.</p>
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

// ---------- the Daily Shot, three holes (from Nov 20) ----------

// one try, for the share text and the summary: ⛳ holed, 💧 lost, else its feet
export const shotMark = (t: ShotTry) => (t.holed ? '⛳' : t.lost || t.ft === null ? '💧' : ftLabel(t.ft));

// where I stand among everyone who's finished today: a percentage once ten have, a count before
export function closerLine(b: ShotBoard) {
  if (!b.place) return '';
  if (!b.others) return 'First to finish today';
  return b.players >= 10 ? `Closer than ${Math.round((b.beat / b.others) * 100)}% of players today` : `Closer than ${b.beat} of ${b.others} ${b.others === 1 ? 'player' : 'players'} today`;
}

export const ordinalOf = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// the text to send the group: the day, each hole in its world, the total and the "closer than"
export function shotShareText(day: string, b: ShotBoard) {
  const set = dailyHoles(day);
  const holes = set.holes.map((x) => {
    const t = b.tries.find((y) => y.hole === x.n);
    return t ? shotMark(t) : '–';
  });
  const closer = closerLine(b);
  return `CCC Daily Shot #${set.number}\n${holes.join(' · ')}\n${ftLabel(totalFt(b.tries))} total${closer ? ` · ${closer.replace(/^Closer/, 'closer').replace(/ today$/, '')}` : ''}\n${location.origin}`;
}

function shotBoardList(b: ShotBoard, top = 10) {
  if (!b.board.length) return '<p class="muted">Nobody has finished all three yet. First on the board?</p>';
  const rows = b.board.slice(0, top);
  const me = b.board.findIndex((r) => r.mine);
  if (me >= top) rows.push(b.board[me]);
  return `<ol class="daily-board">${rows
    .map((r) => {
      const i = b.board.indexOf(r) + 1;
      return `<li class="${r.mine ? 'me' : ''}"><span>${i}</span>${face(r, 24)}<b>${r.playerId ? `<a href="${golferHref(r.playerId, r.mine)}">${esc(r.name)}</a>` : esc(r.name)}</b><small>${r.aces ? '⛳' : ''}</small><em>${ftLabel(r.total)}</em></li>`;
    })
    .join('')}</ol>`;
}

// after the third hole: each hole in its world, the total, where you stand (everyone, and your club), the pot, the
// board, and the text to send
export async function shotSummary(day: string, clubName: string, onClose: () => void) {
  const b = await api.dailyBoard(requireSession(), day).catch(() => null);
  const set = dailyHoles(day);
  const sheet = document.createElement('div');
  sheet.className = 'practice-notes daily-summary';
  const closer = b ? closerLine(b) : '';
  sheet.innerHTML = `
    <div class="notes-card">
      <div class="notes-body">
        <p class="eyebrow">The Daily Shot · #${set.number}</p>
        <h2>${b ? ftLabel(totalFt(b.tries)) : '–'} <small>total</small></h2>
        <ul class="shot-holes">${set.holes
          .map((x) => {
            const t = b?.tries.find((y) => y.hole === x.n);
            return `<li><b>Hole ${x.n}</b><em>${t ? shotMark(t) : '–'}</em></li>`;
          })
          .join('')}</ul>
        ${closer ? `<p class="shot-closer">${esc(closer)}</p>` : ''}
        ${b?.place && b.clubPlayers > 1 ? `<p>${ordinalOf(b.clubPlace)} of ${b.clubPlayers} at ${esc(clubName)}</p>` : ''}
        <p class="shot-pot">Ace Pot <b>${money(b?.pot ?? 1000)}</b></p>
        <h3>Today</h3>
        ${b ? shotBoardList(b) : '<p class="muted">The board is on its way.</p>'}
      </div>
      <div class="notes-foot daily-foot"><button class="btn" data-share>${canShare() ? 'Send to the group' : 'Copy result'}</button><button class="btn ghost" data-close>Back to the club</button></div>
    </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector<HTMLButtonElement>('[data-share]')!.onclick = (e) => b && void share(shotShareText(day, b), e.currentTarget as HTMLButtonElement);
  sheet.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => {
    sheet.remove();
    onClose();
  };
  window.addEventListener('hashchange', () => sheet.remove(), { once: true });
}

export { SHOT_HOLES };

// The Daily Shot on home (from Nov 20): the first thing on the page. Before you've played, today's three worlds, the
// Ace Pot and one tap to start; partway, where you are and Continue; done, your total and where it stands, collapsed.
// The last line points at whatever's left today: your daily cards, or tomorrow.
export function dailyShotCard(day: string) {
  const set = dailyHoles(day);
  return `<section class="shot-card" id="shot-card" data-state="fresh">
    <div class="shot-top"><h2>The Daily Shot <span>#${set.number}</span></h2><span class="shot-potline">Ace Pot <b data-shot-pot>…</b></span></div>
    <div data-shot-body><a class="btn big gold" href="#/daily">Play</a></div>
    <p class="shot-next" data-shot-next hidden></p>
  </section>`;
}

export async function bindDailyShot(day: string, cardsLeft: number | null) {
  const el = document.getElementById('shot-card');
  if (!el) return;
  const b = await api.dailyBoard(requireSession(), day).catch(() => null);
  if (!b || !document.getElementById('shot-card')) return;
  const set = dailyHoles(day);
  el.querySelector('[data-shot-pot]')!.textContent = money(b.pot);
  const played = b.tries.length;
  const body = el.querySelector<HTMLElement>('[data-shot-body]')!;
  const next = el.querySelector<HTMLElement>('[data-shot-next]')!;
  const cardsLine = cardsLeft ? `<a href="#/round">Now your daily card ›</a>` : '';
  void set;
  if (!played) return;
  next.hidden = false;
  if (played < SHOT_HOLES) {
    el.dataset.state = 'going';
    body.innerHTML = `<a class="btn big gold" href="#/daily">Continue · hole ${played + 1} of ${SHOT_HOLES}</a>`;
    next.textContent = `${ftLabel(totalFt(b.tries))} so far`;
    return;
  }
  el.dataset.state = 'done';
  const closer = closerLine(b);
  body.innerHTML = `<a class="shot-done" href="#/daily"><b>${ftLabel(totalFt(b.tries))}</b>${closer ? `<em>${esc(closer)}</em>` : ''}</a>`;
  next.innerHTML = cardsLine || 'Back tomorrow.';
  if (!cardsLine) next.classList.add('quiet');
}
