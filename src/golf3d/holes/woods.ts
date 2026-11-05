// The Western Reserve's woods and turf.
// A line of autumn maples along a path: one every `every` ft, staggered a few feet either side so it reads as a wood
// rather than a row, with the odd pine. They're soft (Post.soft): a ball usually flies on through the leaves, slowed
// and knocked off line, sometimes gets caught and drops, and only the trunk is solid.
import { makeRng } from '../../seed';
import type { Hole, Post, V2 } from '../types';

// thick autumn rough that grabs a landing ball and smothers the next swing, firm fairways that run, and heavy wet
// bunker sand that a wedge only gets 70% out of (an iron about half) and that can send it anywhere
export const RESERVE_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.2, roughDrag: 1.6, roughLie: 0.78, roughScatter: 0.22, fairwayRoll: 0.6, sandLie: 0.7, sandScatter: 0.35 };

// a single tree standing in play
export const tree = (x: number, y: number, r = 5, h = 30): Post => ({ x, y, r, h, soft: true, look: 'maple' });

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
        soft: true,
        look: rng.next() < 0.12 ? 'pine' : 'maple',
      });
    }
  }
  return out;
}
