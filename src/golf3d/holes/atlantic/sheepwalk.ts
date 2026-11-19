// Hole 1, Sheep Walk (par 4, 390 yd as shown): inland through a valley in the dunes on the west coast of Ireland, a
// dry-stone wall across the end of the fairway and a big links green set just beyond it.
// The play: a drive between the two pots and short of the burn, then an iron over the burn and the wall to a green that
// tips to the right.
// The bail-out: left, off the tee and at the green. The burn runs all down the right, and right of the green is a deep pot.
// The secret: the Sheep Gate. There's a gap in the wall, and the sheep have worn a track through it down to the green.
// A putt or a low runner along the track from the end of the fairway rolls through the gate and onto the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { dunes, gorse, LINKS_TURF, pot } from './common';

const GROUND = 8;
const GREEN = { x: 48, y: 530, rx: 19, ry: 16 };
// the wall runs a little uphill of square; the gate is the gap in it
const wallY = (x: number) => 446 + (x - 2) * 0.047;
const GATE = { x0: 8, x1: 20 };
// the burn: a stream down the right of the fairway, then across it, short of the wall
const BURN: V2[] = [
  { x: 66, y: -40 },
  { x: 62, y: 100 },
  { x: 56, y: 220 },
  { x: 46, y: 320 },
  { x: 0, y: 366 },
  { x: -60, y: 380 },
  { x: -130, y: 386 },
];
// the sheep track: from the end of the fairway, through the gate, to the front of the green
const TRACK: V2[] = [
  { x: 2, y: 396 },
  { x: 14, y: wallY(14) },
  { x: 30, y: 486 },
  { x: 42, y: 513 },
];
const traps = [
  pot(-27, 318, 7, 1), // left of the landing
  pot(22, 282, 7, 2), // right of it, further on
  greenside(GREEN, 70, 522, 6, 8, 3, 3.4, 0), // right of the green
  greenside(GREEN, 52, 552, 9, 6, 4, 3.4, 0), // behind it
  greenside(GREEN, 64, 506, 6, 6, 5, 3.4, 0), // short and right: a links pot guarding the bigger green
];

export const sheepwalk: Hole = {
  id: 'sheepwalk',
  name: 'Sheep Walk',
  par: 4,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.1,
  yards: 390,
  blurb: 'Down the valley between the dunes, over the burn and the old wall to a big links green. Miss it short and left, never right.',
  teeTip: 'The burn runs down the right and then across. Favour the left, and stay short of it.',
  tee: { x: 0, y: 0 },
  cup: { x: 48, y: 532 },
  pins: [{ x: 48, y: 532 }, { x: 38, y: 524 }, { x: 59, y: 536 }, { x: 46, y: 541 }],
  aim: 0.01,
  bounds: { x0: -130, y0: -50, x1: 150, y1: 620 },
  border: [
    { x: -126, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 616 },
    { x: -126, y: 616 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the valley floor: 56 ft across where a drive finishes
    { poly: blob(2, 216, 28, 140, 1, 0.06), surface: 'fairway' },
    // past the wall, the run-up to the green
    { poly: blob(32, 486, 15, 22, 2, 0.08), surface: 'fairway' },
    // a wide collar, mown for the run-up (Nov 18: bigger, lower links greens)
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 7, GREEN.ry + 7, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the sheep track, worn to bare earth
    { poly: band(TRACK, 2.6), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(BURN, 5), level: GROUND - 1.4, look: 'lake' }],
  terrain: [
    { kind: 'ramp', x0: -130, y0: -50, x1: 150, y1: 620, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the dunes down both sides and behind the green
    ...dunes([[-100, 40, 50, 9], [-96, 190, 46, 8], [-102, 340, 50, 11], [-92, 500, 48, 9], [108, 100, 44, 8], [112, 260, 46, 10], [116, 420, 42, 8], [124, 560, 40, 9], [40, 628, 54, 10]]),
    // the rumpled floor of the valley
    ...dunes([[-20, 110, 24, 1.6], [22, 170, 22, -1.2], [-14, 250, 24, 1.4], [16, 300, 20, 1.2], [-6, 380, 24, -1.2], [-50, 430, 26, 2.2], [70, 470, 20, 1.8]]),
    // the burn, cut into the ground
    { kind: 'channel', pts: BURN, width: 12, depth: 3 },
    // the tee, up on a low dune
    { kind: 'disc', x: 0, y: -2, r: 18, h: GROUND + 5, edge: 12, op: 'set' },
    ...greenComplex(GREEN, GROUND, { lift: 0.6, edge: 14, tilt: [-0.9, 0.5], rolls: [[-9, -6, 9, 0.4], [11, 7, 8, -0.35], [2, 10, 7, 0.25]] }),
    // the track is worn into the ground, so a rolling ball keeps to it
    { kind: 'channel', pts: TRACK, width: 4.5, depth: 0.6 },
    ...traps.flatMap((t) => t.pieces),
  ],
  // the old dry-stone wall: a ball that hits it kicks off. Fly it, or find the gate.
  walls: [
    { a: { x: -122, y: wallY(-122) }, b: { x: GATE.x0, y: wallY(GATE.x0) }, h: 3, look: 'stone' },
    { a: { x: GATE.x1, y: wallY(GATE.x1) }, b: { x: 142, y: wallY(142) }, h: 3, look: 'stone' },
  ],
  posts: gorse([[-52, 90], [-58, 230], [-50, 300], [84, 200], [86, 330], [-40, 470], [-20, 520], [96, 500], [10, 580], [84, 590]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'sheepgate', poly: rect(GATE.x0, wallY(14) - 4, GATE.x1, wallY(14) + 4) }],
  secret: { name: 'The Sheep Gate', zone: 'sheepgate', hint: 'There is a gap in the wall where the sheep go through. Their track runs all the way to the green. Roll one along it.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 240 },
    { x: 14, y: 430 },
    { x: 48, y: 530 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
    { kind: 'sheep', x: -8, y: 462, rot: 0.9 },
    { kind: 'sheep', x: -70, y: 150, rot: 0.4 },
    { kind: 'sheep', x: -76, y: 164, rot: -1.1 },
    { kind: 'sheep', x: 84, y: 330, rot: 2.2 },
    { kind: 'sheep', x: 100, y: 470, rot: -0.6 },
  ],
};
