// Hole 2, Maple Lake (par 3, about 225 ft, 165 yd as shown): from a tee up in the maples, all carry over a lake to a
// shallow green on the far shore.
// The play: a high iron that holds. Short is wet; long finds two deep pot bunkers.
// The danger: the big maple on the right of the shore pinches the line in from that side.
// The secret: the ridge on the left of the green. Land it there and the slope brings it round to the flag.
import { blob, circle, rect } from '../terrain';
import type { Hole, Post } from '../types';

const GREEN = { x: 8, y: 226, rx: 18, ry: 11 };
const LAKE = { x: -4, y: 128, rx: 104, ry: 66 };
const GROUND = 2;

const maples: Post[] = [
  // round the back of the green
  ...[-70, -44, 30, 56, 82].map((x, i) => ({ x, y: 272 + (i % 2) * 10, r: 4, h: 28, e: 0.25, look: 'maple' as const })),
  // along the far shore, either side of the green
  { x: -62, y: 222, r: 4, h: 26, e: 0.25, look: 'maple' },
  { x: 58, y: 206, r: 5, h: 30, e: 0.2, look: 'maple' }, // the one that pinches the line from the right
  // down both sides of the lake
  ...[50, 120, 190].map((y, i) => ({ x: 128 + (i % 2) * 10, y, r: 4, h: 26, e: 0.25, look: 'maple' as const })),
  ...[50, 120, 190].map((y, i) => ({ x: -132 - (i % 2) * 10, y, r: 4, h: 26, e: 0.25, look: 'maple' as const })),
  // framing the tee
  { x: -34, y: -16, r: 4, h: 24, e: 0.25, look: 'maple' },
  { x: 36, y: -20, r: 4, h: 24, e: 0.25, look: 'maple' },
];

export const maplelake: Hole = {
  id: 'maplelake',
  name: 'Maple Lake',
  par: 3,
  theme: 'autumn',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  blurb: 'All carry over the lake to a shallow green. Short is wet, long is sand.',
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 227 },
  pins: [{ x: 8, y: 227 }, { x: -6, y: 223 }, { x: 21, y: 229 }, { x: 4, y: 232 }],
  aim: 0.02,
  bounds: { x0: -170, y0: -40, x1: 170, y1: 320 },
  border: [
    { x: -166, y: -36 },
    { x: 166, y: -36 },
    { x: 166, y: 316 },
    { x: -166, y: 316 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // a collar of fairway on the far shore
    { poly: blob(GREEN.x, GREEN.y - 4, GREEN.rx + 16, GREEN.ry + 10, 1, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 2, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 2, 0.05), surface: 'green' },
    // the pot bunkers behind
    { poly: circle(-4, 250, 5), surface: 'sand' },
    { poly: circle(22, 250, 4.5), surface: 'sand' },
  ],
  water: [{ poly: blob(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 3, 0.08), level: GROUND - 1 }],
  terrain: [
    // the tee up in the trees, then down to the water
    { kind: 'ramp', x0: -170, y0: -40, x1: 170, y1: 16, axis: 'y', h0: 16, h1: 16, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 16, x1: 170, y1: 60, axis: 'y', h0: 16, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 60, x1: 170, y1: 320, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // wooded slopes all round
    { kind: 'hill', x: -260, y: 140, r: 130, h: 24 },
    { kind: 'hill', x: 260, y: 140, r: 130, h: 24 },
    { kind: 'hill', x: 0, y: 400, r: 130, h: 22 },
    // the lake bed
    { kind: 'disc', x: LAKE.x, y: LAKE.y, r: LAKE.rx + 4, h: -4, edge: 14, op: 'add' },
    { kind: 'box', x0: LAKE.x - LAKE.rx, y0: LAKE.y - LAKE.ry - 6, x1: LAKE.x + LAKE.rx, y1: LAKE.y + LAKE.ry + 6, h: -4, edge: 12, op: 'add' },
    // the green, a step up off the shore, leaning back toward the water
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: GROUND + 1.2, edge: 7, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 20, x1: GREEN.x + 30, y1: GREEN.y + 20, axis: 'y', h0: -0.3, h1: 0.3, op: 'add' },
    // the secret: a ridge on the left that brings a ball round to the middle
    { kind: 'ramp', x0: -46, y0: 214, x1: -12, y1: 246, axis: 'x', h0: 1.8, h1: 0, op: 'add' },
    // deep pot bunkers
    { kind: 'disc', x: -4, y: 250, r: 5, h: -2.8, edge: 2, op: 'add' },
    { kind: 'disc', x: 22, y: 250, r: 4.5, h: -2.8, edge: 2, op: 'add' },
  ],
  walls: [],
  posts: maples,
  movers: [],
  pushes: [],
  zones: [{ id: 'ridge', poly: rect(-42, 217, -16, 243) }],
  secret: { name: 'The Ridge', zone: 'ridge', hint: 'The ridge on the left of the green brings it round. Land it there and let it roll.' },
  drop: { x: -26, y: 212 },
  flyover: [
    { x: 0, y: -20 },
    { x: -40, y: 120 },
    { x: 8, y: 227 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -20, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -12, rot: 0 },
    { kind: 'rock', x: -100, y: 60, scale: 1.4 },
    { kind: 'rock', x: 96, y: 200, scale: 1.1 },
  ],
};
