// The Daily Shot on the home page and after your last try: today's shot, your tries, your streak, the board across
// every club, and a result to share.
import { face } from '../faces';
import { prizesLine } from '../bonus';
import { api } from '../api';
import type { DailyCrown, DailyState, DailyTry, ShotBoard, ShotTry } from '../api/types';
import { holeMark, bestOn, dailyHoles, ftLabel, SHOT_ALL, SHOT_HOLES, SHOT_TRIES, totalFt } from '../dailyholes';
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
    const best = bestOn(b.tries, x.n);
    return holeMark(best);
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
            const best = b ? bestOn(b.tries, x.n) : null;
            return `<li><b>Hole ${x.n}</b><em>${holeMark(best)}</em></li>`;
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

// The Daily Shot on home (from Nov 20): the first thing on the page. The title and number, the Ace Pot as a big gold
// figure that counts up from what you last saw, today's leader, and one button. Partway: Continue; done: your total
// and where it stands, then whatever's left today (your daily card, or tomorrow).
export function dailyShotCard(day: string) {
  const set = dailyHoles(day);
  return `<section class="shot-card" id="shot-card" data-state="fresh">
    <div class="shot-top"><h2>The Daily Shot <span>#${set.number}</span></h2><span class="shot-lead" data-shot-lead></span></div>
    <div class="shot-pot-big"><small>Ace Pot</small><b data-shot-pot>…</b><em>+$50 every miss</em></div>
    <div data-shot-body><a class="btn big gold shine" href="#/daily">Play</a></div>
    <p class="shot-next" data-shot-next hidden></p>
  </section>`;
}

// the pot counts up from the last figure this phone showed (a quick ticker, so a pot that grew overnight shows it)
function tickPot(el: HTMLElement, to: number) {
  const key = 'ccc-shot-pot';
  let from = to;
  try {
    from = Number(localStorage.getItem(key)) || to;
    localStorage.setItem(key, String(to));
  } catch {
    /* private mode: no ticker */
  }
  if (from >= to || matchMedia('(prefers-reduced-motion: reduce)').matches) return void (el.textContent = money(to));
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 1400);
    el.textContent = money(Math.round(from + (to - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export async function bindDailyShot(day: string, _cardsLeft?: number | null) {
  const el = document.getElementById('shot-card');
  if (!el) return;
  const b = await api.dailyBoard(requireSession(), day).catch(() => null);
  if (!b || !document.getElementById('shot-card')) return;
  tickPot(el.querySelector<HTMLElement>('[data-shot-pot]')!, b.pot);
  // today's leaders across every club, rolling past with their faces, in every state (before anyone's finished: a
  // nudge to be first instead)
  const lead = b.board.slice(0, 10);
  const item = (r: (typeof lead)[number], i: number) =>
    `<span class="sd-tk${r.mine ? ' me' : ''}"><i>${i + 1}</i>${face(r, 22)}<b>${esc(r.mine ? 'You' : r.name.split(' ')[0])}</b><em>${ftLabel(r.total)}</em></span>`;
  const run = lead.map(item).join('');
  const ticker = lead.length
    ? `<span class="sd-ticker${lead.length > 2 ? ' roll' : ''}" style="--n:${lead.length}"><span class="sd-track">${run}${lead.length > 2 ? run : ''}</span></span>`
    : '';
  const chip = el.querySelector<HTMLElement>('[data-shot-lead]')!;
  if (lead.length) chip.style.display = 'none'; // the ticker names the leader
  else chip.innerHTML = '<span>Be first today</span>';
  const played = b.tries.length;
  const body = el.querySelector<HTMLElement>('[data-shot-body]')!;
  const next = el.querySelector<HTMLElement>('[data-shot-next]')!;
  next.hidden = !ticker;
  next.innerHTML = ticker;
  if (!played) return;
  // each hole's best so far, with its mark (the hole you're on shows its best yet; holes to come a dash)
  const hole = (n: number) => `<span><small>H${n}</small>${holeMark(bestOn(b.tries, n))}</span>`;
  if (played < SHOT_ALL) {
    el.dataset.state = 'going';
    body.innerHTML = `<span class="sd-holes">${[1, 2, 3].map(hole).join('')}</span>
      <a class="btn big gold shine" href="#/daily">Continue · hole ${Math.floor(played / SHOT_TRIES) + 1}, shot ${(played % SHOT_TRIES) + 1}</a>`;
    // no running total partway (a wet first ball would read as 150 ft with two shots still to come): just the ticker
    return;
  }
  el.dataset.state = 'done';
  // done: the pot small in the corner, your total and where it stands across every club, your three holes, and the
  // leaders ticker
  chip.style.display = '';
  chip.innerHTML = `<span class="sd-corner">Ace Pot <b>${money(b.pot)}</b></span>`;
  body.innerHTML = `<a class="shot-done" href="#/daily">
      <span class="sd-top"><b>${ftLabel(totalFt(b.tries))}</b>${b.place ? `<em>${ordinalOf(b.place)} of ${b.players}<small>all clubs</small></em>` : ''}</span>
      <span class="sd-holes">${[1, 2, 3].map(hole).join('')}</span>
    </a>`;
}
