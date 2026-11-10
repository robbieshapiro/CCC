// Hole 2, Millennium Park (par 3, 180 yd): from the Great Lawn under the bandshell's trellis to a small green past
// Cloud Gate. The Bean sits short right of the green on its plaza (hit it and it'll send you anywhere), the ice rink
// is short left (a ball skates on it), and the towers of Michigan Avenue stand along the left, in play.
// The play: a mid iron at the left half of the green, over the plaza.
// The secret: the plaza. Pitch it onto the stone just left of the Bean and it skips up onto the green.
import { blob, circle, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { building } from '../../looks/chicago';
import { CHI_TURF, chiGreen } from './common';

const LAND = 8;
const GREEN = { x: 6, y: 256, rx: 18, ry: 13 };
const traps = [greenside(GREEN, 40, 262, 8, 7, 1, 3, 0), greenside(GREEN, 4, 286, 10, 5, 2, 3, 0)];
const BEAN = { x: 30, y: 206 };
const PLAZA = blob(BEAN.x, BEAN.y, 30, 22, 4, 0.08);
const RINK = blob(-40, 176, 24, 15, 5, 0.04);
const LANE = rect(-8, 196, 10, 226);
// Michigan Avenue: the street wall on the left
const AVE = [
  [-110, 40, 50, 60, 300],
  [-110, 120, 50, 80, 420],
  [-112, 210, 54, 70, 260],
  [-110, 300, 50, 90, 380],
].map(([x, y, w, d, h], i) => building(x, y, w, d, h, i + 20));

// the Crown Fountain's reflecting pool, short and left of the green: a thin sheet of water on black granite
const POOL = rect(-44, 214, 2, 236);

const posts: Post[] = [
  // maples along the Michigan Avenue edge and behind the green
  ...[[-62, 60], [-60, 130], [-58, 270], [52, 300], [-30, 312], [64, 200], [60, 90]].map(([x, y], i) => ({ x, y, r: 6, h: 22 + (i % 3) * 4, soft: true, look: 'maple' as const })),
  { x: BEAN.x, y: BEAN.y, r: 13, h: 15, look: 'tower' },
  ...[[-70, 20], [-70, 120], [-70, 220], [60, 40], [60, 140]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const })),
];

export const millennium: Hole = {
  id: 'millennium',
  name: 'Millennium Park',
  par: 3,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  yards: 180,
  blurb: 'Over the plaza to a small green past the Bean. The fountain pool short left, the rink beyond it, Michigan Avenue left.',
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 258 },
  pins: [{ x: 6, y: 258 }, { x: -6, y: 250 }, { x: 16, y: 262 }, { x: 2, y: 266 }],
  aim: 0.01,
  bounds: { x0: -150, y0: -50, x1: 120, y1: 360 },
  border: [
    { x: -84, y: -46 },
    { x: 80, y: -46 },
    { x: 80, y: 330 },
    { x: -84, y: 330 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the Great Lawn round the tee, then the plaza, the rink and the walks
    { poly: blob(0, 60, 50, 50, 1, 0.05), surface: 'fairway' },
    { poly: PLAZA, surface: 'stone' },
    { poly: RINK, surface: 'stone' },
    { poly: rect(-74, -40, -66, 320), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: POOL, level: 8 - 0.4 }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 120, y1: 360, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: LAND + 1.5, edge: 8, op: 'set' },
    // the rink is sunk a little; the plaza rises gently to the green
    { kind: 'disc', x: -40, y: 176, r: 26, h: LAND - 1.2, edge: 4, op: 'set' },
    { kind: 'ramp', x0: -10, y0: 186, x1: 60, y1: 236, axis: 'y', h0: 0, h1: 0.8, op: 'add' },
    // the pool, sunk a few inches into the plaza
    { kind: 'box', x0: -44, y0: 214, x1: 2, y1: 236, h: -1.2, edge: 0.6, op: 'add' },
    ...chiGreen(GREEN, LAND, [0.4, 0.6], [[-6, -4, 6, 0.2], [8, 5, 5, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: AVE.flatMap((b) => b.walls),
  roofs: AVE.map((b) => b.roof),
  posts,
  movers: [],
  pushes: [],
  zones: [{ id: 'plaza', poly: LANE }],
  secret: { name: 'The Plaza', zone: 'plaza', hint: 'Just left of the Bean the stone runs straight up to the green. Pitch it there and let it skip.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 30, y: 120 },
    { x: 20, y: 210 },
    { x: 6, y: 256 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'bean', x: BEAN.x, y: BEAN.y, rot: 0.3 },
    { kind: 'pritzker', x: 0, y: -120, rot: Math.PI },
    ...AVE.map((b) => b.decor),
    { kind: 'walkers', x: -70, y: 160, rot: Math.PI / 2, scale: 300, size: [10, 0, 0] },
    { kind: 'walkers', x: -40, y: 176, rot: 0, scale: 36, size: [5, 0, 0] },
    { kind: 'traffic', x: -150, y: 180, rot: Math.PI / 2, scale: 700, size: [12, 0, 0] },
    { kind: 'streetsign', x: -78, y: 0, rot: Math.PI / 2, label: 'MICHIGAN AV' },
    { kind: 'lake', x: 500, y: 0, rot: Math.PI / 2, scale: 8 },
    { kind: 'aon', x: 200, y: 520 },
    { kind: 'hancock', x: -300, y: 900 },
    { kind: 'willis', x: -900, y: 300 },
  ],
};
void circle;
