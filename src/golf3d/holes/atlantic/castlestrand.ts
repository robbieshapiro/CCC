// Hole 3, Castle Strand (par 5, 605 yd as shown): the finisher. Up the coast with the Atlantic all down the right,
// to a green on the cliff edge under the ruined castle.
// The play: a drive up the fairway on the cliff top, a second up to the pots, a short iron in.
// The bail-out: left is always land. The green tips toward the sea, so leave it below the hole on the left.
// The secret: the Strand. Under the cliff on the right the sand is wet and hard. A drive that lands on it runs and
// runs along the shore, and leaves one big shot to the green. Miss it and it's the sea.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { dunes, gorse, LINKS_TURF, pot } from './common';

const GROUND = 8;
const GREEN = { x: 56, y: 822, rx: 20, ry: 17 };
// the coast: the cliff top the hole runs along, and the point the green sits on
const COAST: V2[] = [
  { x: 2, y: -50 },
  { x: 6, y: 200 },
  { x: 12, y: 500 },
  { x: -30, y: 640 },
  { x: -40, y: 900 },
];
const HEAD: V2[] = [
  { x: 0, y: 590 },
  { x: 40, y: 650 },
  { x: 52, y: 730 },
  { x: 54, y: 830 },
  { x: 52, y: 900 },
];
// the strand: hard wet sand under the cliff, rising at its far end back up to the cliff top
const STRAND: V2[] = [
  { x: 128, y: 215 },
  { x: 132, y: 360 },
  { x: 130, y: 500 },
  { x: 118, y: 570 },
  { x: 100, y: 630 },
];
const STRAND_H = [1.8, 1.8, 1.9, 2.8, 8];
// the reef: a low bar of rock and shingle on the seaward side, so the strand is a trough between it and the cliff
const REEF: V2[] = STRAND.slice(0, 4).map((p) => ({ x: p.x + 17, y: p.y }));
const traps = [
  pot(-30, 310, 7, 1), // left of the drive
  pot(2, 650, 7, 2), // left of the second
  pot(72, 720, 7, 3), // the end of the second fairway
  greenside(GREEN, 28, 806, 7, 9, 4, 3.4, 0), // left of the green
  greenside(GREEN, 62, 856, 9, 6, 5, 3.4, 0), // behind it
];

export const castlestrand: Hole = {
  id: 'castlestrand',
  name: 'Castle Strand',
  par: 5,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 605,
  blurb: 'Up the cliff top with the sea all down your right, to a green on the edge under the castle.',
  tee: { x: 0, y: 0 },
  cup: { x: 56, y: 824 },
  pins: [{ x: 56, y: 824 }, { x: 44, y: 816 }, { x: 66, y: 830 }, { x: 52, y: 834 }],
  aim: 0,
  bounds: { x0: -150, y0: -50, x1: 230, y1: 900 },
  border: [
    { x: -146, y: -46 },
    { x: 226, y: -46 },
    { x: 226, y: 896 },
    { x: -146, y: 896 },
  ],
  base: 'rough',
  regions: [
    // the beach under the cliff, soft and dry
    { poly: band([{ x: 104, y: -46 }, { x: 108, y: 200 }, { x: 114, y: 500 }], 9), surface: 'sand' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the drive: 68 ft of fairway on the cliff top
    { poly: blob(0, 290, 34, 140, 1, 0.06), surface: 'fairway' },
    // the second: on up the cliff top
    { poly: blob(40, 664, 32, 58, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the strand: hard wet sand, as firm as a road
    { poly: band(REEF, 5), surface: 'rock' },
    { poly: band(STRAND.slice(0, 4), 11), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-146, -46, 226, 896), level: 0, look: 'sea', tide: { amp: 0.8, period: 50 } }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 230, y1: 900, axis: 'y', h0: -8, h1: -8, op: 'set' },
    { kind: 'embankment', pts: COAST, h: [GROUND, GROUND, GROUND, GROUND, GROUND], width: 100, edge: 12, wobble: 5 },
    // the land runs on inland, past the left edge of the hole
    { kind: 'embankment', pts: [{ x: -130, y: -50 }, { x: -130, y: 900 }], h: [GROUND, GROUND], width: 60, edge: 12 },
    { kind: 'embankment', pts: HEAD, h: [GROUND, GROUND, GROUND, GROUND, GROUND], width: 62, edge: 12, wobble: 5 },
    { kind: 'embankment', pts: STRAND, h: STRAND_H, width: 12, edge: 8 },
    { kind: 'embankment', pts: REEF, h: [4.6, 4.6, 4.8, 5.6], width: 2.5, edge: 5 },
    // worn a little hollow down its middle, so a running ball keeps to it
    { kind: 'channel', pts: STRAND.slice(0, 3), width: 11, depth: 0.6 },
    // dunes along the landward side, and the rise the castle stands on
    ...dunes([[-116, 60, 44, 9], [-110, 220, 46, 10], [-112, 380, 44, 8], [-96, 540, 48, 10], [-80, 690, 50, 9], [-70, 830, 48, 9], [-14, 878, 40, 7]]),
    // rumples in the fairways
    ...dunes([[-18, 170, 24, 1.5], [14, 240, 22, -1.1], [-12, 330, 22, 1.3], [12, 400, 20, 1.2], [30, 630, 20, 1.4], [54, 690, 18, -1]]),
    { kind: 'disc', x: 0, y: -2, r: 16, h: GROUND + 4, edge: 10, op: 'set' },
    ...greenComplex(GREEN, GROUND, { lift: 1, edge: 11, tilt: [-1, 0.5], rolls: [[-8, -6, 7, 0.35], [9, 7, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: gorse([[-52, 120], [-56, 260], [-50, 400], [60, 180], [66, 330], [-30, 540], [-12, 720], [8, 780], [98, 770], [26, 872]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'strand', poly: band(STRAND.slice(0, 3), 11) }],
  secret: { name: 'The Strand', zone: 'strand', hint: 'Under the cliff on the right the wet sand is as hard as a road. Land a drive on it and it runs for ever.' },
  flyover: [
    { x: -10, y: -30 },
    { x: -5, y: 280 },
    { x: 40, y: 580 },
    { x: 56, y: 820 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
    { kind: 'ruin', x: 92, y: 880, rot: -0.3 },
    { kind: 'sheep', x: -80, y: 150, rot: 0.6 },
    { kind: 'sheep', x: -86, y: 300, rot: -1.2 },
    { kind: 'sheep', x: -60, y: 600, rot: 2.4 },
    { kind: 'sheep', x: -24, y: 790, rot: 0.2 },
  ],
};
