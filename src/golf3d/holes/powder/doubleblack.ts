// Hole 7, The Double Black (par 4, 460 yd as shown), the hard one (rebuilt Nov 24, Robbie: "make it straight, very
// very steep"). Straight down the fall line from the top of the expert chute, 150 ft down a gully between dark rock
// walls, packed with firs and moguls. The cut fairway zig-zags across the gully in five legs, left, right, left, right,
// and two mountain creeks cross it, the second right in front of the green. A moose or two by the water.
// The play: a wood onto the first or second leg, then pick your way down the zig-zag. The line straight down is shorter
// but through the trees and the moguls.
// The bail-out: there isn't one. Off the gully is over the rock walls (out of bounds where it lands).
// The secret: the Patrol Line. Ski patrol keep a lane cut straight down the right of the gully, through the trees, for
// the sleds. A low runner onto it from the top rides all the way down to the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_PLAY, POWDER_TURF, firs, moguls, profile } from './common';

const TOP = 172;
// the gully: its walls at x = ±WALL
const WALL = 66;
const GREEN = { x: 0, y: 652, rx: 18, ry: 15 };
// the zig-zag: five legs across the gully, all the way down
const ZIG: V2[] = [
  { x: 0, y: 120 },
  { x: -38, y: 210 },
  { x: 36, y: 310 },
  { x: -36, y: 420 },
  { x: 32, y: 515 },
  { x: 0, y: 600 },
];
const LEG = 14;
// the patrol line: straight down the right of the gully, then round to the green
const LINE: V2[] = [
  { x: 54, y: 150 },
  { x: 54, y: 590 },
  { x: 30, y: 632 },
  { x: 16, y: 644 },
];
// the creeks across the gully, each on a little terrace, with a snow bridge where the fairway crosses
const CREEK1_Y = 366;
const CREEK2_Y = 617;
// (and another for the patrol line)
const CREEK1: V2[][] = [
  [{ x: -WALL - 4, y: CREEK1_Y }, { x: -10, y: CREEK1_Y + 2 }],
  [{ x: 14, y: CREEK1_Y + 2 }, { x: 47, y: CREEK1_Y + 1 }],
  [{ x: 61, y: CREEK1_Y + 1 }, { x: WALL + 4, y: CREEK1_Y }],
];
const CREEK2: V2[][] = [
  [{ x: -WALL - 4, y: CREEK2_Y }, { x: -10, y: CREEK2_Y + 1 }],
  [{ x: 8, y: CREEK2_Y + 1 }, { x: 30, y: CREEK2_Y + 1 }],
  [{ x: 46, y: CREEK2_Y + 1 }, { x: WALL + 4, y: CREEK2_Y }],
];
// the ground down the gully: off the lip of the tee, then 1 in 4 (Nov 24: any steeper and nothing stops on it), a terrace for the first creek, very steep again, and
// out onto a bench for the green
const PROFILE: [number, number][] = [
  [-50, TOP],
  [20, TOP],
  [100, 141],
  [350, 81],
  [384, 78],
  [590, 29],
  [632, 25],
  [740, 24],
];
const groundAt = (y: number) => {
  for (let i = 1; i < PROFILE.length; i++)
    if (y <= PROFILE[i][0]) {
      const [y0, h0] = PROFILE[i - 1];
      const [y1, h1] = PROFILE[i];
      return h0 + ((h1 - h0) * (y - y0)) / (y1 - y0);
    }
  return PROFILE[PROFILE.length - 1][1];
};
const segD = (p: V2, a: V2, b: V2) => {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
};
const near = (p: V2, pts: V2[]) => Math.min(...pts.slice(1).map((b, i) => segD(p, pts[i], b)));
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
// the firs: thick through the gully, everywhere off the zig-zag and the patrol line
const forest: Post[] = [];
for (let y = 140, row = 0; y <= 600; y += 13, row++)
  for (let x = -WALL + 5 + (row % 2 ? 6 : 0); x <= WALL - 5; x += 13) {
    const p = { x: x + (hash(x, y) - 0.5) * 8, y: y + (hash(y, x) - 0.5) * 8 };
    if (near(p, ZIG) < LEG + 4 || near(p, LINE) < 6) continue;
    if (Math.abs(p.y - CREEK1_Y) < 12 || Math.abs(p.y - CREEK2_Y) < 12) continue;
    if (hash(x * 3, y * 7) < 0.12) continue;
    const h = 20 + Math.round(hash(x * 5, y) * 18);
    forest.push({ x: p.x, y: p.y, r: Math.max(4, Math.round(h * 0.24)), h, soft: true, look: 'snowpine' });
  }
const traps = [greenside(GREEN, -20, 660, 7, 7, 2, 3.4, 0), greenside(GREEN, 18, 668, 8, 6, 3, 3.4, 0.3)];

export const doubleblack: Hole = {
  id: 'doubleblack',
  name: 'The Double Black',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  ...POWDER_PLAY,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.22,
  // out of bounds where it comes down, not where it flies
  obWhenLanding: true,
  // over the walls is dark rock, not snow (Nov 24, Robbie)
  outside: '#34393e',
  yards: 460,
  blurb: 'Double black. Straight down a gully, 150 feet, between rock walls. The fairway zig-zags through the firs and moguls, over two creeks.',
  teeTip: 'A wood onto the zig-zag. Straight down is shorter, through the trees. Off the gully is out.',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 655 },
  pins: [{ x: 0, y: 655 }, { x: -9, y: 648 }, { x: 10, y: 658 }, { x: 3, y: 663 }],
  aim: -0.03, // down the gully
  bounds: { x0: -150, y0: -50, x1: 150, y1: 740 },
  border: [
    { x: -40, y: -46 },
    { x: 40, y: -46 },
    { x: 40, y: 40 },
    { x: WALL, y: 70 },
    { x: WALL, y: 736 },
    { x: -WALL, y: 736 },
    { x: -WALL, y: 70 },
    { x: -40, y: 40 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the zig-zag
    { poly: band(ZIG, LEG), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the patrol line: groomed for the sleds (it plays as a path)
    { poly: band(LINE, 3.5), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [...CREEK1.map((c) => ({ poly: band(c, 6), level: groundAt(CREEK1_Y) - 2.2, look: 'lake' as const })),
    ...CREEK2.map((c) => ({ poly: band(c, 6), level: groundAt(CREEK2_Y) - 2.2, look: 'lake' as const }))],
  terrain: [
    ...profile(-150, 150, PROFILE),
    { kind: 'disc', x: 0, y: 0, r: 15, h: TOP + 1, edge: 10, op: 'set' },
    // the rock walls either side of the gully
    { kind: 'ramp', x0: WALL - 2, y0: -50, x1: 150, y1: 740, axis: 'x', h0: 0, h1: 70, op: 'add' },
    { kind: 'ramp', x0: -150, y0: -50, x1: -WALL + 2, y1: 740, axis: 'x', h0: 70, h1: 0, op: 'add' },
    // moguls, big and tight, the whole way down
    // (not on the patrol line: the groomers keep it smooth)
    ...[...moguls(-WALL + 8, WALL - 8, 140, 340, 2.2, 13), ...moguls(-WALL + 8, WALL - 8, 395, 595, 2.4, 13)].filter((m) => near(m, LINE) > 9),
    ...[...CREEK1, ...CREEK2].map((c) => ({ kind: 'channel' as const, pts: c, width: 14, depth: 4 })),
    // the patrol line is pressed smooth and a touch low, so a ball on it keeps to it
    { kind: 'channel', pts: LINE, width: 7, depth: 1.2 },
    ...greenComplex(GREEN, groundAt(GREEN.y), { lift: 0.3, edge: 16, tilt: slope(GREEN, 16, [0.3, -0.9], 1.8), rolls: [[-8, 6, 9, 0.3], [9, -4, 8, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...forest, ...firs([{ x: -40, y: 690 }, { x: -60, y: 730 }], 20, 'db-gl', 1), ...firs([{ x: 40, y: 690 }, { x: 60, y: 730 }], 20, 'db-gr', -1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'patrolline', poly: band(LINE.slice(0, 2), 3.5) }],
  secret: { name: 'The Patrol Line', zone: 'patrolline', hint: 'Ski patrol keep a lane cut straight down the right of the gully, through the trees. A low runner onto it rides all the way down.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 260 },
    { x: 0, y: 520 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'double' },
    { kind: 'patrolhut', x: 34, y: -30, rot: -0.6 },
    // moose by the creeks
    { kind: 'moose', x: -48, y: CREEK1_Y + 10, rot: 0.6 },
    { kind: 'moose', x: 44, y: CREEK2_Y - 10, rot: -2.2 },
    // broken rock along the foot of the walls
    ...[90, 170, 250, 330, 410, 490, 570, 650].flatMap((y, i) => [
      { kind: 'rock', x: WALL + 3, y: y + (i % 2) * 14, scale: 3 + (i % 3) },
      { kind: 'rock', x: -WALL - 3, y: y + 30 + (i % 2) * 10, scale: 3 + ((i + 1) % 3) },
    ]),
  ],
};
