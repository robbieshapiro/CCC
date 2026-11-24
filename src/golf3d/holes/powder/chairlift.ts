// Hole 5, The Chairlift (par 4, 380 yd as shown), a blue square: uphill all the way, 46 ft, under the lift, a dogleg
// left round a stand of firs to a green on a shelf at the top. It plays every yard of its length.
// The après deck: a sun deck with a bar, a keg and a fire pit off the right of the corner. Tap it before your next
// shot and Reginald brings the tray (once a hole). Nothing says it's there.
// The lift (Nov 24, Robbie): the chairlift runs from a loading station at the top-left of the drive zone, up over the
// firs on the corner, to the green. Chip or putt across the station just as a chair sweeps through it and the chair
// takes the ball up and lets it go high over the green, to fall onto it. Mistime it and it rolls on into the snow.
// The play (Nov 23, Robbie: there was nowhere to drive that didn't leave the firs in the way): one wide fairway. Drive
// to its right side, the long way round, and the green is wide open up the hill. The left side is shorter, but the firs
// on the corner are in the way of the second unless the drive is perfect.
// The bail-out: right, short of the cliff; the mountainside there tips a ball back to the fairway.
// The secret: the Glade. A lane has been cleared straight through the firs on the corner. Thread a drive down it and
// you're up on the shelf with a short iron left.
import { band, blob, circle, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import type { Lift } from '../../lift';
import { bunker, FAIRWAY_DEPTH, greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_PLAY, POWDER_TURF, cliff, firs } from './common';

// the cliff edge down the right of the drive (Nov 22, round two)
const LIP = 124;

const LOW = 6;
const HIGH = 52;
const GREEN = { x: -80, y: 500, rx: 24, ry: 20 };
// the green sits level with the hill round it (Nov 24, Robbie: no cupcake greens), at the slope's own height there
const GROUND = LOW + ((GREEN.y - 20) / 540) * (HIGH - 2 - LOW);
// the glade runs straight from the tee to the green; x along it at y
const glade = (y: number) => (GREEN.x * y) / GREEN.y;
const LANE = 14;
// the stand of firs on the corner, with the glade cut through it
const stand: Post[] = [];
for (let y = 150, row = 0; y <= 470; y += 20, row++)
  for (let x = -150 + (row % 2 ? 10 : 0); x <= -26; x += 20) {
    if (Math.abs(x - glade(y)) < LANE + 6) continue;
    // the approach opens up above the corner (Nov 23): from the right side of the fairway the line to the green runs
    // clear past the top of the stand; from the left it runs into the stand
    if (y > 340) continue;
    const h = 20 + ((x * 7 + y * 3) % 22);
    stand.push({ x, y, r: Math.max(4, Math.round(h * 0.26)), h, soft: true, look: 'snowpine' });
  }
// the lift: the loading station by the firs at the top-left of the drive zone, up over the green to a top station
// behind it. The chair lets go 34 ft up, just short of the green, and the ball falls onto it (Nov 24, Robbie)
const LIFT: Lift = { load: { x: 6, y: 300 }, top: { x: -105, y: 557 }, drop: { x: -62, y: 458 }, speed: 16, gap: 4, pad: 4, low: 8 };
// the après deck, off the right of the corner
const APRES: V2 = { x: 100, y: 506 };
// the tip of the corner: firs at the left edge of the fairway, so a drive up the left has them in the way of the green
for (const [x, y] of [[-14, 288], [-8, 308], [-16, 324], [-6, 340], [-18, 352]] as const) stand.push({ x, y, r: 5, h: 26 + ((x + y) % 6), soft: true, look: 'snowpine' });
const traps = [bunker(58, 318, 12, 9, 5, FAIRWAY_DEPTH, 0.3), greenside(GREEN, -58, 486, 8, 7, 1, 3.4, 0.5), greenside(GREEN, -94, 528, 9, 6, 2, 3.4, 0)];

export const chairlift: Hole = {
  id: 'chairlift',
  name: 'The Chairlift',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  ...POWDER_PLAY,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.18, // a bit firmer (Nov 24, Robbie)
  yards: 380,
  blurb: 'Blue square. Uphill, and the lift is running: roll one onto a passing chair and it rides up over the firs to the green. Thirsty? The deck\'s open.',
  teeTip: 'Driver to the right side and the green is wide open. Or lay it by the lift station and time a chip onto a chair.',
  tee: { x: 0, y: 0 },
  cup: { x: -80, y: 503 },
  pins: [{ x: -80, y: 503 }, { x: -92, y: 494 }, { x: -66, y: 508 }, { x: -77, y: 515 }],
  aim: 0.02,
  apres: APRES,
  lift: LIFT,
  // a ride up the lift takes a while: room for the roll to the station, the ride and the fall onto the green
  maxTime: 40,
  bounds: { x0: -200, y0: -50, x1: 200, y1: 710 },
  border: [
    { x: -196, y: -46 },
    { x: 196, y: -46 },
    { x: 196, y: 100 },
    { x: LIP, y: 120 },
    { x: LIP, y: 440 },
    { x: 196, y: 460 },
    { x: 196, y: 706 },
    { x: -196, y: 706 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the drive, out right of the firs: 64 ft across
    // one wide fairway: the right side opens up the green, the left is shorter but behind the firs
    { poly: blob(32, 340, 50, 132, 1, 0.05), surface: 'fairway' },
    // round the corner and up the hill
    // round the corner and up the hill to the green
    { poly: blob(-26, 420, 42, 36, 2, 0.06), surface: 'fairway' },
    // the glade: a strip cut down the lane through the firs, to the shelf
    { poly: band([{ x: glade(170), y: 170 }, { x: glade(470), y: 470 }], 9), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the loading station: packed snow on a little hump, so a ball can't sit there waiting for a chair
    { poly: circle(LIFT.load.x, LIFT.load.y, LIFT.pad + 2, 20), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -200, y0: -50, x1: 140, y1: 20, axis: 'y', h0: LOW, h1: LOW, op: 'set' },
    { kind: 'ramp', x0: -200, y0: 20, x1: 140, y1: 560, axis: 'y', h0: LOW, h1: HIGH - 2, op: 'set' },
    { kind: 'ramp', x0: -200, y0: 560, x1: 140, y1: 710, axis: 'y', h0: HIGH - 2, h1: HIGH, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 16, h: LOW + 1, edge: 8, op: 'set' },
    // the hillside right of the drive tips a ball back toward the cut
    { kind: 'hill', x: 170, y: 330, r: 70, h: 8 },
    ...greenComplex(GREEN, GROUND, { lift: 0.3, edge: 16, tilt: slope(GREEN, 16, [0.6, 0.8]), rolls: [[-12, -8, 10, 0.35], [12, 8, 9, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    { kind: 'hill', x: LIFT.load.x, y: LIFT.load.y, r: LIFT.pad + 3, h: 0.6 },
    // the cliff down the right of the drive
    cliff([{ x: LIP + 36, y: 100 }, { x: LIP + 36, y: 460 }]),
  ],
  walls: [],
  posts: [...stand, ...firs([{ x: 70, y: 40 }, { x: 74, y: 100 }], 26, 'cl-r', -1), ...firs([{ x: 130, y: 550 }, { x: 134, y: 680 }], 26, 'cl-rr', -1), ...firs([{ x: -168, y: 480 }, { x: -170, y: 680 }], 26, 'cl-l', 1, 1)],
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
