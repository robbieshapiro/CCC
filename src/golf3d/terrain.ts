import type { Hole, Piece, Surface, V2, Water } from './types';

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function segDist(p: V2, a: V2, b: V2) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

// value + weight for one piece at (x, y)
function piece(p: Piece, x: number, y: number): [number, number] {
  switch (p.kind) {
    case 'tilt':
      return [p.gx * x + p.gy * y, 1];
    case 'hill': {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d >= p.r) return [0, 0];
      const w = 0.5 * (1 + Math.cos((Math.PI * d) / p.r));
      return p.op === 'set' ? [p.h, w] : [p.h * w, 1];
    }
    case 'box': {
      const inside = Math.min(x - p.x0, p.x1 - x, y - p.y0, p.y1 - y);
      const w = smooth(inside / p.edge);
      return p.op === 'set' ? [p.h, w] : [p.h * w, 1];
    }
    case 'disc': {
      const w = smooth((p.r - Math.hypot(x - p.x, y - p.y)) / p.edge);
      return p.op === 'set' ? [p.h, w] : [p.h * w, 1];
    }
    case 'ramp': {
      if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return [0, 0];
      let t = p.axis === 'y' ? (y - p.y0) / (p.y1 - p.y0) : (x - p.x0) / (p.x1 - p.x0);
      if (p.steps) {
        // stairs: flat treads with short steep risers
        const s = t * p.steps;
        const i = Math.floor(s);
        t = (i + smooth((s - i - 0.8) / 0.2)) / p.steps;
      }
      const v = p.h0 + (p.h1 - p.h0) * t;
      return [v, 1];
    }
    case 'embankment': {
      let best = Infinity;
      let at = 0;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const a = p.pts[i];
        const b = p.pts[i + 1];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby || 1)));
        const d = Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t));
        if (d < best) {
          best = d;
          at = p.h[i] + (p.h[i + 1] - p.h[i]) * t;
        }
      }
      const wide = p.width + (p.wobble ? (p.wobble * (Math.sin(x * 0.071 + y * 0.023) + Math.sin(y * 0.093 - x * 0.031 + 1.3))) / 2 : 0);
      const w = smooth((wide + p.edge - best) / p.edge);
      return [at, w];
    }
    case 'channel': {
      let d = Infinity;
      let along = 0; // how far along the line the nearest point is
      let run = 0;
      for (let i = 0; i < p.pts.length - 1; i++) {
        const a = p.pts[i];
        const b = p.pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const di = segDist({ x, y }, a, b);
        if (di < d) {
          d = di;
          const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (len * len || 1)));
          along = run + t * len;
        }
        run += len;
      }
      if (d >= p.width) return [0, 0];
      const k = d / p.width;
      // a tapered groove runs out to nothing at its far end, so a ball rolls straight out of it
      const fade = p.taper ? Math.min(1, (run - along) / p.taper) : 1;
      return [-p.depth * (1 - k * k) * fade, 1];
    }
  }
}

export function heightAt(h: Hole, x: number, y: number): number {
  let z = 0;
  for (const p of h.terrain) {
    const [v, w] = piece(p, x, y);
    if (!w) continue;
    if (p.kind === 'embankment' || (p.kind !== 'tilt' && p.kind !== 'channel' && p.op === 'set')) z += (v - z) * w;
    else z += v;
  }
  return z;
}

export function gradAt(h: Hole, x: number, y: number): V2 {
  const e = 0.15;
  return { x: (heightAt(h, x + e, y) - heightAt(h, x - e, y)) / (2 * e), y: (heightAt(h, x, y + e) - heightAt(h, x, y - e)) / (2 * e) };
}

export function inPoly(p: V2, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Where a lake's surface sits at time t on the hole clock: tides come in and out, lava swells and settles.
export const levelOf = (w: Water, t = 0) => (w.tide ? w.level + w.tide.amp * Math.sin((2 * Math.PI * t) / w.tide.period) : w.level);

// Wet means under the surface you can see: islands, banks and bridges are dry by their height, not by a list.
export function isWater(h: Hole, p: V2, t = 0): boolean {
  return !!wetIn(h, p, t);
}

// The lake (or sea, or lava) a point is under, if any.
export function wetIn(h: Hole, p: V2, t = 0): Water | undefined {
  if (!h.water.length) return undefined;
  const g = heightAt(h, p.x, p.y);
  return h.water.find((w) => g < levelOf(w, t) - 0.25 && inPoly(p, w.poly));
}

export function surfaceAt(h: Hole, p: V2): Surface {
  for (let i = h.regions.length - 1; i >= 0; i--) if (inPoly(p, h.regions[i].poly)) return h.regions[i].surface;
  return h.base;
}

// shape helpers for hole files
export const rect = (x0: number, y0: number, x1: number, y1: number): V2[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];
export const circle = (cx: number, cy: number, r: number, n = 24): V2[] =>
  Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos((i / n) * Math.PI * 2) * r, y: cy + Math.sin((i / n) * Math.PI * 2) * r }));
export const band = (pts: V2[], width: number): V2[] => {
  // polygon around a polyline, for paths
  const left: V2[] = [];
  const right: V2[] = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    left.push({ x: p.x - (dy / l) * width, y: p.y + (dx / l) * width });
    right.push({ x: p.x + (dy / l) * width, y: p.y - (dx / l) * width });
  });
  return [...left, ...right.reverse()];
};
// a lumpy oval, for greens, fairways and islands that shouldn't look drawn with a compass
export const blob = (cx: number, cy: number, rx: number, ry: number, seed = 0, wobble = 0.1, n = 40): V2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wobble * (Math.sin(a * 3 + seed) * 0.6 + Math.sin(a * 5 + seed * 2.3) * 0.4);
    return { x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k };
  });
