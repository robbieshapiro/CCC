// Hole 1, The Bunny Hill (par 4, 470 yd as shown), a green circle: the warm-up. Down off the top of the beginners'
// slope to an upslope fairway that rises to a crest; past the crest the run falls away to the ski school and the green.
// The mountain falls off a cliff down the right.
// The play: a driver up onto the upper fairway (it stops on the upslope), then an iron down the hill to the green.
// The reward: a perfect, full drive carries the crest and runs all the way down the lower fairway: a wedge in.
// The bail-out: left. The slope tips everything right, toward the cliff.
// The secret: the Magic Carpet. The ski school's conveyor runs down the right of the lower run to the front of the green.
// From the right of the upper fairway, a low runner over the crest onto it rides all the way down.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside, bunker, FAIRWAY_DEPTH } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, profile } from './common';

const TOP = 64;
const GREEN = { x: 6, y: 690, rx: 18, ry: 15 };
// the crest between the two fairways
const CREST = 414;
// the magic carpet: over the crest on the right, down to the front right of the green
const CARPET: V2[] = [
  { x: 44, y: 404 },
  { x: 48, y: 520 },
  { x: 40, y: 620 },
  { x: 20, y: 668 },
];
// the cliff edge down the right
const LIP = 74;
const traps = [bunker(-36, 356, 12, 8, 1, FAIRWAY_DEPTH, 0.2), greenside(GREEN, -18, 686, 7, 9, 2, 3.4, 0), greenside(GREEN, 4, 716, 9, 6, 3, 3.4, 0)];

export const bunnyhill: Hole = {
  id: 'bunnyhill',
  name: 'The Bunny Hill',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 470,
  blurb: 'Green circle. Up onto the upper fairway, then down the hill to the ski school. A perfect drive runs over the crest.',
  teeTip: 'Driver. A full one carries the crest and runs. Mind the cliff on the right.',
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 692 },
  pins: [{ x: 6, y: 692 }, { x: -6, y: 684 }, { x: 16, y: 696 }, { x: 2, y: 701 }],
  aim: 0.005,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 790 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 150 },
    { x: LIP, y: 170 },
    { x: LIP, y: 640 },
    { x: 146, y: 660 },
    { x: 146, y: 786 },
    { x: -136, y: 786 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the upper fairway, on the upslope to the crest: 70 ft across
    { poly: blob(0, 366, 35, 50, 1, 0.05), surface: 'fairway' },
    // the lower fairway, down from the crest
    { poly: blob(4, 540, 30, 126, 2, 0.05), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the magic carpet: firm and quick (it plays as a path)
    { poly: band(CARPET, 3), surface: 'path' },
    // the lip of the cliff: bare rock
    { poly: rect(LIP - 6, 170, LIP + 4, 640), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    ...profile(-140, 150, [
      [-50, TOP],
      [20, TOP],
      [170, 34],
      [320, 30],
      // the upslope to the crest
      [CREST, 38],
      // and over it, down the lower run
      [600, 14],
      [790, 10],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the mountainside rises on the left, so the whole run tips right, toward the cliff
    { kind: 'hill', x: -150, y: 400, r: 175, h: 12 },
    { kind: 'hill', x: -90, y: 250, r: 60, h: 6 },
    // the carpet sits a little into the snow, so a ball rolling on it keeps to it
    { kind: 'channel', pts: CARPET, width: 5, depth: 0.6 },
    ...greenComplex(GREEN, 10, { lift: 0.8, edge: 10, tilt: slope(GREEN, 10, [-0.4, 0.9]), rolls: [[-8, -5, 7, 0.35], [9, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 660 }]),
  ],
  walls: [],
  posts: [...firs([{ x: -70, y: 30 }, { x: -78, y: 740 }], 26, 'bh-l', 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'magiccarpet', poly: band(CARPET.slice(1), 3) }],
  secret: { name: 'The Magic Carpet', zone: 'magiccarpet', hint: 'The ski school\'s conveyor runs down the right of the lower run. Get a low one rolling over the crest onto it and it rides to the green.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 380 },
    { x: 4, y: 560 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'green' },
    { kind: 'snowman', x: -40, y: 660, rot: 0.4 },
    { kind: 'snowman', x: -60, y: 740, rot: -0.6, scale: 0.8 },
    { kind: 'rock', x: LIP + 2, y: 300, scale: 5 },
    { kind: 'rock', x: LIP, y: 520, scale: 4 },
  ],
};
