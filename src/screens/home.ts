import { api, listSessions, localApi, switchClub, useSupabase } from '../api';
import { badgeFor } from '../shop';
import { clubPurse, money, OPEN_PER_PLAYER, openPurseOf, placeLabel, purseOf } from '../purse';
import type { Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { courseFor, nextCourse, type Course } from '../golf3d/courses';
import { CALDERA_START, cardsOn, GAME_TZ, openPurseOn, periodClosesAt, periodName, span, todayInGameTz } from '../day';
import { REGINALD, reginaldSvg, type Mood } from '../host';
import { bindOpen } from './open';
import { askReginald, championWord } from '../reginald';
import { bindDaily, dailyCard } from './daily';
import { bindNotices, noticesStrip } from './notices';
import { bindShoutouts, shoutStrip } from './shoutouts';
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

// Reginald's word for the club's new champion, along the top for the two days after the title is won: a scripted line
// at once, then his own (api/reginald.ts) when it comes
function championDays(snap: Snapshot) {
  const last = snap.champions[0];
  if (!last || last.how === 'playoff') return null;
  const won = periodClosesAt(last.month).toLocaleDateString('en-CA', { timeZone: GAME_TZ });
  const days = Math.round((Date.parse(`${snap.today}T12:00:00Z`) - Date.parse(`${won}T12:00:00Z`)) / 86400000);
  return days >= 0 && days <= 1 ? last : null;
}

function championStrip(snap: Snapshot) {
  const last = championDays(snap);
  if (!last) return '';
  const names = last.playerIds.map((id) => esc(snap.players.find((p) => p.id === id)?.name ?? 'a former member'));
  return `<p class="champ-word" id="champ-word"><span class="host-face">${reginaldSvg('pleased', 30)}</span><span><b>🏆 ${names.join(' & ')}</b>, ${esc(periodName(last.month))} champion at ${toParLabel(last.total - last.par)}. <em data-word>Our congratulations.</em></span></p>`;
}

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
  // what the purse paid (from Nov 8, the whole Open's, with names from every club)
  const paid = (snap.payouts ?? []).filter((p) => p.month === last.month);
  const who = (p: (typeof paid)[number]) => esc(p.name ?? snap.players.find((x) => x.id === p.playerId)?.name ?? '?');
  const mine = (p: (typeof paid)[number]) => p.mine ?? p.playerId === snap.me;
  el.innerHTML = `<div class="board-head"><h2>${esc(periodName(last.month))} honours</h2><span>Your club</span></div>
    <ul>${rows.filter((r) => r[2]).map(([i, t, v]) => `<li><i>${i}</i><b>${t}</b><span>${v}</span></li>`).join('')}</ul>
    ${paid.length ? `<div class="paid"><b>💰 The ${openPurseOn(last.month) ? 'Open ' : ''}purse paid ${money(paid.reduce((a, p) => a + p.payout, 0))}</b><ol>${paid.map((p) => `<li${mine(p) ? ' class="me"' : ''}><span>${placeLabel(p.place, p.tied)}</span>${who(p)}<b>${money(p.payout)}</b></li>`).join('')}</ol></div>` : ''}`;
  el.hidden = false;
}

// On a phone the name, total and to-par stay put while the holes scroll under them: each frozen cell sticks at the
// width of the frozen columns before it
const FROZEN = 4;
function freezeBoard() {
  const table = document.querySelector<HTMLTableElement>('#board-club .scorecard');
  // a hidden board measures as nothing: wait until it's on show
  if (!table || !table.offsetParent) return;
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
  // the week's purse, and what each of the top ten would take if it ended now
  // members playing from another club are paid at home, so the purse here goes round without them
  const purse = clubPurse(rows, (id) => !!player(id)?.away);
  // from Nov 8 the Open pays: the club board shows each member's Open money once it has loaded (see bindOpen below)
  const openMoney = openPurseOn(snap.month);
  const pay = openMoney ? new Map<string, { place: number; tied: boolean; payout: number }>() : purse.pay;
  const played = rows.filter((r) => r.best);
  const mine = myBest(snap);
  const me = rows.find((r) => r.playerId === snap.me)!; // absent when you only run this club
  const host = !!snap.players.find((p) => p.id === snap.me)?.host;
  // daily cards: one counts a day; once today's is in, the course is open for practice
  const cards = cardsOn(snap.month) && !host;
  const cardIn = cards && snap.rounds.some((r) => r.playerId === snap.me && todayInGameTz(new Date(r.createdAt)) === snap.today);

  let line = REGINALD.course(course.name, course.holes.length, course.par, span(snap.month));
  let mood: Mood = 'dry';
  if (!played.length) line = `${line} ${REGINALD.nobody(snap.today)}`;
  else if (!mine) line = REGINALD.notYet(played.length);
  else if (me && me.toPar === played[0].toPar) {
    line = REGINALD.leading(toParLabel(me.toPar), snap.today);
    mood = 'pleased';
  } else {
    const top = played[0];
    line = played.length > 2 ? REGINALD.others(player(top.playerId)!.name, toParLabel(top.toPar)) : REGINALD.behind(player(top.playerId)!.name, toParLabel(top.toPar), me.toPar - top.toPar);
  }
  // the board as it stands, in plain words, always from this snapshot: it goes under Reginald's own line for the day
  const standing = (() => {
    if (!played.length) return 'No rounds on the board yet.';
    const lead = played.filter((r) => r.toPar === played[0].toPar);
    const names = lead.map((r) => (r.playerId === snap.me ? 'You' : player(r.playerId)!.name));
    const at = toParLabel(played[0].toPar);
    const top = lead.length === 1 ? `${esc(names[0])} ${names[0] === 'You' ? 'lead' : 'leads'} at <b>${at}</b>` : `${esc(names.join(' & '))} share the lead at <b>${at}</b>`;
    if (!mine || !me?.best) return `${top}. You haven’t posted yet.`;
    if (me.toPar === played[0].toPar) return `${top}.`;
    const gap = me.toPar - played[0].toPar;
    return `${top}. You’re ${placeLabel(played.filter((r) => r.toPar < me.toPar).length + 1, played.filter((r) => r.toPar === me.toPar).length > 1)} at ${toParLabel(me.toPar)}, ${gap} back.`;
  })();

  if (host) line = REGINALD.host(snap.groupName, snap.homeName ?? 'your club');

  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const p = player(r.playerId)!;
      const cells = course.holes.map((h, i) => `<td class="num"><span class="sc ${r.best ? scoreClass(r.best.holes[i], h.par) : ''}">${r.best ? r.best.holes[i] : ''}</span></td>`).join('');
      const score = (where: 'm' | 'd') => `<td class="num tot ${where}">${r.best ? r.best.total : ''}</td>
        <td class="num topar ${where} ${r.best ? (r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : '') : ''}">${r.best ? toParLabel(r.toPar) : '–'}</td>`;
      return `<tr class="${r.playerId === snap.me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="#/member/${p.id}">${portrait(p.avatar, 34)}<span><i class="nm">${esc(p.name)}${badgeFor(p)}${crownFor(snap, p.id)}</i><em>${openMoney ? `<span data-pay-for="${p.id}">${p.away ? `<b class="pay away">Guest</b> · ` : ''}</span>` : p.away ? `<b class="pay away">Guest</b> · ` : pay.get(p.id)?.payout ? `<b class="pay">${money(pay.get(p.id)!.payout)}</b> · ` : ''}${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'}<i class="last"> · last ${lastPlayed(r.last!)}</i>` : 'yet to play'}</em></span></a></td>
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
      ${championStrip(snap)}
      ${playoffCard()}
      ${noticesStrip()}
      ${shoutStrip()}
      <section class="play-hero${look(course)}">
        <div class="play-reg"><span class="host-face big">${reginaldSvg(mood, 72)}</span><p id="reg-line"><b>Reginald</b> ${line}</p></div>
        <div class="play-main">
          <p class="eyebrow">${mine ? '' : 'Now open · '}${periodName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${course.holes.length} holes · par ${course.par}${mine ? ` · your best <b>${toParLabel(mine.total - mine.par)}</b>` : ''}</p>
          ${mine ? '' : lastWord(snap)}
          ${
            !cards
              ? `<a class="btn big" href="#/round" ${host ? 'data-play-home' : ''}>${mine ? 'Play again' : 'Play'}</a>`
              : cardIn
                ? `<a class="btn big" href="#/round/practice">Practice round</a><p class="fine card-line">Today's card is in. A new one at midnight.</p>`
                : `<a class="btn big" href="#/round" id="card-btn">Play today's card</a><p class="fine card-line">One card a day counts. <a href="#/round/practice">Practise first</a></p>`
          }
        </div>
      </section>
      ${previewBand(snap.month)}
      <section class="board${look(course)}">
        ${countdown(snap.month, course, purse.field, openMoney)}
        <div class="board-head"><h2>The Board</h2><span>${periodName(snap.month)} · best ${cardsOn(snap.month) ? 'card' : 'round'} counts</span></div>
        <div class="board-tabs" id="board-tabs" role="tablist">
          <button role="tab" data-tab="open" aria-selected="true">Open</button><span aria-hidden="true">·</span><button role="tab" data-tab="club" aria-selected="false">My club</button>
        </div>
        <div id="board-open"><p class="muted">Loading the Open…</p></div>
        <div id="board-club" hidden><div class="table-wrap"><table class="scorecard">
          <thead><tr><th></th><th>Member</th><th class="num m">Tot</th><th class="num m">±</th>${head}<th class="num d">Tot</th><th class="num d">±</th></tr></thead>
          <tbody>
            <tr class="par"><td></td><td>Par</td><td class="num m">${course.par}</td><td class="m"></td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num d">${course.par}</td><td class="d"></td></tr>
            ${body}
          </tbody>
        </table></div></div>
      </section>
      <div class="tiles">
        ${dailyCard()}
        <a class="tile" href="#/clubhouse/bar"><i>🍺</i><b>The bar</b><span>Long drive · Members' Course</span></a>
        <a class="tile" href="#/facility"><i>🏌️</i><b>Practice</b><span>Range and short game</span></a>
      </div>
      ${honoursPane(snap)}
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  tickCountdown();
  freezeBoard();
  void bindOpen(snap, line, host).then((open) => {
    if (!openMoney || !open) return;
    // the Open purse, the same figures on the countdown, the Open and the club board
    const cd = document.querySelector('.cd-purse');
    if (cd) cd.textContent = `💰 ${money(openPurseOf(open.field))} Open purse`;
    document.querySelectorAll<HTMLElement>('[data-pay-for]').forEach((el) => {
      const won = open.local.get(el.dataset.payFor!)?.payout;
      if (won) el.insertAdjacentHTML('beforeend', `<b class="pay">${money(won)}</b> · `);
    });
  });
  // the club board starts hidden behind the Open: set its frozen columns once it's on show
  document.querySelector('[data-tab="club"]')?.addEventListener('click', () => requestAnimationFrame(() => freezeBoard()));
  // today's line, written for you by Reginald (Claude): it takes over from the scripted one when it arrives
  if (!host)
    void askReginald('daily', course, snap.today).then((text) => {
      const say = document.querySelector<HTMLElement>('#reg-line');
      if (!text || !say) return;
      say.dataset.ai = '1';
      say.classList.add('reg-fresh');
      say.innerHTML = `<b>Reginald</b> ${esc(text)}${host ? '' : ` <span class="reg-board">${standing}</span>`}`;
    });
  // a card started and cut short: say so on the button
  if (cards && !cardIn)
    void api.cardToday(requireSession()).then((t) => {
      const btn = document.getElementById('card-btn');
      if (btn && t && !t.done && (t.scores.length || t.shots)) btn.textContent = `Finish today's card · hole ${Math.min(t.scores.length + 1, course.holes.length)}`;
    });
  void bindNotices();
  void bindShoutouts();
  void bindDaily(snap.today, snap.crown);
  void bindHonours(snap);
  void bindPlayoff();
  const champ = championDays(snap);
  if (champ)
    void championWord(champ.month).then((text) => {
      const el = document.querySelector('#champ-word [data-word]');
      if (text && el) el.textContent = text;
    });
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
// with the club purse alongside: it's paid when the clock runs out
function countdown(month: string, course: Course, field: number, open = false) {
  const ends = periodClosesAt(month);
  const day = new Date(ends.getTime() - 1).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `<div class="countdown${look(course)}" data-countdown="${ends.getTime()}">
    <span>${esc(course.name.replace(/ Course$/, ''))} closes in</span><b data-left>…</b>
    <small>${
      open
        ? `<em class="cd-purse">💰 Open purse</em> · top 10 on the Open paid · ${money(OPEN_PER_PLAYER)} in with every player, every club`
        : `<em class="cd-purse">💰 ${money(purseOf(field))} purse</em> · top 10 paid${field ? '' : ' · $1,000 in with every player'}`
    } · champion crowned midnight ET, ${day}</small>
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

// The week's course dresses the Play hero, the board and its countdown: ember red for the Caldera, Pacific blue and a
// sunset for the coast
const look = (c: Course) => (c.holes[0]?.theme === 'volcanic' ? ' volcanic' : c.holes[0]?.theme === 'coastal' ? ' coastal' : '');

// Next week's course, between the Play card and the board: a warm band in the course's own colours (autumn leaves for
// the Western Reserve), counting down to its first day, with its practice as the button
const THEME_ICON: Record<string, string> = { autumn: '🍁', volcanic: '🌋', coastal: '🌊' };
function previewBand(month: string) {
  const next = nextCourse(month);
  if (!next) return '';
  const theme = next.holes[0]?.theme ?? '';
  const starts = periodClosesAt(month);
  const n = Math.min(next.previewHoles ?? next.holes.length, next.holes.length);
  return `<a class="preview-band ${esc(theme)}" href="#/practice/${next.id}">
    <span class="pb-icon" aria-hidden="true">${THEME_ICON[theme] ?? '⛳'}</span>
    <span class="pb-text">
      <small>Coming up · <span data-countdown="${starts.getTime()}" data-done="Open now">opens in <em data-left>…</em></span></small>
      <b>${esc(shortName(next))}</b>
      <span>${n >= next.holes.length ? `Practise all ${n} holes` : `Practise ${n === 1 ? 'the first hole' : `the first ${n} holes`}`} before it counts</span>
    </span>
    <span class="pb-go">Practise</span>
  </a>`;
}

