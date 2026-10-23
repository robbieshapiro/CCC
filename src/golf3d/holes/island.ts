// Hole 2, The Island (par 3, about 205 ft): from a cliff-top tee, down to a small green in a mountain lake.
// The play: a high iron that stops. Short is wet, long is wet, and the green tips toward the water.
// The secret: from the shore below the tee, putt the length of the boardwalk onto the green.
import { circle, rect } from '../terrain';
import type { Hole, Post } from '../types';

const ISLAND = { x: -6, y: 200, r: 24 };
const LEVEL = 0.6;
const BOARD = { x0: -26, x1: -22, y0: 64, y1: 200 };

const trees: Post[] = [
  ...[-120, -84, -40, 30, 74, 118].map((x, i) => ({ x, y: 318 + (i % 2) * 10, r: 1.2, h: 20, look: 'pine' as const })),
  ...[-130, -98, 96, 128].map((x, i) => ({ x, y: -14 + (i % 2) * 12, r: 1.2, h: 20, look: 'pine' as const })),
  { x: -64, y: 330, r: 2, h: 34, look: 'oak' },
  { x: 54, y: 332, r: 2, h: 34, look: 'oak' },
];

const rocks: Post[] = [
  [-60, 30, 3.4], [44, 34, 3], [-110, 34, 2.6], [96, 30, 3.8], [-136, 120, 3.2], [136, 230, 3.6],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const island: Hole = {
  id: 'island',
  name: 'The Island',
  par: 3,
  tee: { x: 0, y: 0 },
  cup: { x: -2, y: 204 },
  // tucked by the water on the right, front left, and back
  pins: [{ x: -2, y: 204 }, { x: 4, y: 194 }, { x: -14, y: 192 }, { x: -8, y: 211 }],
  greenFirm: 0.03,
  aim: -0.03,
  bounds: { x0: -150, y0: -40, x1: 150, y1: 340 },
  border: [
    { x: -146, y: -36 },
    { x: 146, y: -36 },
    { x: 146, y: 336 },
    { x: -146, y: 336 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    { poly: rect(-146, 44, 146, 70), surface: 'fringe' },
    { poly: circle(ISLAND.x, ISLAND.y, 21), surface: 'fringe' },
    { poly: circle(ISLAND.x, ISLAND.y, 18), surface: 'green' },
    { poly: circle(8, 214, 4.5), surface: 'sand' },
    { poly: rect(BOARD.x0, BOARD.y0, BOARD.x1, BOARD.y1), surface: 'wood' },
  ],
  water: [{ poly: rect(-146, 62, 146, 304), level: LEVEL }],
  terrain: [
    // the tee on the cliff top, the cliff, then a strip of shore
    { kind: 'ramp', x0: -150, y0: -40, x1: 150, y1: 18, axis: 'y', h0: 26, h1: 26, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 18, x1: 150, y1: 44, axis: 'y', h0: 26, h1: 1.4, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 44, x1: 150, y1: 340, axis: 'y', h0: 1.4, h1: 1.4, op: 'set' },
    // mountains close in on both sides and behind
    { kind: 'hill', x: -236, y: 170, r: 140, h: 36 },
    { kind: 'hill', x: 236, y: 150, r: 140, h: 40 },
    { kind: 'hill', x: 0, y: 440, r: 140, h: 34 },
    // the lake
    { kind: 'box', x0: -150, y0: 70, x1: 150, y1: 304, h: -5, edge: 8, op: 'add' },
    // the island: one foot above the water, with a shore that drops straight in
    { kind: 'disc', x: ISLAND.x, y: ISLAND.y, r: ISLAND.r, h: 1.6, edge: 6, op: 'set' },
    // it tips left, toward the long carry over the water
    { kind: 'ramp', x0: ISLAND.x - 24, y0: ISLAND.y - 24, x1: ISLAND.x + 24, y1: ISLAND.y + 24, axis: 'x', h0: -0.35, h1: 0.4, op: 'add' },
    { kind: 'disc', x: 8, y: 214, r: 4.5, h: -0.9, edge: 1.5, op: 'add' },
    // the boardwalk out from the shore
    { kind: 'box', x0: BOARD.x0, y0: BOARD.y0, x1: BOARD.x1, y1: BOARD.y1, h: 1.5, edge: 0.4, op: 'set' },
  ],
  walls: [],
  posts: [...trees, ...rocks],
  movers: [
    {
      id: 'swan1',
      look: 'swan',
      at: (t) => {
        const a = t * 0.12;
        const pos = { x: 50 + Math.cos(a) * 26, y: 150 + Math.sin(a) * 40 };
        return { walls: [], posts: [{ ...pos, r: 1.6, h: 2.2, look: 'post' }], pos, heading: a + Math.PI / 2 };
      },
    },
    {
      id: 'swan2',
      look: 'swan',
      at: (t) => {
        const a = -t * 0.1 + 2;
        const pos = { x: -70 + Math.cos(a) * 24, y: 250 + Math.sin(a) * 30 };
        return { walls: [], posts: [{ ...pos, r: 1.6, h: 2.2, look: 'post' }], pos, heading: a - Math.PI / 2 };
      },
    },
  ],
  pushes: [],
  zones: [{ id: 'plank', poly: rect(BOARD.x0, 90, BOARD.x1, 180) }],
  secret: { name: 'Walk the Plank', zone: 'plank', hint: 'There is a boardwalk out to the island. No rails. Steady hands.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 40, y: 120 },
    { x: -2, y: 204 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: -22, y: -10, rot: 0 },
    { kind: 'bench', x: 26, y: -12, rot: 0 },
    { kind: 'rock', x: 20, y: 300, scale: 3 },
    { kind: 'rock', x: -100, y: 296, scale: 2.6 },
  ],
};
