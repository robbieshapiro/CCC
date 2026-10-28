// Hole 1, The Blowhole (par 4, about 480 ft round the corner, 350 yd as shown): sea cliffs on a volcanic island.
// The opener, and the kindest hole: a wide arm and a big green. The play: a drive up the right-hand arm of the
// headland, then a mid-iron across the corner of the cove to the green.
// The gamble: carry the cove from the tee with a driver, straight at the far headland. Short is the sea.
// The tide: a black-sand beach at the foot of the cliff dries out and floods on the hole clock.
// The secret: the blowhole on the far cliff. Roll a ball over it as it goes off and it throws you at the green.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: -62, y: 346, r: 25 };
const VENT = { x: -30, y: 310, r: 4 };
// the blowhole breathes: a slow swell, then a burst
const PERIOD = 7;
const firing = (t: number) => t % PERIOD > PERIOD - 1.6;

// the spines of the two headlands: the arm the tee is on, and the far one with the green
const arm: V2[] = [
  { x: 26, y: -34 },
  { x: 32, y: 60 },
  { x: 40, y: 150 },
  { x: 42, y: 240 },
  { x: 32, y: 300 },
];
const far: V2[] = [
  { x: -100, y: 352 },
  { x: -70, y: 348 },
  { x: 10, y: 344 },
  { x: 64, y: 332 },
];
const armWay: V2[] = [
  { x: 30, y: 62 },
  { x: 38, y: 150 },
  { x: 40, y: 236 },
  { x: 30, y: 292 },
];
const farWay: V2[] = [
  { x: 44, y: 316 },
  { x: 4, y: 318 },
  { x: -36, y: 322 },
  { x: -80, y: 330 },
];

const rocks: Post[] = [
  [66, 30, 3], [70, 150, 3.4], [-128, 392, 3.6], [74, 380, 3], [-136, 316, 2.8], [62, 232, 2.4],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

// palms along the back of the far headland
const palms: Post[] = [-126, -98, -30, 2, 34, 60].map((x, i) => ({ x, y: 384 + (i % 2) * 8, r: 1, h: 22, look: 'palm' as const }));

const base: Hole = {
  id: 'blowhole',
  name: 'The Blowhole',
  par: 4,
  theme: 'volcanic',
  tour: true,
  tee: { x: 24, y: 0 },
  cup: { x: -60, y: 350 },
  pins: [{ x: -60, y: 350 }, { x: -72, y: 338 }, { x: -48, y: 356 }, { x: -70, y: 358 }],
  aim: -0.02,
  bounds: { x0: -180, y0: -50, x1: 150, y1: 450 },
  border: [
    { x: -176, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 446 },
    { x: -176, y: 446 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(10, -12, 38, 12), surface: 'fairway' },
    // up the right-hand arm
    { poly: band(armWay, 40), surface: 'fringe' },
    { poly: band(armWay, 36), surface: 'fairway' },
    // across the top to the green: the bold landing sits right on the cliff edge
    { poly: band(farWay, 30), surface: 'fringe' },
    { poly: band(farWay, 26), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 4, GREEN.r + 2, 1, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r - 2, 1, 0.07), surface: 'green' },
    { poly: blob(-32, 372, 8, 6, 2, 0.15), surface: 'sand' },
    { poly: blob(-90, 328, 7, 5, 3, 0.15), surface: 'sand' },
    { poly: blob(56, 196, 6, 10, 4, 0.15), surface: 'sand' },
    // the black-sand beach under the cliff
    { poly: blob(-16, 146, 14, 104, 5, 0.1), surface: 'sand' },
    { poly: circle(VENT.x, VENT.y, VENT.r + 1.5), surface: 'rock' },
  ],
  water: [{ poly: rect(-176, -46, 146, 446), level: 0, look: 'sea', tide: { amp: 1.1, period: 46 } }],
  terrain: [
    // the sea floor
    { kind: 'ramp', x0: -180, y0: -50, x1: 150, y1: 450, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the tee and the right-hand arm of the headland: a cliff top that slopes gently down toward the corner
    { kind: 'embankment', pts: arm, h: [27, 26, 24.5, 23, 22], width: 40, edge: 10, wobble: 6 },
    // the far headland the green sits on
    { kind: 'embankment', pts: far, h: [21, 21, 21, 21.5], width: 60, edge: 10, wobble: 8 },
    // the beach: black sand at the foot of the cliff, just above the low tide
    { kind: 'embankment', pts: [{ x: -12, y: 40 }, { x: -14, y: 146 }, { x: -14, y: 250 }], h: [1.5, 1.2, 1.1], width: 7, edge: 14 },
    // rolls in the fairway
    { kind: 'hill', x: 50, y: 130, r: 26, h: 1.4 },
    { kind: 'hill', x: 20, y: 316, r: 22, h: 1.2 },
    // the green: a raised shelf, with a ridge through the middle and a false front toward the cove
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 10, h: 22.5, edge: 9, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 32, x1: GREEN.x + 32, y1: GREEN.y + 32, axis: 'y', h0: -0.3, h1: 0.3, op: 'add' },
    { kind: 'hill', x: GREEN.x + 6, y: GREEN.y + 2, r: 16, h: 0.7 },
    { kind: 'hill', x: GREEN.x - 14, y: GREEN.y - 12, r: 12, h: -0.5 },
    // bunkers
    ...[[-32, 372, 8], [-90, 328, 7], [56, 196, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
    // the blowhole: a dip in the rock with the vent at the bottom
    { kind: 'disc', x: VENT.x, y: VENT.y, r: VENT.r + 2, h: -0.8, edge: 4, op: 'add' },
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [
    {
      id: 'vent',
      look: 'blowhole',
      x: VENT.x,
      y: VENT.y,
      r: VENT.r,
      at: () => ({ x: 0, y: 0 }),
      // up and toward the green
      erupt: (t) => (firing(t) ? { x: -14, y: 16, z: 20 } : null),
    },
  ],
  zones: [{ id: 'blowhole', poly: circle(VENT.x, VENT.y, VENT.r) }],
  secret: { name: 'Thar She Blows', zone: 'blowhole', hint: 'The blowhole on the far cliff goes off every few seconds. Time it right and it does the work.' },
  flyover: [
    { x: 24, y: -30 },
    { x: 40, y: 180 },
    { x: -20, y: 300 },
    { x: -60, y: 350 },
  ],
  decor: [
    { kind: 'teebox', x: 24, y: 0 },
    { kind: 'sign', x: 44, y: -10, rot: 0 },
    { kind: 'bench', x: 6, y: -14, rot: 0 },
    { kind: 'rock', x: 58, y: -20, scale: 2.6 },
  ],
};

// 100 ft longer than it was drawn: the arm stretches, and everything from the beach on slides back
export const blowhole: Hole = extend(base, 150, 100);
