// Hole 3, The Cliff Road (par 4, 480 yd as shown): the hard one. Along the cliff top with the Atlantic all down the
// right and the wind off it, to a small green on the edge of the drop.
// The play: a long drive up the left half of the cliff top, clear of the pots, then a long iron held into the wind.
// The bail-out: left. Gorse and fescue, but land. Right is the sea, all the way.
// The secret: the Cart Track. An old track runs down the left side to the front of the green, worn hard. From the end
// of the drive, a low runner along it scurries all the way up to the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { dunes, gorse, LINKS_TURF, pot } from './common';

const GROUND = 8;
const GREEN = { x: 18, y: 648, rx: 15, ry: 12 };
// the cliff top the hole runs along; the sea is everything to the right of it
const COAST: V2[] = [
  { x: -20, y: -50 },
  { x: -18, y: 200 },
  { x: -14, y: 490 },
  { x: -8, y: 710 },
];
// the cart track: down the left of the fairway to the front of the green
const TRACK: V2[] = [
  { x: -44, y: 430 },
  { x: -42, y: 520 },
  { x: -26, y: 590 },
  { x: 2, y: 630 },
];
const traps = [
  pot(-34, 300, 7, 1), // left of the drive
  pot(16, 352, 6, 2), // right of it, on the edge
  pot(-14, 540, 7, 3), // short of the green
  greenside(GREEN, -12, 660, 7, 8, 4, 3.4, 0), // left of the green
];

export const cliffroad: Hole = {
  id: 'cliffroad',
  name: 'The Cliff Road',
  par: 4,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.09,
  yards: 480,
  blurb: 'Along the cliff top with the sea all down the right. Long, narrow, and into the wind. Par is a good score.',
  teeTip: 'Drive up the left half. Everything right is the Atlantic.',
  tee: { x: 0, y: 0 },
  cup: { x: 18, y: 650 },
  pins: [{ x: 18, y: 650 }, { x: 8, y: 642 }, { x: 26, y: 654 }, { x: 14, y: 656 }],
  aim: -0.02,
  bounds: { x0: -150, y0: -50, x1: 190, y1: 750 },
  border: [
    { x: -146, y: -46 },
    { x: 186, y: -46 },
    { x: 186, y: 746 },
    { x: -146, y: 746 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the drive: a strip of cliff top, 44 ft across
    { poly: blob(-8, 330, 22, 170, 1, 0.06), surface: 'fairway' },
    // the run-in to the green
    { poly: blob(6, 600, 18, 26, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the cart track, worn hard
    { poly: band(TRACK, 3), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-146, -46, 186, 746), level: 0, look: 'sea', tide: { amp: 0.8, period: 50 } }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 190, y1: 750, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the cliff top: from the left edge of the hole out to the cliff, the green right on the edge
    { kind: 'embankment', pts: COAST, h: [GROUND, GROUND, GROUND, GROUND], width: 40, edge: 9, wobble: 4 },
    { kind: 'embankment', pts: [{ x: -130, y: -50 }, { x: -130, y: 750 }], h: [GROUND, GROUND], width: 70, edge: 12 },
    { kind: 'disc', x: GREEN.x - 4, y: GREEN.y, r: 34, h: GROUND, edge: 8, op: 'set' },
    // dunes along the landward side
    ...dunes([[-120, 60, 40, 8], [-116, 220, 44, 9], [-118, 380, 42, 8], [-112, 520, 42, 8], [-110, 640, 44, 9], [-60, 720, 40, 7]]),
    // rumples in the fairway
    ...dunes([[-14, 160, 22, 1.4], [6, 230, 20, -1], [-20, 330, 22, 1.2], [4, 410, 20, 1.1], [-12, 480, 20, 1.2]]),
    { kind: 'disc', x: 0, y: -2, r: 16, h: GROUND + 4, edge: 10, op: 'set' },
    ...greenComplex(GREEN, GROUND, { lift: 2, edge: 9, tilt: [0.8, 0.6], rolls: [[-6, -5, 6, 0.3], [7, 5, 5, -0.25]] }),
    // the track is worn a little into the ground, so a running ball keeps to it
    { kind: 'channel', pts: TRACK, width: 5, depth: 0.5 },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: gorse([[-60, 110], [-64, 240], [-58, 380], [-62, 540], [-40, 670], [-80, 300]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'carttrack', poly: band(TRACK.slice(1), 3) }],
  secret: { name: 'The Cart Track', zone: 'carttrack', hint: 'An old track runs down the left to the front of the green. Keep a low one on it and it runs all the way up.' },
  flyover: [
    { x: -10, y: -30 },
    { x: -10, y: 280 },
    { x: 0, y: 570 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -12, rot: 0 },
    { kind: 'sheep', x: -90, y: 180, rot: 0.6 },
    { kind: 'sheep', x: -84, y: 420, rot: -1.4 },
    { kind: 'sheep', x: -96, y: 560, rot: 2.1 },
  ],
};
