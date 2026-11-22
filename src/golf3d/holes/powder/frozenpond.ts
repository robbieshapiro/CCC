// Hole 3, The Frozen Pond (par 3, 180 yd as shown), a green circle: off a tee high on the open hillside, in a gusting
// wind, down over the skating pond to a green on a bench above it, tucked under a snowbank. The ice is thin at the edges: a ball that comes up short is in the water.
// The play: a full iron, all carry, to the middle of the green.
// The bail-out: a cut apron out to the right of the pond, for a chip across the green.
// The secret: the Snowbank. The bank behind the green is groomed. Fly it long, onto the bank, and it slides back down
// onto the green.
import { blob, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const GROUND = 6;
const GREEN = { x: 4, y: 252, rx: 15, ry: 12 };
const BANK = { x: 4, y: 286, rx: 20, ry: 14 };
const POND = blob(0, 146, 56, 62, 5, 0.1);
const traps = [greenside(GREEN, -18, 244, 7, 6, 1, 3.4, 0.4), greenside(GREEN, 26, 258, 6, 7, 2, 3.4, 0)];

export const frozenpond: Hole = {
  id: 'frozenpond',
  name: 'The Frozen Pond',
  par: 3,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 180,
  blurb: 'Green circle. Down over the skating pond, in a gusting wind, to a green on a bench. Short is wet. Long is better.',
  teeTip: 'A full iron. Take enough to carry the pond.',
  tee: { x: 0, y: 0 },
  cup: { x: 4, y: 253 },
  pins: [{ x: 4, y: 253 }, { x: -4, y: 248 }, { x: 12, y: 255 }, { x: 2, y: 260 }],
  aim: 0,
  bounds: { x0: -130, y0: -50, x1: 130, y1: 350 },
  border: [
    { x: -126, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 346 },
    { x: -126, y: 346 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the apron out right of the pond: the bail-out
    { poly: blob(64, 214, 13, 18, 2, 0.08), surface: 'fairway' },
    // the Snowbank: groomed snow behind the green
    { poly: blob(BANK.x, BANK.y, BANK.rx, BANK.ry, 4, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: POND, level: GROUND - 1.5, look: 'lake' }],
  terrain: [
    { kind: 'ramp', x0: -130, y0: -50, x1: 130, y1: 350, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the tee up on the hillside
    { kind: 'hill', x: 0, y: -20, r: 80, h: 22 },
    { kind: 'disc', x: 0, y: 0, r: 15, h: GROUND + 30, edge: 14, op: 'set' },
    // the pond's bowl
    { kind: 'disc', x: 0, y: 146, r: 58, h: -5, edge: 12, op: 'add' },
    // the snowbank behind the green, and the hillside round it
    { kind: 'hill', x: 4, y: 300, r: 34, h: 13 },
    { kind: 'hill', x: -60, y: 280, r: 40, h: 9 },
    { kind: 'hill', x: 68, y: 290, r: 40, h: 8 },
    ...greenComplex(GREEN, GROUND + 2, { lift: 0.6, edge: 10, tilt: slope(GREEN, 10, [0.5, -0.9]), rolls: [[-7, -4, 7, 0.3], [8, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...firs([{ x: -90, y: 10 }, { x: -96, y: 320 }], 26, 'fp-l', 1, 1), ...firs([{ x: 96, y: 10 }, { x: 100, y: 320 }], 26, 'fp-r', -1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'snowbank', poly: blob(BANK.x, BANK.y + 4, BANK.rx - 2, BANK.ry - 5, 4, 0.06) }],
  secret: { name: 'The Snowbank', zone: 'snowbank', hint: 'The bank behind the green is groomed. Fly the flag, land on the bank, and it slides back down to the green.' },
  flyover: [
    { x: 20, y: -30 },
    { x: 24, y: 90 },
    { x: 16, y: 200 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'green' },
    { kind: 'snowman', x: 56, y: 270, rot: -0.4 },
  ],
};
