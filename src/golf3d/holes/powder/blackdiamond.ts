// Hole 4, The Black Diamond (par 5, 780 yd as shown), a black diamond, the long one. Off the top of the expert run,
// in a gusting wind, 80 ft down into a mogul field that rises to a ridge of ungroomed powder; over the ridge the run
// falls away steeply to a band of rock, then out across the flats and over a mountain stream to a small green in the
// firs. The mountain falls off a cliff down the whole right side.
// The play: a driver into the moguls (they kick a ball about), a wood down the lower run and over the rock band to the
// flats, then a wedge over the stream.
// The reward: a full, straight drive carries the ridge and runs down the steep lower run, a long way: a wood from there
// clears the rock band and the flats, and can reach the green.
// The bail-out: there isn't much of one. Left is the mountainside in deep powder; right is the cliff.
// The secret: the Groomer. A strip of corduroy runs down the left of the moguls and through the ridge, groomed smooth.
// Land a drive on it and it runs over the ridge and on down the hill.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside, bunker, FAIRWAY_DEPTH } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, moguls, profile } from './common';

const TOP = 150;
// the ridge of powder at the top of the mogul field: a drive that rolls into it stops; one that carries it runs on
const RIDGE = 512;
const GREEN = { x: -26, y: 1110, rx: 15, ry: 12 };
// the cliff edge down the right
const LIP = 70;
// the groomer: down the left of the mogul field, through the ridge and on down the lower run
const GROOMER: V2[] = [
  { x: -40, y: 300 },
  { x: -44, y: 420 },
  { x: -40, y: 540 },
  { x: -30, y: 680 },
];
// the stream: across the front of the green, then up its left side
const STREAM: V2[] = [
  { x: 150, y: 1066 },
  { x: 20, y: 1070 },
  { x: -40, y: 1066 },
  { x: -62, y: 1096 },
  { x: -66, y: 1160 },
];
const traps = [bunker(24, 840, 12, 9, 1, FAIRWAY_DEPTH, -0.3), bunker(-34, 930, 11, 9, 4, FAIRWAY_DEPTH, 0.3), greenside(GREEN, 0, 1120, 7, 8, 2, 3.4, 0), greenside(GREEN, -16, 1134, 9, 6, 3, 3.4, 0)];

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
  greenFirm: 0.18,
  yards: 780,
  blurb: 'Black diamond. Into the moguls, over the powder ridge, down the steep run and the rock band, then the stream. A cliff all down the right.',
  teeTip: 'Driver into the moguls. Only a full one carries the ridge. Right is the cliff.',
  tee: { x: 0, y: 0 },
  cup: { x: -26, y: 1112 },
  pins: [{ x: -26, y: 1112 }, { x: -33, y: 1106 }, { x: -18, y: 1114 }, { x: -24, y: 1119 }],
  aim: -0.01,
  bounds: { x0: -150, y0: -50, x1: 150, y1: 1200 },
  border: [
    { x: -146, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 150 },
    { x: LIP, y: 170 },
    { x: LIP, y: 1010 },
    { x: 146, y: 1030 },
    { x: 146, y: 1196 },
    { x: -146, y: 1196 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the mogul field, where the drive comes down: 68 ft across, up to the ridge
    { poly: blob(-4, 430, 38, 80, 1, 0.04), surface: 'fairway' },
    // the steep lower run, from the ridge down to the rock band
    { poly: blob(-8, 634, 32, 112, 2, 0.05), surface: 'fairway' },
    // the flats, to the lay-up short of the stream
    { poly: blob(-6, 900, 30, 140, 3, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the ridge: a band of ungroomed powder across the top of the moguls
    { poly: rect(-150, RIDGE - 14, 150, RIDGE + 12), surface: 'rough' },
    // the rock band across the lower run
    { poly: rect(-150, 742, 150, 758), surface: 'rock' },
    // the lip of the cliff
    { poly: rect(LIP - 6, 170, LIP + 4, 1010), surface: 'rock' },
    // the groomer: corduroy, firm and quick, right through the ridge
    { poly: band(GROOMER, 4), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(STREAM, 9), level: 2, look: 'lake' }],
  terrain: [
    ...profile(-150, 150, [
      [-50, TOP],
      [20, TOP],
      // the drop into the mogul field
      [200, 72],
      [330, 64],
      // the moguls rise to the ridge, and the ridge rises to a lip before the drop
      [RIDGE - 14, 74],
      [RIDGE + 12, 80],
      // and over it, steeply down the lower run
      [742, 30],
      // the rock band: a 14 ft step
      [758, 16],
      [1000, 6],
      [1200, 4],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the mountainside rises on the left, so the run tips right, toward the cliff
    { kind: 'hill', x: -170, y: 450, r: 180, h: 16 },
    // the moguls, big and tight, where the drive lands
    ...moguls(-30, 30, 350, 496, 2.2, 14),
    { kind: 'channel', pts: STREAM, width: 18, depth: 5 },
    // the groomer is pressed smooth and a touch below the moguls, so a ball on it keeps to it
    { kind: 'channel', pts: GROOMER, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, 5, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.6, 0.8]), rolls: [[-6, -4, 6, 0.35], [7, 4, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 1030 }]),
  ],
  walls: [],
  posts: [
    ...firs([{ x: -76, y: 30 }, { x: -80, y: 1000 }], 24, 'bd-l', 1),
    ...firs([{ x: -90, y: 1020 }, { x: -92, y: 1180 }], 24, 'bd-gl', 1, 1),
    ...firs([{ x: 26, y: 1090 }, { x: 30, y: 1180 }], 24, 'bd-gr', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'groomer', poly: band(GROOMER, 4) }],
  secret: { name: 'The Groomer', zone: 'groomer', hint: 'A strip of corduroy runs down the left of the moguls and right through the ridge. Land a drive on it and it runs on down the hill.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 420 },
    { x: -6, y: 860 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'black' },
    // the rock band, boulders along its lip either side of the run
    { kind: 'rock', x: -60, y: 744, scale: 5 },
    { kind: 'rock', x: 50, y: 748, scale: 4 },
    { kind: 'rock', x: LIP + 2, y: 420, scale: 5 },
    { kind: 'rock', x: LIP, y: 820, scale: 4 },
  ],
};
