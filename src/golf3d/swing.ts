// The three-tap swing, shared by the game and the headless checks so both play by the same rules.
// Tap 1 starts the power bar. Tap 2 stops it (aim for your planned power; 100-110% is overswing).
// Tap 3 stops the needle on its way back: the gold strip is pure, the silver either side of it is close.
// (In the code the whole window is still `gold` and the strip is `pure`.)
import { CLUBS, type ClubId } from './clubs';

export const OVERSWING = 1.1; // the bar runs past 100% to here

// how fast the power bar fills, in power per second; it speeds up toward the top
const FILL: Record<ClubId, number> = { driver: 0.9, wood: 0.85, iron: 0.75, wedge: 0.6, chip: 0.85, putter: 0 };
// calm: the short clubs' meter on the stretched scale below (the chipper since Nov 6, the wedge since Nov 7)
export const powerSpeed = (club: ClubId, p: number, calm = false) =>
  stretched(club) && calm ? Math.max(0.05, (2 * meterPos(club, p)) / OVERSWING) * stretchRate(club) : FILL[club] * (0.6 + 1.4 * p * p);

// The short clubs' meter is drawn on a stretched scale (the chipper on every course since Nov 6, after the Western
// Reserve tried it; the wedge since Nov 7): a short shot needs only a sliver of power, so on a straight scale its line
// sat at the foot of the bar and the fill was past it before you could look. Here the bar shows the square root of the
// power, so a typical chip's line sits a third to half way up (a 30 yd wedge about half way), and it fills at a steady,
// unhurried pace. The physics is the same; only where the line is drawn and how fast the bar climbs to it change.
export const stretched = (club: ClubId) => club === 'chip' || club === 'wedge';
export const CHIP_RATE = 0.48; // bar-heights (of the full 0..OVERSWING) per second (0.7 until Nov 6: chips ran long)
export const WEDGE_RATE = 0.55; // a full wedge takes about two seconds to fill
export const stretchRate = (club: ClubId) => (club === 'wedge' ? WEDGE_RATE : CHIP_RATE);
export const meterPos = (club: ClubId, p: number) => (stretched(club) ? Math.sqrt(Math.max(0, p) * OVERSWING) : p);
export const fromMeter = (club: ClubId, d: number) => (stretched(club) ? (d * d) / OVERSWING : d);

// The meter comes in two styles. Classic runs left to right. The vertical meter (tour courses, and every course
// from November) swings the club up and down with it. The long clubs are just as unforgiving as on the classic meter
// (a full driver gives you about ±24 ms to find the gold, a touch kinder than the classic ±19); the scoring clubs get a
// slower needle and wider gold.
export type MeterStyle = 'classic' | 'vertical';
const SLOWER: Record<ClubId, number> = { driver: 1, wood: 1, iron: 1, wedge: 0.75, chip: 0.75, putter: 1 };
const WIDER: Record<ClubId, number> = { driver: 1.25, wood: 1.2, iron: 1, wedge: 1.5, chip: 1.5, putter: 1 };

// how fast the needle comes back for the accuracy tap, in bar-lengths per second
const RETURN: Record<ClubId, number> = { driver: 1.0, wood: 0.92, iron: 0.84, wedge: 0.72, chip: 0.9, putter: 0 };
// fire: you've a lager or a fireball in you, and the overswing zone is the fire. Swinging into it is what the drink
// is for, so it's only a little harder than a full swing, where a sober overswing is a gamble.
export function returnSpeed(club: ClubId, power: number, needle = 1, style: MeterStyle = 'classic', fire = false) {
  const over = Math.max(0, power - 1);
  return RETURN[club] * (0.7 + 0.6 * Math.min(1, power)) * (1 + over * (fire ? 2.5 : 10)) * needle * (style === 'vertical' ? SLOWER[club] : 1);
}

// the gold window either side of the impact point, as a share of the bar; overswing shrinks it
export function goldHalf(club: ClubId, power: number, sweetMul = 1, style: MeterStyle = 'classic', fire = false) {
  const over = Math.max(0, power - 1);
  return (CLUBS[club].sweet / 2) * sweetMul * (1 - over * (fire ? 1.5 : 4)) * (style === 'vertical' ? WIDER[club] : 1);
}
export const PURE = 0.3; // the gold strip is this share of the window

// miss: how far the needle was from the impact point when tapped (bar-lengths; > 0 early, < 0 late).
// Early pushes and slices (error > 0), late pulls and hooks.
export function accuracyError(miss: number, half: number) {
  const m = Math.abs(miss);
  const pure = half * PURE;
  if (m <= pure) return 0;
  if (m <= half) return Math.sign(miss) * 0.12 * ((m - pure) / (half - pure));
  return Math.sign(miss) * (0.12 + 0.88 * Math.min(1, (m - half) / 0.15));
}

