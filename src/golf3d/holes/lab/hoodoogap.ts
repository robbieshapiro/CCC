// Hole Lab: Hoodoo Gap (par 3, 175 yd), red rock canyon country. From a tee on the near rim, all carry over a slot
// canyon with a green river far below, to a green on the far mesa between two hoodoos. Short is a long way down.
// The play: a mid iron at the middle of the green; the hoodoos either side take anything wide.
// The bail-out: a broad ledge round to the left, for a chip across.
// The secret: the slickrock ramp right of the green. Land it on the bare rock and it runs down onto the putting surface.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';

const RIM = 30;
const GREEN = { x: 6, y: 236, rx: 22, ry: 16 };
const traps = [greenside(GREEN, -30, 250, 8, 6, 1, 3, 0.4), greenside(GREEN, 6, 266, 12, 5, 2, 3, 0)];
const LEDGE: V2[] = [
  { x: -30, y: 20 },
  { x: -96, y: 90 },
  { x: -96, y: 170 },
  { x: -54, y: 220 },
];
const SLICK = rect(36, 214, 70, 250);

const posts: Post[] = [
  // the two that frame the green, and a field of smaller ones out right
  { x: -32, y: 228, r: 4, h: 46, look: 'hoodoo' },
  { x: 44, y: 262, r: 4, h: 38, look: 'hoodoo' },
  ...[[80, 120, 28], [96, 170, 34], [86, 300, 30], [-110, 250, 32], [-60, 300, 26]].map(([x, y, h]) => ({ x, y, r: 3.6, h, look: 'hoodoo' as const })),
  // juniper on the rims
  ...[[-24, -20], [26, -24], [-120, 60], [-120, 200], [40, 300], [-20, 296]].map(([x, y]) => ({ x, y, r: 2, h: 8, soft: true, look: 'cactus' as const })),
];

export const hoodoogap: Hole = {
  id: 'hoodoogap',
  name: 'Hoodoo Gap',
  par: 3,
  theme: 'canyon',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.05,
  noCart: true,
  yards: 175,
  blurb: 'All carry over the canyon to a green between two hoodoos. Short is a long way down. A ledge swings round the left.',
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 238 },
  pins: [{ x: 6, y: 238 }, { x: -8, y: 230 }, { x: 18, y: 242 }, { x: 2, y: 248 }],
  aim: 0.02,
  bounds: { x0: -150, y0: -50, x1: 130, y1: 330 },
  border: [
    { x: -146, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 326 },
    { x: -146, y: 326 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    { poly: band(LEDGE.slice(1), 16), surface: 'fairway' },
    // bare slickrock everywhere off the turf on the far mesa, and the ramp right of the green
    { poly: blob(6, 270, 100, 50, 3, 0.1), surface: 'rock' },
    { poly: SLICK, surface: 'rock' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  // the river fills the canyon floor: anything that goes down there is gone
  water: [{ poly: rect(-146, -46, 126, 326), level: -38 }],
  // a ball in the canyon is dropped on the ledge, short left of the green
  drop: { x: -54, y: 210 },
  terrain: [
    // the canyon floor, deep, and the rims either side
    { kind: 'ramp', x0: -150, y0: -50, x1: 130, y1: 330, axis: 'y', h0: -40, h1: -40, op: 'set' },
    { kind: 'embankment', pts: [{ x: -150, y: -10 }, { x: 130, y: -10 }], h: [RIM, RIM], width: 34, edge: 18, wobble: 6 },
    { kind: 'embankment', pts: LEDGE, h: [RIM, RIM - 1, RIM - 2, RIM - 2], width: 18, edge: 16, wobble: 5 },
    { kind: 'embankment', pts: [{ x: -150, y: 262 }, { x: 130, y: 262 }], h: [RIM - 2, RIM - 2], width: 54, edge: 18, wobble: 6 },
    // the slickrock ramp down onto the green from the right
    { kind: 'ramp', x0: 36, y0: 214, x1: 70, y1: 250, axis: 'x', h0: 0, h1: 3, op: 'add' },
    ...greenComplex(GREEN, RIM - 2, { lift: 0.8, edge: 8, tilt: [0.6, 1], rolls: [[-8, -4, 6, 0.3], [9, 6, 5, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'slickrock', poly: SLICK }],
  secret: { name: 'Slickrock', zone: 'slickrock', hint: 'Right of the green the bare rock slopes down to it. Land one there and let it run.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 30, y: 80 },
    { x: 20, y: 180 },
    { x: 6, y: 236 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'arch', x: -110, y: 312, scale: 50, rot: 0.3 },
  ],
};
