// Hole 6, The Double Black (par 4, 470 yd as shown), the hard one: off the top of the expert chute, 120 ft down a
// narrow gully between bands of rock, packed with moguls, then over a mountain stream to a small, firm green with
// tree wells down its left.
// The play: an iron or a wood to the bench halfway down (past it is powder and moguls), then a long one down over the
// stream.
// The bail-out: none to speak of. The rocks kick a ball anywhere, and the tree wells left of the green swallow it.
// The secret: the Patrol Line. Ski patrol keep a strip groomed down the right of the chute for the sleds. Land on it
// and it runs clean past the moguls to the bottom.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs, moguls } from './common';

const TOP = 140;
const MID = 30;
const FOOT = 20;
const GREEN = { x: -8, y: 720, rx: 13, ry: 11 };
// a mountain stream across the run-out, in front of the green
const STREAM: V2[] = [
  { x: -140, y: 674 },
  { x: -40, y: 666 },
  { x: 40, y: 670 },
  { x: 140, y: 682 },
];
// the patrol line: down the right of the chute
const LINE: V2[] = [
  { x: 20, y: 110 },
  { x: 22, y: 250 },
  { x: 16, y: 390 },
  { x: 8, y: 480 },
  { x: 0, y: 580 },
];
// the rock bands either side of the chute: boulders a ball kicks off
const rocks: Post[] = [];
for (let y = 60, i = 0; y <= 400; y += 13, i++)
  for (const side of [-1, 1]) {
    const x = side * (33 + ((i * 7) % 5)) + (side > 0 ? 2 : 0);
    rocks.push({ x, y: y + (side > 0 ? 6 : 0), r: 4 + (i % 3), h: 5 + (i % 4), look: 'rock' });
  }
// tree wells: firs in hollows short and left of the green
const WELLS: [number, number][] = [
  [-46, 520],
  [-60, 560],
  [-42, 600],
  [-36, 700],
  [-50, 730],
  [-38, 756],
];
const wellFirs: Post[] = WELLS.map(([x, y], i) => ({ x, y, r: 4, h: 20 + (i % 3) * 4, soft: true, look: 'snowpine' }));
const traps = [greenside(GREEN, 10, 716, 6, 8, 2, 3.4, 0), greenside(GREEN, -6, 740, 9, 6, 3, 3.4, 0)];

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
  greenFirm: 0.18,
  yards: 470,
  blurb: 'Double black. 120 feet down a chute of moguls between the rocks, then over the stream to a small green. Bogey is no disgrace.',
  teeTip: 'Find the bench halfway down. Past it is powder and moguls.',
  tee: { x: 0, y: 0 },
  cup: { x: -8, y: 722 },
  pins: [{ x: -8, y: 722 }, { x: -15, y: 716 }, { x: 0, y: 724 }, { x: -6, y: 728 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 140, y1: 810 },
  border: [
    { x: -136, y: -46 },
    { x: 136, y: -46 },
    { x: 136, y: 806 },
    { x: -136, y: 806 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the chute is powder and moguls; the cut is a bench halfway down, where the slope eases: 52 ft across
    { poly: blob(0, 262, 26, 44, 1, 0.05), surface: 'fairway' },
    // the run-out at the bottom, short of the stream
    { poly: blob(0, 560, 28, 70, 2, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the patrol line: groomed for the sleds (it plays as a path)
    { poly: band(LINE, 3.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(STREAM, 8), level: FOOT + 1, look: 'lake' }],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 140, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    // the chute: steep, a bench halfway down, steep again, then easing out at the bottom
    { kind: 'ramp', x0: -140, y0: 20, x1: 140, y1: 210, axis: 'y', h0: TOP, h1: 82, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 210, x1: 140, y1: 310, axis: 'y', h0: 82, h1: 75, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 310, x1: 140, y1: 420, axis: 'y', h0: 75, h1: MID, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 420, x1: 140, y1: 810, axis: 'y', h0: MID, h1: FOOT, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 15, h: TOP + 1, edge: 10, op: 'set' },
    // the gully: the walls of the chute rise either side of the rocks
    { kind: 'hill', x: -90, y: 230, r: 75, h: 22 },
    { kind: 'hill', x: 90, y: 230, r: 75, h: 22 },
    // moguls, tight, down the middle and left of the chute
    ...moguls(-18, 8, 90, 200, 1.6),
    ...moguls(-18, 8, 318, 392, 1.8),
    // the patrol line is pressed smooth and a touch low, so a ball on it keeps to it
    { kind: 'channel', pts: LINE, width: 7, depth: 0.9 },
    { kind: 'channel', pts: STREAM, width: 16, depth: 5 },
    // the tree wells
    ...WELLS.map(([x, y]) => ({ kind: 'disc' as const, x, y, r: 9, h: -4.5, edge: 4, op: 'add' as const })),
    ...greenComplex(GREEN, FOOT, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.5, 0.85]), rolls: [[-6, -4, 6, 0.35], [7, 4, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...rocks,
    ...wellFirs,
    ...firs([{ x: -90, y: 420 }, { x: -94, y: 790 }], 26, 'db-l', 1, 1),
    ...firs([{ x: 70, y: 420 }, { x: 74, y: 790 }], 26, 'db-r', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'patrolline', poly: band(LINE.slice(0, 3), 3.5) }],
  secret: { name: 'The Patrol Line', zone: 'patrolline', hint: 'Ski patrol keep a strip groomed down the right of the chute for the sleds. Land on it and it runs clean past the moguls.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 200 },
    { x: -2, y: 580 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'double' },
    // ski patrol's hut, off to the right at the bottom of the chute
    { kind: 'patrolhut', x: 104, y: 470, rot: -0.6 },
  ],
};
