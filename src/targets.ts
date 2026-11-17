// The Target Range (Nov 17): a daily game at the bar. Ten balls from a bay at six targets, 50 to 210 yd, and the back
// net at 235 yd. Each target is a net in three rings: a ball that lands in a ring on the fly is caught there and scores
// it (the bullseye most, the far targets more than the near ones). One that lands short and rolls in only reaches the
// outer ring. The back net pays only through its centre window, on the fly, for a drive.
// Score again on the next ball and it doubles, then triples from the third in a row; a miss resets that. One counted
// game a day; the day's top three are paid (DAILY_PRIZES). submit_bar in supabase/schema.sql checks the score is
// possible (0 to TARGET_MAX).
import { SCALE } from './golf3d/clubs';
import type { Frame, Result } from './golf3d/physics';
import type { V2 } from './golf3d/types';

export const TARGET_BALLS = 10;
// hole units are SCALE ft, so a yard is 3 / SCALE of them
const yd = (n: number) => (n * 3) / SCALE;
// the rings' radii, in yards: inner, middle, outer
export const RING_YD = [4, 9, 15];
export const RINGS = RING_YD.map(yd);
export type Target = { yards: number; at: V2; points: [number, number, number]; color: number };
export const TARGETS: Target[] = [
  { yards: 50, at: { x: -30, y: yd(50) }, points: [10, 5, 2], color: 0xe94b3c },
  { yards: 80, at: { x: 34, y: yd(80) }, points: [13, 6, 3], color: 0xf39c12 },
  { yards: 115, at: { x: -38, y: yd(115) }, points: [16, 8, 3], color: 0xf1c40f },
  { yards: 150, at: { x: 30, y: yd(150) }, points: [20, 10, 4], color: 0x2ecc71 },
  { yards: 180, at: { x: -24, y: yd(180) }, points: [24, 12, 5], color: 0x3498db },
  { yards: 210, at: { x: 26, y: yd(210) }, points: [28, 14, 6], color: 0x9b59b6 },
];
// The back net, across the end of the range: only a drive through the window in its middle, on the fly, scores.
// x0/x1: the net's ends; top: its height above the ground; win: the window's half-width and height (hole units).
export const NET = { yards: 235, y: yd(235), x: 0, x0: -120, x1: 120, top: 40, half: yd(7), h: yd(9), points: 40, color: 0xffd23f };
// a streak: the second ball in a row in a ring doubles, the third and on triple
export const streakMult = (run: number) => Math.min(3, Math.max(1, run));
// the most a game can score: the window every time, 40, then 80, then 120 for each ball after
export const TARGET_MAX = NET.points * (1 + 2 + 3 * (TARGET_BALLS - 2));

export type Hit = { target: number; ring: number; points: number; rolled?: boolean };
// which target and ring this spot is in (ring 0 is the inner), or null for none
export function ringAt(end: V2): { target: number; ring: number; points: number } | null {
  for (let i = 0; i < TARGETS.length; i++) {
    const t = TARGETS[i];
    const d = Math.hypot(end.x - t.at.x, end.y - t.at.y);
    const ring = RINGS.findIndex((r) => d <= r);
    if (ring >= 0) return { target: i, ring, points: t.points[ring] };
  }
  return null;
}
const inOuter = (p: V2) => TARGETS.findIndex((t) => Math.hypot(p.x - t.at.x, p.y - t.at.y) <= RINGS[2]);

// The nets catch the ball: the shot as flown, cut off where a net takes it, and what it scored (hit null: nothing).
//   on the fly into the back net: it drops at the net (the window scores, the rest of the net doesn't);
//   on the fly into a ring: it stops where it landed and scores that ring;
//   landed short and rolling: the first target it rolls into takes it, in the outer ring;
//   rolling into the back net: it stops there, nothing.
export function netShot(r: Result, ground: (x: number, y: number) => number): { r: Result; hit: Hit | null; net: 'window' | 'net' | null } {
  if (r.penalty || r.frames.length < 2) return { r, hit: null, net: null };
  const land = r.sounds.find((s) => s.s === 'land' || s.s === 'sand' || s.s === 'splash')?.t ?? Infinity;
  const cut = (frames: Frame[]): Result => {
    const t = frames[frames.length - 1].t;
    const end = frames[frames.length - 1];
    return { ...r, frames, end: { x: end.x, y: end.y }, sounds: r.sounds.filter((s) => s.t <= t), duration: t, holed: false, zones: [] };
  };
  // caught by a target's net: from where it went in, it runs down the funnel to the middle and drops out of sight
  const funnel = (frames: Frame[], k: number): Frame[] => {
    const at = frames[frames.length - 1];
    const c = TARGETS[k].at;
    const out: Frame[] = [];
    const n = 12;
    for (let j = 1; j <= n; j++) {
      const s = j / n;
      const e = s * s * (3 - 2 * s);
      const x = at.x + (c.x - at.x) * e;
      const y = at.y + (c.y - at.y) * e;
      out.push({ x, y, z: ground(x, y) - 1.6 * s * s, t: at.t + 0.07 * j });
    }
    return [...frames, ...out];
  };
  for (let i = 1; i < r.frames.length; i++) {
    const a = r.frames[i - 1];
    const f = r.frames[i];
    // the back net
    if (a.y < NET.y && f.y >= NET.y) {
      const k = (NET.y - a.y) / (f.y - a.y || 1);
      const x = a.x + (f.x - a.x) * k;
      const z = a.z + (f.z - a.z) * k;
      const t = a.t + (f.t - a.t) * k;
      const up = z - ground(x, NET.y);
      if (x >= NET.x0 && x <= NET.x1 && up <= NET.top) {
        // it hits the net and drops to its foot
        const y = NET.y - 0.6;
        const g = ground(x, y);
        const drop: Frame[] = [];
        for (let j = 1; j <= 8; j++) drop.push({ x, y, z: g + (z - g) * (1 - j / 8) ** 2, t: t + 0.06 * j });
        const flying = f.t <= land;
        const window = flying && Math.abs(x - NET.x) <= NET.half && up <= NET.h;
        return { r: cut([...r.frames.slice(0, i), { x, y, z, t }, ...drop]), hit: window ? { target: -1, ring: 0, points: NET.points } : null, net: window ? 'window' : 'net' };
      }
    }
    // landed: in a ring, the net takes it there
    if (a.t < land && f.t >= land) {
      const hit = ringAt(f);
      if (hit) return { r: cut(funnel(r.frames.slice(0, i + 1), hit.target)), hit, net: null };
    }
    // rolling: into a target's outer edge
    if (f.t > land) {
      const k = inOuter(f);
      if (k >= 0) return { r: cut(funnel(r.frames.slice(0, i + 1), k)), hit: { target: k, ring: 2, points: TARGETS[k].points[2], rolled: true }, net: null };
    }
  }
  return { r, hit: null, net: null };
}
