// The Midway, hole 1: The Big Top (par 3, 150 yd). Over the dunk tank to a green tucked behind the big top, whose
// canvas wall stands in play short right. Hit the tent and it'll throw you back.
import { blob, circle, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { bulbs, ring } from './common';

const LAND = 3;
const GREEN = { x: -6, y: 204, rx: 24, ry: 18 };
const traps = [greenside(GREEN, -40, 214, 8, 7, 1, 3, 0), greenside(GREEN, 4, 236, 10, 5, 2, 3, 0)];
const TENT = { x: 48, y: 140, r: 26 };
const TANK = { x: -28, y: 128, r: 20 };

export const bigtop: Hole = {
  id: 'midway-bigtop',
  name: 'The Big Top',
  par: 3,
  theme: 'carnival',
  tour: true,
  windByHeight: true,
  chipDrop: 0.7,
  yards: 150,
  blurb: 'Over the dunk tank to a green tucked behind the big top. The tent is in play, and lively.',
  tee: { x: 0, y: 0 },
  cup: { x: -6, y: 206 },
  pins: [{ x: -6, y: 206 }, { x: -18, y: 198 }, { x: 8, y: 210 }, { x: -4, y: 216 }],
  aim: -0.02,
  bounds: { x0: -110, y0: -50, x1: 110, y1: 290 },
  border: [
    { x: -106, y: -46 },
    { x: 106, y: -46 },
    { x: 106, y: 286 },
    { x: -106, y: 286 },
  ],
  base: 'rough',
  wallBounce: 0.9,
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(-4, 160, 34, 40, 2, 0.06), surface: 'fairway' },
    { poly: rect(-90, -40, -82, 270), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: circle(TANK.x, TANK.y, TANK.r), level: LAND - 1.2 }],
  terrain: [
    { kind: 'ramp', x0: -110, y0: -50, x1: 110, y1: 290, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: LAND + 1.5, edge: 8, op: 'set' },
    { kind: 'disc', x: TANK.x, y: TANK.y, r: TANK.r + 2, h: -2.5, edge: 2, op: 'add' },
    ...greenComplex(GREEN, LAND, { lift: 1, edge: 9, tilt: [0.5, 0.6], rolls: [[-8, -5, 7, 0.25], [9, 6, 6, -0.2]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: ring(TENT.x, TENT.y, TENT.r, 22),
  posts: bulbs([[-80, 20], [-80, 110], [-80, 200], [80, 30], [86, 230], [-50, 260], [30, 270]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'tank', poly: circle(TANK.x, TANK.y, TANK.r + 4) }],
  secret: { name: 'The Splash', zone: 'tank', hint: 'Skim the dunk tank and the clown gets wet.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 10, y: 100 },
    { x: -6, y: 204 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'bigtop', x: TENT.x, y: TENT.y, scale: TENT.r },
    { kind: 'booth', x: -96, y: 60, rot: Math.PI / 2, scale: 18 },
    { kind: 'booth', x: -96, y: 160, rot: Math.PI / 2, scale: 16 },
    { kind: 'ferris', x: 160, y: 260, rot: 0.6 },
  ],
};
