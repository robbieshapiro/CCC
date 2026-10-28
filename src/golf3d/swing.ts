// The three-tap swing, shared by the game and the headless checks so both play by the same rules.
// Tap 1 starts the power bar. Tap 2 stops it (aim for your planned power; 100-110% is overswing).
// Tap 3 stops the needle on its way back: the thin pure bullseye is perfect, the rest of the gold is close.
import { CLUBS, type ClubId } from './clubs';

export const OVERSWING = 1.1; // the bar runs past 100% to here

// how fast the power bar fills, in power per second; it speeds up toward the top
const FILL: Record<ClubId, number> = { driver: 0.9, iron: 0.75, wedge: 0.6, chip: 0.85, putter: 0 };
export const powerSpeed = (club: ClubId, p: number) => FILL[club] * (0.6 + 1.4 * p * p);

// The meter comes in two styles. Classic runs left to right. The vertical meter (tour courses, and every course
// from November) swings the club up and down with it. The long clubs are just as unforgiving as on the classic meter
// (a full driver gives you about ±19 ms to find the gold); only the scoring clubs get a slower needle and wider gold.
export type MeterStyle = 'classic' | 'vertical';
const SLOWER: Record<ClubId, number> = { driver: 1, iron: 1, wedge: 0.75, chip: 0.75, putter: 1 };
const WIDER: Record<ClubId, number> = { driver: 1, iron: 1, wedge: 1.5, chip: 1.5, putter: 1 };

// how fast the needle comes back for the accuracy tap, in bar-lengths per second
const RETURN: Record<ClubId, number> = { driver: 1.0, iron: 0.84, wedge: 0.72, chip: 0.9, putter: 0 };
export function returnSpeed(club: ClubId, power: number, needle = 1, style: MeterStyle = 'classic') {
  const over = Math.max(0, power - 1);
  return RETURN[club] * (0.7 + 0.6 * Math.min(1, power)) * (1 + over * 10) * needle * (style === 'vertical' ? SLOWER[club] : 1);
}

// the gold window either side of the impact point, as a share of the bar; overswing shrinks it
export function goldHalf(club: ClubId, power: number, sweetMul = 1, style: MeterStyle = 'classic') {
  const over = Math.max(0, power - 1);
  return (CLUBS[club].sweet / 2) * sweetMul * (1 - over * 4) * (style === 'vertical' ? WIDER[club] : 1);
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

