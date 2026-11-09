// Hole Lab: The Old Keep (par 4, 390 yd), links land on the west coast of Ireland. The sea all down the right, the
// fairway rumpled through the dunes, deep pot bunkers, gorse in flower, a dry-stone wall across the fairway, and a
// ruined castle on the headland behind the green. A fresh wind off the Atlantic every day.
// The play: a drive left of the pots, over the wall, then a bump and run onto a green that falls toward the sea.
// The secret: the Keep's shadow, a hollow short left of the green that feeds the ball down onto it.
import { band, blob, circle, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { bunker, greenComplex, greenside } from '../woods';

const GROUND = 8;
const GREEN = { x: 40, y: 520, rx: 22, ry: 18 };
const traps = [
  bunker(-6, 250, 7, 6, 1, 4, 0),
  bunker(26, 270, 6, 6, 2, 4, 0),
  bunker(-20, 400, 7, 5, 3, 4, 0.3),
  greenside(GREEN, 8, 496, 7, 6, 4, 4, 0),
  greenside(GREEN, 70, 540, 6, 7, 5, 4, 0),
];
const HOLLOW = { x: 6, y: 480, r: 14 };

const gorse: Post[] = [[-62, 60], [-70, 140], [-58, 220], [-74, 300], [-66, 380], [-60, 460], [-40, 560], [-80, 520], [20, 100], [-20, 330]].map(([x, y], i) => ({
  x,
  y,
  r: 2.2 + (i % 3) * 0.4,
  h: 3,
  soft: true,
  look: 'gorse' as const,
}));

export const oldkeep: Hole = {
  id: 'oldkeep',
  name: 'The Old Keep',
  par: 4,
  theme: 'linksland',
  tour: true,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.75,
  greenFirm: 0.07,
  yards: 390,
  blurb: 'Down the coast through the dunes, over the old wall, to a green under the castle. The sea runs the whole right.',
  tee: { x: 0, y: 0 },
  cup: { x: 40, y: 522 },
  pins: [{ x: 40, y: 522 }, { x: 26, y: 512 }, { x: 54, y: 526 }, { x: 36, y: 534 }],
  aim: 0.02,
  bounds: { x0: -120, y0: -50, x1: 200, y1: 620 },
  border: [
    { x: -116, y: -46 },
    { x: 196, y: -46 },
    { x: 196, y: 616 },
    { x: -116, y: 616 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(6, 260, 36, 200, 1, 0.08), surface: 'fairway' },
    { poly: blob(26, 470, 32, 40, 2, 0.08), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.07), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.07), surface: 'green' },
    // the beach along the shore
    { poly: band([{ x: 116, y: -40 }, { x: 122, y: 300 }, { x: 116, y: 610 }], 12), surface: 'sand' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(130, -46, 196, 616), level: 0, look: 'sea', tide: { amp: 0.8, period: 50 } }],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -50, x1: 200, y1: 620, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // down to the beach and the sea on the right
    { kind: 'ramp', x0: 90, y0: -50, x1: 140, y1: 620, axis: 'x', h0: 0, h1: -10, op: 'add' },
    { kind: 'ramp', x0: 140, y0: -50, x1: 200, y1: 620, axis: 'x', h0: -10, h1: -12, op: 'add' },
    // the rumpled ground of a links: humps and hollows all down the hole
    ...[[-30, 80, 26, 2.4], [30, 150, 22, -1.6], [-24, 200, 20, 1.8], [40, 320, 24, 2], [-10, 360, 22, -1.4], [-40, 440, 26, 2.6], [60, 420, 18, 1.6], [-60, 250, 30, 4], [-70, 520, 30, 5]].map(
      ([x, y, r, h]) => ({ kind: 'hill' as const, x, y, r, h }),
    ),
    ...greenComplex(GREEN, GROUND, { lift: 0.8, edge: 12, tilt: [-1.2, 0.4], rolls: [[-8, -6, 7, 0.4], [10, 8, 6, -0.35]] }),
    // the Keep's shadow: a hollow short left that tips toward the green
    { kind: 'disc', x: HOLLOW.x, y: HOLLOW.y, r: HOLLOW.r, h: -1.4, edge: 8, op: 'add' },
    { kind: 'ramp', x0: HOLLOW.x - 16, y0: HOLLOW.y - 16, x1: HOLLOW.x + 16, y1: HOLLOW.y + 16, axis: 'x', h0: 0.8, h1: -0.6, op: 'add' },
    ...traps.flatMap((t) => t.pieces),
  ],
  // the old dry-stone wall across the fairway: a ball that hits it kicks off; go over it
  walls: [{ a: { x: -110, y: 330 }, b: { x: 96, y: 336 }, h: 3, look: 'stone' }],
  posts: gorse,
  movers: [],
  pushes: [],
  zones: [{ id: 'keepshadow', poly: circle(HOLLOW.x, HOLLOW.y, HOLLOW.r) }],
  secret: { name: "The Keep's Shadow", zone: 'keepshadow', hint: 'Short left of the green there is a hollow. Land it in there and it feeds down to the flag.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 20, y: 220 },
    { x: 30, y: 420 },
    { x: 40, y: 520 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'ruin', x: 80, y: 600, rot: -0.3 },
    { kind: 'sheep', x: -96, y: 120, rot: 0.6 },
    { kind: 'sheep', x: -100, y: 140, rot: -1.2 },
    { kind: 'sheep', x: -92, y: 420, rot: 2.4 },
  ],
};
