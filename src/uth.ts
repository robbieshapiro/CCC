// Ultimate Texas Hold'em against Mo (Nov 17): the casino table game, played to the standard rules (Shuffle Master's,
// with its usual pay tables). The live club deals and settles on the server (uth_deal, uth_act, poker_rank in
// supabase/schema.sql); this file is local mode's copy, the hand names and the pay tables. Keep the two in step.
//
// The game: Ante and an equal Blind, and an optional Trips side bet. You and Mo get two cards each; five come to the
// board. Before the flop: check, or Play 3x or 4x the Ante. On the flop, if you checked: check, or Play 2x. On the river,
// if you're still checking: Play 1x, or fold (Ante and Blind lost). One Play bet a hand; once it's down, the rest is
// dealt. Best five of seven. Mo qualifies with a pair or better; if he doesn't, your Ante comes back and the rest plays.
// Beat Mo: Play pays 1:1, Ante 1:1 (if he qualified), Blind by its table on a straight or better (else it pushes).
// Mo wins: Ante (if he qualified), Blind and Play lose. A tie pushes everything. Trips pays on your own hand, even folded.
// Cards are 0 to 51 as in blackjack (src/blackjack.ts): c % 13 is the rank with 0 an ace, Math.floor(c / 13) the suit.

export const UTH_ANTES = [10, 25, 50, 100];
export const UTH_TRIPS = [0, 10, 25, 50];

export type UthStage = 'pre' | 'flop' | 'river' | 'done';
export type UthAction = 'play4' | 'play3' | 'play2' | 'play1' | 'check' | 'fold';
export type UthLines = { ante: number; blind: number; play: number; trips: number };
export type UthView = {
  id: number;
  stage: UthStage;
  ante: number;
  trips: number;
  play: number; // 0 until you make the Play bet
  player: number[];
  dealer: number[]; // empty until the hand is done
  board: number[]; // 0, 3 or 5 cards, as dealt
  result: null | { outcome: 'win' | 'lose' | 'tie' | 'fold'; qualified: boolean; you: string; mo: string; back: UthLines; payout: number };
  bank: number;
  lostToday: number;
};
export type UthState = { hand: UthView | null; bank: number; lostToday: number };

export const HANDS = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush'];
// Blind: what a winning hand pays, to 1 (straight or better; anything less pushes)
export const BLIND_PAYS: Record<number, number> = { 4: 1, 5: 1.5, 6: 3, 7: 10, 8: 50, 9: 500 };
// Trips: what your hand pays, to 1, whatever Mo has (three of a kind or better)
export const TRIPS_PAYS: Record<number, number> = { 3: 3, 4: 4, 5: 7, 6: 9, 7: 30, 8: 40, 9: 50 };

// poker rank of a card: 0 a two ... 12 an ace
const pr = (c: number) => (c % 13 + 12) % 13;
const B = 13;

// the best five of any 5 to 7 cards, as one number (higher wins): category * 13^5 + five kickers. Royal is a
// straight flush to the ace (category 8 with top 12). poker_rank in supabase/schema.sql does the same.
export function pokerRank(cards: number[]): number {
  const cnt = new Array(13).fill(0);
  const suits: number[][] = [[], [], [], []];
  for (const c of cards) {
    cnt[pr(c)]++;
    suits[Math.floor(c / 13) % 4].push(pr(c));
  }
  const val = (cat: number, k: number[]) => [...k, 0, 0, 0, 0, 0].slice(0, 5).reduce((a, x) => a * B + x, cat);
  const maskOf = (rs: number[]) => rs.reduce((m, r) => m | (1 << r), 0);
  const flush = suits.find((s) => s.length >= 5);
  if (flush) {
    const t = wheelAware(maskOf(flush));
    if (t >= 0) return val(8, [t]);
  }
  const byCount = (n: number) => [...Array(13).keys()].reverse().filter((r) => cnt[r] === n);
  const quads = byCount(4);
  const trips = byCount(3);
  const pairs = byCount(2);
  const singles = (skip: number[], n: number) => [...Array(13).keys()].reverse().filter((r) => cnt[r] > 0 && !skip.includes(r)).slice(0, n);
  if (quads.length) return val(7, [quads[0], ...singles([quads[0]], 1)]);
  // a full house: the best trips, and the best pair from what's left (a second set of trips counts as a pair)
  if (trips.length && (trips.length > 1 || pairs.length)) return val(6, [trips[0], Math.max(trips[1] ?? -1, pairs[0] ?? -1)]);
  if (flush) return val(5, [...flush].sort((a, b) => b - a).slice(0, 5));
  const st = wheelAware(maskOf(cnt.map((n, r) => (n ? r : -1)).filter((r) => r >= 0)));
  if (st >= 0) return val(4, [st]);
  if (trips.length) return val(3, [trips[0], ...singles([trips[0]], 2)]);
  if (pairs.length >= 2) return val(2, [pairs[0], pairs[1], ...singles([pairs[0], pairs[1]], 1)]);
  if (pairs.length) return val(1, [pairs[0], ...singles([pairs[0]], 3)]);
  return val(0, singles([], 5));
}

// the top card of the best straight in a rank mask, counting the ace low too (the wheel's top is the five, rank 3)
function wheelAware(mask: number) {
  for (let top = 12; top >= 4; top--) {
    let ok = true;
    for (let k = 0; k < 5; k++) if (!(mask & (1 << (top - k)))) ok = false;
    if (ok) return top;
  }
  const wheel = (1 << 12) | 1 | 2 | 4 | 8;
  return (mask & wheel) === wheel ? 3 : -1;
}

// the category (0 high card ... 8 straight flush, 9 royal flush) of a rank
export function category(rank: number) {
  const cat = Math.floor(rank / B ** 5);
  return cat === 8 && Math.floor(rank / B ** 4) % B === 12 ? 9 : cat;
}
export const handName = (rank: number) => HANDS[category(rank)];

// settle a hand: what comes back on each bet (0 lost, the stake on a push, more on a win)
export function uthSettle(ante: number, trips: number, play: number, player: number[], dealer: number[], board: number[], folded: boolean) {
  const p = pokerRank([...player, ...board]);
  const d = pokerRank([...dealer, ...board]);
  const pc = category(p);
  const qualified = category(d) >= 1;
  const tripsBack = trips && TRIPS_PAYS[pc] ? trips + Math.floor(trips * TRIPS_PAYS[pc]) : 0;
  let back: UthLines;
  let outcome: 'win' | 'lose' | 'tie' | 'fold';
  if (folded) {
    outcome = 'fold';
    back = { ante: 0, blind: 0, play: 0, trips: tripsBack };
  } else if (p > d) {
    outcome = 'win';
    back = { ante: qualified ? ante * 2 : ante, blind: ante + Math.floor(ante * (BLIND_PAYS[pc] ?? 0)), play: play * 2, trips: tripsBack };
  } else if (p < d) {
    outcome = 'lose';
    back = { ante: qualified ? 0 : ante, blind: 0, play: 0, trips: tripsBack };
  } else {
    outcome = 'tie';
    back = { ante, blind: ante, play, trips: tripsBack };
  }
  return { outcome, qualified, you: handName(p), mo: handName(d), back, payout: back.ante + back.blind + back.play + back.trips };
}
