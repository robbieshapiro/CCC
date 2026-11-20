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
import { makeRng } from './seed';

export const SHOT_FROM = '2026-11-20'; // the first day of the three-hole Daily Shot (before it: one shot, src/daily.ts)
export const SHOT_HOLES = 3;
export const LOST_FT = 150; // a ball in the water or lost: what it adds to the day's total
const FIRST = '2026-10-28'; // Daily Shot #1, as before

export type DailyHole = { n: number; world: DailyWorld; spec: HoleSpec; hole: Hole; from: V2; wind: Conditions; yards: number; label: string };
export type DailyHoles = { day: string; number: number; holes: DailyHole[] };

export const isShotDay = (day: string) => day >= SHOT_FROM;
const dayNumber = (day: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${FIRST}T12:00:00Z`)) / 86_400_000) + 1;

// The three steps of difficulty, all on an iron (Robbie, Nov 20: the wood made holes 2 and 3 too hard). Hole by hole:
// longer within the iron's reach, a smaller green, more trouble round it, more tilt, a tougher pin and more wind.
// Tuned with scripts/check-holes.ts (npm run check-holes -- daily).
const STEPS = [
  { yards: [100, 108], green: 'large', bunkers: 1, carry: false, pin: 'middle', tilt: 0, wind: 1 },
  { yards: [112, 120], green: 'medium', bunkers: 2, carry: false, pin: 'edge', tilt: 0.8, wind: 1.3 },
  { yards: [124, 132], green: 'small', bunkers: 2, carry: true, pin: 'tucked', tilt: 1.5, wind: 1.6 },
] as const;

const NAMES = ['The Leap', 'Long Shadow', 'The Lantern', 'Last Light', 'The Steps', 'The Spire', 'Far Flag', 'The Gate', 'Hollow Point', 'The Edge', 'Skyfall', 'The Basin', 'Whisper', 'The Drop', 'High Wire', 'The Crown'];

function spec(day: string, i: number): HoleSpec {
  const rng = makeRng(`dailyhole:${day}:${i}`);
  const r = () => rng.next();
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const s = STEPS[i];
  const yards = Math.round(s.yards[0] + r() * (s.yards[1] - s.yards[0]));
  const side = r() < 0.5 ? -1 : 1;
  const bunkers: HoleSpec['bunkers'] = [];
  for (let b = 0; b < s.bunkers; b++) bunkers.push({ along: 0.94 + r() * 0.08, across: (b % 2 ? -side : side) * (1.2 + r() * 0.3), size: pick(['small', 'medium'] as const), kind: 'greenside' });
  const water: HoleSpec['water'] = [];
  // water short of the green on the last: all carry
  if (s.carry) water.push({ kind: 'creek', along: 0.68 + r() * 0.08, across: 0, size: 'medium', side: 'right' });
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
    fairway: { width: 'medium', from: 0.8, to: 0.97 },
    green: { size: s.green, slope: s.tilt ? pick(['back-to-front', 'front-to-back', 'left-to-right', 'right-to-left'] as const) : 'flat', tiered: false, raised: false, across: (r() - 0.5) * 0.4 },
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

const cache = new Map<string, DailyHoles>();

export function dailyHoles(day: string): DailyHoles {
  const hit = cache.get(day);
  if (hit) return hit;
  const worlds = worldsFor(day);
  const holes = worlds.map((w, i) => {
    const s = spec(day, i);
    const hole = buildHole(s, `daily-${day}-${i + 1}`, 'CCC', w.world, w.world.landmarks).hole;
    const step = STEPS[i];
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
    const pin =
      step.pin === 'middle' || !spots.length
        ? gc
        : step.pin === 'edge'
          ? spots[Math.floor(prng.next() * spots.length)]
          : spots.reduce((b, q) => (trouble(q) < trouble(b) ? q : b), spots[0]);
    const h: Hole = { ...hole, cup: pin, pins: [pin], name: s.name };
    const base = conditionsFor(h, day);
    const k = step.wind;
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
export const totalFt = (tries: { ft: number | null; holed: boolean; lost: boolean }[]) => Math.round(tries.reduce((a, t) => a + tryFt(t), 0) * 10) / 10;
export const ftLabel = (ft: number) => `${ft < 10 ? ft.toFixed(1) : Math.round(ft)} ft`;
