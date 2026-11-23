// Hole 8, The Lodge (par 4, 440 yd as shown), a green circle: the home hole, and the walk-up finish (Robbie, Nov 23:
// everything else went downhill). From a tee at the bottom of the run, 40 ft up the hill to a green on the lodge's
// bench, with the fire lit and the deck full, and the whole hill a party. The mountain falls off a cliff down the right of the drive.
// The play: a driver up onto the drive bench (the slope stops it where it lands), then a long iron up the climb to the
// green. It plays longer than it looks.
// The bail-out: left of the drive. Right is the cliff; short left of the green is the lodge's skating pond.
// The secret: the Snowbank. The bank behind the green is groomed. Take one more club, fly it onto the bank, and it
// slides back down onto the green.
import { blob, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, profile } from './common';

const LOW = 10;
const BENCH = 50;
const GREEN = { x: -12, y: 600, rx: 18, ry: 14 };
const BANK = { x: -12, y: 634, rx: 22, ry: 13 };
// the cliff edge down the right
const LIP = 76;
const traps = [greenside(GREEN, -12, 570, 10, 6, 2, 3.4, 0), greenside(GREEN, 14, 616, 8, 6, 3, 3.4, 0.3), greenside(GREEN, 22, 592, 6, 8, 4, 3.4, 0)];
// the skating pond, short and left of the green, on the lodge's bench
const POND = blob(-66, 576, 24, 20, 6, 0.1);

export const thelodge: Hole = {
  id: 'thelodge',
  name: 'The Lodge',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 440,
  blurb: 'Green circle. The walk-up finish: 40 feet up the hill to the lodge, the fire lit and the deck full. It plays longer than it looks.',
  teeTip: 'Driver up onto the bench. Take an extra club for the climb. Not right: the cliff.',
  tee: { x: 0, y: 0 },
  cup: { x: -12, y: 602 },
  pins: [{ x: -12, y: 602 }, { x: -22, y: 595 }, { x: -1, y: 606 }, { x: -14, y: 609 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 150, y1: 840 },
  border: [
    { x: -136, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 150 },
    { x: LIP, y: 170 },
    { x: LIP, y: 520 },
    { x: 146, y: 540 },
    { x: 146, y: 836 },
    { x: -136, y: 836 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the drive bench: the climb eases here, so a drive stops where it lands
    { poly: blob(-4, 350, 36, 120, 1, 0.05), surface: 'fairway' },
    // up the climb to the green
    { poly: blob(-8, 512, 24, 40, 2, 0.06), surface: 'fairway' },
    // the snowbank behind the green: groomed
    { poly: blob(BANK.x, BANK.y, BANK.rx, BANK.ry, 4, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the lip of the cliff
    { poly: rect(LIP - 6, 170, LIP + 4, 520), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: POND, level: BENCH - 1.5, look: 'lake' }],
  terrain: [
    ...profile(-140, 150, [
      [-50, LOW],
      [20, LOW],
      [180, 16],
      // the drive bench, climbing gently
      [300, 22],
      [440, 30],
      // the climb to the lodge
      [540, BENCH],
      [840, BENCH + 2],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: LOW + 1, edge: 8, op: 'set' },
    // the mountainside rises on the right of the drive, so it tips left, away from the cliff
    { kind: 'hill', x: 170, y: 300, r: 170, h: 14 },
    { kind: 'disc', x: -66, y: 576, r: 26, h: -5, edge: 9, op: 'add' },
    // the snowbank behind the green
    { kind: 'hill', x: BANK.x, y: BANK.y + 14, r: 34, h: 11 },
    ...greenComplex(GREEN, BENCH, { lift: 1, edge: 9, tilt: slope(GREEN, 9, [0.4, -0.9]), rolls: [[-8, -6, 7, 0.35], [10, 6, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right of the drive
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 520 }]),
  ],
  walls: [],
  posts: [...firs([{ x: -70, y: 0 }, { x: -80, y: 520 }], 26, 'lo-l', 1), ...firs([{ x: -110, y: 620 }, { x: -116, y: 740 }], 26, 'lo-gl', 1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'snowbank', poly: blob(BANK.x, BANK.y + 4, BANK.rx - 2, BANK.ry - 4, 4, 0.06) }],
  secret: { name: 'The Snowbank', zone: 'snowbank', hint: 'The bank behind the green is groomed. Take one more club, fly it onto the bank, and it slides back down to the green.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 340 },
    { x: -6, y: 520 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'green' },
    // the après (Nov 23, Robbie: the Lodge is the party): the big lodge with its deck packed, a hot tub, a DJ, fire
    // pits, ski racks, and a crowd lining the walk up to the green, some of them spraying champagne
    { kind: 'biglodge', x: -6, y: 752, rot: 0 },
    { kind: 'hottub', x: 70, y: 690, rot: 0 },
    { kind: 'djbooth', x: -84, y: 684, rot: 0.3 },
    { kind: 'firepit', x: 54, y: 640, rot: 0 },
    { kind: 'firepit', x: -62, y: 636, rot: 0 },
    { kind: 'skirack', x: 92, y: 724, rot: -0.4 },
    { kind: 'skirack', x: -104, y: 724, rot: 0.4 },
    { kind: 'crowd', x: 38, y: 520, rot: 1.571, size: [80, 11, 0] },
    { kind: 'crowd', x: -52, y: 500, rot: 1.571, size: [60, 8, 0] },
    { kind: 'crowd', x: 42, y: 596, rot: 1.571, size: [30, 6, 0] },
    { kind: 'snowman', x: 60, y: 560, rot: -0.3 },
  ],
};
