// Hole Lab: Heron Bay (par 4, 380 yd), Gulf coast Florida. Flat, bright and wet: a lake all the way down the left, a
// white sand waste area along the right, and a green pushed out into a second lake, water short and left.
// The play: a drive down the right half, short of the waste, then a short iron to a green with water hard by it.
// The secret: the spit of fairway out along the far shore of the lake. A brave drive over the corner leaves a wedge.
import { band, blob, circle, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenComplex, greenside } from '../woods';

const GROUND = 2;
const LAKE = 0.4;
const GREEN = { x: 26, y: 506, rx: 24, ry: 18 };
const traps = [greenside(GREEN, 60, 520, 10, 7, 2, 3, 0.3), greenside(GREEN, 30, 540, 12, 6, 3, 3, 0)];

const palms: Post[] = [
  ...[[-150, 40], [-160, 140], [-150, 250], [-165, 360], [-150, 470], [120, 60], [126, 180], [118, 300], [110, 420], [90, 560], [-20, 580], [60, 590]].map(
    ([x, y], i) => ({ x, y, r: 1.4, h: 24 + (i % 4) * 4, soft: true, look: 'sabal' as const }),
  ),
  { x: 96, y: 240, r: 9, h: 30, soft: true, look: 'oak' },
  { x: -40, y: -30, r: 8, h: 26, soft: true, look: 'oak' },
];

export const herons: Hole = {
  id: 'herons',
  name: 'Heron Bay',
  par: 4,
  theme: 'florida',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  yards: 380,
  blurb: 'Water all down the left, a white waste area right, and a green pushed out into the lake. Gators on the banks.',
  tee: { x: 0, y: 0 },
  cup: { x: 26, y: 508 },
  pins: [{ x: 26, y: 508 }, { x: 10, y: 498 }, { x: 40, y: 512 }, { x: 22, y: 520 }],
  aim: 0.02,
  bounds: { x0: -190, y0: -50, x1: 150, y1: 610 },
  border: [
    { x: -186, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 606 },
    { x: -186, y: 606 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(6, 270, 34, 170, 1, 0.06), surface: 'fairway' },
    { poly: blob(10, 440, 26, 40, 2, 0.06), surface: 'fairway' },
    // the spit along the far shore of the lake: the secret line
    { poly: band([{ x: -52, y: 330 }, { x: -40, y: 390 }, { x: -18, y: 420 }], 12), surface: 'fairway' },
    // the waste area: white sand, firm, and flat (it plays as sand)
    { poly: blob(80, 300, 28, 120, 4, 0.18), surface: 'sand' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 5, 0.06), surface: 'green' },
    { poly: band([{ x: 60, y: 20 }, { x: 110, y: 160 }, { x: 116, y: 420 }, { x: 70, y: 470 }], 2.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [
    // the long lake down the left, and the green's own lake, short and left of it
    { poly: blob(-120, 250, 46, 230, 6, 0.08), level: LAKE },
    { poly: blob(-30, 500, 38, 46, 7, 0.1), level: LAKE },
    { poly: circle(-14, 452, 22), level: LAKE },
  ],
  terrain: [
    { kind: 'ramp', x0: -190, y0: -50, x1: 150, y1: 610, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: GROUND + 1.5, edge: 8, op: 'set' },
    // the lakes, dug out
    { kind: 'box', x0: -172, y0: 10, x1: -70, y1: 490, h: -3.5, edge: 10, op: 'add' },
    { kind: 'disc', x: -30, y: 500, r: 44, h: -3.5, edge: 10, op: 'add' },
    { kind: 'disc', x: -14, y: 452, r: 26, h: -3.5, edge: 8, op: 'add' },
    // a gentle roll in the fairway
    { kind: 'hill', x: 20, y: 260, r: 60, h: 0.8 },
    ...greenComplex(GREEN, GROUND, { lift: 1.2, edge: 8, tilt: [0.6, 0.8], rolls: [[-8, -6, 6, 0.35], [10, 6, 5, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: palms,
  movers: [],
  pushes: [],
  zones: [{ id: 'spit', poly: band([{ x: -52, y: 330 }, { x: -40, y: 390 }, { x: -18, y: 420 }], 12) }],
  secret: { name: 'The Spit', zone: 'spit', hint: 'A strip of fairway runs out along the far shore of the lake. Carry the corner and you are a wedge away.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 20, y: 220 },
    { x: 30, y: 420 },
    { x: 26, y: 506 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -12, rot: 0 },
    { kind: 'gator', x: -52, y: 160, rot: 1.4 },
    { kind: 'gator', x: 4, y: 470, rot: -0.4 },
    { kind: 'egret', x: -72, y: 300, rot: 0.6 },
    { kind: 'egret', x: -64, y: 468, rot: 2.2 },
    { kind: 'egret', x: -158, y: 420, rot: -0.8 },
  ],
};
