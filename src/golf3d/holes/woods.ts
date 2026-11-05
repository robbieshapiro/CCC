// A line of autumn maples along a path: one every `every` ft, staggered a few feet either side so it reads as a wood
// rather than a row, with the odd pine. They stop what they catch (low bounce), so a ball into the trees stays there.
import { makeRng } from '../../seed';
import type { Post, V2 } from '../types';

export function treeLine(pts: V2[], every: number, seed: string, stagger = 6): Post[] {
  const rng = makeRng(`woods:${seed}`);
  const out: Post[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / (len || 1);
    const ny = (b.x - a.x) / (len || 1);
    for (let d = i ? every / 2 : 0; d < len; d += every) {
      const t = d / len;
      const off = (out.length % 2 ? 1 : -1) * stagger * (0.5 + rng.next() * 0.5);
      out.push({
        x: Math.round(a.x + (b.x - a.x) * t + nx * off),
        y: Math.round(a.y + (b.y - a.y) * t + ny * off),
        r: 4,
        h: 24 + Math.round(rng.next() * 6),
        e: 0.25,
        look: rng.next() < 0.12 ? 'pine' : 'maple',
      });
    }
  }
  return out;
}
