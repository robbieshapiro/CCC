// Hole 2, The Punchbowl (par 3, 160 yd as shown): off a high dune, over a blown-out waste of sand, to a big green
// sunk in a bowl of dunes.
// The play: a full iron, all carry, to the middle of the green. The dunes left and right are thick fescue: a ball that
// lands in them stays up there.
// The bail-out: a tongue of fairway short of the green, between the two pots, for a chip and a putt.
// The secret: the Backstop. The bank behind the green is mown. Fly it long, onto the bank, and it rolls back to the edge of the green.
import { blob, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { LINKS_TURF, dunes, gorse, slope } from './common';

const GROUND = 8;
const GREEN = { x: 0, y: 218, rx: 16, ry: 14 };
const BANK = { x: 0, y: 254, rx: 20, ry: 17 };
const traps = [greenside(GREEN, -15, 194, 6, 5, 1, 3.4, 0.4), greenside(GREEN, 17, 196, 6, 5, 2, 3.4, -0.4)];

export const punchbowl: Hole = {
  id: 'punchbowl',
  name: 'The Punchbowl',
  par: 3,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  weather: 'soft',
  drizzle: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.14,
  yards: 160,
  blurb: 'All carry over the sand to a big green down in the dunes. Long is better than short.',
  tee: { x: 0, y: 0 },
  cup: { x: 1, y: 219 },
  pins: [{ x: 1, y: 219 }, { x: -10, y: 211 }, { x: 10, y: 223 }, { x: -4, y: 229 }],
  aim: 0,
  bounds: { x0: -120, y0: -50, x1: 120, y1: 330 },
  border: [
    { x: -116, y: -46 },
    { x: 116, y: -46 },
    { x: 116, y: 326 },
    { x: -116, y: 326 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the waste: a blown-out dune, all sand
    { poly: blob(-4, 92, 44, 46, 1, 0.12), surface: 'sand' },
    // the way in, short of the green
    { poly: blob(1, 186, 12, 14, 2, 0.08), surface: 'fairway' },
    // the Backstop: the mown bank behind the green
    { poly: blob(BANK.x, BANK.y, BANK.rx, BANK.ry, 4, 0.06), surface: 'fairway' },
    // a wide collar, mown for the run-up (Nov 18: bigger, lower links greens)
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 6, GREEN.ry + 6, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -50, x1: 120, y1: 330, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the tee dune (Nov 22: higher, the green well below in its bowl)
    { kind: 'hill', x: 0, y: -10, r: 70, h: 14 },
    { kind: 'disc', x: 0, y: 0, r: 15, h: GROUND + 18, edge: 12, op: 'set' },
    // the waste sits in a hollow
    { kind: 'disc', x: -4, y: 92, r: 44, h: -2.5, edge: 16, op: 'add' },
    // the bowl: dunes left, right and behind, their feet at the edge of the green
    ...dunes([[-52, 220, 31, 10], [52, 222, 31, 10], [-40, 270, 34, 9], [42, 272, 34, 9], [0, 272, 36, 12], [-78, 120, 40, 7], [80, 110, 40, 8], [-84, 20, 40, 6], [86, 10, 36, 6]]),
    ...greenComplex(GREEN, GROUND, { lift: 0.5, edge: 12, tilt: slope(GREEN, 12, [0.7, 0.9]), rolls: [[-8, -5, 8, 0.35], [9, 6, 7, -0.3], [0, 9, 6, 0.2]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: gorse([[-34, 172], [38, 170], [-64, 192], [66, 198], [-30, 298], [28, 302], [-50, 40], [52, 50]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'backstop', poly: blob(BANK.x, BANK.y + 4, BANK.rx - 2, BANK.ry - 5, 4, 0.06) }],
  secret: { name: 'The Backstop', zone: 'backstop', hint: 'The bank behind the green is mown short. Fly the flag, land on the bank, and it comes back to the edge of the green.' },
  flyover: [
    { x: 20, y: -30 },
    { x: 30, y: 60 },
    { x: 20, y: 170 },
    { x: 0, y: 218 },
  ],
  decor: [
    // a faint rainbow over the far dunes, through the drizzle
    { kind: 'rainbow', x: 120, y: 1500, rot: 0.2, scale: 900 },
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'sheep', x: -70, y: 266, rot: 0.8 },
    { kind: 'sheep', x: 74, y: 270, rot: -2 },
    { kind: 'sheep', x: 60, y: 292, rot: 1.4 },
  ],
};
