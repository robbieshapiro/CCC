// The three-tap swing, shared by the game and the headless checks so both play by the same rules.
// Tap 1 starts the power bar. Tap 2 stops it (aim for your planned power; 100-110% is overswing).
// Tap 3 stops the needle on its way back: the thin pure bullseye is perfect, the rest of the gold is close.
import { CLUBS, type ClubId } from './clubs';

export const OVERSWING = 1.1; // the bar runs past 100% to here

// how fast the power bar fills, in power per second; it speeds up toward the top
const FILL: Record<ClubId, number> = { driver: 0.9, iron: 0.75, wedge: 0.6, putter: 0 };
export const powerSpeed = (club: ClubId, p: number) => FILL[club] * (0.6 + 1.4 * p * p);

// how fast the needle comes back for the accuracy tap, in bar-lengths per second
const RETURN: Record<ClubId, number> = { driver: 1.0, iron: 0.84, wedge: 0.72, putter: 0 };
export function returnSpeed(club: ClubId, power: number, needle = 1) {
  const over = Math.max(0, power - 1);
  return RETURN[club] * (0.7 + 0.6 * Math.min(1, power)) * (1 + over * 10) * needle;
}

// the gold window either side of the impact point, as a share of the bar; overswing shrinks it
export function goldHalf(club: ClubId, power: number, sweetMul = 1) {
  const over = Math.max(0, power - 1);
  return (CLUBS[club].sweet / 2) * sweetMul * (1 - over * 4);
}
export const PURE = 0.3; // the bullseye is this share of the gold

// miss: how far the needle was from the impact point when tapped (bar-lengths; > 0 early, < 0 late).
// Early pushes and slices (error > 0), late pulls and hooks.
export function accuracyError(miss: number, half: number) {
  const m = Math.abs(miss);
  const pure = half * PURE;
  if (m <= pure) return 0;
  if (m <= half) return Math.sign(miss) * 0.12 * ((m - pure) / (half - pure));
  return Math.sign(miss) * (0.12 + 0.88 * Math.min(1, (m - half) / 0.15));
}

// ---------- the swipe swing (tour courses) ----------
// Pull down to take it back (how far is your power), then swipe up through where you started: that's impact.
// The line of the downswing against the line you took it back on decides the shot: come down right of it and
// you push or slice it, left and you pull or hook. A lazy downswing loses distance; quitting short of the ball chunks it.

export type SwipePt = { x: number; y: number; t: number }; // screen px (y down) and seconds
export type Swipe = { power: number; error: number; label: string; sub: string };

// the path tolerance either side of a square swing, in radians, before it starts to curve properly
export function swipeHalf(club: ClubId, power: number, sweetMul = 1, needle = 1) {
  const over = Math.max(0, power - 1);
  return ((CLUBS[club].sweet * 1.6 * sweetMul) / needle) * (1 - over * 4);
}

export const SLOW_DOWNSWING = 0.45; // seconds from the top to impact before it costs distance

// full: the pull (px) that makes 100% power
export function swipeResult(club: ClubId, pts: SwipePt[], full: number, sweetMul = 1, needle = 1): Swipe | null {
  if (pts.length < 3) return null;
  const start = pts[0];
  let b = 0;
  for (let i = 1; i < pts.length; i++) if (pts[i].y > pts[b].y) b = i;
  const top = pts[b]; // the top of the backswing is the bottom of the swipe
  const back = top.y - start.y;
  const power = Math.min(OVERSWING, back / full);
  if (power < 0.04 || b === pts.length - 1) return null;
  // impact: where the downswing comes back level with the start, or the release if it never gets there
  let hit = pts[pts.length - 1];
  for (let i = b + 1; i < pts.length; i++)
    if (pts[i].y <= start.y) {
      const p = pts[i - 1];
      const q = pts[i];
      const k = (p.y - start.y) / (p.y - q.y || 1);
      hit = { x: p.x + (q.x - p.x) * k, y: start.y, t: p.t + (q.t - p.t) * k };
      break;
    }
  const up = top.y - hit.y;
  if (up < Math.min(12, back * 0.3)) return null; // never really came down: no swing
  // the square line is straight back down the line you took it back on
  const backAng = Math.atan2(top.x - start.x, back);
  const downAng = Math.atan2(hit.x - top.x, up);
  const path = downAng + backAng; // > 0: came down right of the line you took it back on
  const half = swipeHalf(club, power, sweetMul, needle);
  let error = accuracyError(path, half);
  let p = power;
  let label = error === 0 ? 'Pure' : Math.abs(error) <= 0.12 ? 'Good' : Math.abs(error) > 0.5 ? (error > 0 ? 'Slice' : 'Hook') : error > 0 ? 'Push' : 'Pull';
  // quit before the ball: a chunk, fat and short
  if (up < back * 0.4) {
    p *= 0.6;
    error *= 1.3;
    label = 'Chunked';
  } else {
    const dur = hit.t - top.t;
    if (dur > SLOW_DOWNSWING) {
      p *= 1 - Math.min(0.2, (dur - SLOW_DOWNSWING) * 0.4);
      if (error === 0 || Math.abs(error) <= 0.12) label = 'Quit on it';
    }
  }
  const deg = Math.round((path * 180) / Math.PI);
  const sub = `${Math.round(power * 100)}%${deg ? ` · ${Math.abs(deg)}° ${deg > 0 ? 'right' : 'left'} of your line` : ' · on line'}`;
  return { power: p, error: Math.max(-1, Math.min(1, error)), label, sub };
}
