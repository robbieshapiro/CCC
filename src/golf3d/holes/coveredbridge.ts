// Hole 1, The Covered Bridge (par 4, about 490 ft, 360 yd as shown): down off the tee to a creek that winds across
// the hole, and a green beyond it under the maples.
// The play: lay up short of the creek, then a short iron over it to the green.
// The gamble: a driver over the creek, onto the bank of fairway on the right, for a pitch in.
// The secret: an old red covered bridge carries the farm track over the creek, straight at the green. Roll one through.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: -22, y: 420, rx: 20, ry: 22 };
const GROUND = 2;
const LEVEL = GROUND - 2;
// the creek, winding right to left across the hole
const CREEK: V2[] = [
  { x: -170, y: 292 },
  { x: -100, y: 274 },
  { x: -30, y: 268 },
  { x: 30, y: 262 },
  { x: 100, y: 278 },
  { x: 170, y: 266 },
];
// the covered bridge: its deck runs up the hole, walled and roofed
const BRIDGE = { x: -30, y0: 238, y1: 300, half: 4 };
const DECK = GROUND + 0.4;
// the farm track from the far end of the bridge to the green
const TRACK: V2[] = [
  { x: -30, y: 300 },
  { x: -28, y: 350 },
  { x: -24, y: 398 },
];

const maples: Post[] = [
  ...[30, 90, 150, 210, 340, 400].map((y, i) => ({ x: -140 - (i % 2) * 12, y, r: 2, h: 24, look: 'maple' as const })),
  ...[20, 80, 140, 200, 350, 410].map((y, i) => ({ x: 132 + (i % 2) * 12, y, r: 2, h: 24, look: 'maple' as const })),
  ...[-110, -60, 10, 60, 110].map((x, i) => ({ x, y: 474 + (i % 2) * 10, r: 2, h: 26, look: 'maple' as const })),
];

const base: Hole = {
  id: 'coveredbridge',
  name: 'The Covered Bridge',
  par: 4,
  theme: 'autumn',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: -22, y: 424 },
  pins: [{ x: -22, y: 424 }, { x: -14, y: 410 }, { x: -32, y: 412 }, { x: -18, y: 434 }],
  aim: 0,
  bounds: { x0: -170, y0: -40, x1: 170, y1: 500 },
  border: [
    { x: -166, y: -36 },
    { x: 166, y: -36 },
    { x: 166, y: 496 },
    { x: -166, y: 496 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // short of the creek: the layup
    { poly: blob(0, 150, 46, 96, 1, 0.08), surface: 'fairway' },
    // over it: the bank on the right for the gamble, and the approach to the green
    { poly: blob(56, 334, 40, 30, 2, 0.1), surface: 'fairway' },
    { poly: blob(-12, 364, 52, 36, 3, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    { poly: band(TRACK, 3), surface: 'path' },
    { poly: circle(14, 404, 7), surface: 'sand' },
    { poly: circle(-52, 440, 6), surface: 'sand' },
    { poly: rect(BRIDGE.x - BRIDGE.half, BRIDGE.y0, BRIDGE.x + BRIDGE.half, BRIDGE.y1), surface: 'wood' },
  ],
  water: [{ poly: band(CREEK, 12), level: LEVEL }],
  terrain: [
    // the tee up on a knoll, then the long gentle fall to the creek
    { kind: 'ramp', x0: -170, y0: -40, x1: 170, y1: 20, axis: 'y', h0: 9, h1: 9, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 20, x1: 170, y1: 110, axis: 'y', h0: 9, h1: GROUND + 1, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 110, x1: 170, y1: 240, axis: 'y', h0: GROUND + 1, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 240, x1: 170, y1: 500, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // over the creek the ground falls gently to the green, so the track runs on
    { kind: 'ramp', x0: -80, y0: 300, x1: 40, y1: 400, axis: 'y', h0: DECK, h1: GROUND - 0.4, op: 'set' },
    // wooded slopes either side, and a rise behind the green
    ...[0, 160, 320, 480].map((y, i) => ({ kind: 'hill' as const, x: -260, y, r: 120, h: 16 + (i % 2) * 6 })),
    ...[0, 160, 320, 480].map((y, i) => ({ kind: 'hill' as const, x: 260, y, r: 120, h: 18 + (i % 2) * 5 })),
    { kind: 'hill', x: -20, y: 560, r: 120, h: 14 },
    // the creek
    { kind: 'channel', pts: CREEK, width: 14, depth: 4.5 },
    // the bridge deck over it
    { kind: 'embankment', pts: [{ x: BRIDGE.x, y: BRIDGE.y0 - 4 }, { x: BRIDGE.x, y: BRIDGE.y1 + 4 }], h: [DECK, DECK], width: BRIDGE.half, edge: 3 },
    // the green, just up out of the approach, leaning a touch left
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.ry + 8, h: GROUND - 0.2, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: -0.3, h1: 0.3, op: 'add' },
    // bunkers
    ...[[14, 404, 7], [-52, 440, 6]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [
    { a: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x - BRIDGE.half - 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
    { a: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y0 }, b: { x: BRIDGE.x + BRIDGE.half + 1, y: BRIDGE.y1 }, h: 9, look: 'barn' },
  ],
  roofs: [{ poly: rect(BRIDGE.x - BRIDGE.half - 1, BRIDGE.y0, BRIDGE.x + BRIDGE.half + 1, BRIDGE.y1), h: 9, top: 14 }],
  posts: [...maples, ...[[60, 30, 2.6], [-70, 120, 3], [96, 210, 2.8]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }))],
  movers: [],
  pushes: [],
  zones: [{ id: 'bridge', poly: rect(BRIDGE.x - BRIDGE.half, BRIDGE.y0 + 8, BRIDGE.x + BRIDGE.half, BRIDGE.y1 - 8) }],
  secret: { name: 'The Covered Bridge', zone: 'bridge', hint: 'The old bridge carries the farm track over the creek, straight at the green. Roll one through.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 200 },
    { x: -30, y: 300 },
    { x: -22, y: 424 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'pumpkins', x: -36, y: -8 },
    { kind: 'haybale', x: 38, y: -6, rot: 0.4 },
  ],
};

// 60 ft longer than it was drawn, past the bridge: a driver can carry the creek but can't reach the green
export const coveredbridge = extend(base, 310, 60);
