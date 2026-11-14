// The CCC Rating and Slope: our own measure of how hard a course plays, from the robot (npm run check-holes -- rate,
// with QUICK=1). For each hole the robot plays at member skill (SKILL 1.15, how members really swing) and as a strong
// player (0.6), and each counts 1.5 putts a hole (members average 1.3; the robot putts far worse).
//   Rating: what a member is expected to shoot, as a score (par plus the member robot over par).
//   Slope: how much harder the course is for the member than the strong player, against the average course, scaled so
//   the average is 113 and the range 55 to 155 (as golf's slope is). Higher means misses cost more.
// The Greenkeeper re-runs this weekly. A course with no numbers yet shows none.
import type { Course } from "./courses";

type Rated = {
  at: string;
  seeds: number;
  holes: { id: string; member: number; strong: number }[];
};
export const RATINGS: Record<string, Rated> = {
  highlands: {
    at: "2026-11-12",
    seeds: 4,
    holes: [
      { id: "summit", member: -1.2, strong: -1.5 },
      { id: "island", member: 3.3, strong: 0.8 },
      { id: "ridge", member: -0.2, strong: -0.2 },
    ],
  },
  caldera: {
    at: "2026-11-12",
    seeds: 4,
    holes: [
      { id: "blowhole", member: 1, strong: 0.5 },
      { id: "lavafield", member: 3.8, strong: 0.5 },
      { id: "caldera", member: 1, strong: 0.5 },
      { id: "lavalift", member: 1, strong: 0.3 },
      { id: "geyseralley", member: 0.8, strong: 0 },
      { id: "lavatube", member: 1, strong: 0.8 },
    ],
  },
  pacificbluffs: {
    at: "2026-11-12",
    seeds: 4,
    holes: [
      { id: "sealion", member: 0.8, strong: 1.8 },
      { id: "lighthouse", member: 1.5, strong: 0.8 },
      { id: "thecarry", member: 1.3, strong: 1 },
    ],
  },
  westernreserve: {
    at: "2026-11-12",
    seeds: 4,
    holes: [
      { id: "creekbend", member: 3, strong: 0.3 },
      { id: "theledges", member: 0.5, strong: 0 },
      { id: "maplelake", member: 1, strong: 0.3 },
      { id: "thequarry", member: 0.8, strong: 0.5 },
      { id: "thegorge", member: 2.3, strong: 0.5 },
    ],
  },
  windycity: {
    at: "2026-11-14",
    seeds: 4,
    holes: [
      { id: "lakefront", member: 1, strong: 0.5 },
      { id: "millennium", member: -0.2, strong: -0.2 },
      { id: "lincolnpark", member: 2.8, strong: 0.5 },
      { id: "river", member: 3.8, strong: 2 },
      { id: "wrigleyville", member: 2.5, strong: 0 },
      { id: "evanston", member: 3.5, strong: 1 },
      { id: "navypier", member: 0.8, strong: 1.8 },
    ],
  },
};

const spread = (r: Rated) =>
  r.holes.reduce((a, h) => a + h.member - h.strong, 0);
// the average course's spread, over every rated course
const AVERAGE = () => {
  const all = Object.values(RATINGS);
  return all.length ? all.reduce((a, r) => a + spread(r), 0) / all.length : 1;
};

export function ratingOf(
  c: Course,
): {
  rating: number;
  slope: number;
  member: number;
  at: string;
  hardest: string | null;
} | null {
  const r = RATINGS[c.id];
  if (!r || r.holes.length !== c.holes.length) return null;
  const member = r.holes.reduce((a, h) => a + h.member, 0);
  const hard = [...r.holes].sort((a, b) => b.member - a.member)[0];
  const name = c.holes.find((h) => h.id === hard?.id)?.name ?? null;
  return {
    rating: Math.round((c.par + member) * 10) / 10,
    slope: Math.max(55, Math.min(155, Math.round((113 * spread(r)) / (AVERAGE() || 1)))),
    member: Math.round(member * 10) / 10,
    at: r.at,
    hardest: name,
  };
}
