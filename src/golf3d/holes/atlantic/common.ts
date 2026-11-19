// The Atlantic Links: what its holes share. Firm, running fairways, wiry fescue rough that grabs a landing ball
// and takes a little off the next swing, and small deep pots of heavy sand.
import type { Hole, Post } from '../../types';
import { bunker } from '../woods';

export const LINKS_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.4, roughDrag: 1.25, roughLie: 0.86, roughScatter: 0.18, fairwayRoll: 0.85, sandLie: 0.75, sandScatter: 0.3 };

// a pot bunker: small, round and deep
export const pot = (x: number, y: number, r: number, seed: number) => bunker(x, y, r, r * 0.88, seed, 3.4, seed * 0.7);

// gorse in flower: low and soft, a ball goes through it knocked about
export const gorse = (at: [number, number][]): Post[] => at.map(([x, y], i) => ({ x, y, r: 2.2 + (i % 3) * 0.4, h: 3, soft: true, look: 'gorse' as const }));

// dunes: humps of rough either side of a hole
export const dunes = (at: [number, number, number, number][]) => at.map(([x, y, r, h]) => ({ kind: 'hill' as const, x, y, r, h }));

// A green's tilt, set by its angle: dir is the way it falls (any length), deg how steeply the whole green tilts along
// it. Nov 19, the Greenkeeper: built under 1 degree, these read flat; members one-putted the Windy City's 1.5 to 2.5
// degree greens (1.19 putts a hole), so every Atlantic green tilts 1.5 degrees. Size, collars and humps as built.
export const slope = (g: { rx: number; ry: number }, edge: number, dir: [number, number], deg = 1.5): [number, number] => {
  const box = 2 * (Math.max(g.rx, g.ry) + 6 + edge);
  const k = (box * Math.tan((deg * Math.PI) / 180)) / (Math.hypot(dir[0], dir[1]) || 1);
  return [dir[0] * k, dir[1] * k];
};
