// Hole 8, The Lodge (par 4, 560 yd as shown), a green circle: the home run. Off the top of the last run down to an
// upslope fairway that rises to a crest; past it the run falls away to a green in front of the lodge, with the fire
// lit and the deck full. The mountain falls off a cliff down the right.
// The play: a driver onto the upper fairway (it stops on the upslope), then an iron down the hill to the green.
// The reward: a full, straight drive carries the crest and runs a long way down the lower run: a wedge in.
// The bail-out: left of the upper fairway. Right is the cliff; short left of the green is the lodge's skating pond.
// The secret: the Sled Run. The kids' sledding track runs down the right of the lower run, worn into a trough, to the
// front of the green. From the top of it, a low runner slides all the way to the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, profile } from './common';

const TOP = 98;
const FOOT = 4;
const GREEN = { x: -12, y: 790, rx: 18, ry: 14 };
// the crest at the top of the upper fairway
const CREST = 470;
// the cliff edge down the right
const LIP = 76;
// the sled run: down the right to the front of the green
const SLED: V2[] = [
  { x: 50, y: 480 },
  { x: 50, y: 650 },
  { x: 32, y: 734 },
  { x: 4, y: 766 },
];
const traps = [greenside(GREEN, -12, 758, 10, 6, 2, 3.4, 0), greenside(GREEN, 12, 814, 8, 6, 3, 3.4, 0.3), greenside(GREEN, 22, 780, 6, 8, 4, 3.4, 0)];
// the skating pond, short and left of the green
const POND = blob(-58, 750, 28, 26, 6, 0.1);

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
  yards: 560,
  blurb: 'Green circle. The home run: down to the upper fairway, over the crest and down to the lodge. Cliff right, pond short left.',
  teeTip: 'Driver. A full one carries the crest and runs down toward the lodge. Not right: the cliff.',
  tee: { x: 0, y: 0 },
  cup: { x: -12, y: 792 },
  pins: [{ x: -12, y: 792 }, { x: -22, y: 785 }, { x: -1, y: 796 }, { x: -14, y: 799 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 890 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 150 },
    { x: LIP, y: 170 },
    { x: LIP, y: 720 },
    { x: 146, y: 740 },
    { x: 146, y: 886 },
    { x: -136, y: 886 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the run, where the drive comes down: 66 ft across
    // the upper fairway, on the upslope to the crest
    { poly: blob(-4, 410, 36, 62, 1, 0.05), surface: 'fairway' },
    // the lower run, from the crest down to the bunkers
    { poly: blob(-6, 620, 30, 150, 2, 0.05), surface: 'fairway' },
    // the lip of the cliff
    { poly: rect(LIP - 6, 170, LIP + 4, 720), surface: 'rock' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the sled run: packed snow, slick (it plays as a path)
    { poly: band(SLED, 3.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: POND, level: FOOT - 1.5, look: 'lake' }],
  terrain: [
    ...profile(-140, 150, [
      [-50, TOP],
      [20, TOP],
      [200, 50],
      [340, 40],
      // the upslope to the crest
      [CREST, 46],
      // and down the lower run to the lodge
      [740, FOOT + 1],
      [890, FOOT],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    { kind: 'hill', x: -30, y: 200, r: 50, h: 3 },
    // the mountainside rises on the right of the top half, so the run tips left (Nov 22)
    { kind: 'hill', x: 160, y: 200, r: 170, h: 16 },
    { kind: 'disc', x: -58, y: 750, r: 30, h: -5, edge: 10, op: 'add' },
    // the sled run is worn into a trough, so a ball on it keeps to it
    { kind: 'channel', pts: SLED, width: 6, depth: 1 },
    ...greenComplex(GREEN, FOOT, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.6, -0.8]), rolls: [[-8, -6, 7, 0.35], [10, 6, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 720 }]),
  ],
  walls: [],
  posts: [...firs([{ x: -70, y: 0 }, { x: -76, y: 740 }], 26, 'lo-l', 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'sledrun', poly: band(SLED.slice(1), 3.5) }],
  secret: { name: 'The Sled Run', zone: 'sledrun', hint: 'The kids\' sledding track runs down the right to the front of the green. Get a low one going down it.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 400 },
    { x: -6, y: 640 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'green' },
    { kind: 'lodge', x: -10, y: 860, rot: 0 },
    { kind: 'snowman', x: 40, y: 820, rot: -0.3 },
  ],
};
