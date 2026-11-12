// The CCC Rating and Slope: our own measure of how hard a course plays, from the robot (npm run check-holes -- rate,
// with QUICK=1). For each hole the robot plays at member skill (SKILL 1.15, how members really swing) and as a strong
// player (0.6), and each counts 1.5 putts a hole (members average 1.3; the robot putts far worse).
//   Rating: what a member is expected to shoot, as a score (par plus the member robot over par).
//   Slope: how much harder the course is for the member than the strong player, against the average course, scaled so
//   the average is 113 (as golf's slope is). Higher means misses cost more.
// The Greenkeeper re-runs this weekly. A course with no numbers yet shows none.
import type { Course } from './courses';

type Rated = { at: string; seeds: number; holes: { id: string; member: number; strong: number }[] };
export const RATINGS: Record<string, Rated> = {};

const spread = (r: Rated) => r.holes.reduce((a, h) => a + h.member - h.strong, 0);
// the average course's spread, over every rated course
const AVERAGE = () => {
  const all = Object.values(RATINGS);
  return all.length ? all.reduce((a, r) => a + spread(r), 0) / all.length : 1;
};

export function ratingOf(c: Course): { rating: number; slope: number; member: number; at: string; hardest: string | null } | null {
  const r = RATINGS[c.id];
  if (!r || r.holes.length !== c.holes.length) return null;
  const member = r.holes.reduce((a, h) => a + h.member, 0);
  const hard = [...r.holes].sort((a, b) => b.member - a.member)[0];
  const name = c.holes.find((h) => h.id === hard?.id)?.name ?? null;
  return { rating: Math.round((c.par + member) * 10) / 10, slope: Math.round((113 * spread(r)) / (AVERAGE() || 1)), member: Math.round(member * 10) / 10, at: r.at, hardest: name };
}
