// Hole 2, Maple Lake (par 3, about 225 ft, 165 yd as shown): from a tee up in the maples, all carry over a lake to a
// shallow green on the far shore.
// The play: a high iron that holds. Short is wet; long finds two deep pot bunkers.
// The danger: the big maple on the right of the shore pinches the line in from that side.
// The secret: the ridge on the left of the green. Land it there and the slope brings it round to the flag.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post } from '../types';
import { treeLine } from './woods';

const GREEN = { x: 8, y: 226, rx: 20, ry: 13 };
const LAKE = { x: -4, y: 128, rx: 96, ry: 66 };
const GROUND = 2;

// woods tight down both sides and behind: past them is out of bounds
const maples: Post[] = [
  ...treeLine([{ x: -112, y: -10 }, { x: -112, y: 300 }], 22, 'ml-left'),
  ...treeLine([{ x: 112, y: -10 }, { x: 112, y: 300 }], 22, 'ml-right'),
  ...treeLine([{ x: -96, y: 276 }, { x: 96, y: 276 }], 22, 'ml-back', 4),
  // along the far shore, either side of the green
  { x: -62, y: 222, r: 4, h: 26, e: 0.25, look: 'maple' },
  { x: 58, y: 206, r: 5, h: 30, e: 0.2, look: 'maple' }, // the one that pinches the line from the right
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
  pins: [{ x: 8, y: 227 }, { x: -8, y: 222 }, { x: 24, y: 229 }, { x: 4, y: 234 }],
  aim: 0.02,
  bounds: { x0: -170, y0: -40, x1: 170, y1: 320 },
  // out of bounds just past the woods, either side and behind
  border: [
    { x: -124, y: -36 },
    { x: 124, y: -36 },
    { x: 124, y: 312 },
    { x: -124, y: 312 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // a collar of fairway on the far shore
    { poly: blob(GREEN.x, GREEN.y - 4, GREEN.rx + 16, GREEN.ry + 10, 1, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 2, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 2, 0.05), surface: 'green' },
    // the pot bunkers behind
    { poly: circle(-4, 252, 5), surface: 'sand' },
    { poly: circle(24, 252, 4.5), surface: 'sand' },
    // and one front right, for the bail-out
    { poly: circle(38, 210, 5), surface: 'sand' },
  ],
  // the lake in front, and a creek running behind the trees: long is wet too
  water: [
    { poly: blob(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 3, 0.08), level: GROUND - 1 },
    { poly: band([{ x: -130, y: 296 }, { x: 0, y: 290 }, { x: 130, y: 298 }], 7), level: GROUND - 1.5 },
  ],
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
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 20, x1: GREEN.x + 30, y1: GREEN.y + 20, axis: 'y', h0: -0.45, h1: 0.45, op: 'add' },
    // a spine across the middle of the green
    { kind: 'hill', x: 14, y: 225, r: 8, h: 0.5 },
    // the creek behind
    { kind: 'channel', pts: [{ x: -130, y: 296 }, { x: 0, y: 290 }, { x: 130, y: 298 }], width: 9, depth: 3.5 },
    // the secret: a ridge on the left that brings a ball round to the middle
    { kind: 'ramp', x0: -46, y0: 214, x1: -12, y1: 246, axis: 'x', h0: 1.8, h1: 0, op: 'add' },
    // deep pot bunkers
    { kind: 'disc', x: -4, y: 252, r: 5, h: -4, edge: 2, op: 'add' },
    { kind: 'disc', x: 24, y: 252, r: 4.5, h: -4, edge: 2, op: 'add' },
    { kind: 'disc', x: 38, y: 210, r: 5, h: -3.6, edge: 2, op: 'add' },
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
