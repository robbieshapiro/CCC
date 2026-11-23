// The Daily Shot (from Nov 20, 2026): three par 3s a day, the same for every member of every club, each in a
// different world, each harder than the one before: longer, a smaller green, more trouble round it. Built from the
// date alone (no architect, no network), with the Design Desk's own builder (src/designer/hole.ts) and its worlds
// (src/designer/worlds.ts). One try on each hole; the lowest total distance from the pin wins the day, and a hole in
// one on any of them takes the Ace Pot. A new three at midnight, Eastern.
import { conditionsFor, type Conditions } from './golf3d/conditions';
import { SCALE } from './golf3d/clubs';
import type { Hole, V2 } from './golf3d/types';
import { buildHole, type HoleSpec } from './designer/hole';
import { surfaceAt } from './golf3d/terrain';
import { WORLD_PRESETS, type DailyWorld } from './designer/worlds';
import type { World } from './designer/world';
import { makeRng } from './seed';

export const SHOT_FROM = '2026-11-20'; // the first day of the three-hole Daily Shot (before it: one shot, src/daily.ts)
export const SHOT_HOLES = 3;
export const SHOT_TRIES = 3; // shots on each hole; the best on each counts
export const SHOT_ALL = SHOT_HOLES * SHOT_TRIES;
export const LOST_FT = 150; // a ball in the water or lost: what it adds to the day's total
const FIRST = '2026-10-28'; // Daily Shot #1, as before

export type DailyHole = { n: number; world: DailyWorld; spec: HoleSpec; hole: Hole; from: V2; wind: Conditions; yards: number; label: string };
export type DailyHoles = { day: string; number: number; holes: DailyHole[] };

export const isShotDay = (day: string) => day >= SHOT_FROM;
const dayNumber = (day: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${FIRST}T12:00:00Z`)) / 86_400_000) + 1;

// The three steps of difficulty, all on an iron (Robbie, Nov 20: the wood made holes 2 and 3 too hard). Hole by hole:
// longer within the iron's reach, a smaller green, more trouble round it, a tougher pin and more wind. Greens are flat:
// a sloped green here is a rise beside it, which caught shots like a backstop and made the holes easier.
// Tuned with scripts/check-holes.ts (npm run check-holes -- daily).
const STEPS = [
  { yards: [100, 108], green: 'large', bunkers: 1, carry: false, pin: 'middle', tilt: 0, wind: 1 },
  { yards: [112, 120], green: 'medium', bunkers: 2, carry: false, pin: 'edge', tilt: 0, wind: 1.3 },
  { yards: [124, 132], green: 'small', bunkers: 2, carry: true, pin: 'tucked', tilt: 0, wind: 1.6 },
] as const;

// From Sunday Nov 22 (Robbie: holes 2 and 3 a bit longer, a wood in play, still fun to get close): hole 2 is a full
// iron that runs on or a soft wood, hole 3 a wood. Big flat greens with open fronts and fairway right up to them so a
// low shot can run out; bunkers only at the sides, no carry over water. Days before keep the old steps exactly.
export const STEPS_FROM = '2026-11-22';
const LONG_STEPS = [
  STEPS[0],
  { yards: [135, 148], green: 'large', bunkers: 1, carry: false, pin: 'edge', tilt: 0, wind: 1.2 },
  { yards: [165, 185], green: 'large', bunkers: 2, carry: false, pin: 'edge', tilt: 0, wind: 1.3 },
] as const;
// From Monday Nov 23 (Robbie: Nov 22 played far too hard, everyone's medians 45 to 50 ft on holes 2 and 3; holes 1 and
// 2 irons, 3 a wood, less wind, somewhere in the middle): hole 2 back inside a full iron (132 yd), so a spun iron can
// reach the green and bite; hole 3 an easy wood. Wind no longer multiplied up, and capped hole by hole (mph), because
// some looks already blow 11 to 17 on their own. The open fronts and side bunkers of the long steps stay.
export const MID_FROM = '2026-11-23';
const MID_STEPS = [
  { yards: [100, 108], green: 'large', bunkers: 1, carry: false, pin: 'middle', tilt: 0, wind: 1, cap: 9 },
  { yards: [106, 114], green: 'large', bunkers: 1, carry: false, pin: 'side', tilt: 0, wind: 1, cap: 11 },
  { yards: [144, 154], green: 'large', bunkers: 2, carry: false, pin: 'side', tilt: 0, wind: 1, cap: 13 },
] as const;
const stepsFor = (day: string) => (day >= MID_FROM ? MID_STEPS : day >= STEPS_FROM ? LONG_STEPS : STEPS);

const NAMES = ['The Leap', 'Long Shadow', 'The Lantern', 'Last Light', 'The Steps', 'The Spire', 'Far Flag', 'The Gate', 'Hollow Point', 'The Edge', 'Skyfall', 'The Basin', 'Whisper', 'The Drop', 'High Wire', 'The Crown'];

function spec(day: string, i: number): HoleSpec {
  const rng = makeRng(`dailyhole:${day}:${i}`);
  const r = () => rng.next();
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const s = stepsFor(day)[i];
  const long = day >= STEPS_FROM;
  const yards = Math.round(s.yards[0] + r() * (s.yards[1] - s.yards[0]));
  const side = r() < 0.5 ? -1 : 1;
  const bunkers: HoleSpec['bunkers'] = [];
  for (let b = 0; b < s.bunkers; b++)
    bunkers.push(
      long
        ? { along: 0.97 + r() * 0.06, across: (b % 2 ? -side : side) * (1.45 + r() * 0.25), size: pick(['small', 'medium'] as const), kind: 'greenside' }
        : { along: 0.94 + r() * 0.08, across: (b % 2 ? -side : side) * (1.2 + r() * 0.3), size: pick(['small', 'medium'] as const), kind: 'greenside' },
    );
  const water: HoleSpec['water'] = [];
  // water short of the green on the last: all carry
  if (s.carry) water.push({ kind: 'creek', along: 0.68 + r() * 0.08, across: 0, size: 'medium', side: 'right' });
  // the long third: sometimes a pond off to one side, never across the front
  if (long && i === 2 && r() < 0.5) water.push({ kind: 'pond', along: 0.55 + r() * 0.2, across: -side * (2.4 + r() * 0.4), size: 'small', side: side > 0 ? 'left' : 'right' });
  return {
    kind: 'hole',
    name: pick(NAMES),
    look: 'highlands',
    par: 3,
    yards,
    shape: 'straight',
    bend_at: 0.5,
    bend: 10,
    elevation: pick(i === 0 ? (['flat', 'downhill'] as const) : (['flat', 'downhill', 'uphill', 'tee-high'] as const)),
    fairway: long && i > 0 ? { width: 'wide', from: 0.6, to: 1 } : { width: 'medium', from: 0.8, to: 0.97 },
    green: { size: s.green, slope: 'flat', tiered: false, raised: false, across: (r() - 0.5) * 0.4 },
    bunkers,
    water,
    trees: [
      { along: 0.4 + r() * 0.3, across: -side * (2.4 + r()), count: 3 + Math.floor(r() * 4), spread: 'loose' },
      { along: 0.7 + r() * 0.3, across: side * (2.6 + r()), count: 2 + Math.floor(r() * 3), spread: 'tight' },
    ],
    mounds: [],
    review: '',
    hint: '',
  };
}

// today's three worlds: different every day, never the same twice in a day
function worldsFor(day: string): DailyWorld[] {
  const rng = makeRng(`dailyworlds:${day}`);
  const pool = [...WORLD_PRESETS];
  const out: DailyWorld[] = [];
  while (out.length < SHOT_HOLES) out.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  return out;
}

// Real turf (Robbie, Nov 21: pink or purple greens look silly): the Daily Shot keeps each world's sky, light, water,
// trees, landmarks and what lies beyond, but a fairway, green or rough that isn't a grass colour is cut as real grass.
// Members' own courses keep whatever colours they dreamed up.
const hsl = (c: string) => {
  const n = parseInt(c.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s: sat, l };
};
const grassy = (c: string) => {
  const { h, s, l } = hsl(c);
  return h >= 70 && h <= 150 && s >= 0.2 && s <= 0.75 && l >= 0.25 && l <= 0.68;
};
const TURF: Record<World['light'], { fairway: string; green: string }> = {
  day: { fairway: '#62ae52', green: '#6fc062' },
  golden: { fairway: '#6aa84c', green: '#78bb58' },
  overcast: { fairway: '#5a9e4c', green: '#66b058' },
  dusk: { fairway: '#5a9a48', green: '#68ae56' },
  night: { fairway: '#5a9a50', green: '#6aae60' },
};
export function realTurf(w: World): World {
  const g = w.ground;
  const turf = !grassy(g.fairway) || !grassy(g.green) ? TURF[w.light] : null;
  // a pink or purple rough round a real green still reads as candy: it's grass too (the world beyond stays its own)
  // (snow, red rock, desert sand and autumn browns are real ground and stay; pinks, purples and blues go)
  const rh = hsl(g.rough);
  const candy = (rh.h >= 165 && rh.h <= 345 && rh.s > 0.25 && rh.l < 0.85) || ((rh.h < 30 || rh.h > 345) && rh.s > 0.5 && rh.l > 0.6); // or coral
  const rough = candy ? (w.light === 'night' ? '#3f6e3a' : '#4a7a3c') : null;
  if (!turf && !rough) return w;
  return { ...w, ground: { ...g, ...turf, ...(rough ? { rough } : {}) } };
}

const cache = new Map<string, DailyHoles>();

export function dailyHoles(day: string): DailyHoles {
  const hit = cache.get(day);
  if (hit) return hit;
  const worlds = worldsFor(day);
  const holes = worlds.map((w, i) => {
    const s = spec(day, i);
    const hole = buildHole(s, `daily-${day}-${i + 1}`, 'CCC', realTurf(w.world), w.world.landmarks).hole;
    const step = stepsFor(day)[i];
    const gc = (hole.pins ?? [hole.cup])[0]; // the middle of the green
    const greenPoly = hole.regions.find((g) => g.surface === 'green')?.poly ?? [];
    const R = Math.max(10, ...greenPoly.map((q) => Math.hypot(q.x - gc.x, q.y - gc.y)));
    // more tilt: a rise on the high side of the green, as the builder's own slope, only stronger
    if (step.tilt && s.green.slope !== 'flat') {
      const len = Math.hypot(gc.x - hole.tee.x, gc.y - hole.tee.y) || 1;
      const fwd = { x: (gc.x - hole.tee.x) / len, y: (gc.y - hole.tee.y) / len };
      const right = { x: fwd.y, y: -fwd.x };
      const t = s.green.slope === 'back-to-front' ? fwd : s.green.slope === 'front-to-back' ? { x: -fwd.x, y: -fwd.y } : s.green.slope === 'left-to-right' ? { x: -right.x, y: -right.y } : right;
      hole.terrain.push({ kind: 'hill', x: gc.x + t.x * R * 1.05, y: gc.y + t.y * R * 1.05, r: R * 1.7, h: step.tilt });
    }
    // the pin: the middle on the first; near the edge on the second; tucked by the trouble on the third
    const prng = makeRng(`dailypin:${day}:${i}`);
    const spots = Array.from({ length: 16 }, (_, k) => (k / 16) * Math.PI * 2 + prng.next() * 0.1)
      .map((a) => ({ x: gc.x + Math.cos(a) * R * 0.58, y: gc.y + Math.sin(a) * R * 0.58 }))
      .filter((q) => surfaceAt(hole, q) === 'green' && Math.hypot(q.x - gc.x, q.y - gc.y) < R - 6);
    const trouble = (q: V2) =>
      Math.min(
        ...hole.regions.filter((g) => g.surface === 'sand').flatMap((g) => g.poly.map((v) => Math.hypot(v.x - q.x, v.y - q.y))),
        ...hole.water.flatMap((wt) => wt.poly.map((v) => Math.hypot(v.x - q.x, v.y - q.y))),
        999,
      );
    // side (from Nov 23): an edge pin to the left or right of the middle, not the front or back, so the hole plays the
    // length it's set to (a front or back pin moved hole 2 by 15 yd either way, past a full iron some days)
    const len0 = Math.hypot(gc.x - hole.tee.x, gc.y - hole.tee.y) || 1;
    const along = (q: V2) => Math.abs(((q.x - gc.x) * (gc.x - hole.tee.x) + (q.y - gc.y) * (gc.y - hole.tee.y)) / len0);
    const sides = spots.filter((q) => along(q) < R * 0.22);
    const pin =
      step.pin === 'middle' || !spots.length
        ? gc
        : step.pin === 'side' && sides.length
          ? sides[Math.floor(prng.next() * sides.length)]
          : step.pin === 'edge' || step.pin === 'side'
          ? spots[Math.floor(prng.next() * spots.length)]
          : spots.reduce((b, q) => (trouble(q) < trouble(b) ? q : b), spots[0]);
    // greens that take spin (from Nov 23, Robbie: backspin barely did anything here): spin does half again as much, so a
    // full backspin iron checks and zips back, as on the Windy City's greens (1.35), a touch more
    const h: Hole = { ...hole, cup: pin, pins: [pin], name: s.name, ...(day >= MID_FROM ? { greenSpin: 1.5 } : {}) };
    const base = conditionsFor(h, day);
    // the step's multiplier, then its cap (from Nov 23), keeping the direction
    const raw = base.mph * step.wind;
    const cap = 'cap' in step ? step.cap : Infinity;
    const k = step.wind * (raw > cap ? cap / raw : 1);
    const wind = { ...base, pin, mph: Math.round(base.mph * k), accel: { x: base.accel.x * k, y: base.accel.y * k } };
    const yards = Math.round((Math.hypot(h.tee.x - pin.x, h.tee.y - pin.y) * SCALE) / 3);
    return { n: i + 1, world: w, spec: s, hole: h, from: h.tee, wind, yards, label: `${yards} yd` };
  });
  const out = { day, number: dayNumber(day), holes };
  cache.set(day, out);
  return out;
}

// a try's feet toward the day's total: holed 0, lost 150, else its distance
export const tryFt = (t: { ft: number | null; holed: boolean; lost: boolean }) => (t.holed ? 0 : t.lost || t.ft === null ? LOST_FT : t.ft);
type Try = { hole?: number; ft: number | null; holed: boolean; lost: boolean };
// the best shot on a hole (null: not played yet)
export const bestOn = (tries: Try[], hole: number) => {
  const xs = tries.filter((t) => (t.hole ?? 1) === hole).map(tryFt);
  return xs.length ? Math.min(...xs) : null;
};
// the day's total so far: the best on each hole played, added
export const totalFt = (tries: Try[]) => Math.round([1, 2, 3].reduce((a, h) => a + (bestOn(tries, h) ?? 0), 0) * 10) / 10;
export const ftLabel = (ft: number) => `${ft < 10 ? ft.toFixed(1) : Math.round(ft)} ft`;
// a hole's best at a glance: ⛳ ace, 🔥 really close (5 ft or less), 🎯 close (15), 👍 mid (30), 😬 far, 💧 every ball wet
export const holeEmoji = (best: number) => (best === 0 ? '⛳' : best >= LOST_FT ? '💧' : best <= 5 ? '🔥' : best <= 15 ? '🎯' : best <= 30 ? '👍' : '😬');
export const holeMark = (best: number | null) => (best === null ? '–' : `${holeEmoji(best)} ${best === 0 ? 'Ace' : best >= LOST_FT ? 'Wet' : ftLabel(best)}`);
