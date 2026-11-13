// Hole 4, Wrigleyville (par 4, 340 yd): off a rooftop at the south end, up Clark Street to the corner, then hard left
// down Addison to a green at the foot of Wrigley Field. A sharp dogleg left (since Nov 13; it ran straight up Clark
// before), with a whole block of three-flats inside the corner.
// The play: a wood or a long iron up Clark to the corner (a full driver runs through it into the buildings across
// Addison), then a mid iron down Addison to the green.
// The gamble, and the secret: the Rooftop. One roof inside the corner, right by the green, is laid with turf and tips
// toward Addison. Carry the block from the tee, land on it, and the ball trickles off the edge and down beside the
// green. Nothing flies over the buildings either side of it, so it's the only way through. Any other roof in the block
// rattles the ball down into the far end of the alley, no penalty: from there it's a chip up the alley to Addison.
import { blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, FACE, gallery } from './common';

const LAND = 6;
// the tee: on a rooftop over the street, 40 ft up
const ROOF = { x0: -20, y0: -30, x1: 20, y1: 10, h: 40 };
// Addison Street: it runs west (left) from the corner, y 240 to 320
const ADDISON = 280;
// a fifth bigger each way since Nov 13, and no longer a plain oval (see chiGreenRegions)
const SEED = 4;
const GREEN = { x: -185, y: 282, rx: 35, ry: 25 };
const traps = [greenside(GREEN, -240, 288, 7, 9, 1, 3, 0), greenside(GREEN, -130, 312, 8, 5, 2, 3, 0)];
// the Rooftop: a roof of turf at the block's corner nearest the green, 46 ft up: a few feet over its neighbours, so
// you can see it from the tee
const TOP = { x0: -175, y0: 170, x1: -110, y1: 228, h: 46 };
// the alley behind it, open onto Addison
const ALLEY = { x0: -110, y0: 60, x1: -94, y1: 228 };
// The block inside the corner: [x, y, width, depth]. A ball can fly over these (their roofs stop at the roofline, where
// the street's other buildings reach on up), and one that comes down on them rattles to the foot.
const BLOCK: [number, number, number, number][] = [
  [-74, 37.5, 40, 75],
  [-74, 114, 40, 70],
  [-102, 29, 16, 58], // closes the alley's south end
  [-142.5, 32.5, 65, 65],
  [-142.5, 118, 65, 104],
  [-218.5, 57.5, 87, 115],
];
// The row along Addison either side of the Rooftop reaches on up like the rest of the street: nothing flies over it,
// so the only way to Addison from the tee is over the Rooftop itself.
const ROW: [number, number, number, number][] = [
  [-74, 190, 40, 76],
  [-218.5, 172, 87, 112], // the Rooftop's neighbour to the west
];
// the rest of the street: [x, y, width, depth, rooftop bleachers?]
const FLATS: [number, number, number, number, boolean][] = [
  [74, 40, 40, 70, false],
  [74, 120, 40, 70, false],
  [74, 200, 40, 70, false],
  [74, 286, 40, 92, false],
  // across Addison, facing the corner and the green
  [60, 354, 68, 44, false],
  [-14, 354, 72, 44, false],
  [-90, 354, 72, 44, true],
  [-166, 354, 72, 44, true],
  [-242, 354, 72, 44, true],
];
// a ball that comes down on the block rattles down the back stairs into the alley's far end: no penalty, but from there
// it's a chip up the alley to Addison (the buildings on Clark give theirs back to the nearest street, as elsewhere)
const DOWN = { x: (ALLEY.x0 + ALLEY.x1) / 2, y: ALLEY.y0 + 20 };
const facesClark = (x: number, y: number) => x > -94 && y < 150;
const inside = BLOCK.map(([x, y, w, d], i) => {
  const b = building(x, y, w, d, 40, i + 80, 'flat');
  return { ...b, roof: { ...b.roof, top: 41, ...(facesClark(x, y) ? {} : { foot: DOWN }) } };
});
const row = ROW.map(([x, y, w, d], i) => {
  const b = building(x, y, w, d, 40, i + 90, 'flat');
  return { ...b, roof: { ...b.roof, foot: DOWN } };
});
const blocks = [...inside, ...row, ...FLATS.map(([x, y, w, d, top], i) => building(x, y, w, d, 40, i + 60, top ? 'rooftop' : 'flat'))];
const ROOFTOP = rect(TOP.x0, TOP.y0, TOP.x1, TOP.y1);

// cars parked along the curbs, in play: their sides are walls a ball bounces off. [x, y, along Addison?]
const CARS: [number, number, boolean][] = [[-35, 60, false], [-35, 130, false], [35, 80, false], [35, 150, false], [35, 215, false], [-60, 313, true], [-130, 313, true], [20, 313, true]];
const carWalls = CARS.flatMap(([x, y, across]) => {
  const [hx, hy] = across ? [4.5, 2.2] : [2.2, 4.5];
  const c = [{ x: x - hx, y: y - hy }, { x: x + hx, y: y - hy }, { x: x + hx, y: y + hy }, { x: x - hx, y: y + hy }];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: 5, look: 'hidden' as const }));
});
// a planted median down the middle of Clark, maples on a raised bed, short of where a layup lands
const MEDIAN = rect(-6, 110, 6, 190);
const posts: Post[] = [
  ...[[-46, 30], [-46, 170], [46, 30], [46, 170], [46, 300], [-120, 324], [-250, 236]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
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
  teeTip: 'Lay up to the corner with a wood, then turn left for the green. Or carry the block to the turf roof by the green: it tips a ball off beside the pin.',
  yards: 340,
  blurb: 'Up Clark Street off a rooftop, then hard left down Addison to Wrigley Field. A block of three-flats fills the corner. One roof in it has turf on.',
  tee: { x: 0, y: 0 },
  cup: { x: -185, y: 285 },
  pins: [{ x: -185, y: 285 }, { x: -202, y: 274 }, { x: -168, y: 290 }, { x: -190, y: 296 }],
  aim: 0,
  bounds: { x0: -340, y0: -50, x1: 140, y1: 420 },
  // the two streets and the block between them (the alley is in play)
  border: [
    { x: -54, y: -46 },
    { x: 54, y: -46 },
    { x: 54, y: 332 },
    { x: -262, y: 332 },
    { x: -262, y: 0 },
    { x: -54, y: 0 },
  ],
  // the street itself: asphalt that bounces and runs like a cart path
  base: 'stone',
  regions: [
    { poly: rect(ROOF.x0, ROOF.y0, ROOF.x1, ROOF.y1), surface: 'stone' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // Clark Street's turf up to the corner, the corner itself, and Addison's down to the green
    { poly: blob(0, 136, 40, 128, 1, 0.03), surface: 'fairway' },
    // (the far side of the corner is bare street: a drive that runs through it is on asphalt against the wall)
    { poly: blob(0, ADDISON - 12, 42, 30, 2, 0.04), surface: 'fairway' },
    { poly: blob(-88, ADDISON, 66, 38, 3, 0.04), surface: 'fairway' },
    { poly: MEDIAN, surface: 'rough' },
    // sidewalks: both sides of Clark, both sides of Addison
    { poly: rect(-54, -40, -42, 228), surface: 'path' },
    { poly: rect(42, -40, 54, 332), surface: 'path' },
    { poly: rect(-262, 228, -42, 240), surface: 'path' },
    { poly: rect(-262, 320, 42, 332), surface: 'path' },
    // the alley's cinders
    { poly: rect(ALLEY.x0, ALLEY.y0, ALLEY.x1, ALLEY.y1), surface: 'rough' },
    // the Rooftop's turf, and an apron of it on Addison below, where a ball comes down
    { poly: ROOFTOP, surface: 'fairway' },
    { poly: rect(TOP.x0 - 4, TOP.y1, TOP.x1, 258), surface: 'fairway' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -340, y0: -50, x1: 140, y1: 420, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // Clark's crown: a little higher down the middle, so a ball drifts to the gutters
    { kind: 'ramp', x0: -54, y0: -50, x1: 0, y1: 236, axis: 'x', h0: -0.8, h1: 0, op: 'add' },
    { kind: 'ramp', x0: 0, y0: -50, x1: 54, y1: 236, axis: 'x', h0: 0, h1: -0.8, op: 'add' },
    { kind: 'box', x0: ROOF.x0, y0: ROOF.y0, x1: ROOF.x1, y1: ROOF.y1, h: LAND + ROOF.h, edge: 1, op: 'set' },
    // the median's raised bed
    { kind: 'box', x0: -6, y0: 110, x1: 6, y1: 190, h: 1.2, edge: 1, op: 'add' },
    // the Rooftop: a block raised to its roof, tipped toward Addison (and a touch toward the green's side)
    { kind: 'box', x0: TOP.x0, y0: TOP.y0, x1: TOP.x1, y1: TOP.y1, h: LAND + TOP.h, edge: 1, op: 'set' },
    { kind: 'ramp', x0: TOP.x0, y0: TOP.y0, x1: TOP.x1, y1: TOP.y1, axis: 'y', h0: 1.2, h1: -1.2, op: 'add' },
    { kind: 'ramp', x0: TOP.x0, y0: TOP.y0, x1: TOP.x1, y1: TOP.y1, axis: 'x', h0: -0.4, h1: 0.4, op: 'add' },
    ...chiGreen(GREEN, LAND, [-0.5, 0.4], [[-8, -5, 6, 0.25], [9, 5, 5, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [...blocks.flatMap((b) => b.walls), ...carWalls],
  roofs: blocks.map((b) => b.roof),
  roofsGive: true,
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'rooftop', poly: ROOFTOP }],
  secret: { name: 'The Rooftop', zone: 'rooftop', hint: 'One roof inside the corner has turf on it. Carry the block from the tee and it tips the ball off beside the green.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 150 },
    { x: 0, y: 270 },
    { x: -100, y: ADDISON },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    // the patrons (Nov 13)
    // Balconies on every building along Clark and Addison, two floors of them, packed and drinking
    ...[12, 23].flatMap((up) => [
      ...[40, 120, 200, 286].map((y) => gallery(52, y, FACE.west, 56, 13, 1, up, 'deck')),
      ...[37.5, 114, 190].map((y) => gallery(-52, y, FACE.east, 56, 13, 1, up, 'deck')),
      ...[60, -14, -90, -166, -242].map((x) => gallery(x, 330, FACE.south, 60, 14, 1, up, 'deck')),
      gallery(-74, 230, FACE.north, 34, 8, 1, up, 'deck'),
      gallery(-218.5, 230, FACE.north, 76, 18, 1, up, 'deck'),
    ]),
    // the rooftop bleachers across Addison, full
    ...[-90, -166, -242].map((x) => gallery(x, 348, FACE.south, 60, 60, 4, 45, 'stand')),
    // the sidewalks: both sides of Clark, both sides of Addison, and a knot on the tee's roof
    ...[60, 170].map((y) => gallery(-48, y, FACE.east, 90, 30, 2)),
    ...[60, 170, 280].map((y) => gallery(48, y, FACE.west, 90, 30, 2)),
    ...[-200, -100, 0].map((x) => gallery(x, 326, FACE.south, 84, 30, 2)),
    gallery(-76, 234, FACE.north, 40, 14, 2),
    gallery(0, -24, FACE.north, 30, 14, 2),
    { kind: 'teetower', x: 0, y: -10, size: [ROOF.x1 - ROOF.x0, ROOF.y1 - ROOF.y0, ROOF.h], scale: 72 },
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'teetower', x: (TOP.x0 + TOP.x1) / 2, y: (TOP.y0 + TOP.y1) / 2, size: [TOP.x1 - TOP.x0, TOP.y1 - TOP.y0, TOP.h], scale: 73 },
    ...blocks.map((b) => b.decor),
    ...CARS.map(([x, y, across]) => ({ kind: 'car', x, y, rot: across ? 0 : Math.PI / 2 + (x < 0 ? Math.PI : 0) })),
    { kind: 'el', x: 112, y: 160, rot: Math.PI / 2, scale: 500, label: 'red' },
    { kind: 'wrigley', x: -330, y: ADDISON, rot: -Math.PI / 2 },
    { kind: 'walkers', x: -48, y: 110, rot: Math.PI / 2, scale: 220, size: [8, 0, 0] },
    { kind: 'walkers', x: 48, y: 150, rot: Math.PI / 2, scale: 300, size: [10, 0, 0] },
    { kind: 'steam', x: 30, y: 120 },
    { kind: 'streetsign', x: -50, y: -14, rot: 0, label: 'N CLARK ST' },
    { kind: 'streetsign', x: 50, y: 326, rot: 0, label: 'W ADDISON ST' },
    { kind: 'hancock', x: 800, y: -1400 },
    { kind: 'willis', x: 300, y: -2000 },
  ],
};
