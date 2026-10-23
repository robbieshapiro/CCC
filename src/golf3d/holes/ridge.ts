// Hole 3, The Ridge (par 4, about 520 ft the long way): a dogleg left round a pond and a stand of pines.
// The play: a drive down the hill to the corner, then a short iron up to a raised green guarded by sand.
// The gamble: carry the pines and the pond from the tee, straight at the green.
// The secret: the bank behind the green feeds a long ball back down toward the pin.
import { circle, rect } from '../terrain';
import type { Hole, Post } from '../types';

const GREEN = { x: -190, y: 345, r: 24 };
const POND = { x: -70, y: 190, r: 28 };

// the stand of pines on the inside of the corner, clear of the pond
const grove: Post[] = [];
for (let i = 0, x = -150; x <= -14; x += 17, i++)
  for (let y = 86 + (i % 2) * 8; y <= 276; y += 19) {
    if (Math.hypot(x - POND.x, y - POND.y) < POND.r + 9) continue;
    grove.push({ x, y, r: 1.2, h: 22, look: 'pine' });
  }

// the outside of the dogleg and the far side: a line of pines
const edge: Post[] = [
  ...[10, 44, 78, 112, 146, 180, 214, 248].map((y, i) => ({ x: 104 + (i % 2) * 12, y, r: 1.2, h: 20, look: 'pine' as const })),
  ...[-250, -200, -150, -100, -50, 0, 50, 100].map((x, i) => ({ x, y: 412 + (i % 2) * 10, r: 1.2, h: 20, look: 'pine' as const })),
];

export const ridge: Hole = {
  id: 'ridge',
  name: 'The Ridge',
  par: 4,
  tee: { x: 40, y: 0 },
  cup: { x: -186, y: 348 },
  pins: [{ x: -186, y: 348 }, { x: -176, y: 334 }, { x: -200, y: 356 }, { x: -194, y: 336 }],
  aim: -0.05,
  bounds: { x0: -290, y0: -40, x1: 130, y1: 440 },
  border: [
    { x: -286, y: -36 },
    { x: 126, y: -36 },
    { x: 126, y: 436 },
    { x: -286, y: 436 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(26, -14, 54, 14), surface: 'fairway' },
    // an L of fairway: down to the corner, then left to the green
    { poly: rect(4, 54, 78, 352), surface: 'fringe' },
    { poly: rect(-164, 284, 78, 352), surface: 'fringe' },
    { poly: rect(10, 60, 72, 346), surface: 'fairway' },
    { poly: rect(-158, 290, 72, 346), surface: 'fairway' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 4), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r), surface: 'green' },
    { poly: circle(92, 302, 12), surface: 'sand' },
    { poly: circle(-92, 356, 10), surface: 'sand' },
    { poly: circle(-176, 316, 8), surface: 'sand' },
    { poly: circle(-206, 374, 8), surface: 'sand' },
  ],
  water: [{ poly: circle(POND.x, POND.y, POND.r), level: -0.6 }],
  terrain: [
    // tee knoll, down into the dip, then up to the corner
    { kind: 'ramp', x0: -290, y0: -40, x1: 130, y1: 20, axis: 'y', h0: 12, h1: 12, op: 'set' },
    { kind: 'ramp', x0: -290, y0: 20, x1: 130, y1: 120, axis: 'y', h0: 12, h1: 0, op: 'set' },
    { kind: 'ramp', x0: -290, y0: 120, x1: 130, y1: 220, axis: 'y', h0: 0, h1: 0, op: 'set' },
    { kind: 'ramp', x0: -290, y0: 220, x1: 130, y1: 320, axis: 'y', h0: 0, h1: 5, op: 'set' },
    { kind: 'ramp', x0: -290, y0: 320, x1: 130, y1: 440, axis: 'y', h0: 5, h1: 6, op: 'set' },
    // hillsides
    ...[0, 150, 300, 450].map((y, i) => ({ kind: 'hill' as const, x: 230, y, r: 130, h: 28 + (i % 2) * 6 })),
    ...[-120, 20, 160, 300].map((x, i) => ({ kind: 'hill' as const, x, y: 560, r: 150, h: 30 + (i % 2) * 8 })),
    { kind: 'hill', x: -400, y: 120, r: 160, h: 36 },
    { kind: 'hill', x: -400, y: 320, r: 160, h: 32 },
    // the second leg climbs to the green
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: 90, h: 9, edge: 70, op: 'set' },
    // the amphitheatre: the ground rises hard behind the green
    { kind: 'hill', x: GREEN.x - 62, y: GREEN.y + 14, r: 70, h: 18 },
    // the green shelf, tipped toward the approach
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 8, h: 12, edge: 12, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 32, x1: GREEN.x + 32, y1: GREEN.y + 32, axis: 'x', h0: 0.5, h1: -0.4, op: 'add' },
    // the pond in the corner
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 12, h: 0, edge: 10, op: 'set' },
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 2, h: -4, edge: 10, op: 'add' },
    // bunkers
    ...[[92, 302, 12], [-92, 356, 10], [-176, 316, 8], [-206, 374, 8]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [
    ...grove,
    ...edge,
    { x: -124, y: 392, r: 2, h: 34, look: 'oak' },
    { x: -40, y: 388, r: 2, h: 34, look: 'oak' },
    ...[[-30, 30, 3], [110, 360, 3.4], [-270, 260, 3.6], [-266, 120, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const })),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'amphi', poly: rect(-272, 306, GREEN.x - GREEN.r - 2, 392) }],
  secret: { name: 'The Amphitheatre', zone: 'amphi', hint: 'Long is not always wrong here. The bank behind the green sends things home.' },
  flyover: [
    { x: 40, y: -20 },
    { x: 40, y: 220 },
    { x: -40, y: 320 },
    { x: -186, y: 348 },
  ],
  decor: [
    { kind: 'teebox', x: 40, y: 0 },
    { kind: 'sign', x: 60, y: -10, rot: 0 },
    { kind: 'bench', x: 16, y: -12, rot: 0 },
    { kind: 'rock', x: 74, y: 18, scale: 2.6 },
  ],
};
