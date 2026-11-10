// Hole 3, The River (par 4, 420 yd): along the Chicago River's south bank and across it to a green under Marina
// City's corn cobs. The river runs the whole left side, then turns and crosses in front of the green; towers stand
// along the right, in play, and the brown line's el rattles across overhead off the tee.
// The play: a drive up the right-centre, short of the river's bend, then a mid iron over the water.
// The secret: Wacker Drive's lower level, a slot under the last tower on the right. Roll one through it and it comes
// out at the river's edge with a short iron left.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_TURF, chiGreen } from './common';

const LAND = 7;
const RIVER = 1;
const GREEN = { x: 30, y: 580, rx: 22, ry: 17 };
const traps = [greenside(GREEN, 64, 590, 8, 8, 1, 3, 0), greenside(GREEN, 0, 610, 10, 6, 2, 3, 0)];
const BANK: V2[] = [
  { x: -70, y: -60 },
  { x: -68, y: 200 },
  { x: -56, y: 380 },
  { x: -10, y: 470 },
  { x: 120, y: 490 },
  { x: 220, y: 488 },
];
const TOWERS = [
  [118, 60, 60, 80, 380],
  [120, 170, 60, 90, 460],
  [116, 290, 56, 90, 300],
].map(([x, y, w, d, h], i) => building(x, y, w, d, h, i + 40));
const SLOT = rect(70, 360, 104, 404);

const posts: Post[] = [[60, 20], [60, 140], [60, 260], [-40, 40], [-40, 200]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const }));

export const river: Hole = {
  id: 'river',
  name: 'The River',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.03,
  yards: 420,
  blurb: 'Up the south bank with the river all down the left, then over it to a green under the corn cobs. Towers right.',
  tee: { x: 0, y: 0 },
  cup: { x: 30, y: 582 },
  pins: [{ x: 30, y: 582 }, { x: 16, y: 572 }, { x: 44, y: 586 }, { x: 26, y: 594 }],
  aim: 0.03,
  bounds: { x0: -160, y0: -50, x1: 200, y1: 680 },
  border: [
    { x: -150, y: -46 },
    { x: 84, y: -46 },
    { x: 84, y: 340 },
    { x: 196, y: 340 },
    { x: 196, y: 676 },
    { x: -150, y: 676 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(10, 230, 36, 170, 1, 0.05), surface: 'fairway' },
    { poly: blob(50, 420, 34, 30, 2, 0.06), surface: 'fairway' },
    // the riverwalk along the bank, and Wacker Drive along the towers
    { poly: band(BANK.slice(0, 4), 4), surface: 'stone' },
    { poly: rect(66, -40, 84, 340), surface: 'path' },
    { poly: SLOT, surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: [...BANK, { x: 220, y: 540 }, { x: 120, y: 538 }, { x: -20, y: 520 }, { x: -110, y: 420 }, { x: -130, y: 200 }, { x: -130, y: -60 }], level: RIVER }],
  terrain: [
    { kind: 'ramp', x0: -160, y0: -50, x1: 200, y1: 680, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the river in its stone channel
    { kind: 'channel', pts: [{ x: -100, y: -60 }, { x: -98, y: 200 }, { x: -84, y: 400 }, { x: -20, y: 496 }, { x: 120, y: 514 }, { x: 230, y: 512 }], width: 34, depth: 9 },
    ...chiGreen(GREEN, LAND, [0.6, 0.5], [[-8, -6, 7, 0.25], [9, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: TOWERS.flatMap((b) => b.walls),
  roofs: TOWERS.map((b) => b.roof),
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'lowerwacker', poly: SLOT }],
  secret: { name: 'Lower Wacker', zone: 'lowerwacker', hint: 'Past the last tower on the right the drive runs down to the river. Roll one along it.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 20, y: 220 },
    { x: 40, y: 430 },
    { x: 30, y: 580 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'el', x: 0, y: 110, rot: 0, scale: 360, label: 'brown' },
    ...TOWERS.map((b) => b.decor),
    { kind: 'marina', x: -60, y: 760 },
    { kind: 'bascule', x: 160, y: 512, rot: 0, scale: 60 },
    { kind: 'walkers', x: -62, y: 200, rot: Math.PI / 2, scale: 380, size: [10, 0, 0] },
    { kind: 'steam', x: 74, y: 30 },
    { kind: 'steam', x: 74, y: 250 },
    { kind: 'streetsign', x: 88, y: -10, rot: Math.PI / 2, label: 'W WACKER DR' },
    { kind: 'willis', x: 600, y: 300 },
    { kind: 'aon', x: 420, y: 980 },
  ],
};
