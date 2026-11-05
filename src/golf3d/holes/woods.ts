// The Western Reserve's woods and turf.
// Woods along a line: maples (and the odd pine) every `every` ft, staggered a few feet either side so it reads as a
// wood rather than a row, from young 16 ft trees to old 46 ft giants, their crowns as wide as they are tall makes
// them. `rows` adds more rows behind the first, each `depth` ft further out on the `out` side (+1 is to the left of the
// line's direction of travel, -1 to the right). They're soft (Post.soft): a ball usually flies on through the leaves,
// slowed and knocked off line, sometimes gets caught and drops, and only the trunk is solid.
import { makeRng } from '../../seed';
import type { Hole, Post, V2 } from '../types';

// thick, long autumn rough that grabs a landing ball and smothers the next swing, firm fairways that run, and heavy
// wet bunker sand that a wedge only gets 70% out of (an iron about half) and that can send it anywhere
export const RESERVE_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.15, roughDrag: 1.9, roughLie: 0.72, roughScatter: 0.28, fairwayRoll: 0.6, sandLie: 0.7, sandScatter: 0.35 };

// a maple's crown is about this wide (radius) for its height: what the ball has to get through
const crown = (h: number) => Math.max(4, Math.round(h * 0.26 * 10) / 10);

// a single tree standing in play
export const tree = (x: number, y: number, r = 5, h = 30): Post => ({ x, y, r, h, soft: true, look: 'maple' });

export function treeLine(pts: V2[], every: number, seed: string, stagger = 6, rows = 1, out: 1 | -1 = 1, depth = 14): Post[] {
  const rng = makeRng(`woods:${seed}`);
  const res: Post[] = [];
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const nx = -(b.y - a.y) / (len || 1);
      const ny = (b.x - a.x) / (len || 1);
      // rows behind the first sit half a gap along, so the wood has no lanes through it
      for (let d = (i ? every / 2 : 0) + (row % 2 ? every / 2 : 0); d < len; d += every) {
        const t = d / len;
        const off = (res.length % 2 ? 1 : -1) * stagger * (0.5 + rng.next() * 0.5) + out * row * depth;
        const h = Math.round(16 + rng.next() ** 0.8 * 30);
        res.push({
          x: Math.round(a.x + (b.x - a.x) * t + nx * off),
          y: Math.round(a.y + (b.y - a.y) * t + ny * off),
          r: crown(h),
          h,
          soft: true,
          look: rng.next() < 0.1 ? 'pine' : 'maple',
        });
      }
    }
  return res;
}
