import type { Hole, Piece, Surface, V2 } from './types';

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
    case 'channel': {
      let d = Infinity;
      for (let i = 0; i < p.pts.length - 1; i++) d = Math.min(d, segDist({ x, y }, p.pts[i], p.pts[i + 1]));
      if (d >= p.width) return [0, 0];
      const k = d / p.width;
      return [-p.depth * (1 - k * k), 1];
    }
  }
}

export function heightAt(h: Hole, x: number, y: number): number {
  let z = 0;
  for (const p of h.terrain) {
    const [v, w] = piece(p, x, y);
    if (!w) continue;
    if (p.kind !== 'tilt' && p.kind !== 'channel' && p.op === 'set') z += (v - z) * w;
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

// The lake surface: the ground as it was before the beds were dug out, a little below the banks.
const levels = new WeakMap<Hole, Hole>();
export function waterLevel(h: Hole, x: number, y: number): number {
  let level = levels.get(h);
  if (!level) levels.set(h, (level = { ...h, terrain: h.terrain.filter((p) => !(p.kind === 'box' && p.op === 'add' && p.h < 0)) }));
  return heightAt(level, x, y) - 0.7;
}

// Wet means under the surface you can see: islands, banks and bridges are dry by their height, not by a list.
export function isWater(h: Hole, p: V2): boolean {
  return h.water.some((w) => inPoly(p, w)) && heightAt(h, p.x, p.y) < waterLevel(h, p.x, p.y) - 0.25;
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
