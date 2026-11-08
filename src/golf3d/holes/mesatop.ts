// Hole 2, Mesa Top (par 3, 140 yd as shown): all uphill, to a green on the flat top of a red mesa.
// The play: a high iron, one club more than it looks. The face of the mesa kicks a short ball back down into the sand.
// The bail-out: a switchback road climbs the left side of the mesa, for a chip on.
// The secret: the road itself. Get a ball onto it and a putt up the switchback walks it nearly to the pin.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';
import { bunker, greenComplex } from './woods';

const GROUND = 4;
const TOP = 13;
const GREEN = { x: 12, y: 176, rx: 20, ry: 17 };
// the road up the left side: from the foot of the mesa to the green
const ROAD: V2[] = [
  { x: -64, y: 40 },
  { x: -76, y: 84 },
  { x: -62, y: 122 },
  { x: -34, y: 152 },
  { x: -8, y: 170 },
];

const foot = [bunker(-12, 96, 22, 7, 1, 2, 0.1), bunker(34, 104, 16, 6, 2, 2, -0.2)];
const top = [bunker(40, 194, 10, 6, 3, 2.4, 0.3), bunker(-22, 208, 9, 5, 4, 2.4, -0.2)];

const cacti: Post[] = [
  [-100, 30], [-110, 150], [70, 40], [96, 110], [100, 190], [-40, 20], [60, 230], [-30, 236], [30, 240], [-90, 200], [90, 230],
].map(([x, y]) => ({ x, y, r: 1, h: 10, look: 'cactus' as const }));
const rocks: Post[] = [[-60, 80, 3], [70, 160, 4], [-96, 98, 3], [50, 30, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const mesatop: Hole = {
  id: 'mesatop',
  name: 'Mesa Top',
  par: 3,
  theme: 'desert',
  tour: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 140,
  blurb: 'Uphill to a green on a red mesa. Short is the sand. A switchback road climbs the left.',
  tee: { x: 0, y: 0 },
  cup: { x: 12, y: 178 },
  pins: [{ x: 12, y: 178 }, { x: 4, y: 168 }, { x: 22, y: 184 }, { x: 12, y: 166 }],
  aim: 0.04,
  bounds: { x0: -200, y0: -40, x1: 200, y1: 300 },
  border: [
    { x: -150, y: -36 },
    { x: 150, y: -36 },
    { x: 170, y: 290 },
    { x: -170, y: 290 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: band(ROAD, 5), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...foot.map((t) => t.region),
    ...top.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -200, y0: -40, x1: 200, y1: 300, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the mesa: a flat top with a steep red face
    { kind: 'box', x0: -70, y0: 126, x1: 80, y1: 300, h: TOP, edge: 30, op: 'set' },
    // the road, climbing
    { kind: 'embankment', pts: ROAD, h: [GROUND, 6, 8, 10.5, TOP], width: 5, edge: 6 },
    ...[0, 200].map((y) => ({ kind: 'hill' as const, x: -320, y, r: 140, h: 30 })),
    ...[0, 200].map((y) => ({ kind: 'hill' as const, x: 320, y, r: 140, h: 26 })),
    ...greenComplex(GREEN, TOP, { lift: 0.5, edge: 8, tilt: [0.8, -0.8], rolls: [[-6, 4, 6, 0.4]] }),
    ...foot.flatMap((t) => t.pieces),
    ...top.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...cacti, ...rocks],
  movers: [],
  pushes: [],
  zones: [{ id: 'switchback', poly: band(ROAD.slice(2), 5) }],
  secret: { name: 'The Switchback', zone: 'switchback', hint: 'A road climbs the left of the mesa. Get a ball onto it and putt up the switchback.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 10, y: 80 },
    { x: 14, y: 130 },
    { x: 12, y: 178 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: 120, y: 60, scale: 1.4 },
  ],
};
