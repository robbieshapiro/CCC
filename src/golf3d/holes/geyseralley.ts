// Hole 5, Geyser Alley (par 4, about 390 ft): a narrow, crowned fairway between two lines of steaming vents.
// The play: find the fairway. It's crowned, so a ball that lands on a shoulder runs off into the black ash either
// side. The green sits down in a hollow at the end, with steam drifting across it. The vents are only steam.
// The secret: the ash road. A cinder track runs behind the left-hand vents and down into the hollow; a drive that
// finds it runs a long way.
import { band, blob, rect } from '../terrain';
import type { Decor, Hole, Post, V2 } from '../types';

const TOP = 20;
const GREEN = { x: 6, y: 384, rx: 20, ry: 22 };

const way: V2[] = [
  { x: 0, y: 14 },
  { x: 4, y: 140 },
  { x: -4, y: 260 },
  { x: 4, y: 340 },
  { x: 6, y: 364 },
];
// the ash road: off the left of the fairway behind the vents, down into the hollow by the green
const road: V2[] = [
  { x: -46, y: 120 },
  { x: -52, y: 200 },
  { x: -50, y: 280 },
  { x: -36, y: 340 },
  { x: -18, y: 372 },
];
const roadH = road.map((_, i) => TOP - (i / (road.length - 1)) * 7);

// the vents: two lines either side of the fairway
const vents: Decor[] = [];
for (let y = 80; y <= 320; y += 40) {
  vents.push({ kind: 'steamvent', x: -34 + (y % 80 ? 3 : -3), y });
  vents.push({ kind: 'steamvent', x: 36 + (y % 80 ? -3 : 3), y: y + 20 });
}

const rocks: Post[] = [
  [-80, 40, 3.2], [80, 60, 3], [-90, 250, 3.6], [90, 300, 3.4], [-70, 420, 3], [70, 430, 3.2],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const geyseralley: Hole = {
  id: 'geyseralley',
  name: 'Geyser Alley',
  par: 4,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 390 },
  pins: [{ x: 8, y: 390 }, { x: -4, y: 378 }, { x: 16, y: 396 }, { x: 2, y: 400 }],
  aim: 0,
  bounds: { x0: -120, y0: -40, x1: 120, y1: 460 },
  border: [
    { x: -116, y: -36 },
    { x: 116, y: -36 },
    { x: 116, y: 456 },
    { x: -116, y: 456 },
  ],
  base: 'rock',
  regions: [
    // black ash either side: a long waste bunker down each flank
    { poly: band(way, 44), surface: 'sand' },
    { poly: band(way, 22), surface: 'fringe' },
    { poly: band(way, 17), surface: 'fairway' },
    { poly: band(road, 4), surface: 'path' },
    { poly: blob(0, 0, 26, 20, 1, 0.1), surface: 'rough' },
    { poly: rect(-12, -10, 12, 10), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 8, GREEN.ry + 8, 2, 0.08), surface: 'rough' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    { poly: blob(36, 370, 7, 5, 4, 0.15), surface: 'sand' },
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -40, x1: 120, y1: 460, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    // the ridges the vents stand on, either side
    { kind: 'embankment', pts: way.map((p) => ({ x: p.x - 36, y: p.y })), h: way.map(() => TOP + 3), width: 4, edge: 10 },
    { kind: 'embankment', pts: way.map((p) => ({ x: p.x + 38, y: p.y })), h: way.map(() => TOP + 3), width: 4, edge: 10 },
    // the crown down the middle of the fairway: anything on a shoulder runs off
    { kind: 'embankment', pts: way, h: way.map(() => TOP + 1.6), width: 2, edge: 18 },
    // the hollow the green sits in
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 26, h: TOP - 7, edge: 22, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: 0.5, h1: -0.5, op: 'add' },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y + 8, r: 12, h: 0.5 },
    // the ash road, falling gently to the hollow
    { kind: 'embankment', pts: road, h: roadH, width: 4, edge: 8 },
    { kind: 'channel', pts: road, width: 4, depth: 0.8, taper: 24 },
    { kind: 'disc', x: 36, y: 370, r: 7, h: -1.1, edge: 3, op: 'add' },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  zones: [{ id: 'ashroad', poly: band(road.slice(1, 4), 3.4) }],
  secret: { name: 'The Ash Road', zone: 'ashroad', hint: 'There is a cinder road behind the vents on the left. It runs all the way down to the green.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 180 },
    { x: 8, y: 390 },
  ],
  decor: [{ kind: 'teebox', x: 0, y: 0 }, { kind: 'sign', x: 20, y: -10, rot: 0 }, ...vents, { kind: 'steamvent', x: 40, y: 400 }],
};
