// Hole 5, The Black Diamond (par 5, 680 yd as shown), a black diamond. Off the top of the expert run, exposed to a
// gusting wind, 120 ft down a mogul field tipped to the right, out across the flats and down a band of rock, to a small
// green in the firs with a mountain stream across its front.
// The play: a driver down the moguls (they kick a ball about), a wood along the flats to lay up short of the stream,
// then a wedge over it.
// The bail-out: there isn't much of one. The powder either side stops a ball dead and the firs are thick.
// The secret: the Groomer. A strip of corduroy runs down the left of the moguls, groomed smooth. Land a drive on it and
// it runs and runs down the hill.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside, bunker, FAIRWAY_DEPTH } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs, moguls } from './common';

const TOP = 150;
const MID = 30;
const FOOT = 6;
const GREEN = { x: -26, y: 1000, rx: 16, ry: 13 };
// the groomer: down the left of the mogul field
const GROOMER: V2[] = [
  { x: -46, y: 230 },
  { x: -48, y: 400 },
  { x: -40, y: 520 },
  { x: -30, y: 640 },
];
// the stream: across the front of the green, then up its left side
const STREAM: V2[] = [
  { x: 150, y: 958 },
  { x: 20, y: 962 },
  { x: -40, y: 958 },
  { x: -62, y: 988 },
  { x: -66, y: 1048 },
];
const traps = [bunker(30, 700, 12, 9, 1, FAIRWAY_DEPTH, -0.3), bunker(-34, 820, 11, 9, 4, FAIRWAY_DEPTH, 0.3), greenside(GREEN, 0, 1012, 7, 8, 2, 3.4, 0), greenside(GREEN, -18, 1026, 9, 6, 3, 3.4, 0)];

export const blackdiamond: Hole = {
  id: 'blackdiamond',
  name: 'The Black Diamond',
  par: 5,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.14,
  yards: 680,
  blurb: 'Black diamond. Down the moguls in the wind, over a band of rock, then the stream to a small green. Par is a fine score.',
  teeTip: 'Driver down the moguls. They\'ll kick it about, so favour the middle.',
  tee: { x: 0, y: 0 },
  cup: { x: -26, y: 1002 },
  pins: [{ x: -26, y: 1002 }, { x: -34, y: 996 }, { x: -17, y: 1005 }, { x: -24, y: 1010 }],
  aim: -0.01,
  bounds: { x0: -150, y0: -50, x1: 150, y1: 1090 },
  border: [
    { x: -146, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 1086 },
    { x: -146, y: 1086 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the mogul field, where the drive comes down: 64 ft across
    { poly: blob(0, 340, 32, 160, 1, 0.05), surface: 'fairway' },
    // the flats, to the lay-up short of the stream
    { poly: blob(-4, 740, 31, 210, 2, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the rock band across the flats
    { poly: rect(-150, 600, 150, 616), surface: 'rock' },
    // the groomer: corduroy, firm and quick
    { poly: band(GROOMER, 4), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(STREAM, 9), level: FOOT - 2, look: 'lake' }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 150, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 20, x1: 150, y1: 480, axis: 'y', h0: TOP, h1: MID, op: 'set' },
    // the flats, then a band of rock: a 12 ft step down across the hole (Nov 22)
    { kind: 'ramp', x0: -150, y0: 480, x1: 150, y1: 600, axis: 'y', h0: MID, h1: MID - 4, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 600, x1: 150, y1: 616, axis: 'y', h0: MID - 4, h1: MID - 16, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 616, x1: 150, y1: 860, axis: 'y', h0: MID - 16, h1: FOOT + 1, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 860, x1: 150, y1: 1090, axis: 'y', h0: FOOT + 1, h1: FOOT, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the mountainside rises on the left of the moguls
    { kind: 'hill', x: -160, y: 330, r: 180, h: 18 },
    ...moguls(-24, 28, 200, 470, 1.5),
    { kind: 'channel', pts: STREAM, width: 18, depth: 5 },
    // the groomer is pressed smooth and a touch below the moguls, so a ball on it keeps to it
    { kind: 'channel', pts: GROOMER, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, FOOT, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.6, 0.8]), rolls: [[-7, -5, 7, 0.35], [8, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...firs([{ x: -66, y: 30 }, { x: -70, y: 860 }], 24, 'bd-l', 1),
    ...firs([{ x: 60, y: 30 }, { x: 64, y: 860 }], 24, 'bd-r', -1),
    ...firs([{ x: -84, y: 900 }, { x: -86, y: 1070 }], 24, 'bd-gl', 1, 1),
    ...firs([{ x: 26, y: 980 }, { x: 30, y: 1070 }], 24, 'bd-gr', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'groomer', poly: band(GROOMER, 4) }],
  secret: { name: 'The Groomer', zone: 'groomer', hint: 'A strip of corduroy runs down the left of the moguls. Land a drive on it and it runs a mile.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 300 },
    { x: -6, y: 800 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'black' },
    // the rock band, boulders along its lip either side of the run
    { kind: 'rock', x: -60, y: 600, scale: 5 },
    { kind: 'rock', x: 58, y: 604, scale: 4 },
  ],
};
