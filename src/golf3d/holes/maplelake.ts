// Hole 3, Maple Lake (par 3, 230 yd as shown): the hardest one-shotter on the course. From a tee up in the maples, a
// wood all the way over the lake to a wide, shallow green on the far shore, cut in two tiers, the lake right up to its
// front edge.
// The play: a high wood that holds the right tier. Short is wet, long is sand and then a creek, and any wind
// carries across the water.
// The danger: the big maple on the right of the shore pinches the line, and the green's front tier throws a weak shot
// back toward the lake.
// The secret: the ridge on the left of the green. Land it there and the slope brings it round to the flag.
import { band, blob, rect } from '../terrain';
import type { Hole, Post } from '../types';
import { bunker, greenComplex, RESERVE_TURF, tree, treeLine } from './woods';

const GREEN = { x: 8, y: 232, rx: 32, ry: 16 };
const LAKE = { x: -4, y: 120, rx: 98, ry: 88 };
const GROUND = 2;
const TEE = { x: 0, y: -88 };
const traps = [
  bunker(50, 214, 14, 7, 1, 3.8, -0.3), // front right, waiting for the bail-out
  bunker(-8, 264, 16, 6, 2), // behind the green
  bunker(30, 262, 12, 6, 3), // behind the green, right
];
const CREEK = [{ x: -130, y: 296 }, { x: 0, y: 290 }, { x: 130, y: 298 }];

// woods tight down both sides and behind: past them is out of bounds
const maples: Post[] = [
  ...treeLine([{ x: -104, y: -90 }, { x: -104, y: 300 }], 20, 'ml-left', 5, 2, 1, 10),
  ...treeLine([{ x: 104, y: -90 }, { x: 104, y: 300 }], 20, 'ml-right', 5, 2, -1, 10),
  ...treeLine([{ x: -96, y: 276 }, { x: 96, y: 276 }], 22, 'ml-back', 4),
  // along the far shore, either side of the green
  tree(-76, 222, 4, 26),
  tree(54, 208, 6, 32), // the one that pinches the line from the right
];

export const maplelake: Hole = {
  id: 'maplelake',
  name: 'Maple Lake',
  par: 3,
  theme: 'autumn',
  tour: true,
  turf: RESERVE_TURF,
  windByHeight: true,
  calmChip: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  yards: 230,
  blurb: 'A wood over the lake to a small two-tier green. Short is wet, long is sand, and the wind is never still.',
  tee: TEE,
  cup: { x: 8, y: 239 },
  pins: [{ x: 8, y: 239 }, { x: -18, y: 236 }, { x: 30, y: 238 }, { x: 4, y: 224 }],
  aim: 0.02,
  bounds: { x0: -128, y0: -110, x1: 128, y1: 320 },
  // out of bounds just past the woods, either side and behind
  border: [
    { x: -124, y: -106 },
    { x: 124, y: -106 },
    { x: 124, y: 312 },
    { x: -124, y: 312 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(TEE.x - 12, TEE.y - 12, TEE.x + 12, TEE.y + 12), surface: 'fairway' },
    // a thin collar on the far shore: no bail-out short
    { poly: blob(GREEN.x, GREEN.y - 2, GREEN.rx + 8, GREEN.ry + 6, 1, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 3, GREEN.ry + 3, 2, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 2, 0.05), surface: 'green' },
    // pot bunkers behind, and one front right waiting for the safe miss
    ...traps.map((t) => t.region),
  ],
  // the lake in front, and a creek running behind the trees: long is wet too
  water: [
    { poly: blob(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 3, 0.08), level: GROUND - 1 },
    { poly: band(CREEK, 7), level: GROUND - 1.5 },
  ],
  terrain: [
    // the tee up in the trees, then down to the water
    { kind: 'ramp', x0: -128, y0: -110, x1: 128, y1: -40, axis: 'y', h0: 18, h1: 18, op: 'set' },
    { kind: 'ramp', x0: -128, y0: -40, x1: 128, y1: 30, axis: 'y', h0: 18, h1: GROUND, op: 'set' },
    { kind: 'ramp', x0: -128, y0: 30, x1: 128, y1: 320, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // wooded slopes all round
    { kind: 'hill', x: -250, y: 100, r: 130, h: 24 },
    { kind: 'hill', x: 250, y: 100, r: 130, h: 24 },
    { kind: 'hill', x: 0, y: 400, r: 130, h: 22 },
    // the lake bed
    { kind: 'disc', x: LAKE.x, y: LAKE.y, r: LAKE.rx + 4, h: -4, edge: 14, op: 'add' },
    { kind: 'box', x0: LAKE.x - LAKE.rx, y0: LAKE.y - LAKE.ry - 6, x1: LAKE.x + LAKE.rx, y1: LAKE.y + LAKE.ry + 6, h: -4, edge: 12, op: 'add' },
    // the green, a step up off the shore, in two tiers: the back half higher, and the front falling to the lake
    // a cupcake green: up on a mound, its sides falling away just past the fringe, toward the lake in front
    // the green: wide and shallow, just up off the shore, falling right to left and toward the lake, the back tier up
    // low, wide and shallow, a bank behind it, a hump on the right, falling hard toward the lake
    ...greenComplex(GREEN, GROUND, { lift: 1.2, edge: 8, tilt: [-1, 0.8], tier: { axis: 'y', at: GREEN.y + 1, rise: 0.8 }, rolls: [[14, -4, 7, 0.45]], back: 2.2 }),
    // the secret: a ridge on the left that brings a ball round to the middle
    { kind: 'ramp', x0: -62, y0: 214, x1: -26, y1: 246, axis: 'x', h0: 1.8, h1: 0, op: 'add' },
    // the creek behind
    { kind: 'channel', pts: CREEK, width: 9, depth: 3.5 },
    // deep pot bunkers
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: maples,
  movers: [],
  pushes: [],
  zones: [{ id: 'ridge', poly: rect(-58, 217, -30, 243) }],
  secret: { name: 'The Ridge', zone: 'ridge', hint: 'The ridge on the left of the green brings it round. Land it there and let it roll.' },
  drop: { x: -42, y: 214 },
  flyover: [
    { x: 0, y: -90 },
    { x: -40, y: 110 },
    { x: 8, y: 233 },
  ],
  decor: [
    { kind: 'teebox', x: TEE.x, y: TEE.y },
    { kind: 'sign', x: -20, y: TEE.y - 10, rot: 0 },
    { kind: 'bench', x: 22, y: TEE.y - 12, rot: 0 },
    { kind: 'rock', x: -96, y: 30, scale: 1.4 },
    { kind: 'rock', x: 92, y: 196, scale: 1.1 },
  ],
};
