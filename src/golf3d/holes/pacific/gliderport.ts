// Hole 4, The Glider Port (par 4, 470 yd as shown): the hard one. From the launch on the highest bluff, a long drive
// down a cliff-top fairway with the sea far below on the right and a sandstone canyon all down the left, then a long
// iron to a small green out on a point. Hang gliders ride the lift off the cliff.
// The play: a drive down the middle, then a long iron or a wood to the point. A bogey is no disgrace.
// The danger: right is a long way down; left is the canyon; short of the green is a chasm. The green is small and
// stands up on the point, falling away on three sides.
// The secret: the Launch. The right edge of the fairway is the old glider launch, mown and falling away toward the
// green. A drive down it runs and runs, and leaves a short iron in.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { grove, rocks } from './common';

const G = 26;
const GREEN = { x: 22, y: 638, rx: 12, ry: 10.5 };
// the canyon down the left of the fairway
const CANYON: V2[] = [
  { x: -52, y: 100 },
  { x: -42, y: 240 },
  { x: -34, y: 380 },
  { x: -40, y: 500 },
  { x: -24, y: 590 },
];
// the launch: down the right side of the fairway, falling toward the green
const LAUNCH: V2[] = [
  { x: 14, y: 190 },
  { x: 20, y: 280 },
  { x: 22, y: 360 },
  { x: 20, y: 430 },
];
const traps = [greenside(GREEN, 0, 622, 6, 6, 1), greenside(GREEN, 6, 660, 7, 5, 2), greenside(GREEN, 40, 620, 5, 6, 3)];

export const gliderport: Hole = {
  id: 'gliderport',
  name: 'The Glider Port',
  par: 4,
  theme: 'coastal',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 470,
  blurb: 'Off the highest bluff, between the canyon and the cliff, then a long iron over the chasm to a small green on the point.',
  teeTip: 'A drive down the middle. Left is the canyon, right a long way down. The green is small: a bogey is fine.',
  tee: { x: 0, y: 0 },
  cup: { x: 22, y: 640 },
  pins: [{ x: 22, y: 640 }, { x: 14, y: 634 }, { x: 30, y: 642 }, { x: 20, y: 645 }],
  aim: 0.01,
  bounds: { x0: -190, y0: -50, x1: 130, y1: 720 },
  border: [
    { x: -186, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 716 },
    { x: -186, y: 716 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(-4, 270, 18, 140, 1, 0.08), surface: 'fringe' },
    { poly: blob(-4, 270, 14, 136, 1, 0.08), surface: 'fairway' },
    { poly: band(LAUNCH, 9), surface: 'fairway' },
    { poly: blob(10, 520, 14, 40, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-186, -46, 126, 716), level: 0, look: 'sea', tide: { amp: 1, period: 58 } }],
  terrain: [
    { kind: 'ramp', x0: -190, y0: -50, x1: 130, y1: 720, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the bluff: high at the launch, falling gently out to the point
    { kind: 'embankment', pts: [{ x: -110, y: -50 }, { x: -104, y: 340 }, { x: -96, y: 560 }], h: [34, 30, 27], width: 140, edge: 10, wobble: 6 },
    // the point the green sits on
    { kind: 'embankment', pts: [{ x: -60, y: 600 }, { x: 10, y: 636 }], h: [26.6, 26], width: 34, edge: 10, wobble: 4 },
    { kind: 'disc', x: 0, y: 0, r: 16, h: 36, edge: 10, op: 'set' },
    { kind: 'hill', x: -20, y: 200, r: 26, h: 1 },
    // the launch falls away toward the green
    { kind: 'ramp', x0: 6, y0: 180, x1: 34, y1: 440, axis: 'y', h0: 1.4, h1: -2.4, op: 'add' },
    // the canyon
    { kind: 'channel', pts: CANYON, width: 15, depth: 14 },
    // the chasm in front of the point: a second shot that comes up short drops in
    { kind: 'channel', pts: [{ x: -70, y: 590 }, { x: 0, y: 584 }, { x: 70, y: 592 }], width: 9, depth: 14 },
    ...greenComplex(GREEN, G, { lift: 2.4, edge: 7, tilt: [-0.4, 0.4], rolls: [[-5, -3, 5, 0.25], [5, 4, 4, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...grove(-130, 120, 7, 26, 'gp-a', 'torrey'),
    ...grove(-120, 330, 8, 30, 'gp-b'),
    ...grove(-110, 560, 6, 24, 'gp-c', 'monterey'),
    ...rocks([[50, 120, 3], [54, 300, 3.4], [56, 460, 2.6], [-80, 240, 3], [-70, 470, 2.8]]),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'launch', poly: band(LAUNCH, 7) }],
  secret: { name: 'The Launch', zone: 'launch', hint: 'The right edge of the fairway is the old glider launch, falling toward the green. A drive down it runs and runs.' },
  flyover: [
    { x: 40, y: -40 },
    { x: 60, y: 240 },
    { x: 60, y: 480 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'craftsman', x: -60, y: -20, rot: 0.3 },
    { kind: 'iceplant', x: 40, y: 40, scale: 1.4 },
    { kind: 'iceplant', x: 44, y: 220, scale: 1.1 },
    { kind: 'iceplant', x: 40, y: 600, scale: 1 },
    { kind: 'poppies', x: -30, y: 60, scale: 1 },
  ],
};
