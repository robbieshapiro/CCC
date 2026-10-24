// Hole 3, The Caldera (par 3, about 175 ft across and 110 ft down): from the summit rim, down into the crater.
// The green sits on a rock island in a lake of lava. Short is lava, long is lava, and the drop makes everything fly.
// The play: a soft iron or a full wedge that comes down steep and stops. The green tips toward the lava on the right.
// The live hazards: fountains of lava go up out of the lake (scenery), and two steam vents on the island throw a
// rolling ball about when they go off.
// The secret: the spiral road. A cinder road leaves the tee on the left, winds down the inside of the crater wall and
// runs out along a causeway to the island. Putt one down it.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const C = { x: 0, y: 200 }; // the middle of the crater
const RIM = 125; // the summit rim
const FLOOR = 4; // the crater floor, under the lava
const LAVA = 7;
const ISLAND = { x: 0, y: 194, r: 34, h: 13 };
const GREEN = { x: 0, y: 196, r: 18 };

// the spiral road: round the inside of the crater wall from the tee, curling in at the foot onto a causeway across
// the lava to the island. Sampled every few feet so it's one smooth curve, and graded evenly along its length.
const curve: V2[] = [];
for (let k = 0; k <= 1.0001; k += 1 / 40) {
  const a = (-97 - 78 * k) * (Math.PI / 180);
  const r = 158 - 42 * k;
  curve.push({ x: C.x + Math.cos(a) * r, y: C.y + Math.sin(a) * r });
}
// at the foot it's heading north along the wall: a wide right-hand bend swings it round until it points at the
// island, then it runs straight out along the causeway
const foot = curve[curve.length - 1];
const BEND = 30;
const bend: V2[] = [];
for (let t = Math.PI - 0.12; t > 0; t -= 0.12) {
  const p = { x: foot.x + BEND + Math.cos(t) * BEND, y: foot.y + Math.sin(t) * BEND };
  bend.push(p);
  const heading = Math.atan2(-Math.cos(t), Math.sin(t)); // clockwise round the bend
  const toIsland = Math.atan2(ISLAND.y - p.y, ISLAND.x - p.x);
  if (Math.abs(heading - toIsland) < 0.06) break;
}
const out = bend[bend.length - 1];
const reach = Math.hypot(ISLAND.x - out.x, ISLAND.y - out.y) - ISLAND.r + 6;
const causeway: V2[] = [
  ...bend,
  ...[1, 2, 3, 4].map((i) => ({ x: out.x + ((ISLAND.x - out.x) * reach * i) / 4 / Math.hypot(ISLAND.x - out.x, ISLAND.y - out.y), y: out.y + ((ISLAND.y - out.y) * reach * i) / 4 / Math.hypot(ISLAND.x - out.x, ISLAND.y - out.y) })),
];
const road = [...curve, ...causeway];
const along: number[] = [0];
for (let i = 1; i < curve.length; i++) along.push(along[i - 1] + Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y));
// down the wall at an even grade, still falling gently round the bend at the foot, then flat along the causeway
const BEND_TOP = 21;
const grade = [
  ...along.map((d) => RIM - 1 - (RIM - 1 - BEND_TOP) * (d / along[along.length - 1])),
  ...bend.map((_, i) => BEND_TOP - (BEND_TOP - ISLAND.h - 0.5) * ((i + 1) / bend.length)),
  ...causeway.slice(bend.length).map(() => ISLAND.h),
];

const vent = (id: string, x: number, y: number, period: number, phase: number, side: number) => ({
  id,
  look: 'geyser' as const,
  x,
  y,
  r: 4,
  at: () => ({ x: 0, y: 0 }),
  erupt: (t: number) => ((t + phase) % period > period - 1.4 ? { x: side * 10, y: 4, z: 16 } : null),
});

// boulders round the rim
const rocks: Post[] = [
  [40, 36, 3.4], [-44, 30, 3], [150, 120, 4], [-160, 300, 3.6], [120, 330, 3.2], [0, 404, 3.8],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const caldera: Hole = {
  id: 'caldera',
  name: 'The Caldera',
  par: 3,
  theme: 'volcanic',
  tour: true,
  maxTime: 40, // the spiral road is a long way down
  tee: { x: 0, y: 40 },
  cup: { x: 2, y: 196 },
  pins: [{ x: 2, y: 196 }, { x: -8, y: 188 }, { x: 8, y: 204 }, { x: -4, y: 206 }],
  aim: 0,
  bounds: { x0: -240, y0: -40, x1: 240, y1: 440 },
  border: [
    { x: -236, y: -36 },
    { x: 236, y: -36 },
    { x: 236, y: 436 },
    { x: -236, y: 436 },
  ],
  base: 'rock',
  regions: [
    { poly: rect(-14, 28, 14, 52), surface: 'fairway' },
    { poly: band(road, 6), surface: 'cinder' },
    // the causeway is smooth cooled lava: it runs
    { poly: band(causeway, 6), surface: 'path' },
    // the island: rough rock round the edge, then fringe and the green
    { poly: blob(ISLAND.x, ISLAND.y, ISLAND.r - 2, ISLAND.r - 4, 2, 0.08), surface: 'rough' },
    // where the causeway lands on the island it's mown, so a ball off the road runs on to the green
    { poly: band([causeway[causeway.length - 2], { x: GREEN.x - GREEN.r + 2, y: GREEN.y }], 6), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 5, GREEN.r + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r - 1, 3, 0.06), surface: 'green' },
    { poly: blob(-14, 218, 6, 4, 4, 0.15), surface: 'sand' },
  ],
  water: [
    // the lava lake fills the crater floor, swelling and settling
    { poly: circle(C.x, C.y, 116, 40), level: LAVA, look: 'lava', tide: { amp: 0.5, period: 9 } },
  ],
  terrain: [
    // the outer flanks of the volcano
    { kind: 'ramp', x0: -240, y0: -40, x1: 240, y1: 440, axis: 'y', h0: 70, h1: 70, op: 'set' },
    // the summit: a broad rim all round the crater
    { kind: 'disc', x: C.x, y: C.y, r: 210, h: RIM, edge: 45, op: 'set' },
    // the crater: steep walls down to a flat floor
    { kind: 'disc', x: C.x, y: C.y, r: 168, h: FLOOR, edge: 52, op: 'set' },
    // the tee: a flat pad right on the lip
    { kind: 'disc', x: 0, y: 40, r: 16, h: RIM + 1, edge: 8, op: 'set' },
    // the spiral road, cut into the wall as a shelf
    { kind: 'embankment', pts: road, h: grade, width: 10, edge: 10 },
    // the island in the lava
    { kind: 'disc', x: ISLAND.x, y: ISLAND.y, r: ISLAND.r, h: ISLAND.h, edge: 8, op: 'set' },
    // the green tips toward the lava on the right
    { kind: 'ramp', x0: GREEN.x - 26, y0: GREEN.y - 26, x1: GREEN.x + 26, y1: GREEN.y + 26, axis: 'x', h0: 0.5, h1: -0.5, op: 'add' },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y + 6, r: 10, h: 0.4 },
    // bunker
    { kind: 'disc', x: -14, y: 218, r: 6, h: -1.1, edge: 3, op: 'add' },
    // the road is sunk in a groove, so a ball on it stays on it; the groove runs out at the island
    { kind: 'channel', pts: road, width: 7, depth: 3, taper: 45 },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [vent('west', -26, 180, 6, 0, -1), vent('east', 26, 210, 7.5, 2.5, 1)],
  zones: [{ id: 'rimroad', poly: band([...curve.slice(24), ...causeway.slice(0, 2)], 3.4) }],
  secret: {
    name: 'The Spiral Road',
    zone: 'rimroad',
    hint: 'A cinder road leaves the tee on the left and winds all the way down to the lava. There is a causeway at the bottom.',
  },
  flyover: [
    { x: 0, y: -20 },
    { x: 60, y: 90 },
    { x: 40, y: 200 },
    { x: 2, y: 196 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 40 },
    { kind: 'sign', x: 20, y: 30, rot: 0 },
    { kind: 'bench', x: -22, y: 26, rot: 0 },
    { kind: 'lavafount', x: -64, y: 160, scale: 1.2 },
    { kind: 'lavafount', x: 70, y: 236, scale: 1 },
    { kind: 'lavafount', x: 24, y: 290, scale: 1.4 },
    { kind: 'lavafount', x: -50, y: 270, scale: 0.8 },
  ],
};
