// The Midway, hole 2: The Lane (par 4, 330 yd). Straight down the midway between the two rows of game booths (their
// counters are in play and kick a ball back out), then a dogleg right round the Ferris wheel to a green under the
// lights. The wheel's legs stand in play at the corner.
import { blob, rect } from '../../terrain';
import type { Hole, Wall } from '../../types';
import { greenComplex, greenside } from '../woods';
import { boxWalls, bulbs } from './common';

const LAND = 3;
const GREEN = { x: 96, y: 438, rx: 24, ry: 18 };
const traps = [greenside(GREEN, 60, 446, 8, 8, 1, 3, 0), greenside(GREEN, 110, 470, 10, 5, 2, 3, 0)];
const WHEEL = { x: 40, y: 372 };
// the booths, both sides of the lane: [x, y, width]
const BOOTHS: [number, number, number][] = [
  [-46, 70, 18], [-46, 130, 16], [-46, 190, 18], [-46, 250, 16], [-46, 310, 18],
  [46, 70, 16], [46, 130, 18], [46, 190, 16], [46, 250, 18],
];
const boothWalls: Wall[] = BOOTHS.flatMap(([x, y, w]) => boxWalls(x, y, 8, w, 5));

export const thelane: Hole = {
  id: 'midway-lane',
  name: 'The Lane',
  par: 4,
  theme: 'carnival',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  yards: 330,
  blurb: 'Down the midway between the game booths, then right round the Ferris wheel to a green under the lights.',
  tee: { x: 0, y: 0 },
  cup: { x: 96, y: 440 },
  pins: [{ x: 96, y: 440 }, { x: 82, y: 432 }, { x: 110, y: 444 }, { x: 94, y: 452 }],
  aim: 0,
  bounds: { x0: -120, y0: -50, x1: 190, y1: 520 },
  border: [
    { x: -60, y: -46 },
    { x: 60, y: -46 },
    { x: 60, y: 330 },
    { x: 186, y: 330 },
    { x: 186, y: 516 },
    { x: -60, y: 516 },
  ],
  base: 'rough',
  wallBounce: 0.9,
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the lane itself, then the turn at the wheel
    { poly: rect(-30, 30, 30, 330), surface: 'fairway' },
    { poly: blob(40, 410, 40, 40, 2, 0.06), surface: 'fairway' },
    // the boardwalk planks down the middle of the midway
    { poly: rect(-36, -40, -32, 340), surface: 'wood' },
    { poly: rect(32, -40, 36, 290), surface: 'wood' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -50, x1: 190, y1: 520, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: LAND + 1.5, edge: 8, op: 'set' },
    ...greenComplex(GREEN, LAND, { lift: 1.2, edge: 9, tilt: [-0.4, 0.7], rolls: [[-8, -6, 7, 0.3], [10, 6, 6, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: boothWalls,
  posts: [
    { x: WHEEL.x - 10, y: WHEEL.y, r: 2, h: 60, look: 'tower' },
    { x: WHEEL.x + 10, y: WHEEL.y, r: 2, h: 60, look: 'tower' },
    ...bulbs([[-30, 40], [30, 100], [-30, 160], [30, 220], [-30, 280], [140, 400], [150, 480], [40, 490]]),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'counter', poly: rect(34, 300, 60, 330) }],
  secret: { name: 'The Last Booth', zone: 'counter', hint: 'Bank one off the last booth on the right and it kicks round the corner.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 200 },
    { x: 40, y: 400 },
    { x: 96, y: 438 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    ...BOOTHS.map(([x, y, w]) => ({ kind: 'booth', x, y, rot: x < 0 ? Math.PI / 2 : -Math.PI / 2, scale: w })),
    { kind: 'ferris', x: WHEEL.x, y: WHEEL.y, rot: Math.PI / 2 },
    { kind: 'bigtop', x: -110, y: 420, scale: 30 },
  ],
};
