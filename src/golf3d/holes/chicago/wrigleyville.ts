// Hole 4, Wrigleyville (par 4, 390 yd): off a rooftop at the south end, straight up Clark Street to a green at the foot
// of Wrigley Field, parked
// cars along both curbs and a planted median of maples splitting the landing area.
// Three-flats line both sides (a ball on a roof is gone), the red line's el runs the alley on the left with its trains
// going by, one corner building pokes out into the street on the right, and the rooftop bleachers look down on the
// green. The marquee's out by the corner gate.
// The play: a drive up the left half, clear of the corner building, then a short iron to a green in front of the ivy.
// The secret: the gangway, where the sidewalk dips off the gap between the three-flats on the left: a ball that lands
// there kicks back out to the middle of the street.
import { blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_TURF, CHI_WALLS, chiGreen } from './common';

const LAND = 6;
// the tee: on a rooftop over the street, 40 ft up
const ROOF = { x0: -20, y0: -30, x1: 20, y1: 10, h: 40 };
// bigger greens, for longer putts (about a third bigger each way since Nov 10)
const GREEN = { x: 8, y: 520, rx: 29, ry: 21 };
const traps = [greenside(GREEN, -26, 530, 8, 8, 1, 3, 0), greenside(GREEN, 40, 512, 8, 9, 2, 3, 0)];
// [x, y, width, depth, rooftop bleachers?]
const FLATS: [number, number, number, number, boolean][] = [
  [-74, 40, 40, 70, false],
  [-74, 120, 40, 70, false],
  [-74, 200, 40, 70, false],
  [-74, 330, 40, 70, false],
  [-74, 410, 40, 70, true],
  [74, 40, 40, 70, false],
  [74, 120, 40, 70, false],
  [74, 200, 40, 70, false],
  [66, 290, 56, 60, false], // the corner building, poking out into the street
  [74, 400, 40, 70, true],
  [74, 470, 40, 60, true],
];
const blocks = FLATS.map(([x, y, w, d, top], i) => building(x, y, w, d, 40, i + 60, top ? 'rooftop' : 'flat'));
const GANGWAY = rect(-54, 238, -30, 292);

// cars parked along both curbs, in play: their sides are walls a ball bounces off
const CARS: [number, number][] = [[-35, 60], [-35, 110], [-35, 190], [-35, 300], [-35, 380], [35, 80], [35, 150], [35, 230], [35, 340], [35, 420]];
const carWalls = CARS.flatMap(([x, y]) => {
  const c = [{ x: x - 2.2, y: y - 4.5 }, { x: x + 2.2, y: y - 4.5 }, { x: x + 2.2, y: y + 4.5 }, { x: x - 2.2, y: y + 4.5 }];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: 5, look: 'hidden' as const }));
});
// a planted median down the middle of the street, maples on a raised bed, splitting the landing area in two
const MEDIAN = rect(-6, 200, 6, 290);
const posts: Post[] = [
  ...[[-46, 30], [-46, 170], [-46, 300], [46, 30], [46, 170], [46, 360]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
  ...[210, 245, 280].map((y, i) => ({ x: 0, y, r: 6, h: 24 + i * 3, soft: true, look: 'maple' as const })),
];

export const wrigleyville: Hole = {
  id: 'wrigleyville',
  name: 'Wrigleyville',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.03,
  teeTip: 'A full drive stops in the rough short of the green and leaves a wedge. A roof drops a miss in the street.',
  yards: 385,
  blurb: 'Off a rooftop and up Clark Street to Wrigley Field. The street runs fast, cars parked both sides, the red line rattling past.',
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 523 },
  pins: [{ x: 8, y: 523 }, { x: -9, y: 512 }, { x: 25, y: 528 }, { x: 3, y: 534 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 140, y1: 640 },
  border: [
    { x: -54, y: -46 },
    { x: 54, y: -46 },
    { x: 54, y: 470 },
    { x: 80, y: 500 },
    { x: 80, y: 590 },
    { x: -70, y: 590 },
    { x: -70, y: 500 },
    { x: -54, y: 460 },
  ],
  // the street itself: asphalt that bounces and runs like a cart path
  base: 'stone',
  regions: [
    { poly: rect(ROOF.x0, ROOF.y0, ROOF.x1, ROOF.y1), surface: 'stone' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the street: a strip of turf down the middle, sidewalks either side
    // the street's turf, split by the median (half as wide again since Nov 11: it stops short of the sidewalks)
    { poly: blob(-2, 250, 32, 200, 1, 0.04), surface: 'fairway' },
    // a band of rough across the street short of the green (Nov 12): a full drive used to run all the way on, now it
    // stops here and leaves a wedge
    { poly: blob(4, 446, 50, 26, 2, 0.06), surface: 'rough' },
    { poly: MEDIAN, surface: 'rough' },
    { poly: rect(-54, -40, -42, 460), surface: 'path' },
    { poly: rect(42, -40, 54, 460), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 140, y1: 640, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the street's crown: a little higher down the middle, so a ball drifts to the gutters
    { kind: 'ramp', x0: -54, y0: -50, x1: 0, y1: 460, axis: 'x', h0: -0.8, h1: 0, op: 'add' },
    { kind: 'ramp', x0: 0, y0: -50, x1: 54, y1: 460, axis: 'x', h0: 0, h1: -0.8, op: 'add' },
    { kind: 'box', x0: ROOF.x0, y0: ROOF.y0, x1: ROOF.x1, y1: ROOF.y1, h: LAND + ROOF.h, edge: 1, op: 'set' },
    // the median's raised bed
    { kind: 'box', x0: -6, y0: 200, x1: 6, y1: 290, h: 1.2, edge: 1, op: 'add' },
    // the gangway's apron, tipping back toward the street
    { kind: 'ramp', x0: -54, y0: 238, x1: -30, y1: 292, axis: 'x', h0: 1.4, h1: 0, op: 'add' },
    ...chiGreen(GREEN, LAND, [0.5, -0.5], [[-8, -5, 6, 0.25], [9, 5, 5, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [...blocks.flatMap((b) => b.walls), ...carWalls],
  roofs: blocks.map((b) => b.roof),
  roofsGive: true,
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'gangway', poly: GANGWAY }],
  secret: { name: 'The Gangway', zone: 'gangway', hint: 'Where the gangway opens on the left, the sidewalk kicks a ball back to the middle. Use it.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 220 },
    { x: 4, y: 430 },
    { x: 8, y: 520 },
  ],
  decor: [
    { kind: 'teetower', x: 0, y: -10, size: [ROOF.x1 - ROOF.x0, ROOF.y1 - ROOF.y0, ROOF.h], scale: 72 },
    { kind: 'teebox', x: 0, y: 0 },
    ...blocks.map((b) => b.decor),
    ...CARS.map(([x, y]) => ({ kind: 'car', x, y, rot: Math.PI / 2 + (x < 0 ? Math.PI : 0) })),
    { kind: 'el', x: -112, y: 260, rot: Math.PI / 2, scale: 600, label: 'red' },
    { kind: 'wrigley', x: 8, y: 618, rot: 0 },
    { kind: 'walkers', x: -48, y: 220, rot: Math.PI / 2, scale: 420, size: [12, 0, 0] },
    { kind: 'walkers', x: 48, y: 220, rot: Math.PI / 2, scale: 420, size: [12, 0, 0] },
    { kind: 'steam', x: 30, y: 120 },
    { kind: 'streetsign', x: -50, y: -14, rot: 0, label: 'N CLARK ST' },
    { kind: 'streetsign', x: 50, y: 470, rot: 0, label: 'W ADDISON ST' },
    { kind: 'hancock', x: 800, y: -1400 },
    { kind: 'willis', x: 300, y: -2000 },
  ],
};
