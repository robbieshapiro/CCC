// Hole 3, The Gorge (par 5, about 850 ft, 620 yd as shown): three shots through a wooded river valley in October.
// The play: a drive over the ravine, a second along the river through a chute of maples, then a short iron up to a
// green raised above the river, with a little waterfall below it.
// The danger: the river runs the whole right side and swings across in front of the green; deep bunkers guard it.
// The secret: the bank left of the green kicks a ball right, down toward the flag.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';
import { bunker, greenComplex, RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: -20, y: 716, rx: 26, ry: 18 };
const traps = [
  bunker(30, 372, 16, 7, 7, 4, 0.4), // right of the drive's landing
  bunker(-36, 296, 13, 6, 8, 4, -0.4), // left of it
  bunker(-28, 456, 14, 7, 5, 4, 0.3), // short of the chute, left
  bunker(22, 432, 10, 6, 9), // short of the chute, right
  bunker(-22, 536, 13, 6, 10, 4, -0.3), // in the second-shot fairway
  bunker(18, 704, 8, 13, 11), // right of the green
  bunker(-62, 752, 8, 11, 12, 3.6), // left of the green, behind the bank
  bunker(-8, 746, 16, 6, 13, 3.6), // behind the green
];
const POND = { x: -62, y: 392, r: 14 };
const GROUND = 5;
const LEVEL = GROUND - 3;
// the river: across the ravine in front of the tee, down the right of the hole, then across the front of the green
const RIVER: V2[] = [
  { x: -220, y: 150 },
  { x: -100, y: 164 },
  { x: 20, y: 172 },
  { x: 84, y: 214 },
  { x: 100, y: 330 },
  { x: 96, y: 470 },
  { x: 80, y: 590 },
  { x: 30, y: 650 },
  { x: -60, y: 664 },
  { x: -220, y: 676 },
];

// (the woods down both sides are added once the hole is lengthened, below)
const maples: Post[] = [
  // the chute: closing in for the second shot
  tree(-40, 500, 4.5, 28),
  tree(-34, 560, 4.5, 28),
  tree(42, 520, 4.5, 28),
  tree(36, 580, 4.5, 28),
  // one in the middle of the second-shot fairway: pick a side
  tree(4, 545, 5, 30),
  // round the tee
  tree(-40, -16, 4, 24),
  tree(44, -20, 4, 24),
];

const base: Hole = {
  id: 'thegorge',
  name: 'The Gorge',
  par: 5,
  theme: 'autumn',
  tour: true,
  turf: RESERVE_TURF,
  weather: 'storm',
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 640,
  blurb: 'Over the ravine, along the river through the maples, then up to a green above the falls.',
  tee: { x: 0, y: 0 },
  cup: { x: -20, y: 724 },
  pins: [{ x: -20, y: 724 }, { x: -38, y: 708 }, { x: 0, y: 726 }, { x: -24, y: 704 }],
  aim: 0,
  bounds: { x0: -220, y0: -40, x1: 200, y1: 820 },
  border: [
    { x: -216, y: -36 },
    { x: 196, y: -36 },
    { x: 196, y: 816 },
    { x: -216, y: 816 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // over the ravine: the drive's landing, then on up the left of the river
    { poly: blob(-6, 340, 36, 126, 1, 0.06), surface: 'fairway' },
    // the second-shot fairway, through the chute, and a ribbon joining the two
    { poly: band([{ x: -6, y: 420 }, { x: -2, y: 500 }], 9), surface: 'fairway' },
    { poly: blob(-2, 548, 28, 70, 2, 0.06), surface: 'fairway' },
    // a short collar over the river in front of the green
    { poly: blob(GREEN.x, GREEN.y - 22, 30, 10, 3, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    // big, deep bunkers: in both landing areas and round the green
    ...traps.map((t) => t.region),
    // a footpath down to the river and the falls
    { poly: band([{ x: 60, y: 40 }, { x: 66, y: 140 }], 2), surface: 'path' },
  ],
  // the river, and the pool it opens into below the green: a long second that comes up short is wet
  water: [
    { poly: band(RIVER, 14), level: LEVEL },
    { poly: blob(-4, 650, 78, 20, 6, 0.08), level: LEVEL },
    // a pond eating into the left of the landing
    { poly: circle(POND.x, POND.y, POND.r), level: LEVEL },
  ],
  terrain: [
    // the tee high on the valley side
    { kind: 'ramp', x0: -220, y0: -40, x1: 200, y1: 30, axis: 'y', h0: 18, h1: 18, op: 'set' },
    { kind: 'ramp', x0: -220, y0: 30, x1: 200, y1: 120, axis: 'y', h0: 18, h1: GROUND + 2, op: 'set' },
    // the valley floor, rising gently to the green
    { kind: 'ramp', x0: -220, y0: 120, x1: 200, y1: 640, axis: 'y', h0: GROUND, h1: GROUND + 1, op: 'set' },
    { kind: 'ramp', x0: -220, y0: 640, x1: 200, y1: 820, axis: 'y', h0: GROUND + 1, h1: GROUND + 1, op: 'set' },
    // the valley walls
    ...[0, 260, 520, 780].map((y, i) => ({ kind: 'hill' as const, x: -320, y, r: 150, h: 26 + (i % 2) * 6 })),
    ...[0, 260, 520, 780].map((y, i) => ({ kind: 'hill' as const, x: 320, y, r: 140, h: 24 + (i % 2) * 6 })),
    { kind: 'hill', x: -20, y: 900, r: 150, h: 24 },
    // the ravine and the river in it
    { kind: 'channel', pts: RIVER, width: 18, depth: 7 },
    { kind: 'box', x0: -84, y0: 628, x1: 76, y1: 672, h: -5, edge: 10, op: 'add' },
    // the green, raised high above the river: falling toward the water and to the right, the back a tier up
    ...greenComplex(GREEN, GROUND, { lift: 4.5, edge: 8, tilt: [-0.6, 0.7], tier: { axis: 'y', at: GREEN.y + 2, rise: 0.7 } }),
    // the pond
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 3, h: -5, edge: 6, op: 'add' },
    // the secret: a bank on the left that kicks a ball right, toward the flag
    { kind: 'ramp', x0: -78, y0: 700, x1: -50, y1: 726, axis: 'x', h0: 3, h1: 0, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...maples, ...[[110, 610, 3], [70, 642, 2.6], [-80, 172, 2.4]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }))],
  movers: [],
  pushes: [],
  zones: [{ id: 'kick', poly: rect(-74, 702, -54, 724) }],
  secret: { name: 'The Kick', zone: 'kick', hint: 'The bank left of the green kicks things right. Use it.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 240 },
    { x: 20, y: 500 },
    { x: 60, y: 640 },
    { x: -20, y: 718 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 22, y: -14, rot: 0 },
    // the falls, where the river drops below the green
    { kind: 'falls', x: 78, y: 612, rot: -0.9 },
    { kind: 'rock', x: 120, y: 300, scale: 1.4 },
    { kind: 'rock', x: -110, y: 640, scale: 1.2 },
  ],
};

// a true three-shotter: everything past the chute sits 110 ft further on, so the green isn't there in two
const long = extend(base, 470, 140);

// then the woods, tight down both sides and behind the green, with out of bounds just past them
export const thegorge: Hole = {
  ...long,
  border: [
    { x: -102, y: -36 },
    { x: 132, y: -36 },
    { x: 132, y: 956 },
    { x: -102, y: 956 },
  ],
  posts: [
    ...long.posts,
    // two rows hard by the left of the fairway, all the way up
    ...treeLine([{ x: -66, y: 200 }, { x: -66, y: 940 }], 18, 'gorge-left', 4, 2, 1, 12),
    ...treeLine([{ x: 122, y: 220 }, { x: 122, y: 790 }], 20, 'gorge-right', 4),
    ...treeLine([{ x: -100, y: 910 }, { x: 70, y: 910 }], 18, 'gorge-back', 4),
  ],
};
