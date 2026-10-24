// Hole 3, The Caldera (par 3, about 185 ft): from a shoulder of the volcano, across a lava gully, to a green on the crater rim.
// The play: a high iron that holds. The green is crowned, so a ball that lands on the edges runs off.
// Long is the crater (and the lava lake at the bottom of it). Short catches the false front and rolls back into the gully.
// The live hazard: steam vents either side of the green go off on the hole clock and throw a rolling ball about.
// The secret: the rim road. Roll one off the tee down the old road round the crater and it feeds in from the back.
import { band, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: 0, y: 186, r: 19 };
const CRATER = { x: 0, y: 330, r: 118 };
const RIM = 44; // the height of the crater rim at the green

// the rim road: off the left of the tee, along a lava ridge round the outside of the gully, onto the rim and in to the back of the green
const road: V2[] = [
  { x: -12, y: 8 },
  { x: -30, y: 18 },
  { x: -50, y: 34 },
  { x: -68, y: 54 },
  { x: -84, y: 78 },
  { x: -96, y: 106 },
  { x: -102, y: 136 },
  { x: -102, y: 166 },
  { x: -94, y: 192 },
  { x: -78, y: 208 },
  { x: -58, y: 214 },
  { x: -38, y: 208 },
  { x: -20, y: 200 },
];
// the ridge the road runs along falls steadily from the tee to the rim, so a ball on it keeps rolling
const grade = road.map((_, i) => 51.5 - (6.5 * i) / (road.length - 1));

const vent = (id: string, x: number, y: number, period: number, phase: number, side: number) => ({
  id,
  look: 'geyser' as const,
  x,
  y,
  r: 4,
  at: () => ({ x: 0, y: 0 }),
  erupt: (t: number) => ((t + phase) % period > period - 1.4 ? { x: side * 10, y: 4, z: 16 } : null),
});

const rocks: Post[] = [
  [40, 30, 3.4], [-60, -10, 3], [70, 130, 3.8], [-128, 60, 3.2], [100, 220, 3.6], [-40, 120, 2.6],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const caldera: Hole = {
  id: 'caldera',
  name: 'The Caldera',
  par: 3,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 2, y: 188 },
  pins: [{ x: 2, y: 188 }, { x: -8, y: 180 }, { x: 10, y: 194 }, { x: -6, y: 196 }],
  aim: 0,
  bounds: { x0: -150, y0: -40, x1: 150, y1: 460 },
  border: [
    { x: -146, y: -36 },
    { x: 146, y: -36 },
    { x: 146, y: 456 },
    { x: -146, y: 456 },
  ],
  base: 'rock',
  regions: [
    { poly: rect(-26, -24, 26, 22), surface: 'rough' },
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    // the approach and the apron in front of the green
    { poly: rect(-36, 130, 36, 172), surface: 'rough' },
    { poly: rect(-28, 150, 28, 172), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 5), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r), surface: 'green' },
    { poly: circle(-26, 172, 6), surface: 'sand' },
    { poly: circle(28, 176, 6), surface: 'sand' },
    { poly: band(road, 5), surface: 'path' },
  ],
  water: [
    // the gully: a creek of lava between the tee and the green, that dies out on the left where the road crosses
    { poly: rect(-66, 76, 146, 124), level: 18, look: 'lava' },
    // the lava lake at the bottom of the crater
    { poly: circle(CRATER.x, CRATER.y, 70, 32), level: 3, look: 'lava', tide: { amp: 0.6, period: 9 } },
  ],
  terrain: [
    // the flank of the volcano, rising toward the rim
    { kind: 'ramp', x0: -150, y0: -40, x1: 150, y1: 460, axis: 'y', h0: 30, h1: 30, op: 'set' },
    { kind: 'hill', x: CRATER.x, y: CRATER.y, r: 260, h: 26 },
    // the tee: a shoulder of the mountain above the gully
    { kind: 'disc', x: 0, y: 0, r: 40, h: 52, edge: 30, op: 'set' },
    // the gully
    { kind: 'box', x0: -70, y0: 60, x1: 150, y1: 140, h: -16, edge: 26, op: 'add' },
    { kind: 'embankment', pts: road, h: grade, width: 5, edge: 14 },
    // the crater: a bowl inside the rim, with the lava lake at the bottom
    { kind: 'disc', x: CRATER.x, y: CRATER.y, r: CRATER.r, h: 0, edge: 70, op: 'set' },
    // the green on the rim: crowned, with a false front that tips short shots back into the gully
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 9, h: RIM, edge: 9, op: 'set' },
    { kind: 'hill', x: GREEN.x + 2, y: GREEN.y + 1, r: GREEN.r + 4, h: 1.3 },
    { kind: 'hill', x: GREEN.x, y: GREEN.y - GREEN.r - 2, r: 10, h: -1 },
    // bunkers
    ...[[-26, 172, 6], [28, 176, 6]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
    // the road is sunk in a groove, so a ball on it stays on it; the groove runs out just before the green
    { kind: 'channel', pts: road, width: 6, depth: 1.6, taper: 30 },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [vent('west', -30, 196, 6, 0, -1), vent('east', 30, 192, 7.5, 2.5, 1)],
  zones: [{ id: 'rimroad', poly: band(road.slice(6, 11), 3.4) }],
  secret: { name: 'The Rim Road', zone: 'rimroad', hint: 'The old road leaves the tee on the left and goes the long way round the crater. Gravity does the rest.' },
  flyover: [
    { x: 0, y: -30 },
    { x: -60, y: 100 },
    { x: 0, y: 260 },
    { x: 2, y: 188 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'bench', x: -22, y: -14, rot: 0 },
  ],
};
