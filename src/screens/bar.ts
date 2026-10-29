// The Nineteenth Hole: Mo's bar, and the games on the wall behind it. Closest to the Pin (daily), mini golf and
// the long drive (weekly). Each card: what it is in a line, where you stand, the top three, and Play.
// It's the first tab of the Clubhouse.
import { api } from '../api';
import type { BarBoard, DailyState, Snapshot } from '../api/types';
import { scoreLabel, type BarGame } from '../bar';
import { bestTry, dailyShot, resultLabel } from '../daily';
import { MO, staffChip } from '../staff';
import { requireSession } from '../state';
import { esc } from '../ui';

const top3 = (rows: { name: string; label: string; mine: boolean }[]) =>
  rows.length
    ? `<ol class="bar-top">${rows
        .slice(0, 3)
        .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${esc(r.name)}</b><em>${esc(r.label)}</em></li>`)
        .join('')}</ol>`
    : '<p class="bar-empty">Nobody yet. Be first.</p>';

export function barPane(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me)!;
  const shot = dailyShot(snap.today);
  return `
    <div class="bar-page">
      <section class="bar-head">
        <p class="eyebrow">The Nineteenth Hole</p>
        <h1>The bar</h1>
        ${staffChip('mo', MO.welcome(me.name, snap.today))}
      </section>
      <div class="bar-games">
        <a class="bar-game" href="#/daily"><i>🎯</i><div><b>Closest to the Pin</b><span>${esc(shot.label)} · today</span></div><p data-mine="daily"></p><div data-board="daily"></div></a>
        <a class="bar-game spooky" href="#/bar/minigolf"><i>🎃</i><div><b>Hollow Hills Mini Golf</b><span>6 holes · this week</span></div><p data-mine="minigolf"></p><div data-board="minigolf"></div></a>
        <a class="bar-game" href="#/bar/drive"><i>🚀</i><div><b>Long drive</b><span>3 swings · this week</span></div><p data-mine="drive"></p><div data-board="drive"></div></a>
      </div>
    </div>`;
}

export async function fillBar(snap: Snapshot) {
  const s = requireSession();
  const [daily, minigolf, drive] = await Promise.all([
    api.dailyState(s, snap.today).catch(() => null as DailyState | null),
    api.barBoard(s, 'minigolf').catch(() => null as BarBoard | null),
    api.barBoard(s, 'drive').catch(() => null as BarBoard | null),
  ]);
  const put = (game: string, mine: string, board: string) => {
    const m = document.querySelector(`[data-mine="${game}"]`);
    const b = document.querySelector(`[data-board="${game}"]`);
    if (m) m.textContent = mine;
    if (b) b.innerHTML = board;
  };
  if (daily) {
    const best = bestTry(daily.mine);
    put('daily', daily.mine.length ? `You: ${resultLabel(best)}` : 'Not played today', top3(daily.board.map((r) => ({ name: r.name, label: r.holed ? 'Holed' : resultLabel({ ft: r.ft, holed: false, lost: r.ft === null }), mine: r.mine }))));
  }
  for (const [game, b] of [['minigolf', minigolf], ['drive', drive]] as [BarGame, BarBoard | null][]) {
    if (!b) continue;
    put(game, b.mine === null ? 'Not played this week' : `You: ${scoreLabel(game, b.mine)}`, top3(b.board.map((r) => ({ name: r.name, label: scoreLabel(game, r.score), mine: r.mine }))));
  }
}

// after a go: how it went, the week's board, and again or back to the bar
export async function barSummary(game: BarGame, score: number | null, again: () => void, back: () => void) {
  const b = await api.barBoard(requireSession(), game).catch(() => null);
  const sheet = document.createElement('div');
  sheet.className = 'practice-notes daily-summary';
  sheet.innerHTML = `
    <div class="notes-card">
      <div class="notes-body">
        <p class="eyebrow">${game === 'drive' ? 'Long drive' : 'Hollow Hills Mini Golf'} · this week</p>
        <h2>${score === null ? 'No score' : esc(scoreLabel(game, score))}</h2>
        ${b && b.mine !== null ? `<p>Your best this week: <b>${esc(scoreLabel(game, b.mine))}</b></p>` : ''}
        ${b ? `<ol class="daily-board">${b.board
          .slice(0, 10)
          .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.name)}</b><small></small><em>${esc(scoreLabel(game, r.score))}</em></li>`)
          .join('')}</ol>` : ''}
      </div>
      <div class="notes-foot daily-foot"><button class="btn" data-again>Play again</button><button class="btn ghost" data-back>Back to the bar</button></div>
    </div>`;
  document.body.appendChild(sheet);
  sheet.querySelector<HTMLButtonElement>('[data-again]')!.onclick = () => {
    sheet.remove();
    again();
  };
  sheet.querySelector<HTMLButtonElement>('[data-back]')!.onclick = () => {
    sheet.remove();
    back();
  };
  window.addEventListener('hashchange', () => sheet.remove(), { once: true });
}
