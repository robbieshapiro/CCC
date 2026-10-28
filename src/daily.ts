// The Daily Shot: one shot a day, the same for every member of every club. Seeded by the date: a hole from the
// Caldera, a pin, the wind, and a spot to play from (the tee on a par 3, a fairway approach on the others).
// Three tries; the best counts. Closest to the pin wins, holed beats everything.
import { conditionsFor, type Conditions } from './golf3d/conditions';
import { SCALE } from './golf3d/clubs';
import { courseById } from './golf3d/courses';
import { gradAt, isWater, surfaceAt } from './golf3d/terrain';
import type { Hole, V2 } from './golf3d/types';
import { makeRng } from './seed';

export const DAILY_TRIES = 3;
const FIRST = '2026-10-28'; // Daily Shot #1

export type DailyShot = { day: string; number: number; hole: Hole; from: V2; wind: Conditions; yards: number; label: string };

const dayNumber = (day: string) => Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${FIRST}T12:00:00Z`)) / 86_400_000) + 1;

export function dailyShot(day: string): DailyShot {
  const rng = makeRng(`daily:${day}`);
  const holes = courseById('caldera')!.holes;
  const base = holes[Math.floor(rng.next() * holes.length)];
  const pins = base.pins?.length ? base.pins : [base.cup];
  const pin = pins[Math.floor(rng.next() * pins.length)];
  const hole: Hole = { ...base, cup: pin };
  const wind = { ...conditionsFor(base, day), pin };
  let from: V2 = hole.tee;
  if (hole.par > 3) {
    // an approach: a flat, dry fairway spot 100 to 260 ft (about 75 to 190 yd) from the pin
    const spots: V2[] = [];
    for (let x = hole.bounds.x0; x <= hole.bounds.x1; x += 6)
      for (let y = hole.bounds.y0; y <= hole.bounds.y1; y += 6) {
        const d = Math.hypot(x - pin.x, y - pin.y);
        if (d < 100 || d > 260) continue;
        const p = { x, y };
        if (surfaceAt(hole, p) !== 'fairway' || isWater(hole, p)) continue;
        const g = gradAt(hole, x, y);
        if (Math.hypot(g.x, g.y) > 0.12) continue;
        spots.push(p);
      }
    if (spots.length) from = spots[Math.floor(rng.next() * spots.length)];
  }
  const yards = Math.round((Math.hypot(from.x - pin.x, from.y - pin.y) * SCALE) / 3);
  return { day, number: dayNumber(day), hole, from, wind, yards, label: `${hole.name} · ${yards} yd` };
}

// one emoji per try, for the share text
export const tryMark = (t: { ft: number | null; holed: boolean; lost: boolean }) => (t.holed ? '⛳' : t.lost || t.ft === null ? '💧' : t.ft <= 10 ? '🎯' : t.ft <= 30 ? '🟢' : '⚪');

export const resultLabel = (t: { ft: number | null; holed: boolean; lost: boolean } | null) =>
  !t ? '–' : t.holed ? 'Holed!' : t.lost || t.ft === null ? 'No score' : `${t.ft < 10 ? t.ft.toFixed(1) : Math.round(t.ft)} ft`;

// best of a set of tries: holed first, then nearest; lost balls don't count
export function bestTry<T extends { ft: number | null; holed: boolean; lost: boolean }>(tries: T[]): T | null {
  const ok = tries.filter((t) => t.holed || (!t.lost && t.ft !== null));
  return ok.sort((a, b) => Number(b.holed) - Number(a.holed) || (a.ft ?? 0) - (b.ft ?? 0))[0] ?? null;
}
