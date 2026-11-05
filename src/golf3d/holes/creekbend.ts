// Hole 1, Creek Bend (par 4, 460 yd as shown): a long dogleg left down a narrow, tree-lined fairway, in the parkland
// style of a championship course in central Ohio. A creek runs the whole left side, then turns and crosses in front
// of a big two-tier green.
// The play: a drive down the right half, short of the long bunker, then a long iron over the creek to the right tier.
// The danger: the oak on the corner, the creek on the left and in front, a pond right of the green, and a green that
// throws a weak approach back down its front tier.
// The secret: the bank right of the green tips a ball back onto it.
// Scenery: a red covered bridge carries the cart path over the creek. It's for looking at; it doesn't play.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, greenComplex, RESERVE_TURF, tree, treeLine } from './woods';

const GROUND = 3;
const LEVEL = GROUND - 2.2;
const GREEN = { x: -150, y: 604, rx: 24, ry: 18 };
const POND = { x: -80, y: 618, r: 14 };
// the creek down the left, and where it turns to cross in front of the green
const CREEK: V2[] = [
  { x: -70, y: -40 },
  { x: -68, y: 160 },
  { x: -72, y: 330 },
  { x: -66, y: 450 },
  { x: -58, y: 532 },
];
const CROSS: V2[] = [
  { x: -260, y: 552 },
  { x: -150, y: 547 },
  { x: -58, y: 534 },
  { x: 40, y: 545 },
  { x: 96, y: 550 },
];
const BRIDGE = { x: 40, y0: 527, y1: 565, half: 5 };
const DECK = GROUND + 0.4;

const traps = [
  bunker(36, 380, 18, 9, 1, 4, 0.2), // the long one right of the landing
  bunker(-38, 318, 13, 7, 2, 4, 0.6), // inside the turn
  bunker(-2, 474, 16, 6, 3, 4, -0.3), // across the end of the turn
  bunker(-122, 648, 12, 6, 4, 4, 0.5), // behind the green, right
  bunker(-188, 618, 8, 13, 5), // left of the green
  bunker(-142, 574, 15, 5, 6, 3.6), // the front, between the creek and the green
];

const woods: Post[] = [
  // two rows hard by the right of the fairway, crowns over its edge
  ...treeLine([{ x: 34, y: 20 }, { x: 36, y: 330 }, { x: 62, y: 430 }, { x: 72, y: 520 }], 18, 'cb-right', 4, 2, -1, 12),
  // a broken line between the fairway and the creek
  ...treeLine([{ x: -46, y: 80 }, { x: -48, y: 290 }], 32, 'cb-creekside', 3),
  // the woods beyond the creek
  ...treeLine([{ x: -98, y: 0 }, { x: -100, y: 420 }], 18, 'cb-left', 5, 2, 1, 12),
  // round the green
  ...treeLine([{ x: -232, y: 664 }, { x: -60, y: 666 }], 18, 'cb-back', 4),
  ...treeLine([{ x: -226, y: 470 }, { x: -228, y: 650 }], 20, 'cb-greenleft', 4),
  // the oak on the corner
  { x: -54, y: 392, r: 9, h: 38, soft: true, look: 'oak' },
  tree(-30, 404, 4, 22),
  // round the tee
  tree(-30, -16, 4, 24),
  tree(30, -20, 4, 24),
];

export const creekbend: Hole = {
  id: 'creekbend',
  name: 'Creek Bend',
  par: 4,
  theme: 'autumn',
  tour: true,
  turf: RESERVE_TURF,
  weather: 'storm',
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 460,
  blurb: 'A long dogleg left. The oak guards the corner, the creek runs the left and crosses in front of a two-tier green.',
  tee: { x: 0, y: 0 },
  cup: { x: -150, y: 612 },
  pins: [{ x: -150, y: 612 }, { x: -166, y: 598 }, { x: -134, y: 615 }, { x: -146, y: 592 }],
  aim: -0.02,
  bounds: { x0: -255, y0: -40, x1: 100, y1: 700 },
  // out of bounds just past the woods
  border: [
    { x: -120, y: -36 },
    { x: 92, y: -36 },
    { x: 92, y: 690 },
    { x: -246, y: 690 },
    { x: -246, y: 460 },
    { x: -120, y: 430 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // a narrow fairway up the right of the creek, the turn, and a short collar on the far side of the creek
    { poly: blob(-6, 250, 24, 150, 1, 0.05), surface: 'fairway' },
    { poly: blob(-30, 430, 26, 26, 2, 0.08), surface: 'fairway' },
    { poly: blob(-150, 576, 30, 8, 3, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    // the cart path up the right, over the bridge to the green
    { poly: band([{ x: 60, y: 20 }, { x: 62, y: 300 }, { x: 50, y: 470 }, { x: BRIDGE.x, y: 515 }, { x: BRIDGE.x, y: 578 }, { x: -60, y: 596 }], 2.5), surface: 'path' },
    { poly: rect(BRIDGE.x - BRIDGE.half, BRIDGE.y0, BRIDGE.x + BRIDGE.half, BRIDGE.y1), surface: 'wood' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(CREEK, 10), level: LEVEL },
    { poly: band(CROSS, 9), level: LEVEL },
    { poly: circle(POND.x, POND.y, POND.r), level: LEVEL },
  ],
  terrain: [
    // the tee on a rise, falling to the creek valley
    { kind: 'ramp', x0: -255, y0: -40, x1: 100, y1: 20, axis: 'y', h0: 11, h1: 11, op: 'set' },
    { kind: 'ramp', x0: -255, y0: 20, x1: 100, y1: 150, axis: 'y', h0: 11, h1: GROUND + 1, op: 'set' },
    { kind: 'ramp', x0: -255, y0: 150, x1: 100, y1: 700, axis: 'y', h0: GROUND + 1, h1: GROUND, op: 'set' },
    // wooded hillsides
    ...[0, 240, 480, 720].map((y, i) => ({ kind: 'hill' as const, x: -360, y, r: 150, h: 22 + (i % 2) * 6 })),
    ...[0, 240, 480, 720].map((y, i) => ({ kind: 'hill' as const, x: 230, y, r: 130, h: 20 + (i % 2) * 6 })),
    { kind: 'hill', x: -140, y: 820, r: 150, h: 20 },
    // the creek in its cut, and the bridge
    { kind: 'channel', pts: CREEK, width: 13, depth: 5 },
    { kind: 'channel', pts: CROSS, width: 12, depth: 5 },
    { kind: 'embankment', pts: [{ x: BRIDGE.x, y: BRIDGE.y0 - 4 }, { x: BRIDGE.x, y: BRIDGE.y1 + 4 }], h: [DECK, DECK], width: BRIDGE.half, edge: 3 },
    // the green: a broad plateau just up off the creek, rising to the right and away, a tier across its middle
    ...greenComplex(GREEN, GROUND, { lift: 2, edge: 9, tilt: [0.6, 0.6], tier: { axis: 'y', at: GREEN.y + 1, rise: 0.7 } }),
    // the secret: the bank right of the green, tipping down toward it
    { kind: 'ramp', x0: -128, y0: 594, x1: -104, y1: 632, axis: 'x', h0: 0, h1: 2.6, op: 'add' },
    // the pond
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 3, h: -4, edge: 6, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [
    { a: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
    { a: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
  ],
  roofs: [{ poly: rect(BRIDGE.x - BRIDGE.half - 1, BRIDGE.y0, BRIDGE.x + BRIDGE.half + 1, BRIDGE.y1), h: 9, top: 14 }],
  posts: woods,
  movers: [],
  pushes: [],
  zones: [{ id: 'backbank', poly: rect(-126, 598, -106, 628) }],
  secret: { name: 'The Back Bank', zone: 'backbank', hint: 'Right of the green, the bank tips a ball back onto it. Use it.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 260 },
    { x: -40, y: 440 },
    { x: -150, y: 612 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'pumpkins', x: -36, y: -8 },
    { kind: 'rock', x: -80, y: 140, scale: 1.2 },
    { kind: 'rock', x: -76, y: 460, scale: 1 },
  ],
};
