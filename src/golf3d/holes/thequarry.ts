// Hole 4, The Quarry (par 4, about 520 ft, 380 yd as shown): an old sandstone quarry, long since flooded. From a tee on
// the rim, carry the drowned pit to a fairway on the far side, then play up to a green on a shelf above the water.
// The play: a drive that clears the quarry and holds the fairway, which has water down its left. Then a short iron
// up to the shelf.
// The danger: the quarry runs on up the left of the hole and under the green, the woods close in on the right, and a
// maple stands in the middle of the landing.
// The secret: the spillway bank right of the green. Run it down that bank and it feeds onto the green.
import { blob, circle, rect } from '../terrain';
import type { Hole, Post } from '../types';
import { RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: -24, y: 500, rx: 16, ry: 13 };
const GROUND = 6;
// the water in the pit sits well below the rim
const LEVEL = GROUND - 7;

const woods: Post[] = [
  // two rows hard by the right of the fairway
  ...treeLine([{ x: 80, y: 230 }, { x: 80, y: 570 }], 20, 'quarry-right', 5, 2, -1, 11),
  ...treeLine([{ x: -100, y: 560 }, { x: 80, y: 568 }], 22, 'quarry-back', 4),
  // the far side of the quarry arm, beyond the water on the left
  ...treeLine([{ x: -150, y: 220 }, { x: -150, y: 560 }], 26, 'quarry-left'),
  // one standing in the landing
  tree(30, 330, 5, 30),
  // the rim round the tee
  tree(-40, -16, 4, 24),
  tree(44, -20, 4, 24),
];

export const thequarry: Hole = {
  id: 'thequarry',
  name: 'The Quarry',
  par: 4,
  theme: 'autumn',
  tour: true,
  turf: RESERVE_TURF,
  weather: 'storm',
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 380,
  blurb: 'Carry the flooded quarry, hold the fairway with water down its left, then up to a green on the shelf.',
  tee: { x: 0, y: 0 },
  cup: { x: -24, y: 502 },
  pins: [{ x: -24, y: 502 }, { x: -36, y: 495 }, { x: -15, y: 505 }, { x: -28, y: 510 }],
  aim: 0.03,
  bounds: { x0: -170, y0: -40, x1: 120, y1: 600 },
  // out of bounds past the woods on the right and behind; on the left, the quarry
  border: [
    { x: -166, y: -36 },
    { x: 106, y: -36 },
    { x: 106, y: 596 },
    { x: -166, y: 596 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the far side of the pit: a fairway with the water down its left
    { poly: blob(26, 350, 46, 86, 1, 0.06), surface: 'fairway' },
    { poly: blob(-4, 448, 34, 26, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the quarry's sandstone faces
    { poly: rect(-160, 58, 116, 66), surface: 'rock' },
    { poly: rect(-160, 226, -60, 234), surface: 'rock' },
    // deep bunkers: front right of the green, behind it, and where the fairway narrows
    { poly: circle(2, 482, 6), surface: 'sand' },
    { poly: circle(-18, 524, 6), surface: 'sand' },
    { poly: blob(64, 420, 9, 8, 4, 0.12), surface: 'sand' },
    // two more in the landing, either side of the maple
    { poly: blob(-6, 304, 8, 7, 6, 0.12), surface: 'sand' },
    { poly: blob(56, 296, 8, 7, 7, 0.12), surface: 'sand' },
  ],
  water: [
    // the drowned pit across the front, and its arm up the left of the hole and round under the green
    { poly: rect(-156, 74, 112, 218), level: LEVEL },
    { poly: rect(-146, 218, -64, 470), level: LEVEL },
    { poly: blob(-90, 500, 34, 46, 5, 0.08), level: LEVEL },
  ],
  terrain: [
    // the rim, level all round
    { kind: 'ramp', x0: -170, y0: -40, x1: 120, y1: 600, axis: 'y', h0: GROUND, h1: GROUND + 1, op: 'set' },
    // the tee up a little higher on the rim
    { kind: 'disc', x: 0, y: 0, r: 24, h: GROUND + 4, edge: 14, op: 'set' },
    // wooded hills all round
    ...[0, 240, 480].map((y, i) => ({ kind: 'hill' as const, x: -300, y, r: 140, h: 22 + (i % 2) * 6 })),
    ...[0, 240, 480].map((y, i) => ({ kind: 'hill' as const, x: 260, y, r: 130, h: 22 + (i % 2) * 6 })),
    // the pit: sheer sandstone walls down to the water
    { kind: 'box', x0: -160, y0: 66, x1: 116, y1: 226, h: GROUND - 12, edge: 4, op: 'set' },
    { kind: 'box', x0: -150, y0: 214, x1: -60, y1: 474, h: GROUND - 12, edge: 4, op: 'set' },
    { kind: 'disc', x: -90, y: 500, r: 46, h: GROUND - 12, edge: 6, op: 'set' },
    // the green on a shelf, up above the water, leaning back toward it
    // a cupcake green on the shelf: up on a mound, falling away on every side, and to the water on the left
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 3, h: GROUND + 4.5, edge: 4, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: -0.5, h1: 0.5, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.3, h1: 0.3, op: 'add' },
    { kind: 'hill', x: -30, y: 494, r: 7, h: 0.45 },
    // the secret: the spillway bank right of the green, running down onto it
    { kind: 'ramp', x0: 4, y0: 492, x1: 40, y1: 520, axis: 'x', h0: 0, h1: 3, op: 'add' },
    // deep bunkers
    { kind: 'disc', x: 2, y: 482, r: 6, h: -3.8, edge: 2, op: 'add' },
    { kind: 'disc', x: -18, y: 524, r: 6, h: -3.8, edge: 2, op: 'add' },
    { kind: 'disc', x: 64, y: 420, r: 9, h: -4, edge: 2.5, op: 'add' },
    { kind: 'disc', x: -6, y: 304, r: 8, h: -4, edge: 2.5, op: 'add' },
    { kind: 'disc', x: 56, y: 296, r: 8, h: -4, edge: 2.5, op: 'add' },
  ],
  walls: [],
  posts: woods,
  movers: [],
  pushes: [],
  zones: [{ id: 'spillway', poly: rect(10, 494, 36, 518) }],
  secret: { name: 'The Spillway', zone: 'spillway', hint: 'The bank right of the green feeds down onto it. Run it in off the spillway.' },
  flyover: [
    { x: 0, y: -20 },
    { x: -20, y: 150 },
    { x: 20, y: 360 },
    { x: -24, y: 502 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -14, rot: 0 },
    { kind: 'rock', x: -40, y: 236, scale: 2.2 },
    { kind: 'rock', x: 80, y: 240, scale: 1.8 },
    { kind: 'rock', x: -60, y: 470, scale: 1.6 },
  ],
};
