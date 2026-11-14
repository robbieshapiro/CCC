// Hole 4, Wrigleyville (par 4, 365 yd): off a rooftop at the south end, up Clark Street to the corner, then hard left
// down Addison to a green at the foot of Wrigley Field. A sharp dogleg left (since Nov 13; it ran straight up Clark
// before), with a whole block of three-flats inside the corner.
// The play: a wood or a long iron up Clark to the corner (a full driver runs through it into the buildings across
// Addison), then a mid iron down Addison to the green.
// The gamble: drive the green. It's a 350 ft carry over the whole block (about 255 yd on the card), and only a flush
// full driver gets there. The block is one flat rooftop, 40 ft up: a ball that lands on it bounces and runs like it
// would on any hard roof, and one that runs off the far edge drops onto Addison and plays on. One that stops up there
// is stuck: a penalty stroke, play it again (Nov 14; before, every roof handed the ball back to Clark).
import { blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, FACE, gallery } from './common';

const LAND = 6;
// the tee: on a rooftop over the street, 40 ft up
const ROOF = { x0: -20, y0: -30, x1: 20, y1: 10, h: 40 };
// the block's north edge: Addison's near sidewalk. Its distance from the tee is the bar a drive at the green must clear
const EDGE = 264;
// Addison Street: it runs west (left) from the corner, y 276 to 356
const ADDISON = EDGE + 52;
// a fifth bigger each way since Nov 13, and no longer a plain oval (see chiGreenRegions)
const SEED = 4;
const GREEN = { x: -185, y: ADDISON + 2, rx: 35, ry: 25 };
const traps = [greenside(GREEN, -240, ADDISON + 8, 7, 9, 1, 3, 0), greenside(GREEN, -130, ADDISON + 32, 8, 5, 2, 3, 0)];
// The block inside the corner, one flat roof wall to wall, and the buildings that make it up: [x, y, width, depth].
const BLOCK_H = 40;
const BLOCK_ROOF = rect(-262, 0, -54, EDGE);
const BLOCK: [number, number, number, number][] = [
  [-74, 37.5, 40, 75],
  [-74, 113.5, 40, 77],
  [-74, 208, 40, 112],
  [-102, EDGE / 2, 16, EDGE],
  [-142.5, 32.5, 65, 65],
  [-142.5, 117.5, 65, 105],
  [-142.5, 217, 65, 94],
  [-218.5, 57.5, 87, 115],
  [-218.5, 189.5, 87, 149],
];
// its walls, a foot out from the roof's edge on the two street sides: a ball that flies into the side of the block
// bounces off it; one rolling off the roof's edge (just over them) drops to the street
const blockWalls = [
  { a: { x: -53, y: -1 }, b: { x: -53, y: EDGE + 1 }, h: BLOCK_H - 2, look: 'hidden' as const },
  { a: { x: -53, y: EDGE + 1 }, b: { x: -263, y: EDGE + 1 }, h: BLOCK_H - 2, look: 'hidden' as const },
];
// the rest of the street: [x, y, width, depth, rooftop bleachers?]
const FLATS: [number, number, number, number, boolean][] = [
  [74, 40, 40, 70, false],
  [74, 120, 40, 70, false],
  [74, 200, 40, 70, false],
  [74, 304, 40, 128, false],
  // across Addison, facing the corner and the green
  [60, 390, 68, 44, false],
  [-14, 390, 72, 44, false],
  [-90, 390, 72, 44, true],
  [-166, 390, 72, 44, true],
  [-242, 390, 72, 44, true],
];
const blocks = FLATS.map(([x, y, w, d, top], i) => building(x, y, w, d, 40, i + 60, top ? 'rooftop' : 'flat'));

// cars parked along the curbs, in play: their sides are walls a ball bounces off. [x, y, along Addison?]
const CARS: [number, number, boolean][] = [[-35, 60, false], [-35, 130, false], [35, 80, false], [35, 150, false], [35, 215, false], [-60, 349, true], [-130, 349, true], [20, 349, true]];
const carWalls = CARS.flatMap(([x, y, across]) => {
  const [hx, hy] = across ? [4.5, 2.2] : [2.2, 4.5];
  const c = [{ x: x - hx, y: y - hy }, { x: x + hx, y: y - hy }, { x: x + hx, y: y + hy }, { x: x - hx, y: y + hy }];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: 5, look: 'hidden' as const }));
});
// a planted median down the middle of Clark, maples on a raised bed, short of where a layup lands
const MEDIAN = rect(-6, 110, 6, 190);
const posts: Post[] = [
  ...[[-46, 30], [-46, 170], [46, 30], [46, 170], [46, 336], [-120, 360], [-250, 272]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
  ...[120, 150, 180].map((y, i) => ({ x: 0, y, r: 6, h: 24 + i * 3, soft: true, look: 'maple' as const })),
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
  ...CHI_CUP,
  greenFirm: 0.03,
  teeTip: 'Lay up to the corner with a wood, then turn left. Over the block, it has to bounce off the far side: stop on the roof and it is a penalty.',
  yards: 365,
  blurb: 'Up Clark Street off a rooftop, then hard left down Addison to Wrigley Field. A block of buildings fills the corner: go over it and pray it bounces off.',
  tee: { x: 0, y: 0 },
  cup: { x: -185, y: 321 },
  pins: [{ x: -185, y: 321 }, { x: -202, y: 310 }, { x: -168, y: 326 }, { x: -190, y: 332 }],
  aim: 0,
  bounds: { x0: -340, y0: -50, x1: 140, y1: 460 },
  // the two streets and the block between them (the block is solid buildings wall to wall, every roof giving the ball
  // back to Clark: nobody plays from inside it)
  border: [
    { x: -54, y: -46 },
    { x: 54, y: -46 },
    { x: 54, y: 368 },
    { x: -262, y: 368 },
    { x: -262, y: 0 },
    { x: -54, y: 0 },
  ],
  // the street itself: asphalt that bounces and runs like a cart path
  base: 'stone',
  regions: [
    { poly: rect(ROOF.x0, ROOF.y0, ROOF.x1, ROOF.y1), surface: 'stone' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // Clark Street's turf up to the corner, the corner itself, and Addison's down to the green
    { poly: blob(0, 152, 40, 146, 1, 0.03), surface: 'fairway' },
    // (the far side of the corner is bare street: a drive that runs through it is on asphalt against the wall)
    { poly: blob(0, ADDISON - 12, 42, 30, 2, 0.04), surface: 'fairway' },
    { poly: blob(-88, ADDISON, 66, 38, 3, 0.04), surface: 'fairway' },
    { poly: MEDIAN, surface: 'rough' },
    // sidewalks: both sides of Clark, both sides of Addison
    { poly: rect(-54, -40, -42, EDGE), surface: 'path' },
    { poly: rect(42, -40, 54, 368), surface: 'path' },
    { poly: rect(-262, EDGE, -42, EDGE + 12), surface: 'path' },
    { poly: rect(-262, 356, 42, 368), surface: 'path' },
    // the block's roof: a green roof (Chicago has hundreds), planted thick, so a ball that lands on it mostly sits down
    { poly: BLOCK_ROOF, surface: 'rough' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -340, y0: -50, x1: 140, y1: 460, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // Clark's crown: a little higher down the middle, so a ball drifts to the gutters
    { kind: 'ramp', x0: -54, y0: -50, x1: 0, y1: 272, axis: 'x', h0: -0.8, h1: 0, op: 'add' },
    { kind: 'ramp', x0: 0, y0: -50, x1: 54, y1: 272, axis: 'x', h0: 0, h1: -0.8, op: 'add' },
    { kind: 'box', x0: ROOF.x0, y0: ROOF.y0, x1: ROOF.x1, y1: ROOF.y1, h: LAND + ROOF.h, edge: 1, op: 'set' },
    // the median's raised bed
    { kind: 'box', x0: -6, y0: 110, x1: 6, y1: 190, h: 1.2, edge: 1, op: 'add' },
    // the block, raised to its roof
    { kind: 'box', x0: -262, y0: 0, x1: -54, y1: EDGE, h: LAND + BLOCK_H, edge: 1, op: 'set' },
    ...chiGreen(GREEN, LAND, [-0.5, 0.4], [[-8, -5, 6, 0.25], [9, 5, 5, -0.2]], 1.5),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [...blocks.flatMap((b) => b.walls), ...blockWalls, ...carWalls],
  roofs: blocks.map((b) => b.roof),
  // a ball that comes to rest on the block's roof is stuck up there: a penalty
  stuck: [BLOCK_ROOF],
  roofsGive: true,
  posts,
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 150 },
    { x: 0, y: 300 },
    { x: -100, y: ADDISON },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    // some patrons (a lot more Nov 13, most of them sent home the same day): a few balconies and the bleachers across
    // from the green, the sidewalk by it, a knot at the corner and on the tee's roof
    ...[-90, -166, -242].map((x) => gallery(x, 366, FACE.south, 60, 6, 1, 12, 'deck')),
    ...[-90, -166, -242].map((x) => gallery(x, 384, FACE.south, 60, 12, 4, 45, 'stand')),
    gallery(-180, 362, FACE.south, 90, 14, 2),
    gallery(48, 300, FACE.west, 50, 10, 2),
    gallery(0, -24, FACE.north, 30, 8, 2),
    { kind: 'teetower', x: 0, y: -10, size: [ROOF.x1 - ROOF.x0, ROOF.y1 - ROOF.y0, ROOF.h], scale: 72 },
    { kind: 'teebox', x: 0, y: 0 },
    ...blocks.map((b) => b.decor),
    // the block's buildings, under its roof
    ...BLOCK.map(([x, y, w, d], i) => ({ kind: 'teetower', x, y, size: [w, d, BLOCK_H] as [number, number, number], scale: 80 + i })),
    ...CARS.map(([x, y, across]) => ({ kind: 'car', x, y, rot: across ? 0 : Math.PI / 2 + (x < 0 ? Math.PI : 0) })),
    { kind: 'el', x: 112, y: 160, rot: Math.PI / 2, scale: 500, label: 'red' },
    { kind: 'wrigley', x: -330, y: ADDISON, rot: -Math.PI / 2 },
    { kind: 'walkers', x: -48, y: 110, rot: Math.PI / 2, scale: 220, size: [8, 0, 0] },
    { kind: 'walkers', x: 48, y: 150, rot: Math.PI / 2, scale: 300, size: [10, 0, 0] },
    { kind: 'steam', x: 30, y: 120 },
    { kind: 'streetsign', x: -50, y: -14, rot: 0, label: 'N CLARK ST' },
    { kind: 'streetsign', x: 50, y: 362, rot: 0, label: 'W ADDISON ST' },
    { kind: 'hancock', x: 800, y: -1400 },
    { kind: 'willis', x: 300, y: -2000 },
  ],
};
