// Hole 3, The Clubhouse (par 5, about 520 ft): croquet lawn, a hedge maze, and a raised green by the terrace.
// The gamble: an iron over the maze. The secret: up the terrace stairs and along the veranda onto the green.
import { circle, rect } from '../terrain';
import type { Hole, Post, V2, Wall } from '../types';

// Hedge maze: 5 x 4 cells of 34 ft. Listed passages are open; every other cell edge is a hedge.
const MX = -120;
const MY = 196;
const CELL = 34;
const COLS = 5;
const ROWS = 4;
const open = new Set(
  [
    [2, 0, 2, 1], [2, 1, 1, 1], [1, 1, 1, 2], [1, 2, 1, 3],
    // dead ends
    [1, 1, 0, 1], [0, 1, 0, 0], [0, 0, 1, 0], [0, 1, 0, 2], [0, 2, 0, 3],
    [2, 1, 3, 1], [2, 0, 3, 0], [3, 0, 4, 0], [3, 1, 4, 1], [4, 1, 4, 2], [4, 2, 3, 2], [3, 2, 2, 2], [2, 2, 2, 3], [3, 2, 3, 3], [3, 3, 4, 3],
  ].flatMap(([a, b, c, d]) => [`${a},${b}|${c},${d}`, `${c},${d}|${a},${b}`]),
);
const ENTRANCE = 2; // column open at the bottom
const EXIT = 1; // column open at the top
const TOP = MY + ROWS * CELL;

function maze(): Wall[] {
  const walls: Wall[] = [];
  const hedge = (ax: number, ay: number, bx: number, by: number) => walls.push({ a: { x: ax, y: ay }, b: { x: bx, y: by }, h: 12, look: 'hedge' });
  for (let c = 0; c < COLS; c++) {
    const x0 = MX + c * CELL;
    if (c !== ENTRANCE) hedge(x0, MY, x0 + CELL, MY);
    if (c !== EXIT) hedge(x0, TOP, x0 + CELL, TOP);
  }
  hedge(MX, MY, MX, TOP);
  hedge(MX + COLS * CELL, MY, MX + COLS * CELL, TOP);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r < ROWS; r++) {
      const x0 = MX + c * CELL;
      const y0 = MY + r * CELL;
      if (c < COLS - 1 && !open.has(`${c},${r}|${c + 1},${r}`)) hedge(x0 + CELL, y0, x0 + CELL, y0 + CELL);
      if (r < ROWS - 1 && !open.has(`${c},${r}|${c},${r + 1}`)) hedge(x0, y0 + CELL, x0 + CELL, y0 + CELL);
    }
  return walls;
}

// croquet wickets: two thin posts each
const wickets: Post[] = [
  [-60, 60], [10, 80], [-30, 120], [40, 140], [-90, 130],
].flatMap(([x, y]) => [
  { x: x - 1.6, y, r: 0.25, h: 1.6, e: 0.5, look: 'wicket' as const },
  { x: x + 1.6, y, r: 0.25, h: 1.6, e: 0.5, look: 'wicket' as const },
]);
const croquet: Post[] = [
  [-40, 70], [24, 100], [-70, 104], [0, 150],
].map(([x, y]) => ({ x, y, r: 0.9, h: 1.8, e: 0.8, look: 'croquet' as const }));
// veranda columns along the terrace
const columns: Post[] = [76, 112, 148, 184, 220, 256, 292, 328, 364].flatMap((y) => [
  { x: 82, y, r: 1, h: 16, e: 0.5, look: 'column' as const },
  { x: 132, y, r: 1, h: 16, e: 0.5, look: 'column' as const },
]);

const TERRACE_H = 6;
const GREEN_H = 4;
const GREEN = { x0: -76, y0: 366, x1: 22, y1: 430 };

export const clubhouse: Hole = {
  id: 'clubhouse',
  name: 'The Clubhouse',
  par: 5,
  tee: { x: 40, y: 0 },
  cup: { x: -24, y: 404 },
  aim: 0,
  bounds: { x0: -140, y0: -22, x1: 150, y1: 450 },
  border: [
    { x: -136, y: -16 },
    { x: 146, y: -16 },
    { x: 146, y: 446 },
    { x: -136, y: 446 },
  ],
  base: 'fringe',
  regions: [
    { poly: rect(-120, 10, 66, 168), surface: 'fairway' },
    { poly: rect(-136, 172, 66, 188), surface: 'path' },
    { poly: rect(72, 22, 100, 50), surface: 'stone' },
    { poly: rect(72, 50, 146, 446), surface: 'wood' },
    { poly: rect(22, 390, 72, 426), surface: 'stone' },
    { poly: rect(GREEN.x0 - 4, GREEN.y0 - 4, GREEN.x1 + 4, GREEN.y1 + 4), surface: 'fringe' },
    { poly: rect(GREEN.x0, GREEN.y0, GREEN.x1, GREEN.y1), surface: 'green' },
    { poly: circle(-100, 404, 10), surface: 'sand' },
    { poly: circle(-10, 350, 8), surface: 'sand' },
  ],
  water: [],
  terrain: [
    { kind: 'tilt', gx: -0.003, gy: 0.004 },
    // terrace: a raised deck with stairs up from the lawn and a drop onto the green
    { kind: 'box', x0: 72, y0: 50, x1: 150, y1: 450, h: TERRACE_H, edge: 0.6, op: 'set' },
    { kind: 'ramp', x0: 72, y0: 22, x1: 100, y1: 51, axis: 'y', h0: 0.1, h1: TERRACE_H, op: 'set', steps: 7 },
    // raised green with a ramp up from the maze exit
    { kind: 'box', x0: GREEN.x0, y0: GREEN.y0, x1: GREEN.x1, y1: GREEN.y1, h: GREEN_H, edge: 1.5, op: 'set' },
    { kind: 'ramp', x0: -88, y0: 334, x1: -50, y1: 368, axis: 'y', h0: 0.8, h1: GREEN_H, op: 'set' },
    { kind: 'ramp', x0: 20, y0: 390, x1: 73, y1: 426, axis: 'x', h0: GREEN_H, h1: TERRACE_H, op: 'set' },
    // the green breaks hard toward the maze, with a tier at the back
    { kind: 'ramp', x0: GREEN.x0, y0: GREEN.y0, x1: GREEN.x1, y1: GREEN.y1, axis: 'x', h0: 0, h1: 1.2, op: 'add' },
    { kind: 'hill', x: -40, y: 424, r: 22, h: 0.9 },
    { kind: 'disc', x: -100, y: 404, r: 10, h: -0.9, edge: 3, op: 'add' },
    { kind: 'disc', x: -10, y: 350, r: 8, h: -0.9, edge: 3, op: 'add' },
  ],
  walls: [
    ...maze(),
    // balustrade along the terrace edge keeps you up there
    { a: { x: 73.2, y: 50 }, b: { x: 73.2, y: 390 }, h: 1.4, look: 'stone' },
    // a bank board at the far end of the veranda turns a fast ball toward the green
    { a: { x: 96, y: 446 }, b: { x: 146, y: 396 }, h: 1.6, look: 'wood' },
    // the lawn side of the terrace wall, and rails up the stairs
    // a tall ivy wall below the terrace: you get up there by the stairs, not by flying in
    { a: { x: 70.6, y: 52 }, b: { x: 70.6, y: 386 }, h: 16, look: 'hedge' },
    { a: { x: 72.4, y: 22 }, b: { x: 72.4, y: 51 }, h: 1.2, look: 'rail' },
    { a: { x: 99.6, y: 22 }, b: { x: 99.6, y: 51 }, h: 1.2, look: 'rail' },
    // hedges that close the lawn off from the green except via the ramp
    { a: { x: -136, y: 362 }, b: { x: -90, y: 362 }, h: 12, look: 'hedge' },
    { a: { x: -48, y: 362 }, b: { x: 20, y: 362 }, h: 12, look: 'hedge' },
    { a: { x: 50, y: 196 }, b: { x: 70, y: 196 }, h: 12, look: 'hedge' },
    { a: { x: 60, y: 196 }, b: { x: 60, y: 362 }, h: 12, look: 'hedge' },
    { a: { x: 20, y: 362 }, b: { x: 60, y: 362 }, h: 12, look: 'hedge' },
  ],
  posts: [
    ...wickets,
    ...croquet,
    ...columns,
    { x: -120, y: 30, r: 2, h: 34, look: 'oak' },
    { x: -124, y: 150, r: 2, h: 34, look: 'oak' },
    { x: -126, y: 430, r: 1.4, h: 30, look: 'cypress' },
  ],
  movers: [
    {
      id: 'cart',
      look: 'cart',
      at: (t) => {
        // drives back and forth along the service road between the lawn and the maze
        const s = (Math.sin(t * 0.25) + 1) / 2;
        const x = -126 + s * 184;
        const y = 180;
        const heading = Math.cos(t * 0.25) > 0 ? 0 : Math.PI;
        const r: Wall[] = [
          { a: { x: x - 4, y: y - 2.4 }, b: { x: x + 4, y: y - 2.4 }, h: 4, look: 'cart' },
          { a: { x: x + 4, y: y - 2.4 }, b: { x: x + 4, y: y + 2.4 }, h: 4, look: 'cart' },
          { a: { x: x + 4, y: y + 2.4 }, b: { x: x - 4, y: y + 2.4 }, h: 4, look: 'cart' },
          { a: { x: x - 4, y: y + 2.4 }, b: { x: x - 4, y: y - 2.4 }, h: 4, look: 'cart' },
        ];
        return { walls: r, posts: [], pos: { x, y }, heading };
      },
    },
  ],
  pushes: [
    // sprinklers: on for a few seconds, then off
    ...[[-80, 40, 0], [10, 50, 2], [-20, 350, 4]].map(([x, y, off], i) => ({
      id: `sprinkler${i}`,
      look: 'sprinkler' as const,
      x,
      y,
      r: 12,
      at: (t: number) => {
        const on = (t + off) % 6 < 3;
        const a = (t + off) * 2.2;
        return on ? { x: Math.cos(a) * 9, y: Math.sin(a) * 9 } : { x: 0, y: 0 };
      },
    })),
  ],
  // the veranda roof: you roll under it, you don't land on it
  roofs: [{ poly: rect(76, 56, 146, 436), h: 16 }],
  zones: [{ id: 'terrace', poly: rect(76, 100, 140, 260) }],
  secret: { name: 'Terrace Route', zone: 'terrace', hint: 'Members may use the terrace stairs. They lead somewhere useful.' },
  flyover: [
    { x: 40, y: -20 },
    { x: -30, y: 200 },
    { x: 100, y: 260 },
    { x: -24, y: 404 },
  ],
  decor: [
    { kind: 'teebox', x: 40, y: 0 },
    { kind: 'clubhouse', x: 148, y: 240 },
    { kind: 'umbrella', x: 110, y: 90 },
    { kind: 'umbrella', x: 110, y: 200 },
    { kind: 'umbrella', x: 110, y: 310 },
    { kind: 'lights', x: 82, y: 76 },
    { kind: 'flagpole', x: -120, y: -8 },
    { kind: 'sign', x: 16, y: -9, rot: 0 },
  ],
};

export const MAZE_EXIT: V2 = { x: MX + EXIT * CELL + CELL / 2, y: TOP + 10 };
