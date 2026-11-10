// Hole 5, Navy Pier (par 5, 560 yd): the finish, straight out the pier into Lake Michigan with the lake on both sides
// all the way and the wind off the water. The pier's long hall stands on the right halfway out (its roof loses a
// ball), the Centennial Wheel turns beside the fairway, and the green sits at the very end with nothing but lake
// behind it. Willis Tower watches from the skyline back on shore.
// The play: three good shots down the middle. Anything wide is wet.
// The secret: the boardwalk, the planked walk along the left edge. A ball on it runs and runs.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_TURF, CHI_WALLS, chiGreen } from './common';

const DECK = 6;
const GREEN = { x: 0, y: 770, rx: 24, ry: 18 };
const traps = [greenside(GREEN, -34, 764, 8, 9, 1, 3, 0), greenside(GREEN, 32, 790, 8, 7, 2, 3, 0)];
const HALL = building(48, 250, 30, 160, 34, 90, 'flat');
// a boat slip cut into the pier from the right where the second shot wants to land: carry it, or squeeze past on the
// boardwalk side
const SLIP = { x0: -14, y0: 400, x1: 80, y1: 446 };
const BOARDWALK = band([{ x: -52, y: 120 }, { x: -52, y: 700 }], 4);
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
  chipDrop: 0.7,
  greenFirm: 0.03,
  yards: 560,
  blurb: 'Straight out the pier into the lake, water both sides all the way. The wheel turns by the fairway. Three good ones.',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 772 },
  pins: [{ x: 0, y: 772 }, { x: -14, y: 762 }, { x: 14, y: 776 }, { x: -4, y: 784 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 170, y1: 860 },
  border: [
    { x: -166, y: -46 },
    { x: 166, y: -46 },
    { x: 166, y: 856 },
    { x: -166, y: 856 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the lawn at the foot of the pier, then the pier itself, its boardwalk, and the end
    { poly: blob(0, 40, 60, 40, 1, 0.05), surface: 'fairway' },
    // a narrow strip down the pier, broken by the slip
    { poly: rect(-20, 100, 20, SLIP.y0), surface: 'fairway' },
    { poly: rect(-20, SLIP.y1, 20, 740), surface: 'fairway' },
    { poly: BOARDWALK, surface: 'wood' },
    { poly: rect(56, 100, 66, 740), surface: 'stone' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-166, -46, 166, 856), level: 0, look: 'sea', tide: { amp: 0.4, period: 8 } }],
  terrain: [
    // the lake, and the land: the lawn at the foot, the pier straight out, the wider end round the green
    { kind: 'ramp', x0: -170, y0: -50, x1: 170, y1: 860, axis: 'y', h0: -6, h1: -6, op: 'set' },
    { kind: 'box', x0: -120, y0: -50, x1: 120, y1: 90, h: DECK, edge: 1, op: 'set' },
    { kind: 'box', x0: -58, y0: 80, x1: 68, y1: 740, h: DECK, edge: 1, op: 'set' },
    { kind: 'box', x0: -60, y0: 730, x1: 60, y1: 808, h: DECK, edge: 1, op: 'set' },
    { kind: 'box', x0: SLIP.x0, y0: SLIP.y0, x1: SLIP.x1, y1: SLIP.y1, h: -6, edge: 1, op: 'set' },
    ...chiGreen(GREEN, DECK, [0.4, 0.5], [[-8, -6, 7, 0.25], [10, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: HALL.walls,
  roofs: [HALL.roof],
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'boardwalk', poly: BOARDWALK }],
  secret: { name: 'The Boardwalk', zone: 'boardwalk', hint: 'The planked walk down the left edge of the pier runs fast. Land one on it.' },
  flyover: [
    { x: 0, y: -40 },
    { x: 0, y: 300 },
    { x: 10, y: 600 },
    { x: 0, y: 770 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
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
