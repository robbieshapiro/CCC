// Hole 3, The Gorge (par 5, about 850 ft, 620 yd as shown): three shots through a wooded river valley in October.
// The play: a drive over the ravine, a second along the river through a chute of maples, then a short iron up to a
// green raised above the river, with a little waterfall below it.
// The danger: the river runs the whole right side and swings across in front of the green; deep bunkers guard it.
// The secret: the bank left of the green kicks a ball right, down toward the flag.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: -20, y: 716, rx: 15, ry: 12 };
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

const maples: Post[] = [
  // the left of the fairway, all the way up
  ...[250, 330, 410].map((y, i) => ({ x: -78 - (i % 2) * 8, y, r: 4, h: 26, e: 0.25, look: 'maple' as const })),
  // the chute: closing in for the second shot
  { x: -40, y: 500, r: 4.5, h: 28, e: 0.2, look: 'maple' },
  { x: -34, y: 560, r: 4.5, h: 28, e: 0.2, look: 'maple' },
  { x: 42, y: 520, r: 4.5, h: 28, e: 0.2, look: 'maple' },
  { x: 36, y: 580, r: 4.5, h: 28, e: 0.2, look: 'maple' },
  // across the river on the right
  ...[260, 360, 460, 560].map((y, i) => ({ x: 138 + (i % 2) * 10, y, r: 4, h: 26, e: 0.25, look: 'maple' as const })),
  // behind the green
  ...[-74, -46, 8, 36].map((x, i) => ({ x, y: 760 + (i % 2) * 10, r: 4, h: 28, e: 0.25, look: 'maple' as const })),
  // round the tee
  { x: -40, y: -16, r: 4, h: 24, e: 0.25, look: 'maple' },
  { x: 44, y: -20, r: 4, h: 24, e: 0.25, look: 'maple' },
];

const base: Hole = {
  id: 'thegorge',
  name: 'The Gorge',
  par: 5,
  theme: 'autumn',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 620,
  blurb: 'Over the ravine, along the river through the maples, then up to a green above the falls.',
  tee: { x: 0, y: 0 },
  cup: { x: -20, y: 718 },
  pins: [{ x: -20, y: 718 }, { x: -31, y: 711 }, { x: -9, y: 721 }, { x: -22, y: 725 }],
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
    { poly: blob(-6, 340, 52, 126, 1, 0.06), surface: 'fairway' },
    // the second-shot fairway, through the chute, and a ribbon joining the two
    { poly: band([{ x: -6, y: 420 }, { x: -2, y: 500 }], 9), surface: 'fairway' },
    { poly: blob(-2, 548, 40, 70, 2, 0.06), surface: 'fairway' },
    // a short collar over the river in front of the green
    { poly: blob(GREEN.x, GREEN.y - 22, 30, 10, 3, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    // deep bunkers: one in the second-shot landing, two at the green
    { poly: blob(-30, 456, 10, 8, 5, 0.12), surface: 'sand' },
    { poly: circle(16, 708, 7), surface: 'sand' },
    { poly: circle(-52, 734, 6), surface: 'sand' },
    // a footpath down to the river and the falls
    { poly: band([{ x: 60, y: 40 }, { x: 66, y: 140 }], 2), surface: 'path' },
  ],
  // the river, and the pool it opens into below the green: a long second that comes up short is wet
  water: [{ poly: band(RIVER, 14), level: LEVEL }, { poly: blob(-4, 650, 78, 20, 6, 0.08), level: LEVEL }],
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
    // the green, raised above the river, leaning toward it
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 10, h: GROUND + 3.5, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.35, h1: 0.35, op: 'add' },
    // the secret: a bank on the left that kicks a ball right, toward the flag
    { kind: 'hill', x: -50, y: 712, r: 16, h: 2.4 },
    // deep bunkers
    { kind: 'disc', x: -30, y: 456, r: 10, h: -2.8, edge: 3, op: 'add' },
    { kind: 'disc', x: 16, y: 708, r: 7, h: -2.8, edge: 2.5, op: 'add' },
    { kind: 'disc', x: -52, y: 734, r: 6, h: -2.6, edge: 2.5, op: 'add' },
  ],
  walls: [],
  posts: [...maples, ...[[110, 610, 3], [70, 642, 2.6], [-80, 172, 2.4]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }))],
  movers: [],
  pushes: [],
  zones: [{ id: 'kick', poly: circle(-48, 712, 10) }],
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
export const thegorge = extend(base, 470, 110);
