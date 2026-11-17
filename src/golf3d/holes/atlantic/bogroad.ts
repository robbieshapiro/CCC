// Hole 5, The Bog Road (par 4, 330 yd as shown): inland, over a stretch of bog to a green on firm ground beyond it.
// The play: a drive short of the bog, or a long one over it, then a short iron in.
// The bail-out: lay up on the near side, and miss the green left. Anything that comes down in the bog is gone, and
// there is a bog pool hard against the right of the green.
// The secret: the Bog Road. An old turf-cutters' track runs straight across the bog on the left, raised a little and
// packed hard. A drive that lands on it runs across to the far side.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { dunes, gorse, LINKS_TURF, pot } from './common';

const GROUND = 8;
const GREEN = { x: -14, y: 446, rx: 14, ry: 12 };
const BOG = { x0: -112, y0: 214, x1: 112, y1: 330 };
// a pool of bog water right of the green
const POOL = { x0: 6, y0: 418, x1: 70, y1: 480 };
// the turf-cutters' road across the bog
const ROAD: V2[] = [
  { x: -54, y: 200 },
  { x: -52, y: 272 },
  { x: -48, y: 344 },
  { x: -34, y: 410 },
];
const traps = [
  pot(26, 176, 7, 1), // right of the lay-up
  pot(-2, 384, 6, 2), // over the bog, in the run-in
  greenside(GREEN, -36, 452, 7, 8, 3, 3.4, 0), // left of the green
];

export const bogroad: Hole = {
  id: 'bogroad',
  name: 'The Bog Road',
  par: 4,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 330,
  blurb: 'A short one over the bog, to a green with bog water right of it. The old road across is the safe way over.',
  teeTip: 'Short of the bog is safe. The road across it on the left runs a long way.',
  tee: { x: 0, y: 0 },
  cup: { x: -14, y: 448 },
  pins: [{ x: -14, y: 448 }, { x: -21, y: 442 }, { x: -7, y: 452 }, { x: -15, y: 454 }],
  aim: 0,
  bounds: { x0: -130, y0: -50, x1: 130, y1: 520 },
  border: [
    { x: -126, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 516 },
    { x: -126, y: 516 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the lay-up, short of the bog
    { poly: blob(-4, 150, 28, 56, 1, 0.06), surface: 'fairway' },
    // over the bog, the run-in
    { poly: blob(-10, 380, 26, 36, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the road, packed hard
    { poly: band(ROAD, 5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: rect(BOG.x0, BOG.y0, BOG.x1, BOG.y1), level: GROUND - 1, look: 'slime' },
    { poly: rect(POOL.x0, POOL.y0, POOL.x1, POOL.y1), level: GROUND - 1, look: 'slime' },
  ],
  terrain: [
    { kind: 'ramp', x0: -130, y0: -50, x1: 130, y1: 520, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    ...dunes([[-110, 60, 44, 8], [110, 90, 44, 8], [-112, 420, 44, 9], [114, 440, 42, 8], [-10, 530, 50, 8]]),
    ...dunes([[-20, 110, 22, 1.2], [16, 180, 20, -1], [10, 380, 18, 1]]),
    // the bog: a sunk flat of black water
    { kind: 'box', x0: BOG.x0, y0: BOG.y0, x1: BOG.x1, y1: BOG.y1, h: GROUND - 3, edge: 4, op: 'set' },
    // the road across it, a little above the ground either side
    { kind: 'embankment', pts: ROAD, h: [GROUND + 0.6, GROUND + 0.6, GROUND + 0.6, GROUND + 0.6], width: 10, edge: 3 },
    { kind: 'disc', x: 0, y: -2, r: 16, h: GROUND + 4, edge: 10, op: 'set' },
    ...greenComplex(GREEN, GROUND, { lift: 1.8, edge: 10, tilt: [0.6, 0.6], rolls: [[-6, -5, 6, 0.3], [7, 5, 5, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
    { kind: 'box', x0: POOL.x0, y0: POOL.y0, x1: POOL.x1, y1: POOL.y1, h: GROUND - 3, edge: 3, op: 'set' },
  ],
  walls: [],
  posts: gorse([[-60, 120], [58, 140], [-70, 190], [70, 196], [-60, 360], [44, 396], [-50, 470], [30, 500]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'bogroad', poly: band(ROAD.slice(1, 3), 5) }],
  secret: { name: 'The Bog Road', zone: 'bogroad', hint: 'The turf-cutters have a road straight across the bog on the left. It is packed hard. Land a drive on it.' },
  flyover: [
    { x: 0, y: -30 },
    { x: -10, y: 200 },
    { x: -10, y: 360 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'sheep', x: 80, y: 180, rot: 0.4 },
    { kind: 'sheep', x: -84, y: 380, rot: -1.2 },
  ],
};
