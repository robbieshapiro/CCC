// Hole 2, The Ledges (par 4, about 570 ft, 415 yd as shown): a split fairway through mossy sandstone ledges in the
// woods. A spine of rock runs down the middle of the hole and splits it in two.
// The play: left of the spine is wide and safe but leaves a long second over a ledge that guards the front of the
// green. Right of it is narrow, with a creek down the side, but opens the green up.
// The danger: anything on the rock kicks off it, and one standing maple in each fairway picks off the greedy line.
// The secret: the rock shelf right of the green. Land on it and it tips the ball down onto the green.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: 26, y: 560, rx: 17, ry: 14 };
const GROUND = 4;
const LEVEL = GROUND - 2.5;
// the creek down the right-hand side
const CREEK: V2[] = [
  { x: 112, y: 60 },
  { x: 106, y: 220 },
  { x: 110, y: 400 },
  { x: 98, y: 520 },
  { x: 104, y: 660 },
];
// the spine of rock between the two fairways, and the ledge in front of the green
const SPINE = { x0: -16, y0: 170, x1: 18, y1: 420 };
const LEDGE = { x0: -46, y0: 486, x1: 6, y1: 520 };

const woods: Post[] = [
  ...treeLine([{ x: -112, y: 0 }, { x: -112, y: 640 }], 22, 'ledges-left'),
  ...treeLine([{ x: 130, y: 40 }, { x: 128, y: 640 }], 22, 'ledges-right', 4),
  ...treeLine([{ x: -100, y: 628 }, { x: 110, y: 628 }], 22, 'ledges-back', 4),
  // a maple standing in each fairway, where a driver wants to finish
  tree(-58, 330, 5, 30),
  tree(70, 360, 4.5, 28),
  // round the tee
  tree(-38, -16, 4, 24),
  tree(40, -20, 4, 24),
];

export const theledges: Hole = {
  id: 'theledges',
  name: 'The Ledges',
  par: 4,
  theme: 'autumn',
  tour: true,
  turf: RESERVE_TURF,
  weather: 'storm',
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 415,
  blurb: 'A spine of sandstone splits the fairway. Left is safe but blind over the ledge; right is tight by the creek.',
  tee: { x: 0, y: 0 },
  cup: { x: 26, y: 562 },
  pins: [{ x: 26, y: 562 }, { x: 14, y: 553 }, { x: 38, y: 566 }, { x: 22, y: 571 }],
  aim: 0,
  bounds: { x0: -130, y0: -40, x1: 150, y1: 660 },
  // out of bounds just past the woods on both sides
  border: [
    { x: -126, y: -36 },
    { x: 146, y: -36 },
    { x: 146, y: 656 },
    { x: -126, y: 656 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // one fairway off the tee, splitting round the spine
    { poly: blob(0, 120, 40, 56, 1, 0.06), surface: 'fairway' },
    { poly: blob(-56, 300, 34, 130, 2, 0.06), surface: 'fairway' },
    { poly: blob(62, 320, 24, 120, 3, 0.06), surface: 'fairway' },
    // they meet again short of the green
    { poly: blob(20, 470, 46, 34, 4, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 5, 0.06), surface: 'green' },
    // the sandstone
    { poly: rect(SPINE.x0, SPINE.y0, SPINE.x1, SPINE.y1), surface: 'rock' },
    { poly: rect(LEDGE.x0, LEDGE.y0, LEDGE.x1, LEDGE.y1), surface: 'rock' },
    { poly: rect(52, 548, 78, 580), surface: 'rock' },
    // deep bunkers: one where the right fairway pinches, two at the green
    { poly: blob(84, 270, 9, 8, 6, 0.12), surface: 'sand' },
    { poly: circle(30, 590, 6), surface: 'sand' },
    { poly: circle(-2, 572, 6), surface: 'sand' },
  ],
  water: [{ poly: band(CREEK, 10), level: LEVEL }],
  terrain: [
    // the tee up on a rock outcrop, the valley falling gently away
    { kind: 'ramp', x0: -130, y0: -40, x1: 150, y1: 20, axis: 'y', h0: 12, h1: 12, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 20, x1: 150, y1: 140, axis: 'y', h0: 12, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 140, x1: 150, y1: 660, axis: 'y', h0: GROUND, h1: GROUND + 1, op: 'set' },
    // wooded slopes
    ...[0, 220, 440, 660].map((y, i) => ({ kind: 'hill' as const, x: -260, y, r: 140, h: 24 + (i % 2) * 6 })),
    ...[0, 220, 440, 660].map((y, i) => ({ kind: 'hill' as const, x: 290, y, r: 140, h: 22 + (i % 2) * 6 })),
    // the spine: a long low wall of sandstone
    { kind: 'box', x0: SPINE.x0, y0: SPINE.y0, x1: SPINE.x1, y1: SPINE.y1, h: 9, edge: 4, op: 'add' },
    // the ledge in front of the green
    { kind: 'box', x0: LEDGE.x0, y0: LEDGE.y0, x1: LEDGE.x1, y1: LEDGE.y1, h: 7, edge: 3, op: 'add' },
    // the creek
    { kind: 'channel', pts: CREEK, width: 12, depth: 4 },
    // the green, up a step, with a spine through it and a hollow at the back left
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: GROUND + 2.2, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: 0.5, h1: -0.5, op: 'add' },
    { kind: 'hill', x: 30, y: 558, r: 8, h: 0.5 },
    { kind: 'hill', x: 14, y: 570, r: 6, h: -0.35 },
    // the secret: the rock shelf right of the green, tipping down toward it
    { kind: 'ramp', x0: 50, y0: 546, x1: 80, y1: 582, axis: 'x', h0: 0, h1: 2.6, op: 'add' },
    // deep bunkers
    { kind: 'disc', x: 84, y: 270, r: 9, h: -4, edge: 2.5, op: 'add' },
    { kind: 'disc', x: 30, y: 590, r: 6, h: -3.8, edge: 2, op: 'add' },
    { kind: 'disc', x: -2, y: 572, r: 6, h: -3.8, edge: 2, op: 'add' },
  ],
  walls: [],
  posts: [...woods, ...[[-8, 220, 3], [10, 330, 3.4], [-30, 500, 2.8]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }))],
  movers: [],
  pushes: [],
  zones: [{ id: 'shelf', poly: rect(54, 550, 76, 578) }],
  secret: { name: 'The Shelf', zone: 'shelf', hint: 'Right of the green, the rock tips down toward the flag. Land it on the shelf.' },
  flyover: [
    { x: 0, y: -20 },
    { x: -20, y: 160 },
    { x: 0, y: 380 },
    { x: 26, y: 562 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: -4, y: 300, scale: 2.4 },
    { kind: 'rock', x: 4, y: 380, scale: 2 },
    { kind: 'rock', x: -20, y: 504, scale: 1.8 },
  ],
};
