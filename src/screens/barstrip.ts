// The Nineteenth Hole on home (Nov 17): every bar game between the Play card and the Open, two to a row, so they're seen
// by everyone who comes in. Today's contests first (each leads with its live number: today's Closest to the Pin and
// long drive and Target Range leaders, the Ace Pot, the Midway's leader). Mo's tables (your money) are at the bar,
// not here (Nov 17: with poker off it was one card). A game the Committee has closed drops out for members. And once today's cards are in, the Play card's button points here (barCta).
import { face } from '../faces';
import { tidyCourse } from '../designer/course';
import { DAILY_PRIZES } from '../bonus';
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { ACE_SEED } from '../acepot';
import { todayInGameTz } from '../day';
import { scoreLabel } from '../bar';
import { money } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';
import { ftLabel, SHOT_ALL, SHOT_TRIES } from '../dailyholes';

// today's contests, as at the bar (the club puts up the prizes), two by two: the Daily Shot (also at the top of home,
// Robbie Nov 21: here too, first), the long drive, the Target Range and the Midway
type Card = [game: string, href: string, icon: string, name: string, wait: string];
const CONTESTS: Card[] = [
  ['daily', '#/daily', '⛳', 'The Daily Shot', 'Three holes, three shots each'],
  ['drive', '#/bar/drive', '🚀', 'Long drive', `1st pays $${DAILY_PRIZES[0]} today`],
  ['targets', '#/bar/targets', '🏹', 'Target Range', `1st pays $${DAILY_PRIZES[0]} today`],
  ['midway', '#/bar/midway', '🎡', 'The Midway', 'Three carnival holes'],
];
const card = ([game, href, icon, name, wait]: Card, stake = '') =>
  `<a class="bs-card${stake ? ` ${stake}` : ''}" href="${href}" data-bs="${game}"><i>${icon}</i><small>${esc(name)}</small><b data-bs-big>${esc(wait)}</b><span data-bs-sub>${esc(stake)}</span></a>`;

export function barStrip() {
  return `<section class="bar-strip" aria-label="The Nineteenth Hole">
    <div class="bs-head"><h2>The Nineteenth Hole</h2><a href="#/bar">The bar ›</a></div>
    <a class="bs-news" href="#/daily" data-bs-news hidden></a>
    <p class="bs-group">Today's contests</p>
    <div class="bs-row">${CONTESTS.map((c) => card(c)).join('')}</div>
    <a class="bs-featured" href="#/bar/members" data-bs="members" data-bs-featured hidden></a>
    <a class="bs-design" href="#/design" data-bs-design>
      <i aria-hidden="true">✏️</i>
      <div><small>The Design Desk</small><b data-bs-design-big>Design a course</b><span>One signature hole, any world you can dream up. Your score to beat, $50 every time it holds.</span></div>
      <span class="bsf-go">Design ›</span>
    </a>
    <div class="bs-replays" data-bs-replays hidden></div>
  </section>`;
}

// a shot of the day in a few words: what it was and the hole ("Eagle · 5"), no course name
const shotLine = (r: { label: string; hole?: number | null }) => `${r.label.replace(/ on .*$/, '')}${r.hole != null ? ` · ${r.hole + 1}` : ''}`;

// who: today's leader, whose face goes in the corner of the card
const fill = (game: string, big: string, sub = '', who?: Parameters<typeof face>[0]) => {
  const card = document.querySelector<HTMLElement>(`[data-bs="${game}"]`);
  if (!card) return;
  card.querySelector('[data-bs-big]')!.textContent = big;
  card.querySelector('[data-bs-sub]')!.textContent = sub;
  card.querySelector('.bs-lead')?.remove();
  const f = who ? face(who, 30) : '';
  if (f) card.insertAdjacentHTML('beforeend', `<span class="bs-lead" aria-hidden="true">${f}</span>`);
};

export async function bindBarStrip(snap: Snapshot) {
  const s = requireSession();
  // Shots of the day: every eagle or better from today's cards, best first, to watch (src/replay.ts)
  void api
    .replaysToday(s)
    .then((rows) => {
      const box = document.querySelector<HTMLElement>('[data-bs-replays]');
      if (!box) return;
      const top = rows.filter((r) => r.kind === 'card').slice(0, 8);
      if (top.length) box.innerHTML = `<p class="bs-group">Shots of the day</p><div class="bs-rp-row">${top
        .map((r) => `<a class="bs-replay" href="#/replay/${r.id}" aria-label="Watch ${esc(r.name)}'s ${esc(shotLine(r))}"><span class="bs-rp-face">${face(r, 40)}<i aria-hidden="true">▶</i></span><div><b>${r.mine ? 'You' : esc(r.name)}</b><span>${esc(shotLine(r))}</span></div></a>`)
        .join('')}</div>`;
      box.hidden = !top.length;
      // the ace banner plays the ace
      const ace = rows.find((r) => r.kind === 'ace');
      const news = document.querySelector<HTMLAnchorElement>('[data-bs-news]');
      if (ace && news) news.href = `#/replay/${ace.id}`;
    })
    .catch(() => {});
  // the Members' Course: the live course, its designer and their mark to beat, and today's best challenger
  const gamesOpen = api.barGames(s).catch(() => null);
  void Promise.all([api.liveMemberCourse(s).catch(() => null), gamesOpen]).then(([live, games]) => {
    const el = document.querySelector<HTMLElement>('[data-bs-featured]');
    // no course on yet: the Desk asks for the first one
    const big = document.querySelector<HTMLElement>('[data-bs-design-big]');
    if (big && !live) big.textContent = 'Design the first members’ course';
    if (!el || !live) return;
    if (games && games.settings.members === false && !games.committee) return;
    const c = tidyCourse(live.spec);
    const who = { avatar: live.avatar, playerId: live.byId, name: live.by };
    const top = live.board.find((r) => r.playerId !== live.byId);
    el.innerHTML = `<div class="bsf-main"><small>The duel · Members' Course</small><b>${esc(c.name)}</b><span>${live.mine ? `Your course is on. Everyone is playing your ${live.mark.total}.` : `Beat ${esc(live.by)}’s ${live.mark.total}: $300 · tie it: $100`}</span>
      <span class="bsf-by">${face(who, 30)}<span>Designed by <em>${esc(live.by)}</em></span></span>${top ? `<span class="bsf-best">Today's best: ${top.mine ? 'you' : esc(top.name)}, ${top.total}</span>` : ''}</div><span class="bsf-go">${live.mine ? 'Watch' : 'Take them on ›'}</span>`;
    el.hidden = false;
  });
  void gamesOpen.then((g) => {
    if (!g) return;
    const { settings, committee } = g;
    document.querySelectorAll<HTMLElement>('[data-bs]:not([data-bs-featured])').forEach((el) => (el.hidden = settings[el.dataset.bs!] === false && !committee));
  });
  void api
    .aceState(s)
    .then((a) => {
      // an ace today: the news across the top for the rest of the day
      const news = document.querySelector<HTMLAnchorElement>('[data-bs-news]');
      if (news && a.lastAce && todayInGameTz(new Date(a.lastAce.at)) === snap.today) {
        const me = snap.players.find((p) => p.id === snap.me);
        const you = me && me.name.toLowerCase() === a.lastAce.name.toLowerCase();
        news.innerHTML = `${face(a.lastAce, 40) || '<i>🏆</i>'}<div><b>${you ? 'You' : esc(a.lastAce.name)} won the Ace Pot today</b><span>${money(a.lastAce.pot)}${you ? ' is yours' : ''} · the pot started again at ${money(ACE_SEED)}</span></div>`;
        news.hidden = false;
      }
    })
    .catch(() => {});
  void api
    .dailyBoard(s, snap.today)
    .then((b) => {
      const top = b.board[0];
      const played = b.tries.length;
      const mine = b.board.find((r) => r.mine);
      const you = mine ? (mine === top ? 'You lead' : `You: ${ftLabel(mine.total)}`) : played && played < SHOT_ALL ? `Hole ${Math.floor(played / SHOT_TRIES) + 1} to play` : '';
      const pot = `Ace Pot ${money(b.pot)}`;
      fill('daily', top ? `${top.name} · ${ftLabel(top.total)}` : 'Be first today', you ? `${you} · ${pot}` : pot, top);
    })
    .catch(() => {});
  void api
    .barBoard(s, 'drive')
    .then((b) => {
      const top = b.board[0];
      if (top) fill('drive', `${top.name} · ${scoreLabel('drive', top.score)}`, `${top.mine ? "You're leading" : b.mine !== null ? `You: ${scoreLabel('drive', b.mine)}` : 'Beat it'} · 1st pays $${DAILY_PRIZES[0]}`, top);
    })
    .catch(() => {});
  void api
    .barBoard(s, 'targets')
    .then((b) => {
      const top = b.board[0];
      if (top) fill('targets', `${top.name} · ${scoreLabel('targets', top.score)}`, `${top.mine ? "You're leading" : b.mine !== null ? `You: ${scoreLabel('targets', b.mine)}` : 'Beat it'} · 1st pays $${DAILY_PRIZES[0]}`, top);
    })
    .catch(() => {});
  void api
    .barBoard(s, 'midway')
    .then((b) => {
      const top = b.board[0];
      if (top) fill('midway', `${top.name} · ${scoreLabel('midway', top.score)}`, b.playedToday ? "Today's round is in" : "Today's round is waiting", top);
    })
    .catch(() => {});
}

// The Play card once today's cards are in: its button goes to the bar, or to the Daily Shot while it's still to finish
export function bindBarCta() {
  const cta = document.querySelector<HTMLAnchorElement>('[data-bar-cta]');
  if (!cta) return;
  const s = requireSession();
  void api
    .dailyBoard(s, todayInGameTz())
    .then((b) => {
      if (b.tries.length >= 9) return;
      cta.href = '#/daily';
      cta.textContent = `${b.tries.length ? 'Finish' : 'Play'} the Daily Shot · Ace Pot ${money(b.pot)} ›`;
    })
    .catch(() => {});
}
