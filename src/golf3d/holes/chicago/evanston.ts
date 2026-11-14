// Hole 6, Evanston (par 3, 185 yd): off the lakeside terrace of Kellogg's Global Hub on Northwestern's lakefill, over
// the lagoon to a small green out on the rock revetment, Lake Michigan behind it and to the right. Built Nov 14 to be
// hard: a good score here is par.
// The green is ringed in rocks: a ball that catches them kicks off anywhere, usually into the lake. The green tilts
// toward the water. The only miss is a small grass bank short left, joined to the green.
// The play: a full wood at the left half of the green, and take your three. No secret.
import { blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, greenGallery } from './common';

const LAND = 6;
const LAKE = 1;
const SEED = 7;
// a small green, out on the rocks
const GREEN = { x: 24, y: 252, rx: 22, ry: 16 };
// the Global Hub behind the tee: glass and steel, four storeys
const HUB = building(0, -62, 150, 60, 56, 71);
// the bank short left of the green, by the path: the bail-out
const BANK = blob(-40, 240, 18, 22, 3, 0.06);

const posts: Post[] = [
  // the revetment's big stones, round the green and along the shore
  ...[
    [-6, 226], [6, 284], [30, 290], [54, 278], [62, 252], [56, 226], [40, 216],
  ].map(([x, y], i) => ({ x, y, r: 2.4 + (i % 3) * 0.6, h: 2.6 + (i % 2), e: 0.7, look: 'rock' as const })),
  // a painted boulder on the bank, the one everybody paints
  { x: -48, y: 224, r: 3, h: 4, e: 0.6, look: 'rock' },
  ...[[-100, 20], [-110, -40]].map(([x, y], i) => ({ x, y, r: 6, h: 24 + i * 3, soft: true, look: 'maple' as const })),
  ...[[-96, 40], [-96, -40], [60, 30]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
];

export const evanston: Hole = {
  id: 'evanston',
  name: 'Evanston',
  par: 3,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.06,
  teeTip: 'All carry, into the wind off the lake. A full wood at the left half; rocks and water everywhere else. Short left is the only miss.',
  yards: 185,
  blurb: "Off the terrace of Kellogg's Global Hub, over the lakefill lagoon to a small green out on the rocks. Lake Michigan behind and right.",
  tee: { x: 0, y: 0 },
  cup: { x: 24, y: 255 },
  pins: [{ x: 24, y: 255 }, { x: 12, y: 246 }, { x: 36, y: 258 }, { x: 20, y: 264 }],
  aim: 0.05,
  bounds: { x0: -150, y0: -110, x1: 190, y1: 400 },
  border: [
    { x: -146, y: -100 },
    { x: 186, y: -100 },
    { x: 186, y: 396 },
    { x: -146, y: 396 },
  ],
  base: 'rough',
  regions: [
    // the terrace: stone, with a mat on it
    { poly: rect(-40, -26, 40, 14), surface: 'stone' },
    { poly: rect(-10, -10, 10, 10), surface: 'fairway' },
    // the lakefill path down the left
    { poly: rect(-104, -90, -96, 48), surface: 'path' },
    { poly: BANK, surface: 'fairway' },
    // the revetment round the green: big stones, lively and unkind
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 15, GREEN.ry + 14, 4, 0.08), surface: 'rock' },
    ...chiGreenRegions(GREEN, SEED),
  ],
  water: [
    // the lagoon between the terrace and the green, and the lake round the back and right
    { poly: rect(-146, 50, 186, 296), level: LAKE },
    { poly: rect(70, 200, 186, 396), level: LAKE, look: 'sea', tide: { amp: 0.4, period: 9 } },
    { poly: rect(-146, 296, 186, 396), level: LAKE, look: 'sea', tide: { amp: 0.4, period: 9 } },
  ],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -110, x1: 190, y1: 400, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the terrace, a storey up
    { kind: 'box', x0: -40, y0: -26, x1: 40, y1: 14, h: LAND + 12, edge: 1, op: 'set' },
    // the lagoon and the lake, sunk below the water
    { kind: 'box', x0: -146, y0: 50, x1: 186, y1: 296, h: LAKE - 6, edge: 4, op: 'set' },
    { kind: 'box', x0: 70, y0: 196, x1: 186, y1: 396, h: LAKE - 6, edge: 4, op: 'set' },
    { kind: 'box', x0: -146, y0: 292, x1: 186, y1: 396, h: LAKE - 6, edge: 4, op: 'set' },
    // the spit the green sits on, and the bank on the left joining it to the shore
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 14, h: LAND, edge: 4, op: 'set' },
    { kind: 'box', x0: -62, y0: 214, x1: -8, y1: 266, h: LAND, edge: 5, op: 'set' },
    ...chiGreen(GREEN, LAND, [0.6, 0.5], [[-6, -4, 5, 0.2], [6, 4, 5, -0.2]], 2.5),
  ],
  walls: HUB.walls,
  roofs: [HUB.roof],
  roofsGive: true,
  posts,
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -40 },
    { x: 10, y: 120 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teetower', x: 0, y: -6, size: [80, 40, 12], scale: 70 },
    { kind: 'teebox', x: 0, y: 0 },
    HUB.decor,
    ...greenGallery({ ...GREEN, rx: GREEN.rx + 30 }, 150, 210),
    { kind: 'walkers', x: -100, y: -20, rot: Math.PI / 2, scale: 120, size: [6, 0, 0] },
    { kind: 'lake', x: 160, y: 300, rot: Math.PI / 4, scale: 1 },
  ],
};
