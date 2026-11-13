// Hole 3, The River (par 4, 420 yd): off a rooftop on Wacker Drive, along the Chicago River's south bank and across it
// to a green under Marina City's corn cobs. The river runs the whole left side, then turns and crosses in front of the green; towers stand
// along the right, in play, and the brown line's el rattles across overhead off the tee.
// The play: a drive up the right-centre, short of the river's bend, then a mid iron over the water.
// The secret: Wacker Drive's lower level, a slot under the last tower on the right. Roll one through it and it comes
// out at the river's edge with a short iron left.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, FACE, gallery, greenGallery } from './common';

const LAND = 7;
// the tee: on the roof of a riverside tower, 26 ft above the street (44 until Nov 12: from up there a perfect full
// driver flew the landing area and found the river, as did 74% of members' real drives in the simulator)
const ROOF = { x0: -16, y0: -24, x1: 16, y1: 16, h: 26 };
const RIVER = 1;
// bigger greens, for longer putts (about a third bigger each way since Nov 10)
// a fifth bigger again each way since Nov 13, and no longer a plain oval (see chiGreenRegions)
const SEED = 3;
const GREEN = { x: 30, y: 580, rx: 35, ry: 26 };
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

// a boat slip cut in from the river across most of the fairway, where a good drive wants to land: lay up short of it or
// carry it
const SLIP = { y0: 272, y1: 300, x1: 34 };
const posts: Post[] = [
  ...[[60, 20], [60, 140], [60, 260]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
  // maples along the riverwalk, hanging over the left of the fairway
  ...[30, 110, 190, 330, 410].map((y, i) => ({ x: -46 + (i % 2) * 3, y, r: 6, h: 24 + (i % 3) * 3, soft: true, look: 'maple' as const })),
];

export const river: Hole = {
  id: 'river',
  name: 'The River',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.03,
  teeTip: 'The river is left and long. Aim at the towers: they give the ball back.',
  yards: 430,
  blurb: 'Off a rooftop on Wacker. The river down the left, a boat slip across the landing area, then over the river to the corn cobs.',
  tee: { x: 0, y: 0 },
  cup: { x: 30, y: 583 },
  pins: [{ x: 30, y: 583 }, { x: 14, y: 570 }, { x: 48, y: 588 }, { x: 26, y: 595 }],
  aim: 0.1,
  bounds: { x0: -160, y0: -50, x1: 200, y1: 680 },
  border: [
    { x: -150, y: -46 },
    { x: 84, y: -46 },
    { x: 84, y: 340 },
    { x: 196, y: 340 },
    { x: 196, y: 676 },
    { x: -30, y: 676 },
    // the far bank west of the green is out of bounds: no cutting the bend over the river
    { x: -30, y: 548 },
    { x: -150, y: 430 },
  ],
  base: 'rough',
  regions: [
    // the rooftop, gravel and the tee mat
    { poly: rect(ROOF.x0, ROOF.y0, ROOF.x1, ROOF.y1), surface: 'stone' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // (Nov 13: both a quarter wider and longer again)
    // a first leg to the slip, then a second up the right past it (both half as wide again since Nov 11)
    { poly: blob(6, 165, 42, 118, 1, 0.05), surface: 'fairway' },
    // (since Nov 12 it sits where drives off the roof finish: they fly past the first leg)
    { poly: blob(40, 388, 54, 76, 2, 0.06), surface: 'fairway' },
    // the riverwalk along the bank, and Wacker Drive along the towers
    { poly: band(BANK.slice(0, 4), 4), surface: 'stone' },
    { poly: rect(66, -40, 84, 340), surface: 'path' },
    { poly: SLOT, surface: 'path' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: rect(-130, SLIP.y0, SLIP.x1, SLIP.y1), level: RIVER },
    // the river: wide and blue now, from the bank to well across, and round in front of the green
    { poly: [...BANK, { x: 220, y: 552 }, { x: 120, y: 550 }, { x: -20, y: 534 }, { x: -120, y: 430 }, { x: -146, y: 200 }, { x: -146, y: -60 }], level: RIVER },
  ],
  terrain: [
    { kind: 'ramp', x0: -160, y0: -50, x1: 200, y1: 680, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'box', x0: ROOF.x0, y0: ROOF.y0, x1: ROOF.x1, y1: ROOF.y1, h: LAND + ROOF.h, edge: 1, op: 'set' },
    // the slip, walled in stone like the river
    { kind: 'box', x0: -130, y0: SLIP.y0, x1: SLIP.x1, y1: SLIP.y1, h: RIVER - 8, edge: 1, op: 'set' },
    // the river in its stone channel
    { kind: 'channel', pts: [{ x: -100, y: -60 }, { x: -98, y: 200 }, { x: -84, y: 400 }, { x: -20, y: 496 }, { x: 120, y: 514 }, { x: 230, y: 512 }], width: 54, depth: 10 },
    ...chiGreen(GREEN, LAND, [0.6, 0.5], [[-8, -6, 7, 0.25], [9, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: TOWERS.flatMap((b) => b.walls),
  roofs: TOWERS.map((b) => b.roof),
  roofsGive: true,
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
    // the patrons (Nov 13)
    // on the tee's rooftop, along Wacker under the towers, and round the back of the green
    gallery(0, -19, FACE.north, 24, 14, 2),
    ...[40, 150, 260].map((y) => gallery(70, y, FACE.west, 96, 32, 2)),
    ...greenGallery(GREEN, -20, 150),
    { kind: 'teetower', x: 0, y: -4, size: [ROOF.x1 - ROOF.x0, ROOF.y1 - ROOF.y0, ROOF.h], scale: 71 },
    { kind: 'teebox', x: 0, y: 0 },
    // the L runs behind the tee now: with the tee lowered to 26 ft its deck crossed the hole at eye level
    { kind: 'el', x: 0, y: -72, rot: 0, scale: 360, label: 'brown' },
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
