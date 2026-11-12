// The Nineteenth Hole: Mo's bar, and the games on the wall behind it. Closest to the Pin (daily), mini golf and
// the long drive (weekly). Each card: what it is in a line, where you stand, the top three, and Play.
// It's the first tab of the Clubhouse.
import { api } from '../api';
import type { BarBoard, DailyState, MembersHole, Snapshot } from '../api/types';
import { gameName, scoreLabel, type BarGame } from '../bar';
import { isHole } from '../designer/desk';
import { bestTry, dailyShot, resultLabel } from '../daily';
import { MO, staffFace } from '../staff';
import { moKnows, type MoLine } from './mo';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';
import { openPrizeCounter } from './prizecounter';

const top3 = (rows: { playerId?: string; name: string; label: string; mine: boolean }[]) =>
  rows.length
    ? `<ol class="bar-top">${rows
        .slice(0, 3)
        .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${r.playerId ? `<a href="${golferHref(r.playerId, r.mine)}">${esc(r.name)}</a>` : esc(r.name)}</b><em>${esc(r.label)}</em></li>`)
        .join('')}</ol>`
    : '<p class="bar-empty">Nobody yet. Be first.</p>';

// the back bar: a shelf of bottles, drawn
function bottles() {
  const cols = ['#7a3f1c', '#c98a3a', '#2f5d3a', '#8e2f4a', '#d9b77a', '#a8552a', '#9fd0e6', '#b5651d', '#e6d77a', '#5e1a2c', '#2b6d84', '#c4361b', '#e8c86a', '#4a2416'];
  const each = cols.map((c, i) => {
    const x = 6 + i * 22;
    const h = 30 + ((i * 7) % 5) * 5;
    const w = 11 + (i % 3) * 2;
    return `<g transform="translate(${x} ${58 - h})"><rect x="${(w - 4) / 2}" y="0" width="4" height="${h * 0.34}" rx="1.4" fill="${c}"/><rect x="0" y="${h * 0.3}" width="${w}" height="${h * 0.7}" rx="2.6" fill="${c}"/><rect x="1.6" y="${h * 0.5}" width="${w - 3.2}" height="${h * 0.22}" fill="#f3e6cf" opacity="0.85"/><rect x="1.4" y="${h * 0.32}" width="1.6" height="${h * 0.6}" fill="#fff" opacity="0.22"/></g>`;
  });
  return `<svg viewBox="0 0 320 64" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${each.join('')}<rect x="0" y="58" width="320" height="6" fill="#c9a24a"/><rect x="0" y="58" width="320" height="1.5" fill="#f1d58f"/></svg>`;
}

export function barPane(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me)!;
  const shot = dailyShot(snap.today);
  return `
    <div class="bar-page bar-room">
      <section class="bar-back">
        <div class="bar-lamps" aria-hidden="true"><i></i><i></i><i></i></div>
        <p class="bar-sign"><small>The</small> Nineteenth Hole</p>
        <div class="bar-shelf">${bottles()}</div>
        <div class="bar-mo">
          <span class="mo-face">${staffFace('mo', 84)}</span>
          <div class="mo-says" aria-live="polite">
            <b>Mo <small>behind the bar</small></b>
            <p id="mo-line">${esc(MO.welcome(me.name, snap.today))}</p>
            <div class="mo-acts"><a class="mo-btn" id="mo-go" hidden></a><button class="mo-btn ghost" id="mo-more" hidden>What else, Mo?</button></div>
          </div>
        </div>
        <div class="bar-counter" aria-hidden="true"></div>
      </section>
      <h2 class="bar-wall">On the wall</h2>
      <div class="bar-games">
        <a class="bar-game" href="#/daily"><i>🎯</i><div><b>Closest to the Pin</b><span>${esc(shot.label)} · today</span></div><p data-mine="daily"></p><div data-board="daily"></div></a>
        <a class="bar-game midway" href="#/bar/midway"><i>🎡</i><div><b>The Midway</b><span>Eli's game · three carnival holes · one round a day counts</span></div><p data-mine="midway"></p><div data-board="midway"></div></a>
        <a class="bar-game" href="#/bar/drive"><i>🚀</i><div><b>Long drive</b><span>3 swings off the week's longest tee · 2 fireballs</span></div><p data-mine="drive"></p><div data-board="drive"></div></a>
        <a class="bar-game members" href="#/bar/members" data-members><i>🏗️</i><div><b>Members' Course</b><span data-members-count>Holes the members built</span></div><p data-mine="members"></p><div data-board="members"></div></a>
      </div>
      <h2 class="bar-wall">Through the back</h2>
      <div class="bar-doors">
        <button class="desk-cta prize-cta" data-prize><i>🎟️</i><div><b>The Prize Counter</b><span>Power-ups for the Midway, bought with your club money</span></div><em>›</em></button>
        <a class="desk-cta" href="#/design"><i>✏️</i><div><b>Design a hole</b><span>Describe a golf hole. The architect builds it, you play it</span></div><em>›</em></a>
      </div>
    </div>`;
}

export async function fillBar(snap: Snapshot) {
  const s = requireSession();
  const prize = document.querySelector<HTMLButtonElement>('[data-prize]');
  if (prize) prize.onclick = () => void openPrizeCounter();
  // (Hollow Hills mini golf is closed for now: its course and code stay, ready to come back)
  const [daily, drive, members, course, midway] = await Promise.all([
    api.dailyState(s, snap.today).catch(() => null as DailyState | null),
    api.barBoard(s, 'drive').catch(() => null as BarBoard | null),
    api.barBoard(s, 'members').catch(() => null as BarBoard | null),
    api.membersCourse(s).then((l) => l.filter(isHole)).catch(() => [] as MembersHole[]),
    api.barBoard(s, 'midway').catch(() => null as BarBoard | null),
  ]);
  // curses waiting for your next Midway round: the count, not who or what
  const waiting = (await api.powerupState(s).catch(() => null))?.waiting ?? 0;

  // Mo has read the boards: he says the most useful thing first, and more if asked
  const open = await api.openBoard(s).catch(() => null);
  const me = snap.players.find((p) => p.id === snap.me)!;
  const lines = moKnows({ snap, welcome: MO.welcome(me.name, snap.today), daily, drive, midway, waiting, open });
  let at = lines.length > 1 ? 1 : 0;
  const say = (l: MoLine) => {
    const p = document.getElementById('mo-line');
    const go = document.getElementById('mo-go') as HTMLAnchorElement | null;
    if (!p || !go) return;
    p.textContent = l.text;
    go.hidden = !l.href;
    if (l.href) (go.href = l.href), (go.textContent = l.cta ?? 'Go');
  };
  const more = document.getElementById('mo-more') as HTMLButtonElement | null;
  if (more) {
    more.hidden = lines.length < 3;
    more.onclick = () => say(lines[(at = (at + 1) % lines.length)]);
  }
  say(lines[at]);

  // the Members' Course: how many holes this week, and until there are any, a way to build the first
  const card = document.querySelector<HTMLAnchorElement>('[data-members]');
  const count = document.querySelector('[data-members-count]');
  if (card && count) {
    count.textContent = course.length ? `${course.length} ${course.length === 1 ? 'hole' : 'holes'} by ${[...new Set(course.map((h) => h.by))].slice(0, 3).join(', ')} · this week` : 'No member holes yet. Design the first.';
    if (!course.length) card.href = '#/design';
  }
  const put = (game: string, mine: string, board: string) => {
    const m = document.querySelector(`[data-mine="${game}"]`);
    const b = document.querySelector(`[data-board="${game}"]`);
    if (m) m.textContent = mine;
    if (b) b.innerHTML = board;
  };
  if (daily) {
    const best = bestTry(daily.mine);
    put('daily', daily.mine.length ? `You: ${resultLabel(best)}` : 'Not played today', top3(daily.board.map((r) => ({ playerId: r.playerId, name: r.name, label: r.holed ? 'Holed' : resultLabel({ ft: r.ft, holed: false, lost: r.ft === null }), mine: r.mine }))));
  }
  for (const [game, b] of [['drive', drive], ['members', members], ['midway', midway]] as [BarGame, BarBoard | null][]) {
    if (!b) continue;
    const today = game === 'midway' ? (b.playedToday ? " · today's round is in" : ' · today’s round is waiting') + (waiting ? ` · ${waiting === 1 ? 'a curse is' : `${waiting} curses are`} waiting for you` : '') : '';
    put(game, (b.mine === null ? 'Not played this week' : `You: ${scoreLabel(game, b.mine)}`) + today, top3(b.board.map((r) => ({ playerId: r.playerId, name: r.name, label: scoreLabel(game, r.score), mine: r.mine }))));
  }
}

// after a go: how it went, the week's board, and again or back to the bar
export async function barSummary(game: BarGame, score: number | null, again: () => void, back: () => void, fun = false) {
  const b = await api.barBoard(requireSession(), game).catch(() => null);
  const sheet = document.createElement('div');
  sheet.className = 'practice-notes daily-summary';
  sheet.innerHTML = `
    <div class="notes-card">
      <div class="notes-body">
        <p class="eyebrow">${gameName(game)} · ${fun ? 'for fun' : 'this week'}</p>
        <h2>${score === null ? 'No score' : esc(scoreLabel(game, score))}</h2>
        ${game === 'midway' ? `<p class="fine">${fun ? "Just for fun: today's round is already in. Back tomorrow for another that counts." : 'That was today’s round. Any more today are for fun.'}</p>` : ''}
        ${b && b.mine !== null ? `<p>Your best this week: <b>${esc(scoreLabel(game, b.mine))}</b></p>` : ''}
        ${b ? `<ol class="daily-board">${b.board
          .slice(0, 10)
          .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.name)}</b><small></small><em>${esc(scoreLabel(game, r.score))}</em></li>`)
          .join('')}</ol>` : ''}
      </div>
      <div class="notes-foot daily-foot"><button class="btn" data-again>${game === 'midway' ? 'Again, for fun' : 'Play again'}</button><button class="btn ghost" data-back>Back to the bar</button></div>
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
