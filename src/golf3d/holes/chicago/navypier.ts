// Hole 5, Navy Pier (par 5, 590 yd): the finish, straight out the pier into Lake Michigan with the lake on both sides
// all the way and the wind off the water. The pier's long hall stands on the right halfway out (its roof loses a
// ball), the Centennial Wheel turns beside the fairway, and the pier stops short: the green is on an island out in the
// lake, nothing but water round it. Willis Tower watches from the skyline back on shore.
// The play: two good ones to the end of the pier, then a wedge over the water to the island. Or go for it in two.
// The secret: the boardwalk, the planked walk along the left edge. A ball on it runs and runs.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, greenGallery, teeGallery } from './common';

const DECK = 6;
// bigger greens, for longer putts (about a third bigger each way since Nov 10)
// a fifth bigger again each way since Nov 13, and no longer a plain oval (see chiGreenRegions)
const SEED = 5;
const GREEN = { x: 0, y: 800, rx: 38, ry: 29 };
// the island green, out in the lake past the end of the pier
const ISLAND = { x0: -78, y0: 740, x1: 78, y1: 858 };
const PIER_END = 690;
const traps = [greenside(GREEN, -40, 806, 8, 9, 1, 3, 0), greenside(GREEN, 34, 826, 8, 7, 2, 3, 0)];
const HALL = building(48, 250, 30, 160, 34, 90, 'flat');
// a boat slip cut into the pier from the right where the second shot wants to land: carry it, or squeeze past on the
// boardwalk side
const SLIP = { x0: 6, y0: 400, x1: 90, y1: 446 };
const BOARDWALK = band([{ x: -66, y: 120 }, { x: -66, y: PIER_END - 6 }], 4);
const WHEEL = { x: 46, y: 610 };

const posts: Post[] = [
  // the wheel's legs stand in play
  { x: WHEEL.x - 10, y: WHEEL.y, r: 2, h: 60, look: 'tower' },
  { x: WHEEL.x + 10, y: WHEEL.y, r: 2, h: 60, look: 'tower' },
  ...[[-60, 200], [-60, 340], [-60, 480], [-60, 620], [60, 200], [60, 300]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
];

export const navypier: Hole = {
  id: 'navypier',
  name: 'Navy Pier',
  par: 5,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.03,
  teeTip: 'Water both sides. A good drive leaves a wood to the island, or an iron to the end of the pier.',
  yards: 500,
  blurb: 'Out the pier into the lake, water both sides, to an island green past the end. After a good drive: a wood at the island, or an iron to the end of the pier.',
  // the tee is 40 ft out along the pier since Nov 12 (the hole was 590 yd): a good drive now leaves a wood to the
  // island or an iron to the end of the pier
  tee: { x: 0, y: 120 },
  cup: { x: 0, y: 803 },
  pins: [{ x: 0, y: 803 }, { x: -18, y: 789 }, { x: 19, y: 809 }, { x: -5, y: 817 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 170, y1: 890 },
  border: [
    { x: -166, y: -46 },
    { x: 166, y: -46 },
    { x: 166, y: 886 },
    { x: -166, y: 886 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, 108, 12, 132), surface: 'fairway' },
    // the lawn at the foot of the pier, then the pier itself, its boardwalk, and the end
    { poly: blob(0, 40, 70, 46, 1, 0.05), surface: 'fairway' },
    // a strip down the pier, broken by the slip (half as wide again since Nov 11, and out toward the boardwalk Nov 13)
    { poly: rect(-56, 100, 30, SLIP.y0), surface: 'fairway' },
    // the lane past the slip on the boardwalk side
    { poly: rect(-56, SLIP.y0, SLIP.x0 - 4, SLIP.y1), surface: 'fairway' },
    { poly: rect(-56, SLIP.y1, 56, PIER_END - 4), surface: 'fairway' },
    // the island: a ring of fairway round the green
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 26, GREEN.ry + 20, 5, 0.05), surface: 'fairway' },
    { poly: BOARDWALK, surface: 'wood' },
    { poly: rect(72, 100, 82, PIER_END - 4), surface: 'stone' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-166, -46, 166, 886), level: 0, look: 'sea', tide: { amp: 0.4, period: 8 } }],
  terrain: [
    // the lake, and the land: the lawn at the foot, the pier straight out, the wider end round the green
    { kind: 'ramp', x0: -170, y0: -50, x1: 170, y1: 890, axis: 'y', h0: -6, h1: -6, op: 'set' },
    { kind: 'box', x0: -120, y0: -50, x1: 120, y1: 90, h: DECK, edge: 1, op: 'set' },
    { kind: 'box', x0: -74, y0: 80, x1: 86, y1: PIER_END, h: DECK, edge: 1, op: 'set' },
    { kind: 'box', x0: ISLAND.x0, y0: ISLAND.y0, x1: ISLAND.x1, y1: ISLAND.y1, h: DECK - 2, edge: 3, op: 'set' },
    { kind: 'box', x0: SLIP.x0, y0: SLIP.y0, x1: SLIP.x1, y1: SLIP.y1, h: -6, edge: 1, op: 'set' },
    ...chiGreen(GREEN, DECK - 2, [0.4, 0.5], [[-8, -6, 7, 0.25], [10, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: HALL.walls,
  roofs: [HALL.roof],
  roofsGive: true,
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'boardwalk', poly: BOARDWALK }],
  secret: { name: 'The Boardwalk', zone: 'boardwalk', hint: 'The planked walk down the left edge of the pier runs fast. Land one on it.' },
  flyover: [
    { x: 0, y: -40 },
    { x: 0, y: 300 },
    { x: 10, y: 600 },
    { x: 0, y: 690 },
    { x: 0, y: 800 },
  ],
  decor: [
    // a few patrons (Nov 13)
    teeGallery({ x: 0, y: 120 }),
    // round the island green but the front
    ...greenGallery(GREEN, -40, 220),
    { kind: 'teebox', x: 0, y: 120 },
    HALL.decor,
    { kind: 'ferris', x: WHEEL.x, y: WHEEL.y, rot: Math.PI / 2 },
    { kind: 'walkers', x: -52, y: 400, rot: Math.PI / 2, scale: 560, size: [12, 0, 0] },
    { kind: 'walkers', x: 61, y: 260, rot: Math.PI / 2, scale: 260, size: [6, 0, 0] },
    { kind: 'banner', x: -70, y: 40, label: 'NAVY PIER' },
    { kind: 'lake', x: 0, y: 70, rot: 0, scale: 6 },
    // back on shore: the skyline behind the tee
    { kind: 'willis', x: -700, y: -1300 },
    { kind: 'hancock', x: -320, y: -700 },
    { kind: 'aon', x: -500, y: -900 },
    { kind: 'marina', x: -900, y: -650 },
  ],
};
