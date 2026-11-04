// Hole 1, Sea Lion Point (par 4, about 470 ft, 345 yd as shown): off a high bluff, down a cliff-top fairway with the
// Pacific all along the right, to a green out on a point across a little cove.
// The play: a drive up the left-centre, then a mid-iron across the corner of the cove to the green.
// The gamble: a big drive down the right edge leaves a short pitch, but the cliff is right there.
// The secret: the old cliff walk runs round the rim of the cove to the green. Roll one round it.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: 46, y: 440, rx: 21, ry: 17 };
// the cliff walk: round the rim of the cove, falling gently to the front of the green
const WALK: V2[] = [
  { x: -34, y: 352 },
  { x: -26, y: 386 },
  { x: -12, y: 414 },
  { x: 18, y: 434 },
];
const WALK_H = [25.2, 24, 22.8, 21.6];

// the barranca: a sandstone canyon across the hole past the drive, so a big one that runs through the fairway is in it
const BARRANCA: V2[] = [
  { x: -170, y: 334 },
  { x: -90, y: 326 },
  { x: -30, y: 318 },
  { x: 10, y: 312 },
];

const cypress: Post[] = [
  // Torrey pines hard up against the left of the fairway, and a second row behind
  ...[70, 130, 190, 250, 300].map((y, i) => ({ x: -42 - (i % 2) * 6, y, r: 2.4, h: 22, look: 'torrey' as const })),
  ...[40, 120, 200, 280, 380].map((y, i) => ({ x: -100 - (i % 2) * 18, y, r: 2.4, h: 22, look: 'torrey' as const })),
  // a pair of tall fan palms behind the tee: this is Southern California
  { x: -30, y: -32, r: 1, h: 30, look: 'palm' },
  { x: 34, y: -36, r: 1, h: 30, look: 'palm' },
  // two on the cliff edge on the right, squeezing the landing
  { x: 30, y: 150, r: 2.4, h: 20, look: 'torrey' },
  { x: 32, y: 262, r: 2.4, h: 20, look: 'torrey' },
  // the old one guarding the left of the green, and two behind it
  { x: -4, y: 470, r: 2.4, h: 22, look: 'monterey' },
  { x: -66, y: 470, r: 2.2, h: 20, look: 'monterey' },
  { x: -110, y: 450, r: 2.2, h: 20, look: 'monterey' },
];

const rocks: Post[] = [
  [64, 120, 3], [58, 230, 3.4], [6, 330, 2.6], [96, 470, 3.2], [100, 404, 2.8],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const sealion: Hole = {
  id: 'sealion',
  name: 'Sea Lion Point',
  par: 4,
  theme: 'coastal',
  tour: true,
  yards: 335,
  blurb: 'A narrow drive between the pines and the cliff, short of the barranca. Then across the corner of the cove.',
  tee: { x: 0, y: 0 },
  cup: { x: 48, y: 442 },
  pins: [{ x: 48, y: 442 }, { x: 36, y: 434 }, { x: 58, y: 446 }, { x: 44, y: 452 }],
  aim: -0.03,
  bounds: { x0: -170, y0: -50, x1: 150, y1: 520 },
  border: [
    { x: -166, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 516 },
    { x: -166, y: 516 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the drive: wide up the left, tighter as it runs toward the cove
    { poly: blob(-8, 190, 25, 110, 1, 0.08), surface: 'fringe' },
    { poly: blob(-8, 190, 21, 106, 1, 0.08), surface: 'fairway' },
    // round the top of the cove: the safe way in
    { poly: blob(-62, 392, 30, 40, 2, 0.1), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    { poly: band(WALK, 3.4), surface: 'path' },
    // bunkers: one short-left of the green, one at the corner of the drive
    { poly: blob(14, 460, 8, 6, 4, 0.15), surface: 'sand' },
    { poly: blob(-56, 236, 7, 10, 5, 0.15), surface: 'sand' },
  ],
  water: [{ poly: rect(-166, -46, 146, 516), level: 0, look: 'sea', tide: { amp: 1, period: 50 } }],
  terrain: [
    // the sea floor
    { kind: 'ramp', x0: -170, y0: -50, x1: 150, y1: 520, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the bluff: high at the tee, falling gently toward the cove
    { kind: 'embankment', pts: [{ x: -90, y: -50 }, { x: -90, y: 250 }], h: [30, 25], width: 132, edge: 10, wobble: 6 },
    // past the cove the land pulls back to the left
    { kind: 'embankment', pts: [{ x: -120, y: 260 }, { x: -120, y: 520 }], h: [24.8, 23], width: 92, edge: 10, wobble: 5 },
    // the point the green sits on, reaching out to the right
    { kind: 'embankment', pts: [{ x: -40, y: 444 }, { x: 70, y: 444 }], h: [22.4, 21.4], width: 32, edge: 10, wobble: 4 },
    // the tee box, up on a knoll
    { kind: 'disc', x: 0, y: 0, r: 18, h: 31, edge: 10, op: 'set' },
    // rolls in the fairway
    { kind: 'hill', x: 20, y: 150, r: 30, h: 1.2 },
    { kind: 'hill', x: -40, y: 210, r: 26, h: 1 },
    // the barranca
    { kind: 'channel', pts: BARRANCA, width: 15, depth: 11 },
    // the cliff walk, a raised path round the rim of the cove
    { kind: 'embankment', pts: WALK, h: WALK_H, width: 4, edge: 4 },
    // worn into a shallow groove by a century of walkers, so a rolling ball keeps to it
    { kind: 'channel', pts: WALK, width: 4.5, depth: 0.7 },
    // the green: a shelf on the point, leaning gently toward the sea
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: 21.2, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: 0.35, h1: -0.35, op: 'add' },
    { kind: 'hill', x: GREEN.x - 8, y: GREEN.y + 6, r: 12, h: 0.4 },
    // bunkers
    ...[[14, 460, 8], [-56, 236, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...cypress, ...rocks],
  movers: [],
  pushes: [],
  zones: [{ id: 'walk', poly: band(WALK.slice(0, 3), 2.6) }],
  secret: { name: 'The Cliff Walk', zone: 'walk', hint: 'An old path runs round the rim of the cove to the green. Roll one round it.' },
  flyover: [
    { x: 30, y: -40 },
    { x: 60, y: 160 },
    { x: 60, y: 330 },
    { x: 46, y: 440 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 24, y: -12, rot: 0.2 },
    { kind: 'iceplant', x: 40, y: 20, scale: 1.4 },
    { kind: 'iceplant', x: 44, y: 90, scale: 1.2 },
    { kind: 'iceplant', x: 40, y: 260, scale: 1.3 },
    { kind: 'iceplant', x: -30, y: 300, scale: 1 },
    { kind: 'iceplant', x: 70, y: 420, scale: 1 },
  ],
};
