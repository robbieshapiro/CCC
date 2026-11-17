// The daily streak (Nov 17): days in a row with a card in. It's alive while the last card day is today or yesterday;
// miss a whole day and it's gone. Shown as a flame on home and the board, a warning on home when it's about to go, and
// a pop at 3, 7, 14 and 30 days. (person_streak in supabase/schema.sql does the same count on the server.) The money
// for streaks (streakBonus in src/bonus.ts) counts any day at the club and is left as it is.
export type Streak = { days: number; today: boolean };
export const MILESTONES = [3, 7, 14, 30, 60, 100];

const dayMs = 86_400_000;
const n = (d: string) => Date.parse(`${d}T12:00:00Z`);

export function cardStreak(days: string[], today: string): Streak {
  const set = [...new Set(days)].sort();
  if (!set.length) return { days: 0, today: false };
  const last = set[set.length - 1];
  const gap = Math.round((n(today) - n(last)) / dayMs);
  if (gap > 1) return { days: 0, today: false };
  let run = 1;
  for (let i = set.length - 1; i > 0 && Math.round((n(set[i]) - n(set[i - 1])) / dayMs) === 1; i--) run++;
  return { days: run, today: gap === 0 };
}

// the flame, for a run worth showing (3 days or more)
export const flame = (s: Streak | undefined) => (s && s.days >= 3 ? `<span class="flame" title="${s.days} days in a row">🔥${s.days}</span>` : '');
