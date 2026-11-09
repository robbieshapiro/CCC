// Hole Lab: The Loop (par 4, 400 yd), a hole laid through downtown. The fairway is a park cut between towers: their
// walls are in play (a ball off one bounces back), and a ball that comes down on a roof is gone. The elevated train
// crosses overhead, the fairway doglegs right round the corner tower, and the green sits over the river with the old
// ballpark's ivy wall behind it.
// The play: a drive up the left of the avenue, past the corner, then a short iron over the river.
// The secret: the gap between the corner tower and its neighbour. Thread it off the tee and you're over the river in two.
import { building } from '../../looks/city';
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenComplex, greenside } from '../woods';

const GROUND = 4;
const RIVER = 0.5;
const GREEN = { x: 150, y: 560, rx: 24, ry: 18 };
const traps = [greenside(GREEN, 120, 590, 10, 6, 1, 3, 0), greenside(GREEN, 186, 548, 8, 10, 2, 3, 0)];

// the blocks: [x, y, width, depth, height]
const BLOCKS: [number, number, number, number, number][] = [
  // the west side of the avenue
  [-110, 90, 90, 110, 260],
  [-110, 260, 90, 120, 420],
  [-100, 430, 70, 100, 180],
  // the east side, up to the corner
  [110, 70, 80, 100, 220],
  [104, 220, 70, 90, 300],
  // the corner tower the hole bends round, and its neighbour across the gap
  [96, 410, 60, 60, 520],
  [206, 330, 60, 100, 340],
];
const towers = BLOCKS.map(([x, y, w, d, h], i) => building(x, y, w, d, h, i + 3));
const GAP = rect(128, 370, 174, 404);

const lights: Post[] = [[-50, 40], [-50, 180], [-50, 320], [48, 40], [48, 150], [48, 290], [220, 470]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const }));

export const theloop: Hole = {
  id: 'theloop',
  name: 'The Loop',
  par: 4,
  theme: 'city',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  yards: 400,
  blurb: 'Up the avenue between the towers, right round the corner and over the river. Hit a building and it hits back.',
  tee: { x: 0, y: 0 },
  cup: { x: 150, y: 562 },
  pins: [{ x: 150, y: 562 }, { x: 134, y: 552 }, { x: 166, y: 566 }, { x: 146, y: 574 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 260, y1: 660 },
  border: [
    { x: -60, y: -46 },
    { x: 60, y: -46 },
    { x: 60, y: 370 },
    { x: 256, y: 386 },
    { x: 256, y: 656 },
    { x: 60, y: 656 },
    { x: -60, y: 480 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the avenue: a park strip between the blocks, then round the corner to the river
    { poly: blob(-4, 250, 30, 200, 1, 0.04), surface: 'fairway' },
    { poly: blob(30, 470, 40, 30, 2, 0.06), surface: 'fairway' },
    { poly: blob(150, 470, 40, 24, 3, 0.06), surface: 'fairway' },
    // sidewalks
    { poly: band([{ x: -56, y: -40 }, { x: -56, y: 470 }], 4), surface: 'path' },
    { poly: band([{ x: 54, y: -40 }, { x: 54, y: 360 }], 4), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band([{ x: -70, y: 510 }, { x: 80, y: 516 }, { x: 260, y: 508 }], 16), level: RIVER }],
  terrain: [
    { kind: 'ramp', x0: -170, y0: -50, x1: 260, y1: 660, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the river in its stone channel
    { kind: 'channel', pts: [{ x: -80, y: 510 }, { x: 80, y: 516 }, { x: 270, y: 508 }], width: 22, depth: 7 },
    ...greenComplex(GREEN, GROUND, { lift: 1.4, edge: 8, tilt: [0.8, 0.8], rolls: [[-10, -6, 6, 0.35], [8, 8, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: towers.flatMap((t) => t.walls),
  roofs: towers.map((t) => t.roof),
  posts: lights,
  movers: [],
  pushes: [],
  zones: [{ id: 'gap', poly: GAP }],
  secret: { name: 'The Gap', zone: 'gap', hint: 'There is a gap between the corner tower and the one beside it. Thread it and you are over the river in two.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 240 },
    { x: 40, y: 450 },
    { x: 150, y: 560 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    ...towers.map((t) => t.decor),
    // the el crosses the avenue overhead, and the old ballpark sits behind the green
    { kind: 'el', x: 0, y: 180, scale: 340, rot: 0 },
    { kind: 'ballpark', x: 150, y: 640, rot: 0 },
  ],
};
