// Hole 3, The Caldera (par 5, about 640 ft round the corner): a dogleg right round a lake of lava.
// The safe way: a drive up the first leg to the corner, an iron along the second, a short iron on. On in three.
// The gamble: a little island of turf out in the lava, inside the dogleg, about 310 ft from the tee. Land a drive on it
// and hold it, and the green is a long iron away: on in two. A stock drive skips off the far side into the lava; it
// takes a near-pure strike with backspin to stop it.
// The live hazard: a steam vent beside the green goes off on the hole clock and throws a rolling ball about.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const FLOOR = 10; // the turf and rock sit at about this height; the lava lake is cut below it
const LAVA = 7;
const ISLAND = { x: 166, y: 268, rx: 17, ry: 14 };
const GREEN = { x: 282, y: 424, r: 22 };

// the two legs of the dogleg, as one fairway line
const way: V2[] = [
  { x: 0, y: 14 },
  { x: 2, y: 200 },
  { x: 0, y: 320 },
  { x: 24, y: 384 },
  { x: 90, y: 414 },
  { x: 170, y: 424 },
  { x: 240, y: 426 },
];

const vent = (id: string, x: number, y: number, period: number, phase: number, side: number) => ({
  id,
  look: 'geyser' as const,
  x,
  y,
  r: 4,
  at: () => ({ x: 0, y: 0 }),
  erupt: (t: number) => ((t + phase) % period > period - 1.4 ? { x: side * 10, y: 4, z: 16 } : null),
});

const rocks: Post[] = [
  [-60, 40, 3.4], [-66, 220, 3], [-50, 420, 3.8], [60, 480, 3.2], [340, 360, 3.6], [330, 480, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

const palms: Post[] = [-70, -40, 120, 200, 320].map((x, i) => ({ x, y: 490 + (i % 2) * 10, r: 1, h: 22, look: 'palm' as const }));

export const caldera: Hole = {
  id: 'caldera',
  name: 'The Caldera',
  par: 5,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 284, y: 428 },
  pins: [{ x: 284, y: 428 }, { x: 272, y: 416 }, { x: 294, y: 434 }, { x: 278, y: 436 }],
  aim: 0,
  bounds: { x0: -100, y0: -40, x1: 370, y1: 530 },
  border: [
    { x: -96, y: -36 },
    { x: 366, y: -36 },
    { x: 366, y: 526 },
    { x: -96, y: 526 },
  ],
  base: 'rock',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    { poly: band(way, 40), surface: 'rough' },
    { poly: band(way, 30), surface: 'fringe' },
    { poly: band(way, 26), surface: 'fairway' },
    // the island: a firm, fast patch of fairway on a rock shelf, just big enough
    { poly: blob(ISLAND.x, ISLAND.y, ISLAND.rx + 4, ISLAND.ry + 4, 2, 0.1), surface: 'rock' },
    { poly: blob(ISLAND.x, ISLAND.y, ISLAND.rx, ISLAND.ry, 2, 0.1), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 6, GREEN.r + 5, 5, 0.08), surface: 'rough' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 4, GREEN.r + 3, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r - 1, 5, 0.06), surface: 'green' },
    { poly: blob(254, 404, 7, 5, 6, 0.15), surface: 'sand' },
    { poly: blob(18, 352, 9, 6, 7, 0.15), surface: 'sand' },
  ],
  water: [
    // the lake of lava inside the dogleg
    { poly: rect(40, 20, 262, 386), level: LAVA, look: 'lava', tide: { amp: 0.5, period: 11 } },
    // a pool behind the green
    { poly: rect(250, 456, 340, 500), level: LAVA, look: 'lava' },
  ],
  terrain: [
    { kind: 'ramp', x0: -100, y0: -40, x1: 370, y1: 530, axis: 'y', h0: FLOOR, h1: FLOOR + 2, op: 'set' },
    // the volcano's slopes rise round the outside of the dogleg
    { kind: 'hill', x: -200, y: 250, r: 180, h: 40 },
    { kind: 'hill', x: 150, y: 680, r: 200, h: 46 },
    // the lake inside the corner
    { kind: 'box', x0: 44, y0: 24, x1: 258, y1: 382, h: -7, edge: 14, op: 'add' },
    { kind: 'box', x0: 254, y0: 452, x1: 344, y1: 504, h: -6, edge: 8, op: 'add' },
    // the island: a low shelf of rock with turf on top, sides that drop straight into the lava
    { kind: 'disc', x: ISLAND.x, y: ISLAND.y, r: ISLAND.rx + 5, h: FLOOR, edge: 4, op: 'set' },
    // rolls in the fairway
    { kind: 'hill', x: 14, y: 240, r: 30, h: 1.2 },
    { kind: 'hill', x: 140, y: 430, r: 26, h: 1 },
    // the green: two tiers, the back one higher, tipped toward the lava behind
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 10, h: FLOOR + 2.4, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 2, x1: GREEN.x + 32, y1: GREEN.y + 6, axis: 'y', h0: 0, h1: 0.9, op: 'add' },
    { kind: 'box', x0: GREEN.x - 32, y0: GREEN.y + 6, x1: GREEN.x + 32, y1: GREEN.y + 32, h: 0.9, edge: 0.5, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 32, x1: GREEN.x + 32, y1: GREEN.y + 32, axis: 'x', h0: 0.4, h1: -0.4, op: 'add' },
    // bunkers
    ...[[254, 404, 7], [18, 352, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [vent('vent', 308, 410, 7, 0, 1)],
  zones: [{ id: 'rimroad', poly: blob(ISLAND.x, ISLAND.y, ISLAND.rx + 2, ISLAND.ry + 2, 2, 0.1) }],
  secret: {
    name: 'Island Hopper',
    zone: 'rimroad',
    hint: "There's an island in the lava inside the dogleg. Hit it, hold it, and you're on in two. It takes backspin.",
  },
  flyover: [
    { x: 0, y: -30 },
    { x: 60, y: 200 },
    { x: 180, y: 360 },
    { x: 284, y: 428 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
    { kind: 'lavafount', x: 110, y: 150, scale: 1 },
    { kind: 'lavafount', x: 220, y: 300, scale: 1.2 },
    { kind: 'lavafount', x: 90, y: 330, scale: 0.8 },
  ],
};
