// Hole 2, The Ledges (par 4, 470 yd as shown): a long split fairway through mossy sandstone ledges in the woods. A
// spine of rock runs down the middle of the hole and splits it in two.
// The play: left of the spine is the wider fairway but leaves a long second over a ledge that guards the front of the
// green. Right of it is narrow, with a creek down the side, but opens the green up.
// The danger: anything on the rock kicks off it, long bunkers pinch both fairways, a pond waits short and right of the
// green, and the green is two tiers, right side up.
// The secret: the rock shelf behind the green on the right. Land on it and it tips the ball down onto the green.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, greenComplex, RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: 30, y: 640, rx: 24, ry: 18 };
const GROUND = 4;
const LEVEL = GROUND - 2.5;
const POND = { x: 66, y: 580, r: 13 };
// the creek down the right-hand side
const CREEK: V2[] = [
  { x: 112, y: 60 },
  { x: 106, y: 240 },
  { x: 110, y: 440 },
  { x: 98, y: 600 },
  { x: 104, y: 750 },
];
// the spine of rock between the two fairways, and the ledge in front of the green
const SPINE = { x0: -16, y0: 170, x1: 18, y1: 470 };
const LEDGE = { x0: -42, y0: 572, x1: 10, y1: 602 };

const traps = [
  bunker(-62, 250, 14, 8, 1, 4, 0.3), // down the left fairway
  bunker(-40, 424, 12, 7, 2, 4, -0.4), // where the left fairway ends
  bunker(62, 466, 12, 6, 3, 4, 0.5), // where the right fairway ends
  bunker(24, 678, 15, 6, 4), // behind the green
  bunker(-10, 652, 7, 11, 5), // left of the green
  bunker(60, 616, 9, 6, 6, 3.6), // between the pond and the green
];

const woods: Post[] = [
  // two rows hard by the left fairway, crowns over its edge
  ...treeLine([{ x: -84, y: 0 }, { x: -86, y: 720 }], 18, 'ledges-left', 4, 2, 1, 12),
  ...treeLine([{ x: 128, y: 40 }, { x: 126, y: 720 }], 20, 'ledges-right', 4),
  ...treeLine([{ x: -90, y: 712 }, { x: 110, y: 714 }], 18, 'ledges-back', 4),
  // a maple standing in each fairway
  tree(-46, 360, 5, 32),
  tree(64, 380, 4.5, 28),
  // round the tee
  tree(-34, -16, 4, 24),
  tree(36, -20, 4, 24),
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
  yards: 470,
  blurb: 'A spine of sandstone splits a long fairway. Left is safer but blind over the ledge; right is tight by the creek.',
  tee: { x: 0, y: 0 },
  cup: { x: 40, y: 646 },
  pins: [{ x: 40, y: 646 }, { x: 16, y: 634 }, { x: 46, y: 628 }, { x: 22, y: 652 }],
  aim: 0,
  bounds: { x0: -130, y0: -40, x1: 160, y1: 750 },
  // out of bounds just past the woods on both sides
  border: [
    { x: -108, y: -36 },
    { x: 148, y: -36 },
    { x: 148, y: 736 },
    { x: -108, y: 736 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // one fairway off the tee, splitting round the spine
    { poly: blob(0, 120, 30, 50, 1, 0.06), surface: 'fairway' },
    { poly: blob(-50, 320, 26, 140, 2, 0.06), surface: 'fairway' },
    { poly: blob(56, 340, 18, 130, 3, 0.06), surface: 'fairway' },
    // they meet again short of the green
    { poly: blob(16, 528, 32, 24, 4, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 5, 0.06), surface: 'green' },
    // the sandstone
    { poly: rect(SPINE.x0, SPINE.y0, SPINE.x1, SPINE.y1), surface: 'rock' },
    { poly: rect(LEDGE.x0, LEDGE.y0, LEDGE.x1, LEDGE.y1), surface: 'rock' },
    { poly: rect(60, 662, 86, 690), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(CREEK, 10), level: LEVEL },
    { poly: blob(POND.x, POND.y, POND.r, POND.r, 7, 0.1), level: LEVEL },
  ],
  terrain: [
    // the tee up on a rock outcrop, the valley falling gently away
    { kind: 'ramp', x0: -130, y0: -40, x1: 160, y1: 20, axis: 'y', h0: 12, h1: 12, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 20, x1: 160, y1: 140, axis: 'y', h0: 12, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 140, x1: 160, y1: 750, axis: 'y', h0: GROUND, h1: GROUND + 1, op: 'set' },
    // wooded slopes
    ...[0, 250, 500, 750].map((y, i) => ({ kind: 'hill' as const, x: -250, y, r: 140, h: 24 + (i % 2) * 6 })),
    ...[0, 250, 500, 750].map((y, i) => ({ kind: 'hill' as const, x: 300, y, r: 140, h: 22 + (i % 2) * 6 })),
    // the spine: a long low wall of sandstone, and the ledge in front of the green
    { kind: 'box', x0: SPINE.x0, y0: SPINE.y0, x1: SPINE.x1, y1: SPINE.y1, h: 9, edge: 4, op: 'add' },
    { kind: 'box', x0: LEDGE.x0, y0: LEDGE.y0, x1: LEDGE.x1, y1: LEDGE.y1, h: 7, edge: 3, op: 'add' },
    // the creek and the pond
    { kind: 'channel', pts: CREEK, width: 12, depth: 4 },
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 3, h: -4, edge: 5, op: 'add' },
    // the green: up a step, falling from right to left toward the ledge, a tier up the right-hand side
    ...greenComplex(GREEN, GROUND, { lift: 2.5, edge: 7, tilt: [0.8, 0.4], tier: { axis: 'x', at: GREEN.x + 6, rise: 0.6 } }),
    // the secret: the rock shelf behind the green on the right, tipping down toward it
    { kind: 'ramp', x0: 58, y0: 660, x1: 88, y1: 692, axis: 'x', h0: 0, h1: 2.6, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...woods, ...[[-8, 220, 3], [10, 330, 3.4], [-4, 430, 3], [-30, 590, 2.8]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }))],
  movers: [],
  pushes: [],
  zones: [{ id: 'shelf', poly: rect(62, 664, 84, 688) }],
  secret: { name: 'The Shelf', zone: 'shelf', hint: 'Behind the green on the right, the rock tips down toward the flag. Land it on the shelf.' },
  flyover: [
    { x: 0, y: -20 },
    { x: -20, y: 180 },
    { x: 0, y: 440 },
    { x: 40, y: 646 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: -4, y: 300, scale: 2.4 },
    { kind: 'rock', x: 4, y: 400, scale: 2 },
    { kind: 'rock', x: -20, y: 586, scale: 1.8 },
  ],
};
