// Hole 3, The Caldera (par 5, about 800 ft round the corner): a long dogleg right round a lake of lava.
// The safe way: a drive up the first leg to the corner, the longest second you've got along the second leg, then a
// short iron on. On in three.
// The gamble: a little island of turf out in the lava, inside the dogleg, about 300 ft from the tee. Land a drive on it
// and hold it, and the green is about 320 ft away across the lava: on in two. The corner is too wide to cut. A stock drive skips off the far side into the lava; it
// takes a near-pure strike with backspin to stop it.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const FLOOR = 10; // the turf and rock sit at about this height; the lava lake is cut below it
const LAVA = 7;
const ISLAND = { x: 236, y: 190, rx: 17, ry: 14 };
const GREEN = { x: 480, y: 398, r: 22 };

// the two legs of the dogleg, as one fairway line
const way: V2[] = [
  { x: 0, y: 14 },
  { x: 2, y: 200 },
  { x: 0, y: 300 },
  { x: 2, y: 350 },
  { x: 30, y: 392 },
  { x: 120, y: 402 },
  { x: 250, y: 400 },
  { x: 380, y: 396 },
  { x: 444, y: 396 },
];

const rocks: Post[] = [
  [-60, 40, 3.4], [-66, 220, 3], [-50, 470, 3.8], [60, 484, 3.2], [530, 354, 3.6], [540, 496, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

const palms: Post[] = [60, 140, 220, 300, 380].map((y, i) => ({ x: -74 + (i % 2) * 10, y, r: 1, h: 22, look: 'palm' as const }));

export const caldera: Hole = {
  id: 'caldera',
  name: 'The Caldera',
  par: 5,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 482, y: 402 },
  pins: [{ x: 482, y: 402 }, { x: 470, y: 390 }, { x: 492, y: 408 }, { x: 476, y: 410 }],
  aim: 0,
  bounds: { x0: -100, y0: -40, x1: 570, y1: 520 },
  border: [
    { x: -96, y: -36 },
    { x: 566, y: -36 },
    { x: 566, y: 516 },
    { x: -96, y: 516 },
  ],
  base: 'rough',
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
    { poly: blob(452, 380, 7, 5, 6, 0.15), surface: 'sand' },
    { poly: blob(18, 406, 9, 6, 7, 0.15), surface: 'sand' },
  ],
  water: [
    // the lake of lava inside the dogleg
    { poly: rect(40, 20, 440, 366), level: LAVA, look: 'lava', tide: { amp: 0.5, period: 11 } },
    // lava runs along the far side of the second leg, so the corner can't be cut over the top
    { poly: rect(-96, 450, 430, 516), level: LAVA, look: 'lava' },
    // a pool behind the green
    { poly: rect(436, 434, 534, 482), level: LAVA, look: 'lava' },
  ],
  terrain: [
    { kind: 'ramp', x0: -100, y0: -40, x1: 570, y1: 520, axis: 'y', h0: FLOOR, h1: FLOOR + 2, op: 'set' },
    // the volcano's slopes rise round the outside of the dogleg
    { kind: 'hill', x: -200, y: 250, r: 180, h: 40 },
    { kind: 'hill', x: 240, y: 620, r: 220, h: 46 },
    // the lake inside the corner
    { kind: 'box', x0: 44, y0: 24, x1: 436, y1: 362, h: -7, edge: 14, op: 'add' },
    { kind: 'box', x0: 440, y0: 438, x1: 530, y1: 478, h: -6, edge: 8, op: 'add' },
    { kind: 'box', x0: -100, y0: 454, x1: 426, y1: 520, h: -7, edge: 10, op: 'add' },
    // the island: a low shelf of rock with turf on top, sides that drop straight into the lava
    { kind: 'disc', x: ISLAND.x, y: ISLAND.y, r: ISLAND.rx + 5, h: FLOOR, edge: 4, op: 'set' },
    // rolls in the fairway
    { kind: 'hill', x: 14, y: 240, r: 30, h: 1.2 },
    { kind: 'hill', x: 200, y: 414, r: 26, h: 1 },
    // the green: two tiers, the back one higher, tipped toward the lava behind
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 10, h: FLOOR + 2.4, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 2, x1: GREEN.x + 32, y1: GREEN.y + 6, axis: 'y', h0: 0, h1: 0.9, op: 'add' },
    { kind: 'box', x0: GREEN.x - 32, y0: GREEN.y + 6, x1: GREEN.x + 32, y1: GREEN.y + 32, h: 0.9, edge: 0.5, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 32, x1: GREEN.x + 32, y1: GREEN.y + 32, axis: 'x', h0: 0.4, h1: -0.4, op: 'add' },
    // bunkers
    ...[[452, 380, 7], [18, 406, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [],
  zones: [{ id: 'rimroad', poly: blob(ISLAND.x, ISLAND.y, ISLAND.rx + 2, ISLAND.ry + 2, 2, 0.1) }],
  secret: {
    name: 'Island Hopper',
    zone: 'rimroad',
    hint: "There's an island in the lava inside the dogleg. Hit it, hold it, and you're on in two. It takes backspin.",
  },
  flyover: [
    { x: 0, y: -30 },
    { x: 80, y: 220 },
    { x: 300, y: 384 },
    { x: 482, y: 402 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
    { kind: 'lavafount', x: 150, y: 110, scale: 1 },
    { kind: 'lavafount', x: 340, y: 230, scale: 1.2 },
    { kind: 'lavafount', x: 110, y: 250, scale: 0.8 },
  ],
};
