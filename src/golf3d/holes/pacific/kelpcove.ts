// Hole 6, Kelp Cove (par 4, 360 yd as shown): round a little cove, the Pacific on the left this time, kelp in the
// water and a strip of beach under the cliff. The green sits just past the cove on the far side.
// The play: a drive out to the right, round the cove, then a short iron back across the corner to the green.
// The gamble: cut the corner over the cove with the drive. Carry it and it's a flick; come up short and it's wet.
// The secret: the Sandbar. The beach under the cliff is hard wet sand at the water's edge. A drive that lands on it
// runs on down the beach toward the green, and leaves a pitch up.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { grove, rocks } from './common';

const G = 18;
const GREEN = { x: -12, y: 486, rx: 18, ry: 15 };
// the beach under the cliff, round the head of the cove
const BEACH: V2[] = [
  { x: -12, y: 236 },
  { x: 2, y: 290 },
  { x: 4, y: 350 },
  { x: -10, y: 400 },
];
// the hard sand at the water's edge
const BAR: V2[] = BEACH.map((p) => ({ x: p.x - 4, y: p.y }));
const traps = [greenside(GREEN, 10, 470, 6, 7, 1), greenside(GREEN, -10, 512, 8, 5, 2)];

export const kelpcove: Hole = {
  id: 'kelpcove',
  name: 'Kelp Cove',
  par: 4,
  theme: 'coastal',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 360,
  blurb: 'Round a little cove, the Pacific on the left. Cut the corner over the kelp if you dare.',
  teeTip: 'A drive out to the right, round the cove. Or cut the corner over the water. Short of the far side is wet.',
  tee: { x: 0, y: 0 },
  cup: { x: -14, y: 488 },
  pins: [{ x: -14, y: 488 }, { x: -24, y: 480 }, { x: -4, y: 492 }, { x: -16, y: 496 }],
  aim: 0.03,
  bounds: { x0: -150, y0: -50, x1: 200, y1: 580 },
  border: [
    { x: -146, y: -46 },
    { x: 196, y: -46 },
    { x: 196, y: 576 },
    { x: -146, y: 576 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(30, 170, 30, 96, 1, 0.08), surface: 'fringe' },
    { poly: blob(30, 170, 26, 92, 1, 0.08), surface: 'fairway' },
    // round the head of the cove
    { poly: blob(60, 330, 24, 52, 2, 0.1), surface: 'fairway' },
    { poly: blob(16, 420, 28, 34, 3, 0.1), surface: 'fairway' },
    { poly: band(BEACH, 9), surface: 'sand' },
    { poly: band(BAR, 3.5), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-146, -46, 196, 576), level: 0, look: 'sea', tide: { amp: 0.8, period: 50 } }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 200, y1: 580, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the cliff top, bending in round the cove; the sea on the left
    { kind: 'embankment', pts: [{ x: 90, y: -50 }, { x: 92, y: 190 }, { x: 150, y: 300 }, { x: 100, y: 410 }, { x: 70, y: 580 }], h: [21, 20, 19, 18.4, 18], width: 118, edge: 10, wobble: 4 },
    { kind: 'disc', x: 0, y: 0, r: 16, h: 22, edge: 10, op: 'set' },
    { kind: 'hill', x: 40, y: 130, r: 26, h: 0.8 },
    // the beach under the cliff
    { kind: 'embankment', pts: BEACH, h: [2.6, 2.4, 2.4, 2.6], width: 9, edge: 6 },
    ...greenComplex(GREEN, G, { lift: 0.4, edge: 8, tilt: [0.5, 0.3], rolls: [[-6, -4, 6, 0.3], [6, 5, 5, -0.2]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...grove(140, 80, 7, 26, 'kc-a'),
    ...grove(170, 260, 6, 22, 'kc-b', 'torrey'),
    ...grove(110, 470, 7, 26, 'kc-c', 'monterey'),
    ...rocks([[-40, 120, 3], [-44, 40, 2.6], [-30, 300, 3.4], [-36, 380, 2.8], [-60, 520, 3]]),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'sandbar', poly: band(BAR, 3.5) }],
  secret: { name: 'The Sandbar', zone: 'sandbar', hint: 'The beach under the cliff is hard sand at the water. A drive that lands on it runs down the beach toward the green.' },
  flyover: [
    { x: -40, y: -40 },
    { x: -50, y: 200 },
    { x: -50, y: 380 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'sealions', x: -34, y: 300 },
    { kind: 'iceplant', x: -20, y: 60, scale: 1.3 },
    { kind: 'iceplant', x: -10, y: 180, scale: 1.1 },
    { kind: 'iceplant', x: 30, y: 460, scale: 1 },
    { kind: 'poppies', x: 70, y: 40, scale: 1.2 },
  ],
};
