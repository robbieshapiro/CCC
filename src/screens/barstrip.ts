import { DAILY_PRIZES } from '../bonus';
// The Nineteenth Hole on home (Nov 17): one swipeable row between the Play card and the Open, so the bar's games are
// seen by everyone who comes in. Each card leads with its live number: the Ace Pot's pot, today's Closest to the Pin
// and long drive leaders, Mo's Book favourite, the Midway's leader. A game the Committee has closed drops out for members.
// And once today's cards are in, the Play card's button points here (barCta).
import { api } from '../api';
import type { Snapshot } from '../api/types';
import { ACE_SWINGS } from '../acepot';
import { scoreLabel } from '../bar';
import { resultLabel } from '../daily';
import { money } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';

const CARDS: [game: string, href: string, icon: string, name: string, wait: string][] = [
  ['acepot', '#/bar/ace', '💰', 'The Ace Pot', '$50 a swing'],
  ['daily', '#/daily', '🎯', 'Closest to the Pin', `1st pays $${DAILY_PRIZES[0]} today`],
  ['drive', '#/bar/drive', '🚀', 'Long drive', `1st pays $${DAILY_PRIZES[0]} today`],
  ['book', '#/bar/book', '📒', "Mo's Book", 'Bet on the Open'],
  ['midway', '#/bar/midway', '🎡', 'The Midway', 'Three carnival holes'],
];

export function barStrip() {
  return `<section class="bar-strip" aria-label="The Nineteenth Hole">
    <div class="bs-head"><h2>The Nineteenth Hole</h2><a href="#/bar">The bar ›</a></div>
    <div class="bs-row">${CARDS.map(
      ([game, href, icon, name, wait]) => `<a class="bs-card" href="${href}" data-bs="${game}"><i>${icon}</i><small>${esc(name)}</small><b data-bs-big>${esc(wait)}</b><span data-bs-sub></span></a>`,
    ).join('')}</div>
  </section>`;
}

const fill = (game: string, big: string, sub = '') => {
  const card = document.querySelector<HTMLElement>(`[data-bs="${game}"]`);
  if (!card) return;
  card.querySelector('[data-bs-big]')!.textContent = big;
  card.querySelector('[data-bs-sub]')!.textContent = sub;
};

export async function bindBarStrip(snap: Snapshot) {
  const s = requireSession();
  void api.barGames(s).then(({ settings, committee }) => {
    document.querySelectorAll<HTMLElement>('[data-bs]').forEach((el) => (el.hidden = settings[el.dataset.bs!] === false && !committee));
  });
  void api
    .aceState(s)
    .then((a) => {
      const left = ACE_SWINGS - a.swingsToday;
      fill('acepot', `${money(a.pot)} pot`, `Carries over · ${left ? `${left} ${left === 1 ? 'swing' : 'swings'} left` : 'back tomorrow'}`);
    })
    .catch(() => {});
  void api
    .dailyState(s, snap.today)
    .then((d) => {
      const top = d.board[0];
      if (top) fill('daily', `${top.name} · ${top.holed ? 'holed it' : resultLabel({ ft: top.ft, holed: false, lost: top.ft === null })}`, `${top.mine ? "You're leading" : `${d.players} in`} · 1st pays $${DAILY_PRIZES[0]}`);
    })
    .catch(() => {});
  void api
    .barBoard(s, 'drive')
    .then((b) => {
      const top = b.board[0];
      if (top) fill('drive', `${top.name} · ${scoreLabel('drive', top.score)}`, `${top.mine ? "You're leading" : b.mine !== null ? `You: ${scoreLabel('drive', b.mine)}` : 'Beat it'} · 1st pays $${DAILY_PRIZES[0]}`);
    })
    .catch(() => {});
  void api
    .bookState(s)
    .then((b) => {
      const fav = b.field[0];
      const open = b.bets.filter((x) => x.payout === null).length;
      if (!b.open) fill('book', 'Closed till Sunday', open ? `${open} ${open === 1 ? 'bet' : 'bets'} open` : '');
      else if (fav) fill('book', `${fav.name} ${fav.odds.toFixed(1)}x`, open ? `${open} ${open === 1 ? 'bet' : 'bets'} open` : 'Favourite to win');
    })
    .catch(() => {});
  void api
    .barBoard(s, 'midway')
    .then((b) => {
      const top = b.board[0];
      if (top) fill('midway', `${top.name} · ${scoreLabel('midway', top.score)}`, b.playedToday ? "Today's round is in" : "Today's round is waiting");
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
