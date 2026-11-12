// The Committee's dials on a course's holes (course_tweaks): small changes saved in the club, applied as the course
// loads, so they reach every member with no deploy. Each hole can have:
//   tee:     yards the tee moves back (+) or forward (-), along the line the hole is aimed down
//   fairway: feet every fairway on the hole grows (+) or shrinks (-) at its edges
//   pins:    which of the hole's pin spots stay in the daily rotation (indices into hole.pins)
//   wind:    the most the wind can blow on it, in mph (gusts included)
//   time:    hold the hole at day or night, where its look has a night version
// The holes as built are untouched: no dial, no change. The dials don't move greens, so the greens sweep still holds.
import { SCALE } from './clubs';
import { inPoly, isWater, surfaceAt } from './terrain';
import type { Hole, V2 } from './types';

export type Tweak = { tee?: number; fairway?: number; pins?: number[]; wind?: number; time?: 'day' | 'night' };
export type Tweaks = Record<string, Record<string, Tweak>>; // course id -> hole number (1-based) -> its dials

export const TEE_MAX = 30; // yards either way
export const FAIRWAY_STEPS: [number, string][] = [[-4, 'Narrower'], [0, 'As built'], [6, 'Wider'], [12, 'Much wider']];
export const WIND_STEPS: [number | null, string][] = [[null, 'As built'], [15, 'Up to 15'], [10, 'Up to 10'], [5, 'Up to 5'], [0, 'Calm']];

const ft = (yd: number) => (yd * 3) / SCALE;

// a polygon grown (d > 0) or shrunk (d < 0) at its edges by d feet
export function offsetPoly(poly: V2[], d: number): V2[] {
  if (!d || poly.length < 3) return poly;
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    area += a.x * b.y - b.x * a.y;
  }
  const out = area > 0 ? 1 : -1; // counter-clockwise: the outside is to the right of each edge
  const n = poly.length;
  const normal = (a: V2, b: V2) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (out * (b.y - a.y)) / len, y: (out * -(b.x - a.x)) / len };
  };
  return poly.map((p, i) => {
    const n1 = normal(poly[(i - 1 + n) % n], p);
    const n2 = normal(p, poly[(i + 1) % n]);
    const m = { x: n1.x + n2.x, y: n1.y + n2.y };
    const ml = Math.hypot(m.x, m.y);
    if (ml < 1e-6) return { x: p.x + n1.x * d, y: p.y + n1.y * d };
    // how far along the bisector keeps the edges d apart, held back at sharp corners
    const k = Math.min(2, 2 / ml);
    return { x: p.x + (m.x / ml) * d * k, y: p.y + (m.y / ml) * d * k };
  });
}

// where the tee would be with this many yards back (+) or forward (-)
export function teeAt(h: Hole, yd: number): V2 {
  const dir = { x: Math.sin(h.aim), y: Math.cos(h.aim) };
  return { x: h.tee.x - dir.x * ft(yd), y: h.tee.y - dir.y * ft(yd) };
}

// a tee spot a ball can be hit from: on the property, dry, not in sand
export const teeOk = (h: Hole, p: V2) => inPoly(p, h.border) && !isWater(h, p) && surfaceAt(h, p) !== 'sand';

export function applyTweak(h: Hole, t: Tweak | undefined): Hole {
  if (!t) return h;
  let out: Hole = { ...h };
  if (t.tee) {
    const tee = teeAt(h, t.tee);
    if (teeOk(h, tee)) {
      const dx = tee.x - h.tee.x;
      const dy = tee.y - h.tee.y;
      const nearTee = (p: { x: number; y: number }) => Math.hypot(p.x - h.tee.x, p.y - h.tee.y) < 30;
      out = {
        ...out,
        tee,
        // the tee box and its furniture come too
        decor: h.decor.map((d) => (nearTee(d) ? { ...d, x: d.x + dx, y: d.y + dy } : d)),
        flyover: h.flyover.map((p, i) => (i === 0 ? tee : p)),
        ...(h.yards ? { yards: h.yards + Math.round(t.tee) } : {}),
      };
    }
  }
  if (t.fairway) out = { ...out, regions: out.regions.map((r) => (r.surface === 'fairway' ? { ...r, poly: offsetPoly(r.poly, t.fairway!) } : r)) };
  if (t.pins?.length && h.pins?.length) {
    const keep = t.pins.filter((i) => i >= 0 && i < h.pins!.length);
    if (keep.length) out = { ...out, pinsOn: keep };
  }
  if (t.wind != null) out = { ...out, windCap: Math.max(0, t.wind) };
  if (t.time) out = { ...out, time: t.time };
  return out;
}

export const hasTweak = (t: Tweak | undefined) => !!t && (!!t.tee || !!t.fairway || !!t.pins?.length || t.wind != null || !!t.time);
