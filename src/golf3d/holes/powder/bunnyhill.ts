// Hole 1, The Bunny Hill (par 4, 390 yd as shown), a green circle: the breather. Down the beginners' slope, wide but
// tipped to the right off the mountainside, 60 ft down to a green at the bottom by the ski school.
// The play: a driver down the middle (the slope adds a good deal of roll), then a wedge.
// The bail-out: there's room either side of the cut, but it's deep powder: a ball in it stops dead.
// The secret: the Magic Carpet. The ski school's conveyor runs down the right to the front of the green. From the end
// of the drive, a low runner along it rides all the way down.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside, bunker, FAIRWAY_DEPTH } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const TOP = 64;
const FOOT = 4;
const GREEN = { x: 8, y: 532, rx: 20, ry: 16 };
// the magic carpet: down the right of the run to the front right of the green
const CARPET: V2[] = [
  { x: 52, y: 300 },
  { x: 50, y: 400 },
  { x: 38, y: 492 },
  { x: 20, y: 514 },
];
const traps = [bunker(-30, 300, 12, 8, 1, FAIRWAY_DEPTH, 0.2), greenside(GREEN, -20, 528, 7, 9, 2, 3.4, 0), greenside(GREEN, 6, 560, 9, 6, 3, 3.4, 0)];

export const bunnyhill: Hole = {
  id: 'bunnyhill',
  name: 'The Bunny Hill',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.1,
  yards: 390,
  blurb: 'Green circle. Down the beginners\' slope to the ski school. Wide, but it tips right. The powder stops a ball dead.',
  teeTip: 'Driver. The hill gives you plenty of roll.',
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 534 },
  pins: [{ x: 8, y: 534 }, { x: -4, y: 526 }, { x: 18, y: 538 }, { x: 4, y: 543 }],
  aim: 0.01,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 630 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 626 },
    { x: -136, y: 626 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the run: 70 ft across where the drive comes down
    { poly: blob(0, 290, 35, 180, 1, 0.05), surface: 'fairway' },
    { poly: blob(4, 488, 24, 34, 2, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the magic carpet: firm and quick (it plays as a path)
    { poly: band(CARPET, 3), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 150, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 20, x1: 150, y1: 470, axis: 'y', h0: TOP, h1: FOOT + 1, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 470, x1: 150, y1: 630, axis: 'y', h0: FOOT + 1, h1: FOOT, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // banks of snow either side of the run, so a ball near the edge falls back toward the middle
    { kind: 'hill', x: -90, y: 250, r: 60, h: 6 },
    { kind: 'hill', x: 100, y: 200, r: 60, h: 5 },
    { kind: 'hill', x: -16, y: 160, r: 40, h: 1.5 },
    // the mountainside rises on the left, so the whole run tips right (Nov 22)
    { kind: 'hill', x: -150, y: 260, r: 175, h: 16 },
    // the carpet sits a little into the snow, so a ball rolling on it keeps to it
    { kind: 'channel', pts: CARPET, width: 5, depth: 0.6 },
    ...greenComplex(GREEN, FOOT, { lift: 0.8, edge: 10, tilt: slope(GREEN, 10, [-0.4, 0.9]), rolls: [[-8, -5, 7, 0.35], [9, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...firs([{ x: -70, y: 30 }, { x: -78, y: 560 }], 26, 'bh-l', 1), ...firs([{ x: 80, y: 30 }, { x: 86, y: 560 }], 26, 'bh-r', -1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'magiccarpet', poly: band(CARPET.slice(1), 3) }],
  secret: { name: 'The Magic Carpet', zone: 'magiccarpet', hint: 'The ski school\'s conveyor runs down the right to the green. Get a low one rolling on it and it rides all the way down.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 220 },
    { x: 4, y: 420 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'green' },
    { kind: 'snowman', x: -40, y: 510, rot: 0.4 },
    { kind: 'snowman', x: 70, y: 580, rot: -0.6, scale: 0.8 },
  ],
};
