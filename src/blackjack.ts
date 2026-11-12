// Blackjack at the bar, against Mo: the rules, shared by local mode and the table's drawing. On the live club the
// server deals and settles (bj_deal, bj_act and bj_settle in supabase/schema.sql); keep the two in step.
// Cards are 0 to 51: the rank is c % 13 (0 an ace, 1 to 9 two to ten, 10 to 12 the faces), the suit Math.floor(c / 13).
export type BjOutcome = 'bust' | 'push' | 'blackjack' | 'mo-blackjack' | 'mo-bust' | 'win' | 'lose';
export type BjView = { id: number; stake: number; payout: number | null; done: boolean; outcome: BjOutcome | null; doubled: boolean; player: number[]; playerTotal: number; dealer: number[]; dealerTotal: number; bank: number; lostToday: number };
export type BjState = BjView | { bank: number; lostToday: number };

export const BJ_MIN = 10;
export const BJ_MAX = 500;
export const DAILY_LOSS = 2000;
export const CHIPS = [10, 25, 100, 250, 500];

export function bjValue(cards: number[]) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const r = c % 13;
    total += r === 0 ? 1 : r >= 9 ? 10 : r + 1;
    if (r === 0) aces++;
  }
  return aces && total + 10 <= 21 ? total + 10 : total;
}

// Mo draws to 17 and stands on every 17; then the payout (3 to 2 on a blackjack)
export function bjSettle(stake: number, p: number[], d: number[], deck: number[], doubled: boolean): { outcome: BjOutcome; payout: number; dealer: number[] } {
  const pv = bjValue(p);
  const pbj = pv === 21 && p.length === 2 && !doubled;
  const dbj = bjValue(d) === 21 && d.length === 2;
  const dealer = [...d];
  if (pv <= 21 && !pbj) while (bjValue(dealer) < 17) dealer.push(deck.shift()!);
  const dv = bjValue(dealer);
  const [outcome, payout]: [BjOutcome, number] =
    pv > 21 ? ['bust', 0]
    : pbj && dbj ? ['push', stake]
    : pbj ? ['blackjack', stake + Math.floor((stake * 3) / 2)]
    : dbj ? ['mo-blackjack', 0]
    : dv > 21 ? ['mo-bust', stake * 2]
    : pv > dv ? ['win', stake * 2]
    : pv === dv ? ['push', stake]
    : ['lose', 0];
  return { outcome, payout, dealer };
}

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
export const cardRank = (c: number) => RANKS[c % 13];
export const cardSuit = (c: number) => SUITS[Math.floor(c / 13) % 4];
export const cardRed = (c: number) => Math.floor(c / 13) % 4 === 1 || Math.floor(c / 13) % 4 === 2;

// what Mo says when a hand's over
export const MO_SAYS: Record<BjOutcome, string[]> = {
  blackjack: ['Blackjack. Don’t get used to it.', 'Twenty-one off the deal. The house is crying.'],
  win: ['Fair enough. You beat me.', 'Take it. Enjoy it. It won’t last.'],
  'mo-bust': ['Bust. Even I have bad nights.', 'Too many. Your money, this time.'],
  push: ['A push. Nobody’s happy.', 'Same as me. Go again.'],
  lose: ['House wins. It usually does.', 'Mine. Better luck next hand.'],
  bust: ['Over. Should’ve stood.', 'Bust. Happens to the best of us. Mostly to you.'],
  'mo-blackjack': ['Blackjack for the house. Sorry. Not sorry.', 'Twenty-one. Read it and weep.'],
};
