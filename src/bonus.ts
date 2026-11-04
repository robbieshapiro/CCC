// Club bonuses: the side money, on top of the weekly purse (src/purse.ts), which stays the big money. It counts toward
// career earnings and rank, and spends in the Pro Shop, but the board's money column is purse winnings only.
// person_bonus in supabase/schema.sql does the same sums on the server; keep the two in step.

export const BONUS = {
  round: 50, // a finished round, once a day
  streak3: 100, // the third day running at the club (opened the app, played or practised)
  streak7: 250, // every seventh day running
  ctp: 150, // the day's Closest to the Pin winner, across every club
  birdie: 25, // birdies and better pay on the day's first finished round only
  eagle: 100,
  ace: 500,
};

export type Bonus = { rounds: number; streaks: number; ctp: number; shots: number; total: number };

// what one hole earns: an ace is an ace whatever the par
export const shotBonus = (strokes: number, par: number) =>
  strokes === 1 ? BONUS.ace : strokes <= par - 2 ? BONUS.eagle : strokes === par - 1 ? BONUS.birdie : 0;

// days: every day (YYYY-MM-DD) someone was at the club. Each run pays at its third day and at every seventh.
export function streakBonus(days: string[]) {
  const sorted = [...new Set(days)].sort();
  let total = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && Date.parse(`${d}T12:00:00Z`) - Date.parse(`${prev}T12:00:00Z`) === 86400000 ? run + 1 : 1;
    if (run === 3) total += BONUS.streak3;
    if (run % 7 === 0) total += BONUS.streak7;
    prev = d;
  }
  return total;
}

export function bonusOf(o: { roundDays: string[]; days: string[]; ctpWins: number; holes: [number, number][] }): Bonus {
  const rounds = new Set(o.roundDays).size * BONUS.round;
  const streaks = streakBonus(o.days);
  const ctp = o.ctpWins * BONUS.ctp;
  const shots = o.holes.reduce((a, [s, p]) => a + shotBonus(s, p), 0);
  return { rounds, streaks, ctp, shots, total: rounds + streaks + ctp + shots };
}
