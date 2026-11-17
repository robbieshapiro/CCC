// Mo's Book (Nov 17): bets on the week's Open, for club money. Two markets:
//   Who wins: anyone who's played the Open in the last three weeks. Mo prices them from this week's best card (with the
//     days left to improve on it) or, before they've posted, their recent form, and keeps 12% for the house. The price
//     is locked when you bet. Bets close at the end of Friday; Saturday's too late. A tie for first splits the winnings.
//   Back yourself: beat your own line (your recent weeks' best, per hole, times this week's holes, to the half) and get
//     1.9x. Only before your first card of the week, once a week. No card all week and the stake comes back.
// Bets settle when the week closes. book_field, book_state, book_bet and book_settle in supabase/schema.sql do the
// same sums; this file is the local mode's copy and the shared types.

export const BOOK_MARGIN = 0.88;
export const BOOK_MIN = 1.2;
export const BOOK_MAX = 40;
export const BACK_ODDS = 1.9;

export type BookPick = { playerId: string; name: string; posted: number | null; odds: number; mine: boolean };
export type BookBet = { id: number; kind: 'winner' | 'back'; week: string; pick: string | null; line: number | null; odds: number; stake: number; payout: number | null; at: string };
export type BookState = {
  week: string;
  open: boolean; // false on the Saturday: bets closed till Sunday
  field: BookPick[];
  back: { line: number | null; can: boolean; why: string | null };
  bets: BookBet[];
  bank: number;
};

// days of the week left to play, today included: 7 on the Sunday, 1 on the Saturday
export const daysLeft = (week: string, today: string) => Math.max(1, 7 - Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${week}T12:00:00Z`)) / 86_400_000));

// the line for backing yourself: your recent per-hole best times this week's holes, to the half (never a push)
export const backLine = (prior: number) => Math.floor(prior) + 0.5;

// price the field: each person's rating (lower is better) becomes a chance, softer the more days are left, and the
// chance becomes odds less Mo's cut
export function priceField<T extends { posted: number | null; prior: number | null }>(field: T[], left: number): (T & { odds: number })[] {
  if (!field.length) return [];
  const rating = (x: T) => (x.posted !== null ? x.posted - 0.25 * left : (x.prior ?? 2) + 0.5);
  const best = Math.min(...field.map(rating));
  const temp = 1 + 0.35 * left;
  const w = field.map((x) => Math.exp(-(rating(x) - best) / temp));
  const sum = w.reduce((a, b) => a + b, 0);
  return field.map((x, i) => ({ ...x, odds: Math.min(BOOK_MAX, Math.max(BOOK_MIN, Math.round((BOOK_MARGIN / (w[i] / sum)) * 10) / 10)) }));
}

export const betStatus = (b: BookBet) => (b.payout === null ? 'open' : b.payout === 0 ? 'lost' : b.payout === b.stake && b.kind === 'back' ? 'void' : 'won');
