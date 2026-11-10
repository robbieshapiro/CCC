// Hole 4, Wrigleyville (par 4, 390 yd): straight up a snowy side street to a green at the foot of Wrigley Field.
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
import { CHI_TURF, chiGreen } from './common';

const LAND = 6;
const GREEN = { x: 8, y: 520, rx: 22, ry: 16 };
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

const posts: Post[] = [[-46, 30], [-46, 170], [-46, 300], [46, 30], [46, 170], [46, 360]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const }));

export const wrigleyville: Hole = {
  id: 'wrigleyville',
  name: 'Wrigleyville',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.03,
  yards: 390,
  blurb: 'Up a snowy side street to the foot of Wrigley Field. Three-flats both sides, the red line rattling past on the left.',
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 522 },
  pins: [{ x: 8, y: 522 }, { x: -6, y: 514 }, { x: 22, y: 526 }, { x: 4, y: 532 }],
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
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the street: a strip of turf down the middle, sidewalks either side
    { poly: blob(-4, 250, 28, 200, 1, 0.04), surface: 'fairway' },
    { poly: blob(4, 460, 26, 26, 2, 0.06), surface: 'fairway' },
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
    // the gangway's apron, tipping back toward the street
    { kind: 'ramp', x0: -54, y0: 238, x1: -30, y1: 292, axis: 'x', h0: 1.4, h1: 0, op: 'add' },
    ...chiGreen(GREEN, LAND, [0.5, -0.5], [[-8, -5, 6, 0.25], [9, 5, 5, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: blocks.flatMap((b) => b.walls),
  roofs: blocks.map((b) => b.roof),
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
    { kind: 'teebox', x: 0, y: 0 },
    ...blocks.map((b) => b.decor),
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
