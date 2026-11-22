// Hole 5, The Lodge (par 4, 460 yd as shown): the home run. Off the top of the last run, 70 ft down to a green in
// front of the lodge, with the fire lit and the deck full.
// The play: a driver down the run (it runs out a long way), then a wedge over the bunkers to the green.
// The bail-out: short and right, on the run-out, for a chip up the middle. Left is the lodge's skating pond.
// The secret: the Sled Run. The kids' sledding track runs down the right, worn into a trough, and ends at the front of
// the green. From the end of the drive, a low runner down it slides all the way to the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const TOP = 72;
const FOOT = 4;
const GREEN = { x: -12, y: 632, rx: 18, ry: 14 };
// the sled run: down the right to the front of the green
const SLED: V2[] = [
  { x: 56, y: 330 },
  { x: 54, y: 500 },
  { x: 36, y: 576 },
  { x: 6, y: 608 },
];
const traps = [greenside(GREEN, -12, 600, 10, 6, 2, 3.4, 0), greenside(GREEN, 12, 656, 8, 6, 3, 3.4, 0.3), greenside(GREEN, 22, 622, 6, 8, 4, 3.4, 0)];
// the skating pond, short and left of the green
const POND = blob(-58, 592, 28, 26, 6, 0.1);

export const thelodge: Hole = {
  id: 'thelodge',
  name: 'The Lodge',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 460,
  blurb: 'The home run: 70 feet down to the lodge, the fire lit and the deck full. The skating pond waits short left.',
  teeTip: 'Driver down the run. It\'ll run out a long way.',
  tee: { x: 0, y: 0 },
  cup: { x: -12, y: 634 },
  pins: [{ x: -12, y: 634 }, { x: -22, y: 627 }, { x: -1, y: 638 }, { x: -14, y: 641 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 730 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 726 },
    { x: -136, y: 726 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the run, where the drive comes down: 66 ft across
    { poly: blob(0, 340, 33, 210, 1, 0.05), surface: 'fairway' },
    // the run-out, short of the bunkers
    { poly: blob(-4, 560, 28, 30, 2, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the sled run: packed snow, slick (it plays as a path)
    { poly: band(SLED, 3.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: POND, level: FOOT - 1.5, look: 'lake' }],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 150, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 20, x1: 150, y1: 320, axis: 'y', h0: TOP, h1: 26, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 320, x1: 150, y1: 580, axis: 'y', h0: 26, h1: FOOT + 1, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 580, x1: 150, y1: 730, axis: 'y', h0: FOOT + 1, h1: FOOT, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    { kind: 'hill', x: -30, y: 200, r: 50, h: 3 },
    { kind: 'hill', x: 20, y: 380, r: 40, h: -2 },
    { kind: 'disc', x: -58, y: 592, r: 30, h: -5, edge: 10, op: 'add' },
    // the sled run is worn into a trough, so a ball on it keeps to it
    { kind: 'channel', pts: SLED, width: 6, depth: 1 },
    ...greenComplex(GREEN, FOOT, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.6, -0.8]), rolls: [[-8, -6, 7, 0.35], [10, 6, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...firs([{ x: -70, y: 0 }, { x: -76, y: 600 }], 26, 'lo-l', 1), ...firs([{ x: 84, y: 0 }, { x: 88, y: 600 }], 26, 'lo-r', -1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'sledrun', poly: band(SLED.slice(1), 3.5) }],
  secret: { name: 'The Sled Run', zone: 'sledrun', hint: 'The kids\' sledding track runs down the right to the front of the green. Get a low one going down it.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 220 },
    { x: -6, y: 520 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'lodge', x: -10, y: 700, rot: 0 },
    { kind: 'snowman', x: 50, y: 660, rot: -0.3 },
  ],
};
