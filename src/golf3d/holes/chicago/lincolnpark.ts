// Hole 3, Lincoln Park (par 4, 410 yd): through Lincoln Park Zoo. From the lawn by the Conservatory up a narrow
// fairway between two enclosures, the giraffes and zebras on the savanna left and the elephant's yard right, a little
// dogleg right past the Lion House to a small green with the flamingos on the bank beside it. Rebuilt Nov 15 (it was a
// water hole round the lagoons; it played oddly).
// The animals wander their enclosures and are in play: a ball that hits one bounces off it. The enclosures are fenced
// with a low rail and are trampled dirt and long grass: they play like waste bunkers. The Lion House stands right of the green: brick, a ball comes back off it.
// The play: a wood or a driver down the left-centre, short of the fairway bunker, then a mid iron to the green.
// No secret.
import { band, blob, rect } from '../../terrain';
import type { Hole, Mover, Post, V2, Wall } from '../../types';
import { bunker, FAIRWAY_DEPTH, greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, greenGallery, teeGallery } from './common';

const LAND = 6;
const SEED = 6;
// a small green, up on its rise and ringed in sand (smaller and tighter since Nov 15: it played about par)
const GREEN = { x: 46, y: 548, rx: 19, ry: 14 };
const traps = [
  greenside(GREEN, 6, 566, 8, 10, 1, 3.4, 0, 2),
  greenside(GREEN, 78, 528, 9, 7, 2, 3.4, 0, 2),
  greenside(GREEN, 30, 506, 10, 5, 3, 3.4, 0, 2),
  greenside(GREEN, 70, 580, 9, 6, 5, 3.4, 0, 2),
  greenside(GREEN, 40, 594, 10, 5, 6, 3.4, 0, 2),
  // a fairway bunker in the right half where a good drive lands
  bunker(12, 300, 11, 9, 4, FAIRWAY_DEPTH, 0),
];
// the fairway: up the middle, then bending right to the green
const LINE: V2[] = [
  { x: 0, y: 10 },
  { x: -6, y: 180 },
  { x: 0, y: 330 },
  { x: 24, y: 450 },
  { x: 40, y: 512 },
];
// the enclosures: the savanna on the left, the elephant yard on the right
const SAVANNA = { x0: -190, y0: 100, x1: -34, y1: 470 };
const YARD = { x0: 38, y0: 150, x1: 200, y1: 420 };
// the Lion House, right of the green, and the Conservatory behind the tee
const LIONS = building(140, 540, 70, 50, 34, 81, 'flat');
const GLASS = building(0, -80, 110, 40, 30, 82, 'flat');

// a low rail round each enclosure: a rolling ball stops at it, a flying one sails over
const rail = (r: { x0: number; y0: number; x1: number; y1: number }): Wall[] => {
  const c = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }];
  return c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: 3, look: 'rail' as const }));
};

// An animal walking a slow loop in its enclosure: an ellipse round (cx, cy), radii rx, ry, one lap in `lap` seconds.
// r and h: the post a ball bounces off.
const walker = (id: string, look: Mover['look'], cx: number, cy: number, rx: number, ry: number, lap: number, phase: number, r: number, h: number): Mover => ({
  id,
  look,
  at: (t) => {
    const a = (t / lap) * Math.PI * 2 + phase;
    const pos = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
    // heading: along the direction of travel, as an angle from +x
    const heading = Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx);
    return { walls: [], posts: [{ ...pos, r, h, look: 'post' }], pos, heading };
  },
});

const animals: Mover[] = [
  // the savanna: two giraffes and a small herd of zebras, working along the fence by the fairway
  walker('giraffe1', 'giraffe', -90, 220, 34, 70, 70, 0, 1.6, 13),
  walker('giraffe2', 'giraffe', -110, 360, 40, 50, 84, 2, 1.6, 13),
  walker('zebra1', 'zebra', -80, 300, 26, 40, 46, 1, 1.4, 5),
  walker('zebra2', 'zebra', -86, 306, 26, 40, 46, 1.4, 1.4, 5),
  walker('zebra3', 'zebra', -74, 296, 26, 40, 46, 1.8, 1.4, 5),
  // the elephant, slowly round its yard
  walker('elephant', 'elephant', 120, 280, 44, 90, 110, 3, 3.6, 9),
  // flamingos on the bank short left of the green, shuffling about
  walker('flamingo1', 'flamingo', -8, 520, 8, 6, 30, 0, 0.6, 4),
  walker('flamingo2', 'flamingo', -12, 528, 7, 5, 26, 2, 0.6, 4),
  walker('flamingo3', 'flamingo', -4, 512, 6, 6, 34, 4, 0.6, 4),
];

const posts: Post[] = [
  // oaks along the enclosures and round the green
  ...[[-36, 70], [40, 90], [-40, 480], [100, 470], [86, 610], [-30, 620]].map(([x, y], i) => ({ x, y, r: 7, h: 28 + (i % 3) * 3, soft: true, look: 'oak' as const })),
  ...[[-170, 40], [-170, 520], [190, 120], [190, 480]].map(([x, y], i) => ({ x, y, r: 6, h: 24 + i * 2, soft: true, look: 'maple' as const })),
  ...[[-150, 0], [150, 0], [-150, 600], [196, 600]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
];

export const lincolnpark: Hole = {
  id: 'lincolnpark',
  name: 'Lincoln Park',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.05,
  teeTip: 'Through the zoo. Down the left-centre short of the bunker, between the giraffes and the elephant. The animals are in play.',
  yards: 410,
  blurb: 'Through Lincoln Park Zoo: giraffes and zebras left, the elephant right, the Lion House by the green. The animals are in play.',
  tee: { x: 0, y: 0 },
  cup: { x: 46, y: 551 },
  pins: [{ x: 46, y: 551 }, { x: 36, y: 544 }, { x: 56, y: 553 }, { x: 43, y: 558 }],
  aim: 0,
  bounds: { x0: -200, y0: -110, x1: 210, y1: 660 },
  border: [
    { x: -196, y: -46 },
    { x: 206, y: -46 },
    { x: 206, y: 640 },
    { x: -196, y: 640 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: band(LINE, 15), surface: 'fairway' },
    // the zoo's paths, round the enclosures
    { poly: rect(-34, 90, -26, 480), surface: 'path' },
    { poly: rect(30, 140, 38, 430), surface: 'path' },
    // the enclosures: trampled dirt and long grass
    { poly: rect(SAVANNA.x0, SAVANNA.y0, SAVANNA.x1, SAVANNA.y1), surface: 'sand' },
    { poly: blob(-110, 250, 50, 90, 2, 0.1), surface: 'rough' },
    { poly: rect(YARD.x0, YARD.y0, YARD.x1, YARD.y1), surface: 'sand' },
    { poly: blob(130, 300, 40, 60, 3, 0.1), surface: 'rough' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -200, y0: -110, x1: 210, y1: 660, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 14, h: LAND + 1.5, edge: 6, op: 'set' },
    // the green sits up on a rise, falling away to the bunkers
    { kind: 'hill', x: GREEN.x, y: GREEN.y, r: 60, h: 2.5 },
    ...chiGreen(GREEN, LAND + 2.5, [0.5, 0.6], [[-5, -4, 5, 0.25], [6, 4, 4, -0.2]], 2.5),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [...rail(SAVANNA), ...rail(YARD), ...LIONS.walls, ...GLASS.walls],
  roofs: [LIONS.roof, GLASS.roof],
  roofsGive: true,
  posts,
  movers: animals,
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -30 },
    { x: -6, y: 200 },
    { x: 10, y: 400 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    teeGallery({ x: 0, y: 0 }),
    ...greenGallery(GREEN, 60, 120),
    { kind: 'teebox', x: 0, y: 0 },
    LIONS.decor,
    GLASS.decor,
    { kind: 'walkers', x: -30, y: 280, rot: Math.PI / 2, scale: 300, size: [10, 0, 0] },
    { kind: 'walkers', x: 34, y: 280, rot: Math.PI / 2, scale: 240, size: [8, 0, 0] },
    { kind: 'lake', x: 700, y: 300, rot: Math.PI / 2, scale: 6 },
    { kind: 'hancock', x: 400, y: -1600 },
    { kind: 'willis', x: -100, y: -2600 },
  ],
};
