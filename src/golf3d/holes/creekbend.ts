// Hole 1, Creek Bend (par 4, about 550 ft, 400 yd as shown): a tree-lined dogleg left through the Ohio woods in
// October. A creek runs down the whole left side, then bends across in front of the green.
// The play: a drive down the right-centre, short of the deep bunker, then a short iron over the creek.
// The danger: the big oak on the corner knocks down anything that tries to cut it, and the creek takes the rest.
// The secret: the bank behind and right of the green feeds a ball back down toward the flag.
// Scenery: a red covered bridge carries the cart path over the creek. It's for looking at; it doesn't play.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: -140, y: 512, rx: 18, ry: 15 };
const POND = { x: -88, y: 498, r: 12 };
const GROUND = 3;
const LEVEL = GROUND - 2.2;
// the creek: down the left of the fairway, then bending right across the front of the green
const CREEK: V2[] = [
  { x: -96, y: -40 },
  { x: -92, y: 80 },
  { x: -98, y: 200 },
  { x: -92, y: 320 },
  { x: -72, y: 410 },
  { x: -20, y: 452 },
  { x: 60, y: 470 },
  { x: 180, y: 478 },
];
// the covered bridge, where the cart path crosses the creek right of the green
const BRIDGE = { x: 56, y0: 448, y1: 494, half: 5 };
const DECK = GROUND + 0.4;
const OAK = { x: -58, y: 352 };

// woods on both sides, tight: past them is out of bounds
const maples: Post[] = [
  ...treeLine([{ x: 74, y: 30 }, { x: 76, y: 300 }, { x: 82, y: 430 }], 24, 'cb-right'),
  ...treeLine([{ x: -130, y: 0 }, { x: -130, y: 380 }], 26, 'cb-left'),
  ...treeLine([{ x: -204, y: 578 }, { x: -60, y: 578 }], 22, 'cb-back'),
  ...treeLine([{ x: -202, y: 440 }, { x: -202, y: 560 }], 24, 'cb-greenleft'),
  // two in the elbow of the dogleg, inside the oak
  tree(-40, 300, 4, 24),
  tree(-30, 392, 4, 24),
  // and one standing in the right half of the landing: drive it left of the maple or over it
  tree(16, 292, 5, 30),
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
  yards: 400,
  blurb: 'Down the right, short of the deep bunker. The oak guards the corner and the creek guards the green.',
  tee: { x: 0, y: 0 },
  cup: { x: -140, y: 514 },
  pins: [{ x: -140, y: 514 }, { x: -154, y: 507 }, { x: -126, y: 517 }, { x: -142, y: 524 }],
  aim: -0.02,
  bounds: { x0: -220, y0: -40, x1: 200, y1: 600 },
  // out of bounds just past the woods on both sides
  border: [
    { x: -150, y: -36 },
    { x: 96, y: -36 },
    { x: 96, y: 596 },
    { x: -214, y: 596 },
    { x: -214, y: 420 },
    { x: -150, y: 390 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the drive: a corridor up the right side of the creek
    { poly: blob(-4, 210, 36, 150, 1, 0.05), surface: 'fairway' },
    // the turn and the landing short of the creek
    { poly: blob(-24, 362, 38, 34, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the cart path up the right, over the bridge to the green
    { poly: band([{ x: 90, y: 20 }, { x: 92, y: 300 }, { x: BRIDGE.x, y: 430 }, { x: BRIDGE.x, y: 510 }, { x: -60, y: 546 }], 2.5), surface: 'path' },
    { poly: rect(BRIDGE.x - BRIDGE.half, BRIDGE.y0, BRIDGE.x + BRIDGE.half, BRIDGE.y1), surface: 'wood' },
    // the deep bunker right of the landing, and two by the green
    { poly: blob(38, 318, 12, 9, 4, 0.12), surface: 'sand' },
    { poly: circle(-112, 532, 7), surface: 'sand' },
    { poly: circle(-170, 498, 6), surface: 'sand' },
    { poly: circle(-166, 536, 6), surface: 'sand' },
    // a fairway bunker on the inside of the turn
    { poly: blob(-26, 250, 9, 8, 5, 0.12), surface: 'sand' },
  ],
  water: [{ poly: band(CREEK, 12), level: LEVEL }, { poly: circle(POND.x, POND.y, POND.r), level: LEVEL }],
  terrain: [
    // the tee on a rise, falling to the creek valley
    { kind: 'ramp', x0: -220, y0: -40, x1: 200, y1: 20, axis: 'y', h0: 11, h1: 11, op: 'set' },
    { kind: 'ramp', x0: -220, y0: 20, x1: 200, y1: 140, axis: 'y', h0: 11, h1: GROUND + 1, op: 'set' },
    { kind: 'ramp', x0: -220, y0: 140, x1: 200, y1: 600, axis: 'y', h0: GROUND + 1, h1: GROUND, op: 'set' },
    // wooded hillsides beyond the trees
    ...[0, 200, 400, 600].map((y, i) => ({ kind: 'hill' as const, x: -330, y, r: 140, h: 22 + (i % 2) * 6 })),
    ...[0, 200, 400, 600].map((y, i) => ({ kind: 'hill' as const, x: 300, y, r: 130, h: 20 + (i % 2) * 6 })),
    { kind: 'hill', x: -120, y: 700, r: 140, h: 20 },
    // the creek in its cut
    { kind: 'channel', pts: CREEK, width: 15, depth: 5 },
    { kind: 'embankment', pts: [{ x: BRIDGE.x, y: BRIDGE.y0 - 4 }, { x: BRIDGE.x, y: BRIDGE.y1 + 4 }], h: [DECK, DECK], width: BRIDGE.half, edge: 3 },
    // the green, raised a step off the creek, leaning back toward it
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: GROUND + 0.8, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.5, h1: 0.5, op: 'add' },
    // two humps in the green: read the putt
    { kind: 'hill', x: -150, y: 520, r: 8, h: 0.5 },
    { kind: 'hill', x: -129, y: 505, r: 7, h: 0.4 },
    // the pond right of the green
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 3, h: -4, edge: 6, op: 'add' },
    // the secret: a bank behind and right of the green that feeds back down
    { kind: 'hill', x: -110, y: 538, r: 20, h: 2.6 },
    // deep bunkers: steep-faced, a good way down
    { kind: 'disc', x: 38, y: 318, r: 12, h: -4, edge: 3, op: 'add' },
    { kind: 'disc', x: -26, y: 250, r: 9, h: -3.6, edge: 2.5, op: 'add' },
    { kind: 'disc', x: -166, y: 536, r: 6, h: -3.6, edge: 2, op: 'add' },
    { kind: 'disc', x: -112, y: 532, r: 7, h: -3.6, edge: 2.5, op: 'add' },
    { kind: 'disc', x: -170, y: 498, r: 6, h: -3.6, edge: 2, op: 'add' },
  ],
  walls: [
    { a: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
    { a: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
  ],
  roofs: [{ poly: rect(BRIDGE.x - BRIDGE.half - 1, BRIDGE.y0, BRIDGE.x + BRIDGE.half + 1, BRIDGE.y1), h: 9, top: 14 }],
  posts: [
    // the oak on the corner: a big spread, and it stops what it catches
    { x: OAK.x, y: OAK.y, r: 8, h: 36, soft: true, look: 'oak' },
    ...maples,
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'backbank', poly: circle(-108, 540, 14) }],
  secret: { name: 'The Back Bank', zone: 'backbank', hint: 'Long and right is not lost. The bank behind the green feeds it back toward the flag.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 10, y: 220 },
    { x: -40, y: 380 },
    { x: -140, y: 514 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'pumpkins', x: -36, y: -8 },
    { kind: 'rock', x: -80, y: 140, scale: 1.2 },
    { kind: 'rock', x: -86, y: 430, scale: 1 },
  ],
};
