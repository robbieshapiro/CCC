// Hole 3, Dry Falls (par 5, 570 yd as shown): the finisher. A dogleg left down a canyon floor between red walls, to a
// green behind a dry waterfall of rock and sand.
// The play: a drive down the right, a second to the elbow, then a pitch over the falls.
// The danger: the canyon walls kick a ball about, the waste is thick with cactus, and the falls drop short shots into sand.
// The bail-out: the right side is wide open, at the cost of the long way round.
// The secret: the Overlook, a flat ledge left of the green, level with it and clear of the falls. A long second that finds it leaves a short pitch.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, FAIRWAY_DEPTH, greenComplex, greenside } from './woods';

const GROUND = 4;
const GREEN = { x: -40, y: 770, rx: 24, ry: 20 };
const LINE: V2[] = [
  { x: 0, y: 10 },
  { x: 6, y: 200 },
  { x: -10, y: 390 },
  { x: -40, y: 560 },
];
const FALLS: V2[] = [
  { x: -200, y: 652 },
  { x: -90, y: 646 },
  { x: -30, y: 652 },
  { x: 40, y: 646 },
  { x: 150, y: 654 },
];
const LEDGE = { x: -104, y: 716, r: 22 };

const traps = [
  bunker(-34, 220, 14, 7, 1, FAIRWAY_DEPTH, 0.1), // left of the landing
  bunker(40, 250, 16, 7, 2, FAIRWAY_DEPTH, -0.2), // right of the landing
  bunker(16, 450, 18, 7, 3, FAIRWAY_DEPTH, -0.5), // outside the elbow
  bunker(-70, 540, 12, 6, 4, FAIRWAY_DEPTH, 0.3), // inside the elbow
  greenside(GREEN, -40, 708, 14, 6, 5, 3.2, 0), // short, under the falls
  greenside(GREEN, -78, 772, 8, 14, 6, 3.2, 0), // left
  greenside(GREEN, 2, 780, 8, 12, 7, 3.2, 0), // right
];

const cacti: Post[] = [
  [-30, 80], [40, 100], [-52, 140], [60, 360], [60, 520], [-110, 600], [90, 620], [-100, 720], [30, 730], [20, 830], [-90, 830],
  [-130, 340], [-70, 340], [70, 180], [-20, 680],
].map(([x, y]) => ({ x, y, r: 1, h: 10, look: 'cactus' as const }));
const rocks: Post[] = [[-80, 120, 3], [80, 440, 4], [-130, 520, 4], [60, 680, 3], [-20, 850, 3], [-100, 200, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const dryfalls: Hole = {
  id: 'dryfalls',
  name: 'Dry Falls',
  par: 5,
  theme: 'desert',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 570,
  blurb: 'A canyon dogleg left. Over the dry falls to the green. A ledge beside it dodges the falls.',
  tee: { x: 0, y: 0 },
  cup: { x: -40, y: 774 },
  pins: [{ x: -40, y: 774 }, { x: -50, y: 762 }, { x: -30, y: 778 }, { x: -42, y: 760 }],
  aim: -0.01,
  bounds: { x0: -240, y0: -40, x1: 220, y1: 900 },
  border: [
    { x: -190, y: -36 },
    { x: 190, y: -36 },
    { x: 200, y: 890 },
    { x: -210, y: 890 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: band(LINE, 26), surface: 'fairway' },
    { poly: band([{ x: -40, y: 560 }, { x: -40, y: 692 }], 16), surface: 'fairway' },
    { poly: band(FALLS, 12), surface: 'sand' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 5, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 5, 0.06), surface: 'green' },
    // the Overlook: a worn flat ledge
    { poly: blob(LEDGE.x, LEDGE.y, LEDGE.r - 2, LEDGE.r - 2, 2, 0.1), surface: 'fairway' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -240, y0: -40, x1: 220, y1: 900, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the canyon walls
    ...[0, 260, 520, 780, 1040].map((y) => ({ kind: 'hill' as const, x: -360, y, r: 150, h: 34 })),
    ...[0, 260, 520, 780, 1040].map((y) => ({ kind: 'hill' as const, x: 340, y, r: 150, h: 30 })),
    // the Overlook, a ledge a little above the floor
    { kind: 'disc', x: LEDGE.x, y: LEDGE.y, r: LEDGE.r, h: 7, edge: 12, op: 'set' },
    // the falls: the wash drops across the hole, and the green sits a step up behind it
    { kind: 'channel', pts: FALLS, width: 14, depth: 2.6 },
    ...greenComplex(GREEN, GROUND, { lift: 1.8, edge: 10, tilt: [0.8, 1.2], tier: { axis: 'y', at: GREEN.y, rise: 0.7 }, rolls: [[-8, -6, 7, 0.4], [10, 8, 6, -0.4]], back: 2 }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...cacti, ...rocks],
  movers: [],
  pushes: [],
  zones: [{ id: 'overlook', poly: blob(LEDGE.x, LEDGE.y, LEDGE.r - 2, LEDGE.r - 2, 2, 0.1) }],
  secret: { name: 'The Overlook', zone: 'overlook', hint: 'A flat ledge left of the green sits clear of the falls. Reach it with the second.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 4, y: 240 },
    { x: -20, y: 460 },
    { x: -40, y: 774 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: 140, y: 300, scale: 1.4 },
    { kind: 'rock', x: -150, y: 600, scale: 1.2 },
  ],
};
