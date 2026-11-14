// Hole 3, Lincoln Park (par 4, 415 yd): from the lawn by the Conservatory, round the South Pond lagoon to a green on a
// spit of land out in North Pond, the lake and the skyline beyond. Built Nov 14 to be hard: a good score here is par.
// The lagoon runs diagonally across the hole from front right to back left (a cape hole): the more of it you bite off,
// the shorter the second, and a driver goes in it. The first fairway is a narrow strip up the left between the oaks
// and the water. The green sits on a peninsula with water short, right and long; the only miss is the bank left.
// The play: a wood or a long iron up the left strip, then a long iron or a wood over the lagoon's far arm to the
// peninsula. No secret.
import { blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, greenGallery, teeGallery } from './common';

const LAND = 6;
const POND = LAND - 1; // the water's surface, a foot below the turf
const SEED = 6;
// a smaller green than the rest of the course, out on its spit
const GREEN = { x: 30, y: 560, rx: 26, ry: 19 };
const traps = [greenside(GREEN, -26, 548, 7, 9, 1, 3, 0)];
// the South Pond lagoon, sweeping across the hole from front right to back left
const LAGOON = [
  { x: 220, y: 70 },
  { x: 150, y: 200 },
  { x: 76, y: 305 },
  { x: -30, y: 368 },
  { x: -170, y: 396 },
];
// the strip up the left, between the oaks and the water
const FIRST = blob(-44, 215, 42, 110, 1, 0.05);
// the far side of the lagoon, where the second is played from
const SECOND = blob(-24, 458, 52, 30, 2, 0.05);

const posts: Post[] = [
  // oaks crowding the left of the first fairway, and a few on the far bank
  ...[60, 130, 200, 270].map((y, i) => ({ x: -98 + (i % 2) * 6, y, r: 8, h: 30 + (i % 2) * 6, soft: true, look: 'oak' as const })),
  ...[[-110, 440], [-70, 500], [70, 430]].map(([x, y], i) => ({ x, y, r: 7, h: 28 + i * 3, soft: true, look: 'oak' as const })),
  // maples along the lagoon's near bank, short of the green and by the tee
  ...[[40, 60], [70, 130], [-140, 520]].map(([x, y], i) => ({ x, y, r: 6, h: 24 + i * 2, soft: true, look: 'maple' as const })),
  ...[[-130, 40], [-130, 300], [-150, 480]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
];

export const lincolnpark: Hole = {
  id: 'lincolnpark',
  name: 'Lincoln Park',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.05,
  teeTip: 'A driver finds the lagoon. A wood up the left strip, then everything over the water to the spit. Miss left of the green, never right.',
  yards: 415,
  blurb: 'Round the South Pond lagoon to a green out on a spit in North Pond. Water short, right and long. A good score here is par.',
  tee: { x: 0, y: 0 },
  cup: { x: 30, y: 563 },
  pins: [{ x: 30, y: 563 }, { x: 16, y: 553 }, { x: 44, y: 568 }, { x: 26, y: 574 }],
  aim: -0.18,
  bounds: { x0: -180, y0: -50, x1: 210, y1: 660 },
  border: [
    { x: -176, y: -46 },
    { x: 206, y: -46 },
    { x: 206, y: 656 },
    { x: -176, y: 656 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: FIRST, surface: 'fairway' },
    { poly: SECOND, surface: 'fairway' },
    // the path along the left, and the neck of the spit out to the green
    { poly: rect(-150, -40, -142, 640), surface: 'path' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [
    // the lagoon and North Pond: water wherever the ground is below the surface
    { poly: [{ x: 210, y: -10 }, { x: 210, y: 340 }, { x: 60, y: 395 }, { x: -20, y: 415 }, { x: -180, y: 440 }, { x: -180, y: 345 }, { x: -60, y: 325 }, { x: 30, y: 275 }, { x: 110, y: 140 }, { x: 160, y: -10 }], level: POND },
    { poly: rect(-180, 496, 210, 660), level: POND },
  ],
  terrain: [
    { kind: 'ramp', x0: -180, y0: -50, x1: 210, y1: 660, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 14, h: LAND + 1.5, edge: 6, op: 'set' },
    { kind: 'channel', pts: LAGOON, width: 78, depth: 7 },
    // North Pond: everything past the second fairway, but for the spit
    { kind: 'box', x0: -180, y0: 500, x1: 210, y1: 660, h: POND - 5, edge: 6, op: 'set' },
    // the neck of the spit, out from the far bank to the green
    { kind: 'box', x0: -8, y0: 480, x1: 26, y1: 540, h: LAND, edge: 3, op: 'set' },
    // and the bank left of the green: the one place to miss it
    { kind: 'box', x0: -60, y0: 500, x1: 0, y1: 580, h: LAND, edge: 5, op: 'set' },
    ...chiGreen(GREEN, LAND, [0.5, 0.6], [[-7, -5, 6, 0.25], [8, 5, 5, -0.2]], 2.5),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts,
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -30 },
    { x: -50, y: 200 },
    { x: -24, y: 440 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    // a few patrons
    teeGallery({ x: 0, y: 0 }),
    ...greenGallery(GREEN, 120, 200),
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'walkers', x: -146, y: 300, rot: Math.PI / 2, scale: 600, size: [10, 0, 0] },
    { kind: 'lake', x: 700, y: 300, rot: Math.PI / 2, scale: 6 },
    { kind: 'hancock', x: 400, y: -1600 },
    { kind: 'willis', x: -100, y: -2600 },
  ],
};
