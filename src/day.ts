// The game day rolls over at midnight Eastern.
export const GAME_TZ = 'America/New_York';

export function todayInGameTz(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ }).format(now);
}

// The game period, which the database and the code still call "month": calendar months to begin with ('2026-10'),
// then the Caldera challenge from Friday 30 October to Saturday 7 November ('2026-10-30'), then from FIRST_WEEK a week
// at a time, Sunday to Saturday, keyed by its Sunday ('2026-11-15'). Keys sort in time order either way, so comparing
// them as strings works across the switch. supabase/schema.sql has the same rule in game_month().
export const CALDERA_START = '2026-10-30';
export const FIRST_WEEK = '2026-11-08';

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 Sunday

export const isWeek = (period: string) => period.length === 10;

export function periodOf(day: string): string {
  if (day >= FIRST_WEEK) return addDays(day, -weekday(day));
  return day >= CALDERA_START ? CALDERA_START : day.slice(0, 7);
}

// The day the next period starts.
function nextStart(period: string): string {
  if (period === CALDERA_START) return FIRST_WEEK;
  if (isWeek(period)) return addDays(period, 7);
  const [y, m] = period.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  return period < CALDERA_START && next > CALDERA_START ? CALDERA_START : next;
}

// The moment a period closes: midnight Eastern as the next one begins (so 2026-10 closes at 04:00 UTC on 30 October,
// while Eastern is still on daylight time). Midnight Eastern is 04:00 or 05:00 UTC; take whichever it is.
export function periodClosesAt(period: string): Date {
  const [y, m, d] = nextStart(period).split('-').map(Number);
  const hour = (t: Date) => Number(new Intl.DateTimeFormat('en-US', { timeZone: GAME_TZ, hour: 'numeric', hourCycle: 'h23' }).format(t));
  for (const utc of [4, 5]) {
    const t = new Date(Date.UTC(y, m - 1, d, utc));
    if (hour(t) === 0) return t;
  }
  return new Date(Date.UTC(y, m - 1, d, 5));
}

// What members call a period: "month" for the old calendar months, "week" from the Caldera challenge on.
export const span = (period: string) => (period < CALDERA_START ? 'month' : 'week');

const short = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Its name: "October 2026", "Oct 30 to Nov 7", "Week of Nov 15"
export function periodName(period: string): string {
  if (period === CALDERA_START) return `${short(period)} to ${short(addDays(FIRST_WEEK, -1))}`;
  if (isWeek(period)) return `Week of ${short(period)}`;
  return new Date(`${period}-15T12:00:00Z`).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
