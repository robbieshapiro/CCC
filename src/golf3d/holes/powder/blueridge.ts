// Hole 4, Blue Ridge Cruiser (par 4, 430 yd as shown), a blue square: a long rolling cruiser down the ridge, over two
// rollers, the whole run tipped to the right toward the firs and their tree wells, then over a creek to the green.
// The play: a driver up the left side (the slope brings it back), then a mid iron down the hill.
// The bail-out: left, high on the slope. The right is firs and tree wells, hollows round the trunks a ball can't get out of.
// The secret: the Cat Track. The groomers' road runs down the left of the run to the front of the green, worn into a
// groove. Land a drive on it and it rolls all the way down.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { bunker, FAIRWAY_DEPTH, greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const TOP = 110;
const FOOT = 18;
const GREEN = { x: 30, y: 600, rx: 17, ry: 14 };
// the cat track: down the left to the front left of the green
const TRACK: V2[] = [
  { x: -54, y: 200 },
  { x: -58, y: 340 },
  { x: -44, y: 470 },
  { x: -10, y: 550 },
  { x: 10, y: 576 },
];
// tree wells: firs on the right of the run, each in a hollow
const WELLS: [number, number][] = [
  [62, 250],
  [70, 310],
  [58, 370],
  [74, 430],
  [62, 490],
];
// a creek across the front of the green, in two runs either side of the snow bridge the cat track crosses on
const CREEK_L: V2[] = [
  { x: -140, y: 560 },
  { x: -30, y: 552 },
];
const CREEK_R: V2[] = [
  { x: 14, y: 550 },
  { x: 80, y: 552 },
  { x: 150, y: 566 },
];
const wellFirs: Post[] = WELLS.map(([x, y], i) => ({ x, y, r: 4, h: 22 + (i % 3) * 4, soft: true, look: 'snowpine' }));
const traps = [bunker(36, 380, 11, 8, 1, FAIRWAY_DEPTH, 0.3), greenside(GREEN, 8, 596, 6, 8, 2, 3.4, 0), greenside(GREEN, 50, 610, 7, 7, 3, 3.4, 0.4)];

export const blueridge: Hole = {
  id: 'blueridge',
  name: 'Blue Ridge Cruiser',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 430,
  blurb: 'Blue square. A long cruiser over two rollers, tipped right toward the tree wells, then over the creek. Favour the left.',
  teeTip: 'Driver up the left. The slope brings it back.',
  tee: { x: 0, y: 0 },
  cup: { x: 30, y: 602 },
  pins: [{ x: 30, y: 602 }, { x: 20, y: 596 }, { x: 40, y: 605 }, { x: 28, y: 610 }],
  aim: 0.04,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 690 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 686 },
    { x: -136, y: 686 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the cruiser: 68 ft across over the rollers
    { poly: blob(-4, 290, 34, 170, 1, 0.05), surface: 'fairway' },
    // the lay-up, short of the creek
    { poly: blob(10, 496, 28, 34, 2, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the cat track: packed by the groomers (it plays as a path)
    { poly: band(TRACK, 3.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(CREEK_L, 7), level: FOOT - 0.5, look: 'lake' },
    { poly: band(CREEK_R, 7), level: FOOT - 0.5, look: 'lake' },
  ],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 150, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 20, x1: 150, y1: 540, axis: 'y', h0: TOP, h1: FOOT + 2, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 540, x1: 150, y1: 690, axis: 'y', h0: FOOT + 2, h1: FOOT, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the run tips right: the mountainside rises on the left
    { kind: 'hill', x: -140, y: 300, r: 175, h: 18 },
    // the two rollers
    { kind: 'hill', x: -6, y: 210, r: 42, h: 5 },
    { kind: 'hill', x: 2, y: 390, r: 40, h: 4 },
    // the tree wells: deep hollows round the trunks
    ...WELLS.map(([x, y]) => ({ kind: 'disc' as const, x, y, r: 9, h: -4, edge: 4, op: 'add' as const })),
    { kind: 'channel', pts: CREEK_L, width: 14, depth: 4 },
    { kind: 'channel', pts: CREEK_R, width: 14, depth: 4 },
    // the cat track sits a little into the snow, so a ball on it keeps to it
    { kind: 'channel', pts: TRACK, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, FOOT, { lift: 0.8, edge: 10, tilt: slope(GREEN, 10, [-0.5, 0.85]), rolls: [[-8, -5, 7, 0.35], [9, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...wellFirs,
    ...firs([{ x: -92, y: 30 }, { x: -96, y: 640 }], 26, 'br-l', 1),
    ...firs([{ x: 96, y: 30 }, { x: 100, y: 640 }], 26, 'br-r', -1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'cattrack', poly: band(TRACK.slice(0, 4), 3.5) }],
  secret: { name: 'The Cat Track', zone: 'cattrack', hint: 'The groomers\' road runs down the left of the run, worn into a groove. Land a drive on it and it rolls to the green.' },
  flyover: [
    { x: 0, y: -24 },
    { x: -4, y: 250 },
    { x: 12, y: 480 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'blue' },
  ],
};
