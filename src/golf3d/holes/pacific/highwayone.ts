// Hole 3, Highway One (par 4, 410 yd as shown): down the cliff top beside the coast road, the Pacific on the right, over
// a canyon the road crosses on a concrete arch bridge, to a green near the cliff edge.
// The play: a drive or a wood short of the canyon, then a mid iron over it to the green.
// The gamble: a big drive carries the canyon and leaves a wedge. Short of the far side, it's in the canyon.
// The secret: the Old Road. Past the bridge the old road comes down off the rise straight at the green. Roll one
// down it.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { bunker, greenComplex, greenside } from '../woods';
import { descent, grove, rocks } from './common';

const G = 23.4;
const GREEN = { x: 26, y: 560, rx: 19, ry: 15 };
// the canyon, across the hole
const CANYON: V2[] = [
  { x: -200, y: 422 },
  { x: -100, y: 414 },
  { x: 0, y: 420 },
  { x: 80, y: 412 },
  { x: 140, y: 418 },
];
// the coast road down the left, and past the bridge the old road down to the green
const ROAD: V2[] = [
  { x: -62, y: -40 },
  { x: -60, y: 140 },
  { x: -66, y: 300 },
  { x: -70, y: 396 },
];
const OLD: V2[] = [
  { x: -52, y: 476 },
  { x: -34, y: 504 },
  { x: -12, y: 528 },
  { x: 10, y: 546 },
];
const traps = [greenside(GREEN, 4, 548, 7, 6, 1), greenside(GREEN, 50, 580, 6, 8, 2), bunker(30, 300, 10, 8, 3, 2.2)];

export const highwayone: Hole = {
  id: 'highwayone',
  name: 'Highway One',
  par: 4,
  theme: 'coastal',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 410,
  blurb: 'Down the cliff top beside the coast road, the Pacific on the right, over the canyon by the bridge to the green.',
  teeTip: 'A wood short of the canyon, then a mid iron over it. A big drive can carry it. Right is the sea.',
  tee: { x: 0, y: 0 },
  cup: { x: 28, y: 562 },
  pins: [{ x: 28, y: 562 }, { x: 16, y: 554 }, { x: 38, y: 566 }, { x: 24, y: 570 }],
  aim: 0,
  bounds: { x0: -180, y0: -50, x1: 130, y1: 650 },
  border: [
    { x: -176, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 646 },
    { x: -176, y: 646 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(-4, 220, 22, 116, 1, 0.08), surface: 'fringe' },
    { poly: blob(-4, 220, 18, 112, 1, 0.08), surface: 'fairway' },
    // past the canyon: a landing for the big drive, and the run up to the green
    { poly: blob(10, 500, 28, 32, 2, 0.08), surface: 'fairway' },
    { poly: band(ROAD, 4), surface: 'path' },
    { poly: band(OLD, 3.2), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-176, -46, 126, 646), level: 0, look: 'sea', tide: { amp: 1, period: 54 } }],
  terrain: [
    { kind: 'ramp', x0: -180, y0: -50, x1: 130, y1: 650, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the cliff top, the sea below on the right
    { kind: 'embankment', pts: [{ x: -110, y: -50 }, { x: -104, y: 300 }, { x: -96, y: 650 }], h: [27, 25, 22.6], width: 160, edge: 10, wobble: 6 },
    { kind: 'disc', x: 0, y: 0, r: 16, h: 28, edge: 10, op: 'set' },
    { kind: 'hill', x: -30, y: 160, r: 30, h: 1.2 },
    { kind: 'hill', x: 20, y: 300, r: 26, h: -0.8 },
    // the rise past the canyon the old road comes down off
    { kind: 'hill', x: -56, y: 482, r: 26, h: 3.6 },
    // the canyon
    { kind: 'channel', pts: CANYON, width: 20, depth: 13 },
    ...greenComplex(GREEN, G, { lift: 0.3, edge: 8, tilt: [-0.3, 0.5], back: 2.2, rolls: [[-6, -4, 6, 0.25], [7, 5, 5, -0.2]] }),
    ...descent(OLD, [G + 5.2, G + 3.4, G + 1.6, G + 0.3]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...grove(-120, 80, 8, 30, 'h1-a'),
    ...grove(-110, 320, 7, 26, 'h1-b'),
    ...grove(-120, 520, 8, 30, 'h1-c', 'monterey'),
    { x: -30, y: 610, r: 2.4, h: 22, look: 'monterey' },
    ...rocks([[60, 160, 3.2], [66, 300, 3], [62, 470, 2.8], [70, 600, 3.4]]),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'oldroad', poly: band(OLD.slice(0, 3), 3.2) }],
  secret: { name: 'The Old Road', zone: 'oldroad', hint: 'Past the bridge the old road comes down off the rise, straight at the green. Roll one down it.' },
  flyover: [
    { x: 40, y: -40 },
    { x: 50, y: 200 },
    { x: 40, y: 440 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -20, y: -12, rot: -0.2 },
    // the bridge carries the road over the canyon
    { kind: 'bridge', x: -72, y: 418, rot: Math.PI / 2, size: [64, 13, 8] },
    { kind: 'iceplant', x: 44, y: 60, scale: 1.3 },
    { kind: 'iceplant', x: 50, y: 220, scale: 1.2 },
    { kind: 'iceplant', x: 54, y: 520, scale: 1 },
    { kind: 'poppies', x: -36, y: 40, scale: 1 },
    { kind: 'poppies', x: -40, y: 340, scale: 1.2 },
  ],
};
