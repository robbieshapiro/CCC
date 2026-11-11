import { api, listSessions, localApi, switchClub, useSupabase } from '../api';
import { badgeFor } from '../shop';
import { clubPurse, money, OPEN_FLOOR, openPurseOf, placeLabel, purseOf } from '../purse';
import type { Snapshot, CardToday } from '../api/types';
import { portrait } from '../avatar';
import { courseFor, nextCourse, type Course } from '../golf3d/courses';
import { CALDERA_START, cardsOn, GAME_TZ, openPurseOn, periodClosesAt, periodName, span, todayInGameTz, CARDS_A_DAY } from '../day';
import { bindOpen } from './open';
import { bindLive, liveCards, liveNow } from './live';
import { bindPlayTiles, playTiles } from './playtiles';
import { openName } from '../season';
import { openFeedback } from './feedback';
import { bindDaily } from './daily';
import { bindCardNote, cardTile, tileState } from './cardnote';
import { bindNotices, noticesStrip } from './notices';
import { bindShoutouts, shoutStrip } from './shoutouts';
import { bindPlayoff, playoffCard } from './playoff';
import { bindNominateTile, nominateTile } from './nominate';
import { bindHomeScreenTip, homeScreenTip } from './homescreen';
import { board, crownFor, myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, golferHref, header, navigate, render } from '../ui';

const CARD_LINKS = { play: '#/round', practice: '#/round/practice' };

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
  // the honours are this club's, by name: each name links to its member's card
  const link = (n: string) => {
    const p = snap.players.find((x) => x.name === n);
    return p ? `<a href="${golferHref(p.id, p.id === snap.me)}">${esc(n)}</a>` : esc(n);
  };
  const names = (xs: string[]) => xs.map(link).join(' & ');
  const open = opens.find((o) => o.month === last.month);
  const per = span(last.month);
  const rows: [string, string, string][] = [
    ['🏆', 'Champion', !h.champions.length ? '' : h.champions[0].how === 'playoff' ? `${h.champions.map((c) => link(c.name)).join(' v ')} · playoff today` : `${names(h.champions.map((c) => c.name))} · ${toParLabel(h.champions[0].toPar)}${h.champions[0].how === 'playoff-won' ? ', won in a playoff' : ''}`],
    ['🌍', 'The Open', open ? `${names(open.names)} · ${toParLabel(open.total - open.par)}` : ''],
    ['🥈', 'Runner-up', h.runnersUp.length ? `${names(h.runnersUp.map((c) => c.name))} · ${toParLabel(h.runnersUp[0].toPar)}` : ''],
    ['🔁', 'Iron Man', h.mostRounds ? `${names(h.mostRounds.names)} · ${h.mostRounds.count} rounds` : ''],
    ['⛳', `Ace of the ${per}`, h.aces.length ? h.aces.map((a) => `${link(a.name)}${a.count > 1 ? ` ×${a.count}` : ''}`).join(' & ') : ''],
    ['📊', 'Steadiest hand', h.lowestAverage ? `${names(h.lowestAverage.names)} · ${toParLabel(h.lowestAverage.avg!)} average` : ''],
    ['🫡', 'The Honest Card', h.highestScore ? `${names(h.highestScore.names)} · ${toParLabel(h.highestScore.toPar!)}, posted all the same` : ''],
  ];
  // what the purse paid (from Nov 8, the whole Open's, with names from every club)
  const paid = (snap.payouts ?? []).filter((p) => p.month === last.month);
  const who = (p: (typeof paid)[number]) => `<a href="${golferHref(p.playerId, p.mine ?? p.playerId === snap.me)}">${esc(p.name ?? snap.players.find((x) => x.id === p.playerId)?.name ?? '?')}</a>`;
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
  // the Guest tag: a member playing from another club, but never whoever runs the clubs (they're the Committee)
  const guest = (p: { away?: boolean; committee?: boolean }) => !!p.away && !p.committee;
  // from Nov 8 the Open pays: the club board shows each member's Open money once it has loaded (see bindOpen below)
  const openMoney = openPurseOn(snap.month);
  const pay = openMoney ? new Map<string, { place: number; tied: boolean; payout: number }>() : purse.pay;
  const mine = myBest(snap);
  const host = !!snap.players.find((p) => p.id === snap.me)?.host;
  // daily cards: one counts a day; once today's is in, the course is open for practice
  const cards = cardsOn(snap.month) && !host;
  // all of today's cards in (two a day, the better one counts)
  const todays = snap.rounds.filter((r) => r.playerId === snap.me && r.month === snap.month && todayInGameTz(new Date(r.createdAt)) === snap.today);
  const cardIn = cards && todays.length >= CARDS_A_DAY;
  const dayCards: CardToday | null = cardIn
    ? { done: true, n: todays.length, of: CARDS_A_DAY, best: Math.min(...todays.map((r) => r.total - r.par)), id: null, course: null, scores: [], shots: 0, spots: [], feats: [] }
    : null;

  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const p = player(r.playerId)!;
      const cells = course.holes.map((h, i) => `<td class="num"><span class="sc ${r.best ? scoreClass(r.best.holes[i], h.par) : ''}">${r.best ? r.best.holes[i] : ''}</span></td>`).join('');
      const score = (where: 'm' | 'd') => `<td class="num tot ${where}">${r.best ? r.best.total : ''}</td>
        <td class="num topar ${where} ${r.best ? (r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : '') : ''}">${r.best ? toParLabel(r.toPar) : '–'}</td>`;
      return `<tr class="${r.playerId === snap.me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="${golferHref(p.id, p.id === snap.me)}">${portrait(p.avatar, 34)}<span><i class="nm">${esc(p.name)}${badgeFor(p)}${crownFor(snap, p.id)}</i><em>${openMoney ? `<span data-pay-for="${p.id}">${guest(p) ? `<b class="pay away">Guest</b> · ` : ''}</span>` : guest(p) ? `<b class="pay away">Guest</b> · ` : pay.get(p.id)?.payout ? `<b class="pay">${money(pay.get(p.id)!.payout)}</b> · ` : ''}${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'}<i class="last"> · last ${lastPlayed(r.last!)}</i>` : 'yet to play'}</em></span></a></td>
        ${score('m')}${cells}${score('d')}
      </tr>`;
    })
    .join('');

  const plaque = snap.champions.length
    ? snap.champions
        .slice(0, 6)
        .map((c) => {
          const who = c.playerIds.map((id) => `<a href="${golferHref(id, id === snap.me)}">${esc(player(id)?.name ?? '?')}</a>`);
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
      ${homeScreenTip()}
      ${playoffCard()}
      ${noticesStrip()}
      ${shoutStrip()}
      <section class="play-hero${look(course)}">
        <div class="play-main">
          <p class="eyebrow">${leaf(course)}${mine ? '' : 'Now open · '}${periodName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${course.holes.length} holes · par ${course.par}${mine ? ` · your best <b>${toParLabel(mine.total - mine.par)}</b>` : ''}</p>
          ${
            !cards
              ? `<a class="btn big" href="#/round" ${host ? 'data-play-home' : ''}>${mine ? 'Play again' : 'Play'}</a>`
              : `<div id="card-tile">${cardTile(cardIn ? 'in' : 'fresh', course, dayCards, CARD_LINKS)}</div>`
          }
          <p class="who-out" id="who-out" hidden></p>
        </div>
      </section>
      ${liveNow()}
      ${liveCards()}
      <section class="board${look(course)}">
        ${countdown(snap.month, course, purse.field, openMoney)}
        <div class="board-head"><h2>${leaf(course)}${openPurseOn(snap.month) ? esc(openName(course.name, snap.month)) : 'The Open'}</h2><span>${periodName(snap.month)} · best ${cardsOn(snap.month) ? 'card' : 'round'} counts</span></div>
        <div class="board-tabs" id="board-tabs" role="tablist">
          <button role="tab" data-tab="open" aria-selected="true">All clubs</button><span aria-hidden="true">·</span><button role="tab" data-tab="club" aria-selected="false">My club</button>
        </div>
        <div id="board-list"><p class="muted">Loading the Open…</p></div>
        <div id="board-open" hidden></div>
        <div id="board-club" hidden><div class="table-wrap"><table class="scorecard">
          <thead><tr><th></th><th>Member</th><th class="num m">Tot</th><th class="num m">±</th>${head}<th class="num d">Tot</th><th class="num d">±</th></tr></thead>
          <tbody>
            <tr class="par"><td></td><td>Par</td><td class="num m">${course.par}</td><td class="m"></td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num d">${course.par}</td><td class="d"></td></tr>
            ${body}
          </tbody>
        </table></div></div>
        <button class="link board-more" id="board-more" hidden>See hole by hole</button>
        ${openPurseOn(snap.month) ? `<a class="season-link" href="#/clubhouse/season" id="season-link">🏆 ${snap.month.slice(0, 4)} Season standings</a>` : ''}
      </section>
      ${nominateTile()}
      ${playTiles(snap)}
      ${previewBand(snap.month)}
      <p class="course-idea">Want to feature next week's course? <button class="link" data-course-idea>Submit an idea</button> to Reginald for review.</p>
      ${honoursPane(snap)}
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  tickCountdown();
  freezeBoard();
  void bindLive(snap, course);
  void bindPlayTiles(snap);
  // where you stand in the season, on the link under the Open
  if (openPurseOn(snap.month))
    void api.seasonStandings(requireSession()).then((s) => {
      const el = document.getElementById('season-link');
      const i = s.standings.findIndex((r) => r.mine);
      if (!el || i < 0) return;
      const pts = s.standings[i].points;
      el.textContent = `🏆 ${s.year} Season · you're ${placeLabel(i + 1, false)}, ${pts.toLocaleString('en-US')} pts`;
    }).catch(() => {});
  void bindOpen(snap).then((open) => {
    if (!openMoney || !open) return;
    // the Open purse, the same figures on the countdown, the Open and the club board
    const cd = document.querySelector('.cd-purse');
    if (cd) cd.textContent = `💰 ${money(Math.max(openPurseOf(open.field), OPEN_FLOOR))} Open purse`; // the floor shows from the start
    document.querySelectorAll<HTMLElement>('[data-pay-for]').forEach((el) => {
      const won = open.local.get(el.dataset.payFor!)?.payout;
      if (won) el.insertAdjacentHTML('beforeend', `<b class="pay">${money(won)}</b> · `);
    });
  });
  // the note before a fresh card; and a card started and cut short shows where it stands, with Continue
  bindCardNote(document, CARD_LINKS, navigate);
  // a member's idea for a course, to Reginald (it lands in the Committee's feedback, marked as a course idea)
  document.querySelectorAll<HTMLButtonElement>('[data-course-idea]').forEach(
    (b) =>
      (b.onclick = () =>
        openFeedback('Course idea', document.body, {
          intro: 'A course of your own devising? Do tell. The Committee reviews every one.',
          label: 'Your course idea',
          placeholder: 'Where is it, what is it like, and which holes would you play? A real place, a dream, anything.',
        })),
  );
  if (cards && !cardIn)
    void api.cardToday(requireSession()).then((t) => {
      const tile = document.getElementById('card-tile');
      const state = tileState(t, false);
      // a card going, elsewhere, all in, or the second card waiting
      if (tile && (state !== 'fresh' || t?.n)) {
        tile.innerHTML = cardTile(state, course, t, CARD_LINKS);
        bindCardNote(tile, CARD_LINKS, navigate);
      }
    });
  void bindNotices();
  void bindShoutouts();
  void bindDaily(snap.today, snap.crown);
  void bindHonours(snap);
  void bindPlayoff();
  void bindNominateTile();
  bindHomeScreenTip();
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
        ? `<em class="cd-purse">💰 ${money(OPEN_FLOOR)} Open purse</em> · top 10 paid`
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
// and fall orange with a maple leaf for the Western Reserve
const LOOKS = ['volcanic', 'coastal', 'autumn'];
export const look = (c: Course) => (LOOKS.includes(c.holes[0]?.theme ?? '') ? ` ${c.holes[0].theme}` : '');
const leaf = (c: Course) => (c.holes[0]?.theme === 'autumn' ? '🍁 ' : '');

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
      <small><span class="pb-lead">Coming up · </span><span data-countdown="${starts.getTime()}" data-done="Open now">opens in <em data-left>…</em></span></small>
      <b>${esc(shortName(next))}</b>
      <span>${n >= next.holes.length ? `Practise all ${n} holes` : `Practise ${n === 1 ? 'the first hole' : `the first ${n} holes`}`} before it counts</span>
    </span>
    <span class="pb-go">Practise the course</span>
  </a>`;
}

