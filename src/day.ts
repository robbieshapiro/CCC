// The game day rolls over at midnight Eastern.
const GAME_TZ = 'America/New_York';

export function todayInGameTz(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ }).format(now);
}

// The moment a game month closes: midnight Eastern as the next month begins (so 2026-10 closes at 04:00 UTC on
// 1 November, while Eastern is still on daylight time). Midnight Eastern is 04:00 or 05:00 UTC; take whichever it is.
export function monthClosesAt(month: string): Date {
  const [y, m] = month.split('-').map(Number);
  const hour = (d: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: GAME_TZ, hour: 'numeric', hourCycle: 'h23' }).format(d));
  for (const utc of [4, 5]) {
    const d = new Date(Date.UTC(y, m, 1, utc));
    if (hour(d) === 0) return d;
  }
  return new Date(Date.UTC(y, m, 1, 5));
}
