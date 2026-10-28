// Hole 4, The Plunge (par 3, about 230 ft across and 50 ft down, about 170 yd as shown): you tee off on the rim of the
// volcano and hit across the crater to a green on the far side of the lava lake, under the far wall. It plays well
// short of its length: the drop does a lot of the work. Short is the lake. Long is worse: a flow of lava runs along the
// foot of the far wall right behind the green, so you can't just bomb it at the back wall and let it come down.
// Lava fountains spew from the lake.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const C = { x: 0, y: 200 }; // the crater's centre
const RIM = 62; // the rim, and the tee on it
const BOWL = 6; // the crater floor, under the lava
const LAVA = 12;
// the green: a big shelf of turf on the far side of the lake, at the foot of the far wall
const GREEN = { x: 0, y: 274, r: 24 };
const SHELF = LAVA + 3.2;
// the flow: a channel of lava along the foot of the far wall, right behind the green
const FLOW: V2[] = [
  { x: -38, y: 290 },
  { x: -20, y: 302 },
  { x: 0, y: 306 },
  { x: 20, y: 302 },
  { x: 38, y: 290 },
];

const rocks: Post[] = [
  [-40, 6, 3.2], [44, 10, 3], [-150, 200, 3.6], [150, 220, 3.4], [-90, 360, 3], [96, 350, 3.2],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const lavalift: Hole = {
  id: 'lavalift',
  name: 'The Plunge',
  par: 3,
  theme: 'volcanic',
  tour: true,
  noCart: true,
  tee: { x: 0, y: 55 },
  cup: { x: 2, y: 276 },
  pins: [{ x: 2, y: 276 }, { x: -10, y: 266 }, { x: 12, y: 268 }, { x: -4, y: 286 }],
  aim: 0,
  bounds: { x0: -200, y0: -40, x1: 200, y1: 400 },
  border: [
    { x: -196, y: -36 },
    { x: 196, y: -36 },
    { x: 196, y: 396 },
    { x: -196, y: 396 },
  ],
  base: 'rock',
  regions: [
    { poly: blob(0, 55, 20, 14, 1, 0.1), surface: 'rough' },
    { poly: rect(-12, 45, 12, 65), surface: 'fairway' },
    // the green's shelf: a skirt of rough at the water's edge, a ring of fringe, the green
    { poly: blob(GREEN.x, GREEN.y + 4, GREEN.r + 12, GREEN.r + 10, 4, 0.08), surface: 'rough' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 4, GREEN.r + 3.5, 3, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r * 0.88, 3, 0.05), surface: 'green' },
    // a pot bunker short right, where the bailout goes
    { poly: blob(GREEN.x + 24, GREEN.y - 18, 6, 4.5, 9, 0.15), surface: 'sand' },
  ],
  water: [
    // the lava lake fills the floor of the crater, and breathes
    { poly: circle(C.x, C.y, 128, 40), level: LAVA, look: 'lava', tide: { amp: 1.1, period: 9 } },
    // the flow behind the green
    { poly: band(FLOW, 5), level: SHELF - 1.5, look: 'lava', tide: { amp: 0.4, period: 5 } },
  ],
  terrain: [
    // the outer slopes of the volcano, up to the rim
    { kind: 'ramp', x0: -200, y0: -40, x1: 200, y1: 400, axis: 'y', h0: RIM - 44, h1: RIM - 44, op: 'set' },
    { kind: 'disc', x: C.x, y: C.y, r: 196, h: RIM, edge: 54, op: 'set' },
    // the crater: a steep bowl down to the lake
    { kind: 'disc', x: C.x, y: C.y, r: 112, h: BOWL, edge: 34, op: 'set' },
    // the tee: a flat shelf on the rim
    { kind: 'disc', x: 0, y: 55, r: 14, h: RIM + 0.5, edge: 6, op: 'set' },
    // the green's shelf, standing out of the lava at the foot of the far wall
    { kind: 'disc', x: GREEN.x, y: GREEN.y + 8, r: GREEN.r + 18, h: SHELF, edge: 14, op: 'set' },
    // the green: dished a little so a ball that lands on it tends to stay, and tilted toward the lake
    { kind: 'hill', x: GREEN.x, y: GREEN.y, r: GREEN.r + 2, h: -0.7 },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.4, h1: 0.4, op: 'add' },
    { kind: 'disc', x: GREEN.x + 24, y: GREEN.y - 18, r: 6, h: -1, edge: 2, op: 'add' },
    // the flow, cut into the shelf's back edge below the lava
    { kind: 'channel', pts: FLOW, width: 5, depth: 5 },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: 10 },
    { x: 0, y: 150 },
    { x: 0, y: 274 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 55 },
    { kind: 'sign', x: 18, y: 47, rot: 0 },
    // lava spewing from the lake
    { kind: 'lavafount', x: -40, y: 200, scale: 1.1 },
    { kind: 'lavafount', x: 44, y: 172, scale: 0.9 },
    { kind: 'lavafount', x: 30, y: 236, scale: 1 },
    { kind: 'lavafount', x: -86, y: 222, scale: 0.8 },
    { kind: 'lavafount', x: 90, y: 196, scale: 0.8 },
  ],
};
