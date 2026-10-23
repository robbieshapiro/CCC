// Hole 2, The Lava Field (par 5, about 590 ft): islands of turf in a field of black rock and running lava.
// The play: three carries. Drive over the first flow, an iron over the wide one to the layup island, then a wedge in.
// The gamble: from the second island, a full driver over the wide flow and the last one, straight at the green.
// The live hazard: the wide flow swells and settles, so its banks are wider some moments than others.
// The secret: an old lava tube still crosses the wide flow on the right. Roll a ball along the top of it.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: -6, y: 580, r: 26 };
const FLOOR = 8; // the black rock (and the turf on it) sits at about this height; the flows are cut below it
const LAVA = FLOOR - 4;

// the three flows, winding across the hole
const L1: V2[] = [{ x: -150, y: 64 }, { x: -60, y: 80 }, { x: 20, y: 70 }, { x: 80, y: 84 }, { x: 150, y: 74 }];
const L2: V2[] = [{ x: -150, y: 330 }, { x: -70, y: 350 }, { x: 0, y: 336 }, { x: 70, y: 352 }, { x: 150, y: 340 }];
const L3: V2[] = [{ x: -150, y: 508 }, { x: -40, y: 500 }, { x: 40, y: 516 }, { x: 150, y: 506 }];

// the lava tube: a hump of cooled rock across the wide flow, with a groove along the top
const tube: V2[] = [
  { x: 82, y: 262 },
  { x: 84, y: 300 },
  { x: 86, y: 344 },
  { x: 84, y: 388 },
  { x: 78, y: 430 },
];

const rocks: Post[] = [
  [-70, 20, 3.4], [70, 26, 3], [-96, 200, 4], [96, 170, 3.6], [-92, 452, 3.2], [-62, 640, 3.4], [56, 642, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const lavafield: Hole = {
  id: 'lavafield',
  name: 'The Lava Field',
  par: 5,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: -2, y: 586 },
  pins: [{ x: -2, y: 586 }, { x: 8, y: 568 }, { x: -18, y: 592 }, { x: 4, y: 596 }],
  aim: 0,
  bounds: { x0: -140, y0: -40, x1: 140, y1: 680 },
  border: [
    { x: -136, y: -36 },
    { x: 136, y: -36 },
    { x: 136, y: 676 },
    { x: -136, y: 676 },
  ],
  base: 'rock',
  regions: [
    // the tee island
    { poly: blob(0, 0, 40, 34, 1, 0.12), surface: 'rough' },
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the second island: the main landing
    { poly: blob(6, 190, 76, 66, 2, 0.1), surface: 'rough' },
    { poly: blob(4, 192, 60, 52, 2, 0.1), surface: 'fairway' },
    // the layup island
    { poly: blob(12, 456, 82, 34, 3, 0.1), surface: 'rough' },
    { poly: blob(14, 456, 66, 24, 3, 0.1), surface: 'fairway' },
    // the green island
    { poly: blob(-6, 584, 60, 50, 4, 0.1), surface: 'rough' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 5, GREEN.r + 3, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r - 2, 5, 0.06), surface: 'green' },
    { poly: blob(-40, 556, 8, 6, 6, 0.15), surface: 'sand' },
    { poly: blob(26, 612, 8, 6, 7, 0.15), surface: 'sand' },
    { poly: blob(-30, 236, 10, 7, 8, 0.15), surface: 'sand' },
    { poly: band(tube, 2.4), surface: 'path' },
  ],
  water: [
    { poly: band(L1, 26), level: LAVA, look: 'lava' },
    // the wide flow swells and settles
    { poly: band(L2, 62), level: LAVA, look: 'lava', tide: { amp: 1.2, period: 13 } },
    { poly: band(L3, 18), level: LAVA, look: 'lava' },
  ],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -40, x1: 140, y1: 680, axis: 'y', h0: FLOOR + 2, h1: FLOOR, op: 'set' },
    // rough black rock: lumps and hollows everywhere off the turf
    ...[[-110, 160], [110, 80], [-112, 440], [116, 520], [-100, 620], [120, 250], [-120, 30], [110, 640]].map(([x, y], i) => ({ kind: 'hill' as const, x, y, r: 40, h: 3 + (i % 3) })),
    // a cone rises behind the green
    { kind: 'hill', x: 0, y: 780, r: 170, h: 50 },
    // the three flows
    { kind: 'channel', pts: L1, width: 26, depth: 7 },
    { kind: 'channel', pts: L2, width: 62, depth: 7 },
    { kind: 'channel', pts: L3, width: 18, depth: 7 },
    // the lava tube across the wide flow
    { kind: 'embankment', pts: tube, h: [FLOOR + 0.3, FLOOR, FLOOR - 0.2, FLOOR - 0.3, FLOOR], width: 4, edge: 6 },
    { kind: 'channel', pts: tube, width: 4, depth: 0.7 },
    // rolls on the landing island
    { kind: 'hill', x: 30, y: 180, r: 30, h: 1.4 },
    { kind: 'hill', x: -30, y: 456, r: 24, h: 1 },
    // the green: two tiers, the back one higher, with a false front that throws a timid shot back off
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 12, h: FLOOR + 1.5, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 4, x1: GREEN.x + 40, y1: GREEN.y + 4, axis: 'y', h0: 0, h1: 1.1, op: 'add' },
    { kind: 'box', x0: GREEN.x - 40, y0: GREEN.y + 4, x1: GREEN.x + 40, y1: GREEN.y + 40, h: 1.1, edge: 0.5, op: 'add' },
    { kind: 'hill', x: GREEN.x, y: GREEN.y - GREEN.r + 2, r: 13, h: -0.9 },
    // and the whole green leans left
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 40, x1: GREEN.x + 40, y1: GREEN.y + 40, axis: 'x', h0: -0.5, h1: 0.5, op: 'add' },
    // bunkers
    ...[[-40, 556, 8], [26, 612, 8], [-30, 236, 10]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  zones: [{ id: 'lavatube', poly: band(tube.slice(1, 4), 3) }],
  secret: { name: 'The Lava Tube', zone: 'lavatube', hint: 'An old lava tube still crosses the wide flow, out on the right. Roll one along the top.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 200 },
    { x: 20, y: 420 },
    { x: -2, y: 586 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'bench', x: -22, y: -12, rot: 0 },
  ],
};
