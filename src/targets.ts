// The Target Range (Nov 17): a daily game at the bar. Ten balls from a bay at six targets, 60 to 240 yd, each with
// three rings. Where the ball stops scores: the inner ring the most, and the far targets more than the near ones.
// Land in a ring on the next ball too and it scores double, then triple from the third in a row; a miss resets that.
// So a sure wedge can be worth more than a long miss. One counted game a day; the day's top three are paid
// (DAILY_PRIZES). submit_bar in supabase/schema.sql checks the score is possible (0 to TARGET_MAX).
import { SCALE } from './golf3d/clubs';
import type { V2 } from './golf3d/types';

export const TARGET_BALLS = 10;
// hole units are SCALE ft, so a yard is 3 / SCALE of them
const yd = (n: number) => (n * 3) / SCALE;
// the rings' radii, in yards: inner, middle, outer
export const RING_YD = [4, 9, 15];
export const RINGS = RING_YD.map(yd);
export type Target = { yards: number; at: V2; points: [number, number, number]; color: number };
export const TARGETS: Target[] = [
  { yards: 60, at: { x: -30, y: yd(60) }, points: [10, 5, 2], color: 0xe94b3c },
  { yards: 90, at: { x: 34, y: yd(90) }, points: [14, 7, 3], color: 0xf39c12 },
  { yards: 125, at: { x: -38, y: yd(125) }, points: [18, 9, 4], color: 0xf1c40f },
  { yards: 160, at: { x: 30, y: yd(160) }, points: [22, 11, 4], color: 0x2ecc71 },
  { yards: 200, at: { x: -20, y: yd(200) }, points: [26, 13, 5], color: 0x3498db },
  { yards: 240, at: { x: 24, y: yd(240) }, points: [30, 15, 6], color: 0x9b59b6 },
];
// a streak: the second ball in a row in a ring doubles, the third and on triple
export const streakMult = (run: number) => Math.min(3, Math.max(1, run));
// the most a game can score: 30, then 60, then 90 for each ball after
export const TARGET_MAX = TARGETS[TARGETS.length - 1].points[0] * (1 + 2 + 3 * (TARGET_BALLS - 2));

// which target and ring a ball that stopped here is in (ring 0 is the inner), or null for none
export function ringAt(end: V2): { target: number; ring: number; points: number } | null {
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const d = Math.hypot(end.x - t.at.x, end.y - t.at.y);
    const ring = RINGS.findIndex((r) => d <= r);
    if (ring >= 0) return { target: i, ring, points: t.points[ring] };
  }
  return null;
}

// a whole game: each ball's points after the streak, and the total
export function scoreGame(ends: (V2 | null)[]) {
  let run = 0;
  let total = 0;
  const balls = ends.map((e) => {
    const hit = e ? ringAt(e) : null;
    run = hit ? run + 1 : 0;
    const mult = hit ? streakMult(run) : 1;
    const pts = hit ? hit.points * mult : 0;
    total += pts;
    return { hit, mult, pts };
  });
  return { balls, total };
}
