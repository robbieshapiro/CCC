// The short game area: a contoured practice green with fringe, rough and a bunker round it, and six spots to work from.
// Caldera greens: quick, and a putt has to be dying to drop.
import { blob } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const FLOOR = 10;
const GREEN = { x: 0, y: 120, rx: 26, ry: 22 };
const CUP = { x: 4, y: 124 };

export const STATIONS: { name: string; at: V2 }[] = [
  { name: 'Chip from the fringe', at: { x: -2, y: 95 } },
  { name: 'Pitch from the rough', at: { x: 20, y: 76 } },
  { name: 'Bunker shot', at: { x: -34, y: 118 } },
  { name: 'Short putt', at: { x: 4, y: 118 } },
  { name: 'Mid putt', at: { x: -9, y: 117 } },
  { name: 'Long putt', at: { x: -20, y: 110 } },
];

const rocks: Post[] = [
  [-80, 60, 3.2], [80, 90, 3], [-70, 180, 3.4], [76, 170, 3.2],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const shortgame: Hole = {
  id: 'shortgame',
  name: 'Short game',
  par: 0,
  theme: 'volcanic',
  tour: true,
  flag: 'CCC',
  tee: STATIONS[0].at,
  cup: CUP,
  aim: 0,
  bounds: { x0: -100, y0: 40, x1: 100, y1: 200 },
  border: [
    { x: -96, y: 44 },
    { x: 96, y: 44 },
    { x: 96, y: 196 },
    { x: -96, y: 196 },
  ],
  base: 'rough',
  regions: [
    { poly: blob(0, 80, 26, 14, 1, 0.1), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    { poly: blob(-35, 118, 7, 6, 4, 0.15), surface: 'sand' },
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -100, y0: 40, x1: 100, y1: 200, axis: 'y', h0: FLOOR, h1: FLOOR + 1, op: 'set' },
    { kind: 'hill', x: 0, y: 300, r: 140, h: 40 },
    // the green: tipped front to back and left to right, with a ridge through the middle
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: FLOOR + 1.6, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 28, x1: GREEN.x + 32, y1: GREEN.y + 28, axis: 'y', h0: -0.5, h1: 0.5, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 32, y0: GREEN.y - 28, x1: GREEN.x + 32, y1: GREEN.y + 28, axis: 'x', h0: 0.4, h1: -0.4, op: 'add' },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y, r: 12, h: 0.5 },
    { kind: 'disc', x: -35, y: 118, r: 7, h: -1.4, edge: 3, op: 'add' },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: 60 },
    { x: 0, y: 120 },
  ],
  decor: [{ kind: 'bench', x: -30, y: 70, rot: 0 }],
};
