// Hole 7, The Chairlift (par 4, 470 yd as shown), a blue square: uphill all the way, 46 ft, under the lift, a dogleg
// left round a stand of firs to a green on a shelf at the top. It plays every yard of its length.
// The après deck: a sun deck with a bar, a keg and a fire pit off the right of the corner. Tap it before your next
// shot and Reginald brings the tray (once a hole). Nothing says it's there.
// The play: a driver out to the right of the firs, then a wood or a long iron up the hill to the green.
// The bail-out: right. Powder, but open, and the hill brings a ball back toward the cut.
// The secret: the Glade. A lane has been cleared straight through the firs on the corner. Thread a drive down it and
// you're up on the shelf with a short iron left.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const LOW = 6;
const HIGH = 52;
const GREEN = { x: -124, y: 630, rx: 16, ry: 13 };
// the glade runs straight from the tee to the green; x along it at y
const glade = (y: number) => (GREEN.x * y) / GREEN.y;
const LANE = 14;
// the stand of firs on the corner, with the glade cut through it
const stand: Post[] = [];
for (let y = 150, row = 0; y <= 470; y += 20, row++)
  for (let x = -150 + (row % 2 ? 10 : 0); x <= -26; x += 20) {
    if (Math.abs(x - glade(y)) < LANE + 6) continue;
    if (y > 420 && x < -90) continue; // the approach, left of the glade, opens up
    const h = 20 + ((x * 7 + y * 3) % 22);
    stand.push({ x, y, r: Math.max(4, Math.round(h * 0.26)), h, soft: true, look: 'snowpine' });
  }
// the après deck, off the right of the corner
const APRES: V2 = { x: 50, y: 492 };
const traps = [greenside(GREEN, -102, 616, 8, 7, 1, 3.4, 0.5), greenside(GREEN, -138, 658, 9, 6, 2, 3.4, 0)];

export const chairlift: Hole = {
  id: 'chairlift',
  name: 'The Chairlift',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 470,
  blurb: 'Blue square. Uphill all the way under the lift, round the firs to a green on a shelf. Thirsty? The deck\'s open.',
  teeTip: 'Driver, out to the right of the firs.',
  tee: { x: 0, y: 0 },
  cup: { x: -124, y: 632 },
  pins: [{ x: -124, y: 632 }, { x: -132, y: 626 }, { x: -115, y: 635 }, { x: -122, y: 640 }],
  aim: 0.02,
  apres: APRES,
  bounds: { x0: -200, y0: -50, x1: 140, y1: 710 },
  border: [
    { x: -196, y: -46 },
    { x: 136, y: -46 },
    { x: 136, y: 706 },
    { x: -196, y: 706 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the drive, out right of the firs: 64 ft across
    { poly: blob(16, 330, 32, 130, 1, 0.05), surface: 'fairway' },
    // round the corner and up the hill
    { poly: blob(-40, 500, 50, 34, 2, 0.06), surface: 'fairway' },
    { poly: blob(-100, 574, 26, 28, 3, 0.06), surface: 'fairway' },
    // the glade: a strip cut down the lane through the firs, to the shelf
    { poly: band([{ x: glade(170), y: 170 }, { x: glade(470), y: 470 }], 9), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -200, y0: -50, x1: 140, y1: 20, axis: 'y', h0: LOW, h1: LOW, op: 'set' },
    { kind: 'ramp', x0: -200, y0: 20, x1: 140, y1: 560, axis: 'y', h0: LOW, h1: HIGH - 2, op: 'set' },
    { kind: 'ramp', x0: -200, y0: 560, x1: 140, y1: 710, axis: 'y', h0: HIGH - 2, h1: HIGH, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: LOW + 1, edge: 8, op: 'set' },
    // the hillside right of the drive tips a ball back toward the cut
    { kind: 'hill', x: 96, y: 330, r: 60, h: 7 },
    ...greenComplex(GREEN, HIGH, { lift: 0.8, edge: 10, tilt: slope(GREEN, 10, [0.6, 0.8]), rolls: [[-8, -5, 7, 0.35], [8, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...stand, ...firs([{ x: 78, y: 40 }, { x: 84, y: 660 }], 26, 'cl-r', -1), ...firs([{ x: -168, y: 480 }, { x: -170, y: 680 }], 26, 'cl-l', 1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'glade', poly: band([{ x: glade(220), y: 220 }, { x: glade(420), y: 420 }], 9) }],
  secret: { name: 'The Glade', zone: 'glade', hint: 'A lane is cut straight through the firs on the corner. Thread a drive down it and you\'re up on the shelf.' },
  flyover: [
    { x: 10, y: -24 },
    { x: 14, y: 300 },
    { x: -60, y: 520 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'blue' },
    { kind: 'apresdeck', x: APRES.x, y: APRES.y, rot: 0.5 },
    { kind: 'snowman', x: -150, y: 560, rot: 0.8 },
  ],
};
