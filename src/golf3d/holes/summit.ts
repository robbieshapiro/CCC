// Hole 1, The Summit (par 5, about 740 ft): off a cliff-top tee, straight down a mountain valley.
// The play: bomb a driver down the middle, then decide whether to carry the creek or lay up short of it.
// The secret: the cart path starts beside the tee, drops down the cliff and runs hard and fast all the way down the valley.
import { band, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: -4, y: 730, r: 26 };
const CREEK = { y0: 532, y1: 550 };
const LAKE = { x: -92, y: 415, r: 34 };

// the cart path leaves the tee, drops down the cliff, hugs the right side of the fairway,
// crosses the creek on a bridge and turns in to the green
const path: V2[] = [
  { x: 14, y: 10 },
  { x: 38, y: 24 },
  { x: 58, y: 48 },
  { x: 69, y: 80 },
  { x: 73, y: 120 },
  { x: 73, y: 664 },
  { x: 50, y: 704 },
];

// pines up both valley walls, thinned out where the lake is
const pines: Post[] = [];
for (let i = 0, y = 40; y <= 800; y += 30, i++)
  for (const side of [-1, 1]) {
    const x = side * (104 + ((i + (side > 0 ? 1 : 0)) % 3) * 15);
    if (side < 0 && y > 370 && y < 460) continue;
    pines.push({ x, y: y + (i % 2) * 9, r: 1.2, h: 20, look: 'pine' });
    if (i % 2) pines.push({ x: x + side * 26, y: y + 15, r: 1.2, h: 20, look: 'pine' });
  }

const rocks: Post[] = [
  [-62, 70, 3], [58, 96, 2.6], [-140, 210, 4], [146, 330, 3.4], [-150, 610, 4.2], [140, 560, 3], [118, 790, 3.6], [-120, 790, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const summit: Hole = {
  id: 'summit',
  name: 'The Summit',
  par: 5,
  tee: { x: 0, y: 0 },
  cup: { x: -8, y: 736 },
  aim: 0,
  bounds: { x0: -170, y0: -40, x1: 170, y1: 840 },
  border: [
    { x: -166, y: -36 },
    { x: 166, y: -36 },
    { x: 166, y: 836 },
    { x: -166, y: 836 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-54, 144, 54, 526), surface: 'fringe' },
    { poly: rect(-48, 150, 48, 520), surface: 'fairway' },
    { poly: rect(-48, 556, 48, 702), surface: 'fringe' },
    { poly: rect(-42, 560, 42, 698), surface: 'fairway' },
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 4), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r), surface: 'green' },
    { poly: circle(-52, 320, 12), surface: 'sand' },
    { poly: circle(-50, 456, 12), surface: 'sand' },
    { poly: circle(50, 420, 12), surface: 'sand' },
    { poly: circle(-38, 712, 9), surface: 'sand' },
    { poly: circle(30, 752, 8), surface: 'sand' },
    { poly: band(path, 3.2), surface: 'path' },
    { poly: rect(66, CREEK.y0 - 6, 80, CREEK.y1 + 6), surface: 'wood' },
  ],
  water: [
    { poly: rect(-166, CREEK.y0 - 4, 166, CREEK.y1 + 4), level: -0.6 },
    { poly: circle(LAKE.x, LAKE.y, LAKE.r), level: 1.8 },
  ],
  terrain: [
    // the valley floor, tee to green: a cliff-top tee, a long fall, a gentle run to the creek, a climb to the green
    { kind: 'ramp', x0: -170, y0: -40, x1: 170, y1: 24, axis: 'y', h0: 34, h1: 33, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 24, x1: 170, y1: 150, axis: 'y', h0: 33, h1: 6, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 150, x1: 170, y1: 470, axis: 'y', h0: 6, h1: 2, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 470, x1: 170, y1: 600, axis: 'y', h0: 2, h1: 0.5, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 600, x1: 170, y1: 700, axis: 'y', h0: 0.5, h1: 7, op: 'set' },
    { kind: 'ramp', x0: -170, y0: 700, x1: 170, y1: 840, axis: 'y', h0: 7, h1: 9, op: 'set' },
    // valley walls
    ...[40, 180, 320, 460, 600, 740, 860].flatMap((y, i) => [
      { kind: 'hill' as const, x: -232, y, r: 120, h: 28 + (i % 3) * 6 },
      { kind: 'hill' as const, x: 232, y: y + 50, r: 120, h: 30 + ((i + 1) % 3) * 6 },
    ]),
    // a mountain behind the green
    { kind: 'hill', x: 0, y: 900, r: 140, h: 40 },
    // rolls in the fairway
    { kind: 'hill', x: 28, y: 250, r: 30, h: 1.6 },
    { kind: 'hill', x: -26, y: 395, r: 28, h: 1.3 },
    { kind: 'hill', x: 18, y: 640, r: 24, h: 1 },
    // the lake sits in its own hollow
    { kind: 'disc', x: LAKE.x, y: LAKE.y, r: 48, h: 2.4, edge: 14, op: 'set' },
    { kind: 'disc', x: LAKE.x, y: LAKE.y, r: 36, h: -4, edge: 10, op: 'add' },
    // the creek runs across the valley floor
    { kind: 'box', x0: -170, y0: CREEK.y0 - 18, x1: 170, y1: CREEK.y1 + 18, h: 1, edge: 10, op: 'set' },
    { kind: 'box', x0: -170, y0: CREEK.y0, x1: 170, y1: CREEK.y1, h: -3, edge: 4, op: 'add' },
    { kind: 'box', x0: 66, y0: CREEK.y0 - 6, x1: 80, y1: CREEK.y1 + 6, h: 1.1, edge: 0.6, op: 'set' },
    // the green sits on a shelf, tipped back to front
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 14, h: 7.6, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 34, y0: GREEN.y - 34, x1: GREEN.x + 34, y1: GREEN.y + 34, axis: 'y', h0: -0.3, h1: 0.4, op: 'add' },
    // bunkers
    ...[[-52, 320, 12], [-50, 456, 12], [50, 420, 12], [-38, 712, 9], [30, 752, 8]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
    // the cart path is sunk in a trough, so a ball rolling on it stays on it
    { kind: 'channel', pts: path, width: 6, depth: 1.2 },
  ],
  walls: [
    // bridge rails
    { a: { x: 66.4, y: CREEK.y0 - 6 }, b: { x: 66.4, y: CREEK.y1 + 6 }, h: 1.2, look: 'rail' },
    { a: { x: 79.6, y: CREEK.y0 - 6 }, b: { x: 79.6, y: CREEK.y1 + 6 }, h: 1.2, look: 'rail' },
  ],
  posts: [...pines, ...rocks, { x: 40, y: 612, r: 2, h: 34, look: 'oak' }, { x: -70, y: 250, r: 2, h: 34, look: 'oak' }],
  movers: [],
  pushes: [],
  zones: [{ id: 'runway', poly: band(path.slice(4), 3.4) }],
  secret: { name: 'Cart Path Special', zone: 'runway', hint: 'The cart path starts right beside the tee. Roll one onto it and see where it goes.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 260 },
    { x: 20, y: 520 },
    { x: -8, y: 736 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 18, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: 30, y: -20, scale: 3 },
    { kind: 'rock', x: -36, y: 8, scale: 2.4 },
    { kind: 'flagpole', x: -26, y: -24 },
  ],
};
