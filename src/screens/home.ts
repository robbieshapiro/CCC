import { api, listSessions, localApi, switchClub, useSupabase } from '../api';
import type { Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { featById } from '../feats';
import { courseFor, nextCourse, type Course } from '../golf3d/courses';
import { CALDERA_START, GAME_TZ, periodClosesAt, periodName, span } from '../day';
import { REGINALD, reginaldSvg, type Mood } from '../host';
import { bindOpen } from './open';
import { askReginald } from '../reginald';
import { bindDaily, dailyCard } from './daily';
import { bindNotices, noticesStrip } from './notices';
import { bindPlayoff, playoffCard } from './playoff';
import { board, crownFor, myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';

export function scoreClass(strokes: number, par: number) {
  if (strokes === 1) return 'ace';
  const d = strokes - par;
  return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
}

// Last round's date on the club's (Eastern) calendar, e.g. "Oct 24".
const lastPlayed = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });

// The first time a member opens the app in a new period, it lands on the home page (see main.ts); opening it counts as
// seen.
export const SEEN_PERIOD = 'ccc-seen-period';
// (from the Caldera challenge on: the months before it just open on the home page as they always did)
export const newPeriod = (snap: Snapshot) => snap.month >= CALDERA_START && store.get(SEEN_PERIOD) !== snap.month;

// Under the course name, until you've played the new period: how the last one ended
function lastWord(snap: Snapshot) {
  const last = snap.champions[0];
  if (!last || snap.month < CALDERA_START) return '';
  const names = last.playerIds.map((id) => esc(snap.players.find((p) => p.id === id)?.name ?? 'a former member'));
  const at = toParLabel(last.total - last.par);
  const text =
    last.how === 'playoff'
      ? `${esc(periodName(last.month))} closed in a tie at <b>${at}</b>. <b>${names.join(' and ')}</b> play off today.`
      : `${esc(periodName(last.month))} has closed. <b>${names.join(' & ')}</b> ${names.length > 1 ? 'share' : last.how === 'playoff-won' ? 'wins a playoff for' : 'takes'} the title at <b>${at}</b>.`;
  return `<p class="play-news">${text}</p>`;
}

// The honours for the period that last closed, filled in once the server answers: champion, the Open, runner-up,
// most rounds, aces, the steadiest average and the honest card.
function honoursPane(snap: Snapshot) {
  return snap.champions[0] ? `<section class="honours" id="honours" hidden></section>` : '';
}

async function bindHonours(snap: Snapshot) {
  const last = snap.champions[0];
  const el = document.getElementById('honours');
  if (!last || !el) return;
  const session = requireSession();
  const [h, opens] = await Promise.all([
    api.periodHonors(session, last.month).catch(() => null),
    api.openChampions(session).catch(() => []),
  ]);
  if (!h || !document.getElementById('honours')) return; // no SQL yet, or left the page
  const names = (xs: string[]) => xs.map(esc).join(' & ');
  const open = opens.find((o) => o.month === last.month);
  const per = span(last.month);
  const rows: [string, string, string][] = [
    ['🏆', 'Champion', !h.champions.length ? '' : h.champions[0].how === 'playoff' ? `${h.champions.map((c) => esc(c.name)).join(' v ')} · playoff today` : `${names(h.champions.map((c) => c.name))} · ${toParLabel(h.champions[0].toPar)}${h.champions[0].how === 'playoff-won' ? ', won in a playoff' : ''}`],
    ['🌍', 'The Open', open ? `${names(open.names)} · ${toParLabel(open.total - open.par)}` : ''],
    ['🥈', 'Runner-up', h.runnersUp.length ? `${names(h.runnersUp.map((c) => c.name))} · ${toParLabel(h.runnersUp[0].toPar)}` : ''],
    ['🔁', 'Iron Man', h.mostRounds ? `${names(h.mostRounds.names)} · ${h.mostRounds.count} rounds` : ''],
    ['⛳', `Ace of the ${per}`, h.aces.length ? h.aces.map((a) => `${esc(a.name)}${a.count > 1 ? ` ×${a.count}` : ''}`).join(' & ') : ''],
    ['📊', 'Steadiest hand', h.lowestAverage ? `${names(h.lowestAverage.names)} · ${toParLabel(h.lowestAverage.avg!)} average` : ''],
    ['🫡', 'The Honest Card', h.highestScore ? `${names(h.highestScore.names)} · ${toParLabel(h.highestScore.toPar!)}, posted all the same` : ''],
  ];
  el.innerHTML = `<div class="board-head"><h2>${esc(periodName(last.month))} honours</h2><span>Your club</span></div>
    <ul>${rows.filter((r) => r[2]).map(([i, t, v]) => `<li><i>${i}</i><b>${t}</b><span>${v}</span></li>`).join('')}</ul>`;
  el.hidden = false;
}

// On a phone the name, total and to-par stay put while the holes scroll under them: each frozen cell sticks at the
// width of the frozen columns before it
const FROZEN = 4;
function freezeBoard() {
  const table = document.querySelector<HTMLTableElement>('#board-club .scorecard');
  if (!table) return;
  const widths = [...(table.tHead?.rows[0].cells ?? [])].slice(0, FROZEN).map((c) => c.getBoundingClientRect().width);
  for (const row of table.rows)
    [...row.cells].slice(0, FROZEN).forEach((c, i) => {
      c.classList.add('fz');
      c.classList.toggle('fz-end', i === FROZEN - 1);
      c.style.left = `${widths.slice(0, i).reduce((a, w) => a + w, 0)}px`;
    });
}
window.addEventListener('resize', () => freezeBoard());

export function home(snap: Snapshot) {
  const player = (id: string) => snap.players.find((p) => p.id === id);
  const course = courseFor(snap.month);
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const mine = myBest(snap);
  const me = rows.find((r) => r.playerId === snap.me)!; // absent when you only run this club
  const host = !!snap.players.find((p) => p.id === snap.me)?.host;

  let line = REGINALD.course(course.name, course.holes.length, course.par, span(snap.month));
  let mood: Mood = 'dry';
  if (!played.length) line = `${line} ${REGINALD.nobody(snap.today)}`;
  else if (!mine) line = REGINALD.notYet(played.length);
  else if (played[0].playerId === snap.me) {
    line = REGINALD.leading(toParLabel(me.toPar), snap.today);
    mood = 'pleased';
  } else {
    const top = played[0];
    line = played.length > 2 ? REGINALD.others(player(top.playerId)!.name, toParLabel(top.toPar)) : REGINALD.behind(player(top.playerId)!.name, toParLabel(top.toPar), me.toPar - top.toPar);
  }

  if (host) line = REGINALD.host(snap.groupName, snap.homeName ?? 'your club');

  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const p = player(r.playerId)!;
      const cells = course.holes.map((h, i) => `<td class="num"><span class="sc ${r.best ? scoreClass(r.best.holes[i], h.par) : ''}">${r.best ? r.best.holes[i] : ''}</span></td>`).join('');
      const score = (where: 'm' | 'd') => `<td class="num tot ${where}">${r.best ? r.best.total : ''}</td>
        <td class="num topar ${where} ${r.best ? (r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : '') : ''}">${r.best ? toParLabel(r.toPar) : '–'}</td>`;
      const feats = p.feats.map((f) => featById(f)?.icon ?? '').join('');
      return `<tr class="${r.playerId === snap.me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="#/member/${p.id}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${crownFor(snap, p.id)}${feats ? ` <small>${feats}</small>` : ''}<em>${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · last ${lastPlayed(r.last!)}` : 'yet to play'}</em></span></a></td>
        ${score('m')}${cells}${score('d')}
      </tr>`;
    })
    .join('');

  const plaque = snap.champions.length
    ? snap.champions
        .slice(0, 6)
        .map((c) => {
          const who = c.playerIds.map((id) => `<a href="#/member/${id}">${esc(player(id)?.name ?? '?')}</a>`);
          const b = c.how === 'playoff' ? `Playoff: ${who.join(' v ')}` : who.join(' & ');
          return `<li><span>${periodName(c.month)}</span><b>${b}</b><em>${toParLabel(c.total - c.par)}${c.how === 'playoff-won' ? ' · won in a playoff' : ''}</em></li>`;
        })
        .join('')
    : `<li class="empty">The first name goes up when the ${span(snap.month)} closes.</li>`;

  // whatever was full screen before (the tour, a round) has let go of the page by now
  document.body.classList.remove('court-open');
  render(`
    ${header(snap.groupName, 'play')}
    <main>
      ${playoffCard()}
      ${noticesStrip()}
      <section class="play-hero${course.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}">
        <div class="play-reg"><span class="host-face big">${reginaldSvg(mood, 72)}</span><p id="reg-line"><b>Reginald</b> ${line}</p></div>
        <div class="play-main">
          <p class="eyebrow">${mine ? '' : 'Now open · '}${periodName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${course.holes.length} holes · par ${course.par}${mine ? ` · your best <b>${toParLabel(mine.total - mine.par)}</b>` : ''}</p>
          ${mine ? '' : lastWord(snap)}
          <a class="btn big" href="#/round" ${host ? 'data-play-home' : ''}>${mine ? 'Play again' : 'Play'}</a>
        </div>
      </section>
      ${honoursPane(snap)}
      <section class="board${course.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}">
        ${countdown(snap.month, course)}
        <div class="board-head"><h2>The Board</h2><span>${periodName(snap.month)} · best round counts</span></div>
        <div class="board-tabs" id="board-tabs" role="tablist" hidden>
          <button role="tab" data-tab="open">Open</button><span aria-hidden="true">·</span><button role="tab" data-tab="club">My club</button>
        </div>
        <div id="board-open" hidden></div>
        <div id="board-club"><div class="table-wrap"><table class="scorecard">
          <thead><tr><th></th><th>Member</th><th class="num m">Tot</th><th class="num m">±</th>${head}<th class="num d">Tot</th><th class="num d">±</th></tr></thead>
          <tbody>
            <tr class="par"><td></td><td>Par</td><td class="num m">${course.par}</td><td class="m"></td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num d">${course.par}</td><td class="d"></td></tr>
            ${body}
          </tbody>
        </table></div></div>
      </section>
      <div class="tiles">
        ${dailyCard()}
        <a class="tile" href="#/clubhouse/bar"><i>🎃</i><b>The bar</b><span>Mini golf · long drive</span></a>
        <a class="tile" href="#/facility"><i>🏌️</i><b>Practice</b><span>Range and short game</span></a>
        ${previewTile(snap.month)}
      </div>
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  tickCountdown();
  freezeBoard();
  void bindOpen(snap, line, host);
  // today's line, written for you by Reginald (Claude): it takes over from the scripted one when it arrives
  if (!host)
    void askReginald('daily', course, snap.today).then((text) => {
      const say = document.querySelector<HTMLElement>('#reg-line');
      if (!text || !say) return;
      say.dataset.ai = '1';
      say.classList.add('reg-fresh');
      say.innerHTML = `<b>Reginald</b> ${esc(text)}`;
    });
  void bindNotices();
  void bindDaily(snap.today, snap.crown);
  void bindHonours(snap);
  void bindPlayoff();
  if (newPeriod(snap)) store.set(SEEN_PERIOD, snap.month);
  // in a club you only run, play from your own club: that's where it counts
  document.querySelector<HTMLAnchorElement>('[data-play-home]')?.addEventListener('click', (e) => {
    if (!snap.homeGroupId || !listSessions().some((x) => x.groupId === snap.homeGroupId)) return;
    e.preventDefault();
    switchClub(snap.homeGroupId);
    location.hash = '#/round';
  });
  document.getElementById('demo')?.addEventListener('click', async () => {
    localApi.seedDemo(requireSession());
    home(await refresh());
  });
}

// The period's clock: how long until the board closes and the champion goes up.
function countdown(month: string, course: Course) {
  const ends = periodClosesAt(month);
  const day = new Date(ends.getTime() - 1).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `<div class="countdown" data-countdown="${ends.getTime()}">
    <span>${esc(course.name.replace(/ Course$/, ''))} closes in</span><b data-left>…</b>
    <small>This ${span(month)}'s champion is crowned at midnight ET, ${day}.</small>
  </div>`;
}

// One clock for the page, however often the home page redraws: it finds the countdown each second.
let clock = 0;
function tickCountdown() {
  const draw = () => {
    const els = document.querySelectorAll<HTMLElement>('[data-countdown]');
    if (!els.length) {
      window.clearInterval(clock);
      clock = 0;
      return;
    }
    for (const el of els) {
      const left = Number(el.dataset.countdown) - Date.now();
      const out = el.querySelector('[data-left]')!;
      el.classList.toggle('final', left < 3_600_000);
      if (left <= 0) {
        out.textContent = el.dataset.done ? '' : 'Closed';
        const note = el.querySelector('small');
        if (note) note.textContent = el.dataset.done ?? 'The champion is being crowned.';
        continue;
      }
      const s = Math.floor(left / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      out.textContent = `${d ? `${d}d ` : ''}${h}h ${String(m).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
    }
  };
  draw();
  if (!clock) clock = window.setInterval(draw, 1000);
}

const shortName = (c: Course) => c.name.replace(/ Course$/, '');

// The headline at the top of the home page: the next course's Open, counting down to its first day, with its practice
// preview as the main button. Volcanic courses get the red glow.
function previewTile(month: string) {
  const next = nextCourse(month);
  if (!next) return '';
  const starts = periodClosesAt(month);
  return `<a class="tile" href="#/practice/${next.id}"><i>${next.holes[0]?.theme === 'autumn' ? '🍁' : next.holes[0]?.theme === 'volcanic' ? '🌋' : '⛳'}</i><b>${esc(shortName(next))} preview</b><span data-countdown="${starts.getTime()}" data-done="Open now">Opens in <em data-left>…</em></span></a>`;
}

