// Season points, FedEx Cup style: each week's Open finish earns points, ties sharing the places they cover, through
// the calendar year. The same scale as season_points() in schema.sql. A year-end Wrapped draws on the same weeks.
export const SEASON_POINTS = [500, 300, 190, 135, 110, 100, 90, 85, 80, 75, 70, 65, 60, 55, 50, 45, 40, 35, 30, 25];
export const SEASON_FLOOR = 20; // every card posted in a week earns at least this
export const seasonPoints = (place: number) => SEASON_POINTS[place - 1] ?? SEASON_FLOOR;
// "The 2026 Western Reserve Open": a week's Open named as a tour event is, for its course and year
// what a period of the season is called: its course for the Highlands and the Caldera (before the Open began on Nov 8),
// then that week's Open
export const seasonEventName = (courseName: string, period: string) =>
  period < '2026-11-08' ? `The ${courseName.replace(/^The /, '').replace(/ Course$/, '')}` : openName(courseName, period);
export const openName = (courseName: string, period: string) => `The ${period.slice(0, 4)} ${courseName.replace(/^The /, '').replace(/ Course$/, '')} Open`;
