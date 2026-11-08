// Hole 1, Saguaro Run (par 4, 390 yd as shown): a dogleg right down a ribbon of grass through the Arizona waste. A red
// butte fills the inside of the turn, and a dry wash cuts across the front of the green.
// The play: a drive down the left half, clear of the sand, then a mid iron over the wash to a green that tilts to the back.
// The danger: the waste sand left and right of the landing, the butte on the corner, cacti with spines, and the wash.
// The secret: the red rock slab right of the green tips a ball back onto it.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, FAIRWAY_DEPTH, greenComplex, greenside } from './woods';

const GROUND = 4;
const GREEN = { x: 84, y: 524, rx: 22, ry: 18 };
const WASH: V2[] = [
  { x: -200, y: 478 },
  { x: -60, y: 470 },
  { x: 30, y: 476 },
  { x: 100, y: 470 },
  { x: 200, y: 478 },
];
const LINE: V2[] = [
  { x: 0, y: 10 },
  { x: 4, y: 200 },
  { x: 30, y: 330 },
  { x: 62, y: 430 },
];

const traps = [
  bunker(-34, 230, 12, 6, 1, FAIRWAY_DEPTH, 0.2), // left of the landing
  bunker(44, 210, 14, 6, 2, FAIRWAY_DEPTH, -0.3), // right of the landing, the safe-looking side
  bunker(66, 332, 18, 8, 3, FAIRWAY_DEPTH, -0.5), // outside the turn
  greenside(GREEN, 56, 548, 12, 6, 4, 3.2, 0.4), // front left
  greenside(GREEN, 84, 556, 14, 5, 5, 3.2, 0), // short right
  greenside(GREEN, 60, 500, 8, 8, 6, 3.2, 0), // left, hard by the wash
];

const cacti: Post[] = [
  [-26, 120], [-52, 190], [-70, 260], [-20, 300], [18, 60], [78, 130], [92, 250], [110, 300], [118, 400], [-56, 420],
  [130, 480], [150, 540], [30, 560], [20, 520], [-90, 520], [60, 600], [140, 440],
].map(([x, y]) => ({ x, y, r: 1, h: 10, look: 'cactus' as const }));
const rocks: Post[] = [[-100, 350, 4], [-80, 90, 3], [140, 340, 4], [-130, 220, 3], [100, 580, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const saguarorun: Hole = {
  id: 'saguarorun',
  name: 'Saguaro Run',
  par: 4,
  theme: 'desert',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 390,
  blurb: 'A dogleg right round a red butte. The wash cuts across in front of a green that tilts away.',
  tee: { x: 0, y: 0 },
  cup: { x: 84, y: 528 },
  pins: [{ x: 84, y: 528 }, { x: 72, y: 516 }, { x: 96, y: 532 }, { x: 86, y: 512 }],
  aim: 0.03,
  bounds: { x0: -220, y0: -40, x1: 220, y1: 640 },
  border: [
    { x: -180, y: -36 },
    { x: 180, y: -36 },
    { x: 200, y: 630 },
    { x: -200, y: 630 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: band(LINE, 24), surface: 'fairway' },
    { poly: band([{ x: 62, y: 430 }, { x: 80, y: 500 }], 14), surface: 'fairway' },
    { poly: band(WASH, 12), surface: 'sand' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    // a red slab right of the green
    { poly: blob(122, 522, 12, 16, 7, 0.1), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -220, y0: -40, x1: 220, y1: 640, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the red butte on the inside of the turn, and the mesas beyond
    { kind: 'hill', x: -90, y: 330, r: 60, h: 20 },
    { kind: 'hill', x: -90, y: 330, r: 30, h: 8 },
    ...[0, 260, 520].map((y) => ({ kind: 'hill' as const, x: -330, y, r: 150, h: 30 })),
    ...[0, 260, 520].map((y) => ({ kind: 'hill' as const, x: 340, y, r: 150, h: 26 })),
    { kind: 'channel', pts: WASH, width: 14, depth: 2.2 },
    ...greenComplex(GREEN, GROUND, { lift: 1.6, edge: 10, tilt: [0.6, 1.4], rolls: [[-8, -6, 7, 0.4], [8, 8, 6, -0.4]], back: 2 }),
    // the secret: the slab tips toward the green
    { kind: 'ramp', x0: 108, y0: 504, x1: 134, y1: 542, axis: 'x', h0: 0, h1: 2.6, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...cacti, ...rocks],
  movers: [],
  pushes: [],
  zones: [{ id: 'redslab', poly: rect(108, 506, 132, 540) }],
  secret: { name: 'The Red Slab', zone: 'redslab', hint: 'Right of the green, the red rock tips a ball back onto it. Use it.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 4, y: 220 },
    { x: 50, y: 400 },
    { x: 84, y: 526 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: -110, y: 150, scale: 1.4 },
    { kind: 'rock', x: 150, y: 200, scale: 1.2 },
  ],
};
