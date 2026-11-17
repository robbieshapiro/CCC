// Hole 2, The Poppies (par 3, 155 yd as shown): the breather. A mid iron across a cliff-top meadow of California
// poppies to a big green, the Pacific down the right and a mown bank behind.
// The play: a mid iron at the middle. Plenty of green, and the bank behind saves a long one.
// The danger: right is the cliff, and the sea.
// The secret: the Backstop. The bank behind the green is mown and steep. Land on it and it feeds the ball back down.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { grove, rocks } from './common';

const LAND = 22.6;
const GREEN = { x: -6, y: 206, rx: 22, ry: 17 };
// the bank behind the green
const BANK: V2[] = [
  { x: -44, y: 236 },
  { x: -6, y: 244 },
  { x: 32, y: 236 },
];
const FACE: V2[] = BANK.map((p) => ({ x: p.x, y: p.y - 7 }));
const traps = [greenside(GREEN, -30, 190, 7, 6, 1, 3), greenside(GREEN, 20, 186, 6, 7, 2, 3)];

export const poppies: Hole = {
  id: 'poppies',
  name: 'The Poppies',
  par: 3,
  theme: 'coastal',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  yards: 155,
  blurb: 'A mid iron across the poppies to a big green. The cliff and the sea on the right, a mown bank behind.',
  teeTip: 'A mid iron at the middle. Long is fine: the bank behind brings it back. Right is the sea.',
  tee: { x: 0, y: 0 },
  cup: { x: -6, y: 208 },
  pins: [{ x: -6, y: 208 }, { x: -18, y: 200 }, { x: 6, y: 212 }, { x: -10, y: 218 }],
  aim: -0.02,
  bounds: { x0: -170, y0: -50, x1: 120, y1: 300 },
  border: [
    { x: -166, y: -46 },
    { x: 116, y: -46 },
    { x: 116, y: 296 },
    { x: -166, y: 296 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the approach: a wide mown run up to the green
    { poly: blob(-8, 140, 26, 30, 1, 0.08), surface: 'fairway' },
    { poly: band(BANK, 10), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-166, -46, 116, 296), level: 0, look: 'sea', tide: { amp: 1, period: 52 } }],
  terrain: [
    { kind: 'ramp', x0: -170, y0: -50, x1: 120, y1: 300, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the meadow on the cliff top, the sea below on the right
    { kind: 'embankment', pts: [{ x: -70, y: -50 }, { x: -64, y: 300 }], h: [25, 22.4], width: 112, edge: 10, wobble: 6 },
    { kind: 'disc', x: 0, y: 0, r: 16, h: 26, edge: 10, op: 'set' },
    { kind: 'hill', x: -40, y: 90, r: 30, h: 1 },
    { kind: 'hill', x: 30, y: 110, r: 20, h: -0.6 },
    ...greenComplex(GREEN, LAND, { lift: 0.3, edge: 8, tilt: [0.4, -0.5], rolls: [[-9, -4, 7, 0.3], [9, 6, 6, -0.2]] }),
    // the bank behind: four feet up, its face mown down to the green
    { kind: 'embankment', pts: BANK, h: BANK.map(() => LAND + 4.4), width: 5, edge: 9 },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...grove(-110, 70, 6, 24, 'poppies-a'),
    ...grove(-96, 250, 7, 28, 'poppies-b', 'monterey'),
    ...grove(-150, 160, 4, 18, 'poppies-c', 'torrey'),
    ...rocks([[58, 150, 3], [52, 230, 2.6], [64, 60, 3.2]]),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'backstop', poly: band(FACE, 4) }],
  secret: { name: 'The Backstop', zone: 'backstop', hint: 'The bank behind the green is mown and steep. Land on it and it feeds the ball back down.' },
  flyover: [
    { x: 30, y: -30 },
    { x: 20, y: 110 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'poppies', x: -30, y: 50, scale: 1.5 },
    { kind: 'poppies', x: 30, y: 70, scale: 1.2 },
    { kind: 'poppies', x: -44, y: 120, scale: 1.4 },
    { kind: 'poppies', x: 26, y: 140, scale: 1 },
    { kind: 'poppies', x: -64, y: 190, scale: 1.3 },
    { kind: 'iceplant', x: 46, y: 100, scale: 1.2 },
    { kind: 'iceplant', x: 44, y: 200, scale: 1 },
  ],
};
