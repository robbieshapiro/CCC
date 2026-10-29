// Hole 2, Sugar Maple (par 3, about 200 ft, 145 yd as shown): from a tee up in the trees, down over a pond dark with
// fallen leaves to a green ringed by blazing maples.
// The play: a high iron that holds. The green leans toward the pond, so short and left is wet.
// The secret: the farmer's hay bales sit on a bank behind the green, on the right. Go long and right, and the bank
// sends it back down to the flag.
import { blob, circle, rect } from '../terrain';
import type { Hole, Post } from '../types';

const GREEN = { x: 6, y: 196, rx: 18, ry: 15 };
const POND = { x: -14, y: 150, r: 32 };
const BANK = { x: 46, y: 224, r: 30 };
const GROUND = 2;

const maples: Post[] = [
  // the ring behind the green, clear of the bank
  ...[-78, -52, -26, 0, 22].map((x, i) => ({ x, y: 248 + (i % 2) * 10, r: 2, h: 26, look: 'maple' as const })),
  // down the right, past the bank
  ...[60, 110, 160].map((y, i) => ({ x: 100 + (i % 2) * 10, y, r: 2, h: 24, look: 'maple' as const })),
  // down the left, behind the pond
  ...[40, 100, 170, 220].map((y, i) => ({ x: -104 - (i % 2) * 10, y, r: 2, h: 24, look: 'maple' as const })),
  // round the tee
  { x: -40, y: -16, r: 2, h: 24, look: 'maple' },
  { x: 44, y: -20, r: 2, h: 24, look: 'maple' },
];

export const sugarmaple: Hole = {
  id: 'sugarmaple',
  name: 'Sugar Maple',
  par: 3,
  theme: 'autumn',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 198 },
  pins: [{ x: 6, y: 198 }, { x: -4, y: 190 }, { x: 14, y: 202 }, { x: 2, y: 205 }],
  greenFirm: 0.03,
  aim: 0.02,
  bounds: { x0: -130, y0: -40, x1: 130, y1: 290 },
  border: [
    { x: -126, y: -36 },
    { x: 126, y: -36 },
    { x: 126, y: 286 },
    { x: -126, y: 286 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // somewhere to bail out, short and right
    { poly: blob(34, 146, 16, 14, 1, 0.1), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 2, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 2, 0.06), surface: 'green' },
    { poly: circle(-22, 218, 6), surface: 'sand' },
  ],
  water: [{ poly: circle(POND.x, POND.y, POND.r), level: GROUND - 0.8 }],
  terrain: [
    // the tee up in the trees, then down the slope to the water
    { kind: 'ramp', x0: -130, y0: -40, x1: 130, y1: 16, axis: 'y', h0: 18, h1: 18, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 16, x1: 130, y1: 90, axis: 'y', h0: 18, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 90, x1: 130, y1: 290, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // wooded slopes all round
    { kind: 'hill', x: -220, y: 140, r: 120, h: 22 },
    { kind: 'hill', x: 220, y: 140, r: 120, h: 24 },
    { kind: 'hill', x: 0, y: 360, r: 120, h: 20 },
    // the pond
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 2, h: -3, edge: 10, op: 'add' },
    // the green, just above the water, leaning toward the pond (left and front)
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: GROUND + 0.6, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: -0.45, h1: 0.45, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.3, h1: 0.3, op: 'add' },
    // the hay-bale bank behind and right of the green
    { kind: 'hill', x: BANK.x, y: BANK.y, r: BANK.r, h: 5 },
    { kind: 'disc', x: -22, y: 218, r: 6, h: -1.1, edge: 3, op: 'add' },
  ],
  walls: [],
  posts: maples,
  movers: [],
  pushes: [],
  zones: [{ id: 'bales', poly: circle(BANK.x + 4, BANK.y + 4, 18) }],
  secret: { name: 'The Hay Bales', zone: 'bales', hint: 'Long and right is not lost here. The bank by the hay bales sends things home.' },
  flyover: [
    { x: 0, y: -20 },
    { x: -20, y: 110 },
    { x: 6, y: 198 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -20, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -12, rot: 0 },
    // up on the bank, behind where the ball runs
    { kind: 'haybale', x: 80, y: 244, rot: 0.3 },
    { kind: 'haybale', x: 86, y: 230, rot: 0.1 },
    { kind: 'haybale', x: 74, y: 258, rot: 0.6 },
    { kind: 'pumpkins', x: 88, y: 214 },
  ],
};
