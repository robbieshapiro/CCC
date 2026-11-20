// The Daily Shot (from Nov 20, 2026): three par 3s a day, the same for every member of every club, each in a
// different world, each harder than the one before: longer, a smaller green, more trouble round it. Built from the
// date alone (no architect, no network), with the Design Desk's own builder (src/designer/hole.ts) and its worlds
// (src/designer/worlds.ts). One try on each hole; the lowest total distance from the pin wins the day, and a hole in
// one on any of them takes the Ace Pot. A new three at midnight, Eastern.
import { conditionsFor, type Conditions } from './golf3d/conditions';
import { SCALE } from './golf3d/clubs';
import type { Hole, V2 } from './golf3d/types';
import { buildHole, type HoleSpec } from './designer/hole';
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

// The three steps of difficulty: how long, how big a green, and what guards it. Tuned with scripts/check-holes.ts
// (npm run check-holes -- daily) so the day's median miss lands 20 to 30% farther than the one-shot game's.
const STEPS = [
  // (the bag has a gap between the iron, 132 yd, and the wood, 220: each hole sits where a club plays it)
  { yards: [120, 130], green: 'medium', bunkers: 1, carry: false, sideWater: false },
  { yards: [140, 152], green: 'medium', bunkers: 2, carry: false, sideWater: true },
  { yards: [180, 196], green: 'small', bunkers: 2, carry: true, sideWater: false },
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
  if (s.carry) water.push({ kind: 'creek', along: 0.55 + r() * 0.12, across: 0, size: 'medium', side: 'right' });
  if (s.sideWater) water.push({ kind: 'pond', along: 0.75 + r() * 0.1, across: side * 3.1, size: 'small', side: side < 0 ? 'left' : 'right' });
  return {
    kind: 'hole',
    name: pick(NAMES),
    look: 'highlands',
    par: 3,
    yards,
    shape: 'straight',
    bend_at: 0.5,
    bend: 10,
    elevation: pick(i === 0 ? (['flat', 'downhill', 'tee-high'] as const) : (['flat', 'downhill', 'uphill', 'tee-high', 'valley'] as const)),
    fairway: { width: 'medium', from: 0.8, to: 0.97 },
    green: { size: s.green, slope: pick(['flat', 'back-to-front', 'front-to-back', 'left-to-right', 'right-to-left'] as const), tiered: false, raised: i > 0 && r() < 0.4, across: (r() - 0.5) * 0.6 },
    bunkers,
    water,
    trees: [
      { along: 0.4 + r() * 0.3, across: -side * (2.4 + r()), count: 3 + Math.floor(r() * 4), spread: 'loose' },
      { along: 0.7 + r() * 0.3, across: side * (2.6 + r()), count: 2 + Math.floor(r() * 3), spread: 'tight' },
    ],
    mounds: [],
    review: '',
    hint: s.carry ? 'All carry. Take enough club.' : s.sideWater ? 'Water off the side of the green. Favour the other half.' : 'Big green. Go at the flag.',
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
    // the pin: one of the hole's four, by the date; the wind: that day's
    const pins = hole.pins?.length ? hole.pins : [hole.cup];
    const pin = pins[Math.floor(makeRng(`dailypin:${day}:${i}`).next() * pins.length)];
    const h: Hole = { ...hole, cup: pin, name: s.name };
    const wind = { ...conditionsFor(h, day), pin };
    const yards = Math.round((Math.hypot(h.tee.x - pin.x, h.tee.y - pin.y) * SCALE) / 3);
    return { n: i + 1, world: w, spec: s, hole: h, from: h.tee, wind, yards, label: `${w.world.name} · ${yards} yd` };
  });
  const out = { day, number: dayNumber(day), holes };
  cache.set(day, out);
  return out;
}

// a try's feet toward the day's total: holed 0, lost 150, else its distance
export const tryFt = (t: { ft: number | null; holed: boolean; lost: boolean }) => (t.holed ? 0 : t.lost || t.ft === null ? LOST_FT : t.ft);
export const totalFt = (tries: { ft: number | null; holed: boolean; lost: boolean }[]) => Math.round(tries.reduce((a, t) => a + tryFt(t), 0) * 10) / 10;
export const ftLabel = (ft: number) => `${ft < 10 ? ft.toFixed(1) : Math.round(ft)} ft`;
