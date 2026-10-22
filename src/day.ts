// The game day rolls over at midnight Eastern.
const GAME_TZ = 'America/New_York';

export function todayInGameTz(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TZ }).format(now);
}
