// Hole 7, The Double Black (par 4, 560 yd as shown), the hard one, a dogleg left. Off the top of the expert chute,
// 75 ft down a gully of powder between bands of rock to a ledge of moguls; straight on, the ledge ends at a cliff. The
// hole turns left there, down a second, steeper chute and over a mountain stream to a small, firm green with tree wells
// down its left.
// The play: a driver down the chute onto the ledge (the moguls kick it about), then a long iron down the second chute.
// The reward: cut the corner. A full drive aimed left carries the firs on the corner and lands in the second chute,
// leaving a short iron.
// The bail-out: none to speak of. Too long off the tee is over the cliff; the rocks kick a ball anywhere.
// The secret: the Patrol Line. Ski patrol keep a strip groomed down the right of the second chute for the sleds. From
// the ledge, a low runner onto it rides down to the front of the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, moguls, profile } from './common';

const TOP = 150;
const GREEN = { x: -228, y: 776, rx: 12, ry: 10 };
// the patrol line: down the right of the second chute to the front of the green
const LINE: V2[] = [
  { x: -24, y: 504 },
  { x: -54, y: 540 },
  { x: -100, y: 610 },
  { x: -150, y: 666 },
  { x: -204, y: 740 },
  { x: -214, y: 756 },
];
// a mountain stream across the foot of the second chute, in front of the green, in two runs either side of the
// snow bridge the patrol line crosses on
const STREAM_L: V2[] = [
  { x: -360, y: 740 },
  { x: -230, y: 732 },
];
const STREAM_R: V2[] = [
  { x: -192, y: 740 },
  { x: -124, y: 756 },
];
// the rock bands either side of the first chute: boulders a ball kicks off
const rocks: Post[] = [];
for (let y = 60, i = 0; y <= 330; y += 13, i++)
  for (const side of [-1, 1]) {
    const x = side * (36 + ((i * 7) % 5)) + (side > 0 ? 2 : 0);
    rocks.push({ x, y: y + (side > 0 ? 6 : 0), r: 4 + (i % 3), h: 5 + (i % 4), look: 'rock' });
  }
// the stand of firs on the corner, which a big drive cuts across
const corner: Post[] = [];
for (let y = 330, row = 0; y <= 450; y += 18, row++)
  for (let x = -150 + (row % 2 ? 9 : 0); x <= -54; x += 18) {
    const h = 20 + ((x * 7 + y * 3) % 18);
    corner.push({ x, y, r: Math.max(4, Math.round(h * 0.25)), h, soft: true, look: 'snowpine' });
  }
// tree wells: firs in hollows down the left of the green
// and down the right of the second chute
const WELLS: [number, number][] = [
  [-72, 622],
  [-98, 680],
  [-130, 728],
  [-272, 730],
  [-282, 766],
  [-268, 800],
  [-256, 830],
];
const wellFirs: Post[] = WELLS.map(([x, y], i) => ({ x, y, r: 4, h: 20 + (i % 3) * 4, soft: true, look: 'snowpine' }));
const traps = [greenside(GREEN, -208, 772, 6, 8, 2, 3.4, 0), greenside(GREEN, -226, 794, 9, 6, 3, 3.4, 0)];

export const doubleblack: Hole = {
  id: 'doubleblack',
  name: 'The Double Black',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.22,
  yards: 560,
  blurb: 'Double black. Down the chute to a ledge of moguls, then left down a second chute and over the stream. Straight on is a cliff.',
  teeTip: 'Driver to the ledge, or a full one over the firs on the left. Long and straight is over the cliff.',
  tee: { x: 0, y: 0 },
  cup: { x: -228, y: 778 },
  pins: [{ x: -228, y: 778 }, { x: -234, y: 773 }, { x: -221, y: 780 }, { x: -226, y: 783 }],
  aim: -0.02,
  bounds: { x0: -360, y0: -50, x1: 140, y1: 880 },
  border: [
    { x: -356, y: -46 },
    { x: 136, y: -46 },
    { x: 136, y: 548 },
    { x: -36, y: 566 },
    { x: -102, y: 876 },
    { x: -356, y: 876 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the ledge, where the drive comes down: moguls, 64 ft across, ending at the cliff
    { poly: blob(-6, 474, 34, 64, 1, 0.05), surface: 'fairway' },
    // the second chute, down to the left
    { poly: band([{ x: -80, y: 476 }, { x: -116, y: 556 }, { x: -170, y: 650 }, { x: -184, y: 672 }], 20), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the patrol line: groomed for the sleds (it plays as a path)
    { poly: band(LINE, 3.5), surface: 'path' },
    // the lip of the cliff at the end of the ledge
    { poly: band([{ x: 136, y: 552 }, { x: -36, y: 570 }, { x: -100, y: 872 }], 4), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(STREAM_L, 8), level: 25, look: 'lake' },
    { poly: band(STREAM_R, 8), level: 25, look: 'lake' },
  ],
  terrain: [
    ...profile(-360, 140, [
      [-50, TOP],
      [20, TOP],
      // the first chute, steep
      [330, 82],
      // the ledge
      [540, 74],
      // the second chute, steeper
      [730, 28],
      [880, 24],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 15, h: TOP + 1, edge: 10, op: 'set' },
    // the gully: its walls rise either side of the first chute's rocks
    { kind: 'hill', x: -100, y: 200, r: 75, h: 22 },
    { kind: 'hill', x: 100, y: 200, r: 75, h: 22 },
    // moguls on the ledge, where the drive lands
    ...moguls(-34, 18, 420, 516, 2.2, 14),
    { kind: 'channel', pts: STREAM_L, width: 16, depth: 5 },
    { kind: 'channel', pts: STREAM_R, width: 16, depth: 5 },
    // the patrol line is pressed smooth and a touch low, so a ball on it keeps to it
    { kind: 'channel', pts: LINE, width: 7, depth: 0.9 },
    // the tree wells
    ...WELLS.map(([x, y]) => ({ kind: 'disc' as const, x, y, r: 9, h: -4.5, edge: 4, op: 'add' as const })),
    // the green sits up on a bench above the stream, tipped toward it: short, or spun back, and it runs off the front into the water
    ...greenComplex(GREEN, 31, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.4, -1], 2.4), rolls: [[-5, 4, 6, 0.3], [6, -3, 5, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff at the end of the ledge and down the outside of the bend
    cliff([{ x: 140, y: 584 }, { x: -2, y: 600 }, { x: -66, y: 900 }]),
  ],
  walls: [],
  posts: [
    ...rocks,
    ...corner,
    ...wellFirs,
    ...firs([{ x: -200, y: 300 }, { x: -330, y: 640 }], 26, 'db-l', 1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'patrolline', poly: band(LINE.slice(0, 3), 3.5) }],
  secret: { name: 'The Patrol Line', zone: 'patrolline', hint: 'Ski patrol keep a strip groomed down the right of the second chute. From the ledge, a low runner onto it rides down to the green.' },
  flyover: [
    { x: 0, y: -24 },
    { x: -4, y: 460 },
    { x: -120, y: 600 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'double' },
    // ski patrol's hut, on the ledge by the cliff
    { kind: 'patrolhut', x: 70, y: 470, rot: -0.6 },
    { kind: 'rock', x: 30, y: 556, scale: 5 },
    { kind: 'rock', x: -40, y: 640, scale: 5 },
  ],
};
