// The Nineteenth Hole: Mo's bar, and the games on the wall behind it. Closest to the Pin (daily), mini golf and
// the long drive (weekly). Each card: what it is in a line, where you stand, the top three, and Play.
// It's the first tab of the Clubhouse.
import { api } from '../api';
import type { BarBoard, DailyState, MembersHole, Snapshot } from '../api/types';
import { gameName, scoreLabel, type BarGame } from '../bar';
import { isHole } from '../designer/desk';
import { bestTry, dailyShot, resultLabel } from '../daily';
import { MO, staffFace } from '../staff';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';
import { openPrizeCounter } from './prizecounter';
import { payTrophies } from './trophyroom';

const top3 = (rows: { playerId?: string; name: string; label: string; mine: boolean }[]) =>
  rows.length
    ? `<ol class="bar-top">${rows
        .slice(0, 3)
        .map((r, i) => `<li class="${r.mine ? 'me' : ''}"><span>${['🥇', '🥈', '🥉'][i]}</span><b>${r.playerId ? `<a href="${golferHref(r.playerId, r.mine)}">${esc(r.name)}</a>` : esc(r.name)}</b><em>${esc(r.label)}</em></li>`)
        .join('')}</ol>`
    : '<p class="bar-empty">Nobody yet. Be first.</p>';

// The back bar, drawn: two shelves, crowded and a bit untidy. Whiskey bottles (squat, square-shouldered, amber), wine
// and gin, pints of stout settling with their cream heads, a tipped glass, a bar towel and the odd lime. Nothing red
// and squeezy: Robbie said the first shelf looked like ketchup.
function bottles() {
  // a whiskey bottle: a square-shouldered body, a short neck, a cork, a cream label
  const whiskey = (x: number, base: number, h: number, amber: string, tilt = 0) => {
    const w = h * 0.42;
    return `<g transform="translate(${x} ${base}) rotate(${tilt})"><rect x="${-w / 2}" y="${-h * 0.68}" width="${w}" height="${h * 0.68}" rx="1.6" fill="${amber}"/><rect x="${-w / 2 + 1}" y="${-h * 0.62}" width="1.4" height="${h * 0.5}" fill="#fff" opacity="0.25"/><path d="M${-w / 2} ${-h * 0.68} Q0 ${-h * 0.82} ${w / 2} ${-h * 0.68}Z" fill="${amber}"/><rect x="-2" y="${-h}" width="4" height="${h * 0.24}" fill="${amber}"/><rect x="-2.4" y="${-h - 2}" width="4.8" height="3" rx="1" fill="#7a5230"/><rect x="${-w / 2 + 1.5}" y="${-h * 0.45}" width="${w - 3}" height="${h * 0.22}" fill="#efe1c0"/><rect x="${-w / 2 + 3}" y="${-h * 0.4}" width="${w - 6}" height="1.2" fill="#3a2114" opacity="0.6"/></g>`;
  };
  // a tall bottle (wine, gin): round shoulders, a long neck
  const tall = (x: number, base: number, h: number, glass: string, label: string, tilt = 0) => {
    const w = h * 0.3;
    return `<g transform="translate(${x} ${base}) rotate(${tilt})"><rect x="${-w / 2}" y="${-h * 0.62}" width="${w}" height="${h * 0.62}" rx="${w / 3}" fill="${glass}"/><rect x="-1.7" y="${-h}" width="3.4" height="${h * 0.42}" fill="${glass}"/><rect x="-2" y="${-h - 1.5}" width="4" height="2.5" fill="#d9b77a"/><rect x="${-w / 2 + 1}" y="${-h * 0.38}" width="${w - 2}" height="${h * 0.18}" fill="${label}"/><rect x="${-w / 2 + 1.2}" y="${-h * 0.58}" width="1.2" height="${h * 0.48}" fill="#fff" opacity="0.2"/></g>`;
  };
  // a pint of stout: black body, a cream head, the glass bulging near the top
  const pint = (x: number, base: number, h = 20, settling = false) =>
    `<g transform="translate(${x} ${base})"><path d="M-5 0 L-6 ${-h * 0.72} Q-6.6 ${-h * 0.86} -5.6 ${-h} L5.6 ${-h} Q6.6 ${-h * 0.86} 6 ${-h * 0.72} L5 0Z" fill="${settling ? '#5a3a26' : '#14100c'}"/><path d="M-5.6 ${-h} L5.6 ${-h} L5.9 ${-h * 0.86} L-5.9 ${-h * 0.86}Z" fill="#f2e6c9"/>${settling ? `<rect x="-5" y="${-h * 0.6}" width="10" height="${h * 0.6}" fill="#14100c" opacity="0.7"/>` : ''}<rect x="-4.4" y="${-h * 0.78}" width="1.2" height="${h * 0.7}" fill="#fff" opacity="0.18"/></g>`;
  const AMBERS = ['#b8722c', '#c98a3a', '#8a4f1e', '#d79a4a', '#a35f22'];
  const top: string[] = [], low: string[] = [];
  // the top shelf: whiskey, mostly, in no particular order, a couple leaning
  [12, 36, 54, 80, 100, 128, 150, 176, 198, 224, 246, 270, 294].forEach((x, i) => {
    const h = 26 + ((i * 7) % 4) * 4;
    if (i % 5 === 3) top.push(tall(x, 40, h + 6, i % 2 ? '#2f5d3a' : '#5e1a2c', '#e8dcc6', i === 8 ? -8 : 0));
    else top.push(whiskey(x, 40, h, AMBERS[i % AMBERS.length], i === 5 ? 6 : 0));
  });
  // the lower shelf: pints of stout (one still settling), a tipped tumbler, a bar towel, a few limes, more bottles
  [20, 62, 156, 236].forEach((x, i) => low.push(pint(x, 84, 20, i === 2)));
  [40, 110, 190, 280, 304].forEach((x, i) => low.push(i % 2 ? tall(x, 84, 30, '#1f4a3a', '#d9b77a') : whiskey(x, 84, 26, AMBERS[(i + 2) % AMBERS.length], i === 4 ? -10 : 0)));
  low.push(`<g transform="translate(130 84) rotate(-78)"><path d="M-5 0 L-6 -12 L6 -12 L5 0Z" fill="#cfe6ea" opacity="0.55"/></g>`);
  low.push(`<path d="M206 84 Q212 70 220 76 Q226 66 230 84Z" fill="#e8dcc6"/><path d="M210 84 Q214 76 219 79" stroke="#b8955a" stroke-width="1" fill="none"/>`);
  low.push(`<circle cx="86" cy="81" r="3.2" fill="#8bbf3a"/><circle cx="92" cy="82" r="2.8" fill="#9fd04a"/><path d="M262 84 a4 4 0 0 1 8 0Z" fill="#8bbf3a"/>`);
  const plank = (y: number) => `<rect x="0" y="${y}" width="320" height="5" fill="#6b4226"/><rect x="0" y="${y}" width="320" height="1.4" fill="#9a6a3e"/><rect x="0" y="${y + 5}" width="320" height="2" fill="#000" opacity="0.35"/>`;
  return `<svg viewBox="0 0 320 92" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${top.join('')}${plank(40)}${low.join('')}${plank(84)}</svg>`;
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
            <div class="mo-acts"><button class="mo-btn ghost" id="mo-more" hidden>Go on, Mo</button></div>
          </div>
        </div>
        <div class="bar-counter" aria-hidden="true"></div>
      </section>
      <h2 class="bar-wall">On the wall</h2>
      <div class="bar-games">
        <a class="bar-game" href="#/daily"><i>🎯</i><div><b>Closest to the Pin</b><span>${esc(shot.label)} · today</span></div><p data-mine="daily"></p><div data-board="daily"></div></a>
        <a class="bar-game midway" href="#/bar/midway"><i>🎡</i><div><b>The Midway</b><span>Eli's game · three carnival holes · one round a day counts</span></div><p data-mine="midway"></p><div data-board="midway"></div></a>
        <a class="bar-game cards" href="#/bar/blackjack"><i>🃏</i><div><b>Blackjack</b><span>Against Mo, for club money · $10 to $500 a hand</span></div><p data-mine="blackjack">Pull up a stool</p></a>
        <a class="bar-game cards" href="#/bar/popashot"><i>🏀</i><div><b>Pop-a-Shot</b><span>Thirty seconds at the hoop · beat Mo's score for club money</span></div><p data-mine="popashot">Mo's waiting</p></a>
        <a class="bar-game cards" href="#/bar/billiards"><i>🎱</i><div><b>8-Ball</b><span>A full game against Mo · stripes or solids, for club money</span></div><p data-mine="billiards">Table's free</p></a>
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

  // Mo: a hello, then banter on request, in a shuffled order so it doesn't repeat for a while
  const lines = [...MO.banter].sort(() => Math.random() - 0.5);
  let at = -1;
  const more = document.getElementById('mo-more') as HTMLButtonElement | null;
  if (more) {
    more.hidden = false;
    more.onclick = () => {
      const p = document.getElementById('mo-line');
      if (p) p.textContent = lines[(at = (at + 1) % lines.length)];
    };
  }

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
  void payTrophies();
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
