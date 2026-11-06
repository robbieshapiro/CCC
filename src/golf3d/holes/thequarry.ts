// Hole 4, The Quarry (par 4, 475 yd as shown): a Cape hole over an old flooded sandstone quarry. The drowned pit runs
// diagonally across the drive, from short on the left to long on the right; the fairway runs along its far side.
// The play: bite off as much of the quarry as you dare. Carry it on the right and you have a long iron in; play safe
// to the left and it's a wood. Either way the second has to carry the quarry's other arm, which crosses in front of
// a green on a shelf above the water.
// The danger: the quarry twice, a narrow fairway with bunkers along its far edge and the woods behind them, and a
// two-tier green that falls toward the water.
// The secret: the spillway bank behind the green on the left. Run it down that and it feeds onto the green.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, greenComplex, RESERVE_TURF, tree, treeLine } from './woods';

const GROUND = 6;
// the water in the pit sits well below the rim
const LEVEL = GROUND - 7;
const GREEN = { x: 120, y: 640, rx: 28, ry: 22 };
// the quarry: the diagonal pit across the drive, and its arm across the front of the green
const PIT: V2[] = [
  { x: -190, y: 92 },
  { x: -40, y: 197 },
  { x: 110, y: 302 },
  { x: 200, y: 365 },
];
const ARM: V2[] = [
  { x: -60, y: 574 },
  { x: 60, y: 572 },
  { x: 200, y: 580 },
];
// the fairway runs along the far side of the pit, at the same angle
const TURN = Math.atan2(210, 300);
const rblob = (x: number, y: number, rx: number, ry: number, seed: number): V2[] => {
  const c = Math.cos(TURN);
  const s = Math.sin(TURN);
  return blob(0, 0, rx, ry, seed, 0.06).map((p) => ({ x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c }));
};

const traps = [
  bunker(-30, 348, 20, 7, 1, 4, TURN), // along the far edge of the fairway, left
  bunker(58, 410, 16, 6, 2, 4, TURN), // along the far edge, right
  bunker(70, 360, 10, 5, 3, 3.6, TURN), // on the water side, where the carry is longest
  bunker(-84, 292, 12, 5, 7, 3.6, TURN), // on the water side, at the safe end
  bunker(98, 444, 10, 5, 8, 4, TURN), // the far end of the fairway
  bunker(124, 688, 20, 7, 4), // behind the green
  bunker(164, 640, 9, 16, 5), // right of the green
  bunker(86, 612, 11, 7, 6, 3.6), // front left, above the water
];

const woods: Post[] = [
  // two rows along the far side of the fairway, crowns over the bunkers
  ...treeLine([{ x: -150, y: 300 }, { x: 70, y: 452 }], 18, 'quarry-far', 4, 2, 1, 12),
  // the woods down both sides and behind the green
  ...treeLine([{ x: 160, y: 380 }, { x: 160, y: 700 }], 18, 'quarry-right', 4, 2, -1, 11),
  ...treeLine([{ x: -150, y: 330 }, { x: -150, y: 700 }], 20, 'quarry-left', 4),
  ...treeLine([{ x: -140, y: 704 }, { x: 170, y: 708 }], 18, 'quarry-back', 4),
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
  windByHeight: true,
  calmChip: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 475,
  blurb: 'Bite off as much of the quarry as you dare. Then carry its other arm to a green on a shelf above the water.',
  tee: { x: 0, y: 0 },
  cup: { x: 132, y: 650 },
  pins: [{ x: 132, y: 650 }, { x: 102, y: 632 }, { x: 138, y: 630 }, { x: 110, y: 656 }],
  aim: 0.22,
  bounds: { x0: -175, y0: -40, x1: 190, y1: 730 },
  // out of bounds just past the woods
  border: [
    { x: -166, y: -36 },
    { x: 180, y: -36 },
    { x: 180, y: 722 },
    { x: -166, y: 722 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the narrow fairway along the far side of the pit
    { poly: rblob(-12, 332, 132, 22, 1), surface: 'fairway' },
    // a short collar above the arm, in front of the green
    { poly: blob(110, 604, 34, 8, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the quarry's sandstone faces, down to the water
    { poly: band(PIT, 44), surface: 'rock' },
    { poly: band(ARM, 22), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(PIT, 34), level: LEVEL },
    { poly: band(ARM, 15), level: LEVEL },
  ],
  terrain: [
    // the rim, level all round, and the tee a little higher on it
    { kind: 'ramp', x0: -175, y0: -40, x1: 190, y1: 730, axis: 'y', h0: GROUND, h1: GROUND + 1, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 24, h: GROUND + 4, edge: 14, op: 'set' },
    // wooded hills all round
    ...[0, 260, 520].map((y, i) => ({ kind: 'hill' as const, x: -310, y, r: 140, h: 22 + (i % 2) * 6 })),
    ...[0, 260, 520].map((y, i) => ({ kind: 'hill' as const, x: 330, y, r: 140, h: 22 + (i % 2) * 6 })),
    // the pit and the arm: sheer sandstone walls down to the water
    { kind: 'channel', pts: PIT, width: 46, depth: 12 },
    { kind: 'channel', pts: ARM, width: 24, depth: 11 },
    // the green on its shelf: falling from right to left and toward the water, the right side a tier up
    ...greenComplex(GREEN, GROUND, { lift: 3, edge: 9, tilt: [1, 0.8], tier: { axis: 'x', at: GREEN.x + 4, rise: 0.9 }, rolls: [[-8, 8, 6, 0.45], [10, -6, 7, -0.4]] }),
    // the secret: the spillway bank behind the green on the left, running down onto it
    { kind: 'ramp', x0: 64, y0: 652, x1: 90, y1: 694, axis: 'x', h0: 2.6, h1: 0, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: woods,
  movers: [],
  pushes: [],
  zones: [{ id: 'spillway', poly: rect(68, 656, 88, 690) }],
  secret: { name: 'The Spillway', zone: 'spillway', hint: 'Behind the green on the left, the bank feeds down onto it. Run it in off the spillway.' },
  flyover: [
    { x: 0, y: -20 },
    { x: -20, y: 200 },
    { x: 40, y: 380 },
    { x: 128, y: 646 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -14, rot: 0 },
    { kind: 'rock', x: -60, y: 150, scale: 2.2 },
    { kind: 'rock', x: 140, y: 290, scale: 1.8 },
    { kind: 'rock', x: 20, y: 560, scale: 1.6 },
  ],
};
