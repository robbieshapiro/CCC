// The Pacific Bluffs: what its holes share.
import { makeRng } from '../../../seed';
import type { Post, V2 } from '../../types';

// A grove: trees scattered round a centre the way they grow on the bluffs, in clumps, at different heights and
// leaning their own way, never in rows. look: Torrey pines or Monterey cypress (or a mix, mostly the first).
export function grove(cx: number, cy: number, n: number, spread: number, seed: string, look: 'torrey' | 'monterey' | 'mix' = 'mix'): Post[] {
  const rng = makeRng(`grove:${seed}`);
  const out: Post[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * spread;
    const kind = look === 'mix' ? (rng.next() < 0.72 ? 'torrey' : 'monterey') : look;
    out.push({ x: Math.round(cx + Math.cos(a) * r), y: Math.round(cy + Math.sin(a) * r * 1.3), r: 2.2, h: 16 + Math.round(rng.next() * 12), look: kind });
  }
  return out;
}

// the sandstone rocks along the cliff tops
export const rocks = (at: [number, number, number][]): Post[] => at.map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

// the cliff walks and old roads: a raised strip, worn into a groove, falling gently to the green
export const descent = (pts: V2[], h: number[]) => [
  { kind: 'embankment' as const, pts, h, width: 4, edge: 4 },
  { kind: 'channel' as const, pts, width: 4.5, depth: 0.7 },
];
