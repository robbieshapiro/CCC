// The Midway, hole 3: The Duck Pond (par 3, 120 yd). Down off the high tee by the carousel to an island green in the
// duck pond. Water all round; the bulb poles on the bank light it up.
import { blob, circle, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex } from '../woods';
import { bulbs } from './common';

const LAND = 3;
const POND = { x: 0, y: 170, r: 58 };
const GREEN = { x: 0, y: 172, rx: 26, ry: 20 };

export const duckpond: Hole = {
  id: 'midway-duckpond',
  name: 'The Duck Pond',
  par: 3,
  theme: 'carnival',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  yards: 120,
  blurb: 'Down off the high tee to an island green in the duck pond. Water all round. No pressure.',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 174 },
  pins: [{ x: 0, y: 174 }, { x: -14, y: 166 }, { x: 14, y: 178 }, { x: 2, y: 184 }],
  aim: 0,
  bounds: { x0: -110, y0: -50, x1: 110, y1: 270 },
  border: [
    { x: -106, y: -46 },
    { x: 106, y: -46 },
    { x: 106, y: 266 },
    { x: -106, y: 266 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(0, 70, 30, 30, 1, 0.06), surface: 'fairway' },
    { poly: rect(-30, 236, 30, 252), surface: 'wood' },
    // the island: a ring of fringe round the green
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 8, GREEN.ry + 8, 3, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
  ],
  water: [
    // the pond (the island stands up out of it, so it's dry)
    { poly: circle(POND.x, POND.y, POND.r), level: LAND - 1.2 },
  ],
  terrain: [
    { kind: 'ramp', x0: -110, y0: -50, x1: 110, y1: 270, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the high tee by the carousel
    { kind: 'disc', x: 0, y: 0, r: 18, h: LAND + 14, edge: 10, op: 'set' },
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r, h: LAND - 4, edge: 3, op: 'set' },
    // the island, up out of the water
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 9, h: LAND, edge: 2, op: 'set' },
    ...greenComplex(GREEN, LAND, { lift: 0.6, edge: 6, tilt: [0.3, -0.4], rolls: [[-8, -4, 7, 0.25], [9, 5, 6, -0.2]] }),
  ],
  walls: [],
  posts: bulbs([[-60, 120], [60, 120], [-62, 230], [62, 230], [-30, 40], [30, 40]]),
  movers: [],
  pushes: [],
  // the boardwalk behind the pond: long and dry beats short and wet
  zones: [{ id: 'ducks', poly: rect(-30, 236, 30, 252) }],
  secret: { name: 'The Back Boardwalk', zone: 'ducks', hint: 'Long is not dead. The boardwalk behind the pond keeps you dry for the chip back.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 100 },
    { x: 0, y: 172 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'bigtop', x: -80, y: 20, scale: 22 },
    { kind: 'booth', x: 80, y: 30, rot: -Math.PI / 2, scale: 16 },
    { kind: 'ferris', x: -170, y: 260, rot: 0.4 },
  ],
};
