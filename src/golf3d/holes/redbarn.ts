// Hole 3, The Red Barn (par 5, about 720 ft, 530 yd as shown): a dogleg right round a field of standing corn, then
// downhill along the farm to a green past the old red barn.
// The play: a drive up the first leg, an iron round the corner, then a short iron over (or round) the barn.
// The gamble: a driver over the corn, cutting the corner. The corn is out of bounds.
// The secret: the barn doors stand open at both ends, and the farm track runs on from the far door to the green.
// Roll one through the barn.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: 404, y: 330, rx: 22, ry: 20 };
// the barn: long side along the hole, doors in the middle of each end
const BARN = { x0: 220, x1: 280, y0: 310, y1: 350, door: 6, eave: 14, ridge: 24 };
const MID = (BARN.y0 + BARN.y1) / 2;
// the corn fills the inside of the dogleg; everything in it is out of bounds
const CORN = { x0: 52, y1: 262 };
// the first leg climbs gently to the corner; the second falls away along the farm to the green
const CORNER = 10;
const LOW = 4;
const TRACK: V2[] = [
  { x: BARN.x0 - 4, y: MID },
  { x: BARN.x1, y: MID },
  { x: 330, y: MID },
  { x: GREEN.x - GREEN.rx - 2, y: MID },
];

const maples: Post[] = [
  // up the left of the first leg
  ...[40, 110, 180, 250].map((y, i) => ({ x: -86 - (i % 2) * 10, y, r: 2, h: 24, look: 'maple' as const })),
  // the big one beyond the corner
  { x: -30, y: 392, r: 2.4, h: 30, look: 'maple' },
  // along the far side of the second leg
  ...[90, 150, 310, 370].map((x, i) => ({ x, y: 400 + (i % 2) * 8, r: 2, h: 24, look: 'maple' as const })),
  // behind the green
  ...[300, 330, 360].map((y, i) => ({ x: 446 + (i % 2) * 8, y, r: 2, h: 26, look: 'maple' as const })),
];

// standing corn across the inside of the dogleg, in square patches
const corn = [80, 200, 320].flatMap((x) => [60, 180].map((y) => ({ kind: 'corn', x: x + 50, y, scale: 116 })));

export const redbarn: Hole = {
  id: 'redbarn',
  name: 'The Red Barn',
  par: 5,
  theme: 'autumn',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 408, y: 332 },
  pins: [{ x: 408, y: 332 }, { x: 396, y: 322 }, { x: 414, y: 342 }, { x: 398, y: 340 }],
  aim: 0,
  bounds: { x0: -110, y0: -40, x1: 460, y1: 420 },
  // the corn takes a bite out of the inside corner
  border: [
    { x: -106, y: -36 },
    { x: CORN.x0, y: -36 },
    { x: CORN.x0, y: CORN.y1 },
    { x: 456, y: CORN.y1 },
    { x: 456, y: 416 },
    { x: -106, y: 416 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the first leg, and the corner
    { poly: blob(-2, 200, 40, 120, 1, 0.06), surface: 'fairway' },
    { poly: blob(10, 330, 44, 46, 2, 0.08), surface: 'fairway' },
    // the second leg: wide, with the barn in the middle of it
    { poly: blob(170, 332, 120, 50, 3, 0.06), surface: 'fairway' },
    { poly: blob(330, 330, 70, 44, 4, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 5, 0.06), surface: 'green' },
    // the barn floor and the track out of it
    { poly: rect(BARN.x0, BARN.y0, BARN.x1, BARN.y1), surface: 'path' },
    { poly: band(TRACK, 3), surface: 'path' },
    { poly: circle(384, 362, 7), surface: 'sand' },
    { poly: circle(420, 302, 6), surface: 'sand' },
    { poly: circle(-30, 300, 8), surface: 'sand' },
  ],
  water: [],
  terrain: [
    // up the first leg to the corner
    { kind: 'ramp', x0: -110, y0: -40, x1: CORN.x0, y1: 20, axis: 'y', h0: 7, h1: 7, op: 'set' },
    { kind: 'ramp', x0: -110, y0: 20, x1: CORN.x0, y1: 320, axis: 'y', h0: 6, h1: CORNER, op: 'set' },
    { kind: 'ramp', x0: -110, y0: 320, x1: CORN.x0, y1: 420, axis: 'y', h0: CORNER, h1: CORNER, op: 'set' },
    // the corn, flat
    { kind: 'ramp', x0: CORN.x0, y0: -40, x1: 460, y1: CORN.y1, axis: 'y', h0: 7, h1: 7, op: 'set' },
    // the second leg falls away to the green
    { kind: 'ramp', x0: CORN.x0, y0: CORN.y1, x1: 400, y1: 420, axis: 'x', h0: CORNER, h1: LOW, op: 'set' },
    { kind: 'ramp', x0: 400, y0: CORN.y1, x1: 460, y1: 420, axis: 'x', h0: LOW, h1: LOW, op: 'set' },
    // rolling farmland beyond
    ...[-40, 120, 280].map((y, i) => ({ kind: 'hill' as const, x: -220, y, r: 120, h: 18 + (i % 2) * 6 })),
    ...[40, 200, 360].map((x, i) => ({ kind: 'hill' as const, x, y: 520, r: 120, h: 16 + (i % 2) * 6 })),
    { kind: 'hill', x: 560, y: 340, r: 120, h: 16 },
    // the green, a step up out of the track, leaning back toward it
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: LOW + 0.3, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: -0.3, h1: 0.4, op: 'add' },
    // bunkers
    ...[[384, 362, 7], [420, 302, 6], [-30, 300, 8]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [
    // the long sides
    { a: { x: BARN.x0, y: BARN.y0 }, b: { x: BARN.x1, y: BARN.y0 }, h: BARN.eave, look: 'barn' },
    { a: { x: BARN.x0, y: BARN.y1 }, b: { x: BARN.x1, y: BARN.y1 }, h: BARN.eave, look: 'barn' },
    // the ends, either side of the open doors
    ...[BARN.x0, BARN.x1].flatMap((x) => [
      { a: { x, y: BARN.y0 }, b: { x, y: MID - BARN.door }, h: BARN.eave, look: 'barn' as const },
      { a: { x, y: MID + BARN.door }, b: { x, y: BARN.y1 }, h: BARN.eave, look: 'barn' as const },
    ]),
  ],
  roofs: [{ poly: rect(BARN.x0, BARN.y0, BARN.x1, BARN.y1), h: BARN.eave, top: BARN.ridge }],
  posts: maples,
  movers: [],
  pushes: [],
  zones: [{ id: 'barn', poly: rect(BARN.x0 + 4, MID - BARN.door, BARN.x1 - 4, MID + BARN.door) }],
  secret: { name: 'Through the Barn', zone: 'barn', hint: 'The barn doors stand open at both ends, and the track runs on to the green. Mind the roof.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 260 },
    { x: 120, y: 330 },
    { x: 300, y: 330 },
    { x: 408, y: 332 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -14, rot: 0 },
    { kind: 'pumpkins', x: 30, y: 8 },
    ...corn,
    // the farmyard beyond the barn
    { kind: 'silo', x: 250, y: 440, scale: 1.1 },
    { kind: 'haybale', x: 300, y: 432, rot: 0.2 },
    { kind: 'haybale', x: 308, y: 444, rot: 1.1 },
  ],
};
