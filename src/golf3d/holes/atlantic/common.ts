// The Atlantic Links: what its holes share. Firm, running fairways, wiry fescue rough that grabs a landing ball
// and takes a little off the next swing, and small deep pots of heavy sand.
import { band } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { bunker } from '../woods';

export const LINKS_TURF: NonNullable<Hole['turf']> = { roughKeep: 0.4, roughDrag: 1.25, roughLie: 0.86, roughScatter: 0.18, fairwayRoll: 0.85, sandLie: 0.75, sandScatter: 0.3 };

// a pot bunker: small, round and deep
export const pot = (x: number, y: number, r: number, seed: number) => bunker(x, y, r, r * 0.88, seed, 3.4, seed * 0.7);

// gorse in flower: low and soft, a ball goes through it knocked about
export const gorse = (at: [number, number][]): Post[] => at.map(([x, y], i) => ({ x, y, r: 2.2 + (i % 3) * 0.4, h: 3, soft: true, look: 'gorse' as const }));

// A stone bridge over a river (Nov 22): a deck of stone set just above the water, so a ball runs across it dry, low
// parapet walls either side that a ball kicks off, and a stone arch under it for the look. a to b: across the river.
// half: half the deck's width. deck: the height of its surface. bed: for a bridge over a sea gorge, the height of
// the sea bed below it; the causeway then stands on tight stone sides, with tall arched faces down into the sea.
export function stoneBridge(a: V2, b: V2, half: number, deck: number, bed?: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const u = { x: dx / len, y: dy / len };
  const n = { x: -u.y, y: u.x };
  const off = (p: V2, k: number, s: number) => ({ x: p.x + u.x * k + n.x * s, y: p.y + u.y * k + n.y * s });
  const side = (s: number) => ({ a: off(a, -2, s), b: off(b, 2, s), h: 2.6, look: 'stone' as const });
  return {
    region: { poly: band([off(a, -3, 0), off(b, 3, 0)], half), surface: 'stone' as const },
    piece: { kind: 'embankment' as const, pts: [off(a, -7, 0), off(b, 7, 0)], h: [deck, deck], width: half + 1, edge: bed === undefined ? 4 : 1.5 },
    walls: [side(half + 0.9), side(-half - 0.9)],
    decor: {
      kind: bed === undefined ? 'bridgearch' : 'causeway',
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      rot: Math.atan2(u.y, u.x),
      scale: len,
      size: [len, half, bed === undefined ? deck : deck - bed] as [number, number, number],
    },
  };
}

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
