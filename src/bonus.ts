// Club bonuses: the side money, on top of the weekly purse (src/purse.ts), which stays the big money. It counts toward
// career earnings and rank, and spends in the Pro Shop, but the board's money column is purse winnings only.
// person_bonus in supabase/schema.sql does the same sums on the server; keep the two in step.

export const BONUS = {
  round: 50, // a finished round, once a day
  week: 250, // every week (from Nov 8) you post a counted card, wherever you finish (from Nov 14)
  streak3: 100, // the third day running at the club (opened the app, played or practised)
  streak7: 250, // every seventh day running
  ctp: 150, // the day's Closest to the Pin winner, across every club, before Nov 17 (DAILY_PRIZES from then)
  birdie: 100, // birdies and better pay on the day's first finished round only (raised from 25 for holes from Nov 10; not paid back)
  eagle: 500, // was 100
  albatross: 1000, // three under on a hole (was paid as an eagle)
  ace: 2500, // was 500
  // on a daily card (counted rounds only, one a day): the moments worth a cheer
  longPutt: 75, // holed from 30 ft
  monsterPutt: 200, // holed from 60 ft
  chipin: 100, // holed from off the green (not the tee: that's an ace)
  secret: 150, // the first time you find each hole's secret route
  designPlay: 100, // another member finishes your Members' Course hole (once each a week)
  designWeek: 500, // the most your holes can earn you in a week
};
// Closest to the Pin and the long drive, from Nov 17 (and the Target Range): the day's top three across every club, paid at midnight ET.
// Before that Closest to the Pin paid its winner BONUS.ctp and the long drive nothing (not paid back).
export const DAILY_PRIZES = [300, 150, 75];
export const PRIZES_FROM = '2026-11-17';
export const dailyPrize = (day: string, place: number) => (day >= PRIZES_FROM ? (DAILY_PRIZES[place - 1] ?? 0) : place === 1 ? BONUS.ctp : 0);
export const prizesLine = () => DAILY_PRIZES.map((n) => `$${n}`).join(' · ');
export const LONG_PUTT_FT = 30;
export const MONSTER_PUTT_FT = 60;
// every hole's secret route, by its zone (secret_feats in supabase/schema.sql)
export const SECRET_FEATS = ['cartpath', 'bridge', 'terrace', 'runway', 'plank', 'amphi', 'blowhole', 'lavatube', 'rimroad', 'ledge', 'liftoff', 'tunnel', 'ashroad', 'seaarch', 'backbank', 'kick', 'ridge', 'sealionrock', 'shelf', 'spillway', 'walk', 'breakwater', 'plaza', 'lowerwacker', 'gangway', 'boardwalk', 'rooftop'];

export type Bonus = { rounds: number; streaks: number; ctp: number; drive?: number; targets?: number; acepot?: number; shots: number; putts?: number; chipins?: number; secrets?: number; designs?: number; grants?: number; trophies?: number; weeks?: number; total: number };

// before Nov 10 2026 great holes paid the old rates (person_bonus in supabase/schema.sql)
export const RAISE_FROM = '2026-11-10';
export const oldShotBonus = (strokes: number, par: number) => (strokes === 1 ? 500 : strokes <= par - 2 ? 100 : strokes === par - 1 ? 25 : 0);

// what a holed putt from this far is worth on a card
export const puttBonus = (ft: number) => (ft >= MONSTER_PUTT_FT ? BONUS.monsterPutt : ft >= LONG_PUTT_FT ? BONUS.longPutt : 0);

// what one hole earns: an ace is an ace whatever the par
export const shotBonus = (strokes: number, par: number) =>
  strokes === 1 ? BONUS.ace : strokes <= par - 3 ? BONUS.albatross : strokes === par - 2 ? BONUS.eagle : strokes === par - 1 ? BONUS.birdie : 0;
// and what it's called
export const shotName = (strokes: number, par: number) =>
  strokes === 1 ? 'Hole in one' : strokes <= par - 3 ? 'Albatross' : strokes === par - 2 ? 'Eagle' : strokes === par - 1 ? 'Birdie' : '';

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

export function bonusOf(o: { roundDays: string[]; days: string[]; ctpPay: number; drivePay?: number; targetsPay?: number; acePay?: number; holes: [number, number, boolean?][]; putts?: number; chipins?: number; secrets?: number; designs?: number; cardWeeks?: string[] }): Bonus {
  const rounds = new Set(o.roundDays).size * BONUS.round;
  const streaks = streakBonus(o.days);
  const ctp = o.ctpPay;
  const drive = o.drivePay ?? 0;
  const targets = o.targetsPay ?? 0;
  const acepot = o.acePay ?? 0;
  const shots = o.holes.reduce((a, [s, p, old]) => a + (old ? oldShotBonus(s, p) : shotBonus(s, p)), 0);
  const extra = { putts: o.putts ?? 0, chipins: o.chipins ?? 0, secrets: o.secrets ?? 0, designs: o.designs ?? 0 };
  const weeks = new Set((o.cardWeeks ?? []).filter((w) => w >= '2026-11-08')).size * BONUS.week;
  return { rounds, streaks, ctp, drive, targets, acepot, shots, ...extra, weeks, total: rounds + streaks + ctp + drive + targets + acepot + shots + extra.putts + extra.chipins + extra.secrets + extra.designs + weeks };
}
