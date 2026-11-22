// Hole 6, Castle Strand (par 5, 680 yd as shown): the finisher. Up the coast with the Atlantic all down the right,
// to a green out on the castle rock: a sea stack off the point, cut off from the headland by a gorge of open sea and
// joined to it by the old castle causeway, a long stone bridge on arches (Nov 22, the grand finale).
// The play: a drive up the fairway on the cliff top, a second over the river to the headland, a pitch over the gorge.
// The bold play: go for the rock in two, all carry over the gorge. Eagle if it holds, the sea if it doesn't.
// The bail-out: the causeway. Lay up to the bridgehead and bump it across; the parapets keep it on.
// The green tips toward the sea, so leave it below the hole on the left.
// The secret: the Strand. Under the cliff on the right the sand is wet and hard. A drive that lands on it runs and
// runs along the shore, and leaves one big shot to the green. Miss it and it's the sea.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { LINKS_TURF, dunes, gorse, pot, slope, stoneBridge } from './common';

const GROUND = 8;
const GREEN = { x: 70, y: 924, rx: 18, ry: 15 };
// the coast: the cliff top the hole runs along, and the point the green sits on
const COAST: V2[] = [
  { x: 2, y: -50 },
  { x: 6, y: 200 },
  { x: 12, y: 500 },
  { x: -30, y: 740 },
  { x: -96, y: 880 },
  { x: -110, y: 1000 },
];
// the headland ends at the bridgehead; past it, the gorge
const HEAD: V2[] = [
  { x: 0, y: 590 },
  { x: 40, y: 750 },
  { x: 44, y: 790 },
];
// the castle rock: the green and, beside it, the castle, sheer to the sea all round
const ROCK: V2[] = [
  { x: 68, y: 922 },
  { x: 150, y: 928 },
];
// the strand: hard wet sand under the cliff, rising at its far end back up to the cliff top
const STRAND: V2[] = [
  { x: 128, y: 215 },
  { x: 132, y: 360 },
  { x: 130, y: 500 },
  { x: 118, y: 570 },
  { x: 100, y: 630 },
];
// the burn: a stream across the hole at the end of the drive, running out over the cliff
const BURN: V2[] = [
  { x: 30, y: 552 },
  { x: 0, y: 560 },
  { x: -60, y: 566 },
  { x: -140, y: 572 },
];
const STRAND_H = [1.8, 1.8, 1.9, 2.8, 8];
// Nov 22 (the Irish pass): the burn is a river now, with the old stone bridge where the lay-up crosses it
const BRIDGE = stoneBridge({ x: 8, y: 538 }, { x: -2, y: 580 }, 4.5, GROUND + 0.4);
// the castle causeway over the gorge, headland to rock
const CAUSEWAY = stoneBridge({ x: 50, y: 830 }, { x: 64, y: 898 }, 4.5, GROUND + 0.4, -8);
// the reef: a low bar of rock and shingle on the seaward side, so the strand is a trough between it and the cliff
const REEF: V2[] = STRAND.slice(0, 4).map((p) => ({ x: p.x + 17, y: p.y }));
const traps = [
  pot(-30, 310, 7, 1), // left of the drive
  pot(2, 750, 7, 2), // left of the second
  pot(70, 790, 7, 3), // right of the bridgehead
  greenside(GREEN, 94, 942, 7, 6, 5, 3.4, 0), // behind and right, under the castle walls
];

export const castlestrand: Hole = {
  id: 'castlestrand',
  name: 'Castle Strand',
  par: 5,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  weather: 'soft',
  drizzle: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.15, // Nov 19: a step firmer (was 0.12)
  yards: 680,
  blurb: 'Up the cliff top with the sea on your right, over the river, then across the gorge to a green on the castle rock.',
  teeTip: 'The gorge guards the rock. Carry it in two if you dare, or lay up and run one over the castle causeway.',
  tee: { x: 0, y: 0 },
  cup: { x: 70, y: 926 },
  pins: [{ x: 70, y: 926 }, { x: 59, y: 918 }, { x: 80, y: 930 }, { x: 67, y: 935 }],
  aim: 0,
  bounds: { x0: -150, y0: -50, x1: 230, y1: 1000 },
  border: [
    { x: -146, y: -46 },
    { x: 226, y: -46 },
    { x: 226, y: 996 },
    { x: -146, y: 996 },
  ],
  base: 'rough',
  regions: [
    // the beach under the cliff, soft and dry
    { poly: band([{ x: 104, y: -46 }, { x: 108, y: 200 }, { x: 114, y: 500 }], 9), surface: 'sand' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the drive: 52 ft of fairway on the cliff top
    { poly: blob(0, 290, 26, 140, 1, 0.06), surface: 'fairway' },
    // the second: on up the cliff top
    { poly: blob(36, 700, 32, 90, 2, 0.08), surface: 'fairway' },
    // the lay-up: a tongue of fairway out to the bridgehead
    { poly: blob(46, 812, 13, 24, 5, 0.06), surface: 'fairway' },
    // a wide collar, mown for the run-up (Nov 18: bigger, lower links greens)
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 7, GREEN.ry + 7, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the strand: hard wet sand, as firm as a road
    { poly: band(REEF, 5), surface: 'rock' },
    { poly: band(STRAND.slice(0, 4), 11), surface: 'path' },
    BRIDGE.region,
    CAUSEWAY.region,
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: rect(-146, -46, 226, 996), level: 0, look: 'sea', tide: { amp: 0.8, period: 50 } },
    { poly: band(BURN, 8), level: GROUND - 1.4, look: 'lake' },
  ],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 230, y1: 1000, axis: 'y', h0: -8, h1: -8, op: 'set' },
    { kind: 'embankment', pts: COAST, h: [GROUND, GROUND, GROUND, GROUND, GROUND], width: 100, edge: 12, wobble: 5 },
    // the land runs on inland, past the left edge of the hole
    { kind: 'embankment', pts: [{ x: -130, y: -50 }, { x: -130, y: 1000 }], h: [GROUND, GROUND], width: 60, edge: 12 },
    { kind: 'embankment', pts: HEAD, h: [GROUND, GROUND, GROUND], width: 46, edge: 10, wobble: 4 },
    { kind: 'embankment', pts: ROCK, h: [GROUND, GROUND], width: 30, edge: 5, wobble: 2 },
    { kind: 'embankment', pts: STRAND, h: STRAND_H, width: 12, edge: 8 },
    { kind: 'embankment', pts: REEF, h: [4.6, 4.6, 4.8, 5.6], width: 2.5, edge: 5 },
    // worn a little hollow down its middle, so a running ball keeps to it
    { kind: 'channel', pts: STRAND.slice(0, 3), width: 11, depth: 0.6 },
    // dunes along the landward side, and the rise the castle stands on
    ...dunes([[-116, 60, 44, 9], [-110, 220, 46, 10], [-112, 380, 44, 8], [-96, 540, 48, 10], [-80, 790, 50, 9], [-100, 930, 40, 9], [-60, 990, 36, 7]]),
    // rumples in the fairways
    ...dunes([[-18, 170, 24, 1.5], [14, 240, 22, -1.1], [-12, 330, 22, 1.3], [12, 400, 20, 1.2], [30, 730, 20, 1.4], [54, 790, 18, -1]]),
    // the tee up on a big dune, the whole hole laid out below (Nov 22)
    { kind: 'hill', x: 0, y: -20, r: 46, h: 6 },
    { kind: 'disc', x: 0, y: -2, r: 16, h: GROUND + 11, edge: 14, op: 'set' },
    ...greenComplex(GREEN, GROUND, { lift: 0.8, edge: 12, tilt: slope(GREEN, 12, [-1, 0.5]), rolls: [[-10, -7, 9, 0.4], [11, 8, 8, -0.35], [0, 10, 6, 0.2]] }),
    ...traps.flatMap((t) => t.pieces),
    // the river, cut deep into the cliff top, and its bridge
    { kind: 'channel', pts: BURN, width: 18, depth: 7 },
    BRIDGE.piece,
    CAUSEWAY.piece,
  ],
  walls: [...BRIDGE.walls, ...CAUSEWAY.walls],
  posts: gorse([[-52, 120], [-56, 260], [-50, 400], [60, 180], [66, 330], [-30, 540], [-12, 800], [12, 820]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'strand', poly: band(STRAND.slice(0, 3), 11) }],
  secret: { name: 'The Strand', zone: 'strand', hint: 'Under the cliff on the right the wet sand is as hard as a road. Land a drive on it and it runs for ever.' },
  flyover: [
    { x: -10, y: -30 },
    { x: -5, y: 280 },
    { x: 40, y: 580 },
    { x: 46, y: 800 },
    { x: 70, y: 920 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
    // the castle on the point behind the green, and the pub for after
    // its footprint is about 80 by 50 ft, bawn wall to the front: well clear of the green, on the rock's far end
    { kind: 'castle', x: 142, y: 928, rot: 0 },
    { kind: 'pub', x: -70, y: 900, rot: 0.5 },
    BRIDGE.decor,
    CAUSEWAY.decor,
    { kind: 'sheep', x: -80, y: 150, rot: 0.6 },
    { kind: 'sheep', x: -86, y: 300, rot: -1.2 },
    { kind: 'sheep', x: -60, y: 600, rot: 2.4 },
    { kind: 'sheep', x: -10, y: 780, rot: 0.2 },
  ],
};
