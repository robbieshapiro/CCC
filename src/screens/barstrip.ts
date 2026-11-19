// The Nineteenth Hole on home (Nov 17): every bar game between the Play card and the Open, two to a row, so they're seen
// by everyone who comes in. Today's contests first (each leads with its live number: today's Closest to the Pin and
// long drive and Target Range leaders, the Ace Pot, the Midway's leader). Mo's tables (your money) are at the bar,
// not here (Nov 17: with poker off it was one card). A game the Committee has closed drops out for members. And once today's cards are in, the Play card's button points here (barCta).
import { face } from '../faces';
import { DAILY_PRIZES } from '../bonus';
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { ACE_SEED, ACE_SWINGS } from '../acepot';
import { KIND_NAME, withHoleNo } from '../replay';
import { todayInGameTz } from '../day';
import { scoreLabel } from '../bar';
import { resultLabel } from '../daily';
import { money } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';

// today's contests, as at the bar (the club puts up the prizes): the Ace Pot first, a gold bar across the top, then the
// other four two to a row on a phone, nothing to scroll sideways.
type Card = [game: string, href: string, icon: string, name: string, wait: string];
const CONTESTS: Card[] = [
  ['daily', '#/daily', '🎯', 'Closest to the Pin', `1st pays $${DAILY_PRIZES[0]} today`],
  ['drive', '#/bar/drive', '🚀', 'Long drive', `1st pays $${DAILY_PRIZES[0]} today`],
  ['targets', '#/bar/targets', '🏹', 'Target Range', `1st pays $${DAILY_PRIZES[0]} today`],
  ['midway', '#/bar/midway', '🎡', 'The Midway', 'Three carnival holes'],
];
const ACE: Card = ['acepot', '#/bar/ace', '💰', 'The Ace Pot', 'An ace takes the pot'];
const card = ([game, href, icon, name, wait]: Card, stake = '') =>
  `<a class="bs-card${stake ? ` ${stake}` : ''}" href="${href}" data-bs="${game}"><i>${icon}</i><small>${esc(name)}</small><b data-bs-big>${esc(wait)}</b><span data-bs-sub>${esc(stake)}</span></a>`;

export function barStrip() {
  return `<section class="bar-strip" aria-label="The Nineteenth Hole">
    <div class="bs-head"><h2>The Nineteenth Hole</h2><a href="#/bar">The bar ›</a></div>
    <a class="bs-news" href="#/bar/ace" data-bs-news hidden></a>
    <p class="bs-group">Today's contests</p>
    ${card(ACE, 'ace')}
    <div class="bs-row">${CONTESTS.map((c) => card(c)).join('')}</div>
    <div class="bs-replays" data-bs-replays hidden></div>
  </section>`;
}

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
      if (top.length) box.innerHTML = `<p class="bs-group">Shots of the day</p>${top
        .map((r) => `<a class="bs-replay" href="#/replay/${r.id}">${face(r, 36) || '<i>▶</i>'}<div><b>${r.mine ? 'You' : esc(r.name)} · ${esc(withHoleNo(r.label, r.hole))}</b><span>${esc(KIND_NAME[r.kind])}</span></div></a>`)
        .join('')}`;
      box.hidden = !top.length;
      // the ace banner plays the ace
      const ace = rows.find((r) => r.kind === 'ace');
      const news = document.querySelector<HTMLAnchorElement>('[data-bs-news]');
      if (ace && news) news.href = `#/replay/${ace.id}`;
    })
    .catch(() => {});
  void api.barGames(s).then(({ settings, committee }) => {
    document.querySelectorAll<HTMLElement>('[data-bs]').forEach((el) => (el.hidden = settings[el.dataset.bs!] === false && !committee));
  });
  void api
    .aceState(s)
    .then((a) => {
      const left = ACE_SWINGS - a.swingsToday;
      // an ace today: the news across the top for the rest of the day
      const news = document.querySelector<HTMLAnchorElement>('[data-bs-news]');
      if (news && a.lastAce && todayInGameTz(new Date(a.lastAce.at)) === snap.today) {
        const me = snap.players.find((p) => p.id === snap.me);
        const you = me && me.name.toLowerCase() === a.lastAce.name.toLowerCase();
        news.innerHTML = `${face(a.lastAce, 40) || '<i>🏆</i>'}<div><b>${you ? 'You' : esc(a.lastAce.name)} won the Ace Pot today</b><span>${money(a.lastAce.pot)}${you ? ' is yours' : ''} · the pot started again at ${money(ACE_SEED)}</span></div>`;
        news.hidden = false;
      }
      fill('acepot', `${money(a.pot)} pot`, `Carries over · ${left ? `${left} ${left === 1 ? 'swing' : 'swings'} left` : 'back tomorrow'}`);
    })
    .catch(() => {});
  void api
    .dailyState(s, snap.today)
    .then((d) => {
      const top = d.board[0];
      if (top) fill('daily', `${top.name} · ${top.holed ? 'holed it' : resultLabel({ ft: top.ft, holed: false, lost: top.ft === null })}`, `${top.mine ? "You're leading" : `${d.players} in`} · 1st pays $${DAILY_PRIZES[0]}`, top);
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

// The Play card once today's cards are in: its button goes to the bar, naming the Ace Pot while you've swings left
export function bindBarCta() {
  const cta = document.querySelector<HTMLAnchorElement>('[data-bar-cta]');
  if (!cta) return;
  const s = requireSession();
  void Promise.all([api.aceState(s).catch(() => null), api.barGames(s).catch(() => null)]).then(([a, g]) => {
    const open = !g || g.settings.acepot !== false || g.committee;
    if (!a || !open || a.swingsToday >= ACE_SWINGS) return;
    cta.href = '#/bar/ace';
    cta.textContent = `Try the Ace Pot · ${money(a.pot)} ›`;
  });
}
