// Hole 4, The Plunge (par 3, about 150 ft down, 110 yd as shown): you tee off on the rim of the volcano and hit down
// into the crater: it plays about half its length, the drop does the rest. The green is a big, dished island in the
// lava lake at the bottom; miss it and it's lava, unless you find
// one of the little rock islands round it, which have traps of their own. Lava fountains spew from the lake.
// The tunnel: on the far wall of the crater there's a shelf with a hole in it. Roll one into the hole and it drops
// down an old lava tube and rolls out beside the green, a few feet from the pin. Never an ace, always a gift.
import { blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const C = { x: 0, y: 200 }; // the crater's centre
const RIM = 62; // the rim, and the tee on it
const BOWL = 6; // the crater floor, under the lava
const LAVA = 12;
const GREEN = { x: 10, y: 206, r: 22 };
// the little islands round the green: somewhere to bail out to, each with its trap
const ISLES = [
  { x: -70, y: 160, r: 20 },
  { x: 80, y: 238, r: 18 },
  { x: -50, y: 278, r: 15 },
];
// the shelf on the far wall, and the hole in it
const SHELF = { x: 0, y: 316, r: 16, h: 34 };
const MOUTH = { x: 0, y: 324, r: 2.6 };
// where the tunnel lets the ball out: on the green, a short putt from the pin
const OUT: V2 = { x: 4, y: 200 };

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
  cup: { x: 12, y: 208 },
  pins: [{ x: 12, y: 208 }, { x: 2, y: 198 }, { x: 20, y: 200 }, { x: 6, y: 218 }],
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
    // the islands: a skirt of rough, turf on top, and a trap
    ...ISLES.flatMap((s, i) => [
      { poly: blob(s.x, s.y, s.r, s.r * 0.85, 10 + i, 0.1), surface: 'rough' as const },
      { poly: blob(s.x, s.y, s.r - 4, (s.r - 4) * 0.85, 10 + i, 0.1), surface: 'fairway' as const },
      { poly: blob(s.x + (i % 2 ? -5 : 5), s.y + 3, 4, 3, 20 + i, 0.15), surface: 'sand' as const },
    ]),
    // the green island: a ring of fringe round a big green
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 3.5), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r * 0.9, 3, 0.05), surface: 'green' },
    // the shelf on the far wall
    { poly: circle(SHELF.x, SHELF.y, SHELF.r), surface: 'path' },
  ],
  water: [
    // the lava lake fills the floor of the crater, and breathes
    { poly: circle(C.x, C.y, 128, 40), level: LAVA, look: 'lava', tide: { amp: 1.1, period: 9 } },
  ],
  terrain: [
    // the outer slopes of the volcano, up to the rim
    { kind: 'ramp', x0: -200, y0: -40, x1: 200, y1: 400, axis: 'y', h0: RIM - 44, h1: RIM - 44, op: 'set' },
    { kind: 'disc', x: C.x, y: C.y, r: 196, h: RIM, edge: 54, op: 'set' },
    // the crater: a steep bowl down to the lake
    { kind: 'disc', x: C.x, y: C.y, r: 112, h: BOWL, edge: 34, op: 'set' },
    // the tee: a flat shelf on the rim
    { kind: 'disc', x: 0, y: 55, r: 14, h: RIM + 0.5, edge: 6, op: 'set' },
    // the islands, standing up out of the lava
    ...ISLES.map((s) => ({ kind: 'disc' as const, x: s.x, y: s.y, r: s.r - 2, h: LAVA + 3, edge: 3, op: 'set' as const })),
    ...ISLES.map((s, i) => ({ kind: 'disc' as const, x: s.x + (i % 2 ? -5 : 5), y: s.y + 3, r: 4, h: -0.9, edge: 2, op: 'add' as const })),
    // the green island: flat and small, just clear of the lava
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 2.5, h: LAVA + 3.2, edge: 2.5, op: 'set' },
    // dished, with a lip round it, so a ball that lands on it stays on it more often than not
    { kind: 'hill', x: GREEN.x, y: GREEN.y, r: GREEN.r + 1, h: -0.9 },
    { kind: 'ramp', x0: GREEN.x - 24, y0: GREEN.y - 24, x1: GREEN.x + 24, y1: GREEN.y + 24, axis: 'x', h0: 0.3, h1: -0.3, op: 'add' },
    { kind: 'hill', x: GREEN.x - 9, y: GREEN.y + 8, r: 8, h: 0.35 },
    // the shelf on the far wall, dished toward the hole in it so a ball that reaches it finds its way in
    { kind: 'disc', x: SHELF.x, y: SHELF.y, r: SHELF.r, h: SHELF.h, edge: 4, op: 'set' },
    { kind: 'hill', x: MOUTH.x, y: MOUTH.y, r: SHELF.r + 2, h: -3.5 },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  portals: [{ id: 'tunnel', x: MOUTH.x, y: MOUTH.y, r: MOUTH.r, to: OUT, delay: 1.6 }],
  zones: [{ id: 'tunnel', poly: circle(MOUTH.x, MOUTH.y, MOUTH.r) }],
  secret: { name: 'The Tunnel', zone: 'tunnel', hint: 'There is a hole in the far wall of the crater. They say an old lava tube runs from it to the green.' },
  flyover: [
    { x: 0, y: 10 },
    { x: 0, y: 120 },
    { x: 10, y: 206 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 55 },
    { kind: 'sign', x: 18, y: 47, rot: 0 },
    // lava spewing from the lake
    { kind: 'lavafount', x: -30, y: 214, scale: 1.1 },
    { kind: 'lavafount', x: 44, y: 172, scale: 0.9 },
    { kind: 'lavafount', x: 26, y: 262, scale: 1 },
    { kind: 'lavafount', x: -86, y: 222, scale: 0.8 },
    { kind: 'lavafount', x: 90, y: 196, scale: 0.8 },
  ],
};
