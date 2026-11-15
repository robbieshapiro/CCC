// Hole 2, The Punchbowl (par 3, 140 yd as shown): off a high dune, over a blown-out waste of sand, to a small green
// sunk in a bowl of dunes.
// The play: a full iron, all carry, to the middle of the green. The dunes left and right are thick fescue: a ball that
// lands in them stays up there.
// The bail-out: a tongue of fairway short of the green, between the two pots, for a chip and a putt.
// The secret: the Backstop. The bank behind the green is mown. Fly it long, onto the bank, and it rolls back to the edge of the green.
import { blob, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { dunes, gorse, LINKS_TURF } from './common';

const GROUND = 8;
const GREEN = { x: 0, y: 188, rx: 15, ry: 13 };
const BANK = { x: 0, y: 219, rx: 18, ry: 17 };
const traps = [greenside(GREEN, -15, 164, 6, 5, 1, 3.4, 0.4), greenside(GREEN, 17, 166, 6, 5, 2, 3.4, -0.4)];

export const punchbowl: Hole = {
  id: 'punchbowl',
  name: 'The Punchbowl',
  par: 3,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.07,
  yards: 140,
  blurb: 'All carry over the sand to a small green down in the dunes. Long is better than short.',
  tee: { x: 0, y: 0 },
  cup: { x: 1, y: 189 },
  pins: [{ x: 1, y: 189 }, { x: -8, y: 183 }, { x: 8, y: 192 }, { x: -3, y: 196 }],
  aim: 0,
  bounds: { x0: -120, y0: -50, x1: 120, y1: 300 },
  border: [
    { x: -116, y: -46 },
    { x: 116, y: -46 },
    { x: 116, y: 296 },
    { x: -116, y: 296 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the waste: a blown-out dune, all sand
    { poly: blob(-4, 92, 44, 46, 1, 0.12), surface: 'sand' },
    // the way in, short of the green
    { poly: blob(1, 158, 9, 13, 2, 0.08), surface: 'fairway' },
    // the Backstop: the mown bank behind the green
    { poly: blob(BANK.x, BANK.y, BANK.rx, BANK.ry, 4, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -50, x1: 120, y1: 300, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    // the tee dune
    { kind: 'hill', x: 0, y: -10, r: 60, h: 12 },
    { kind: 'disc', x: 0, y: 0, r: 15, h: GROUND + 12, edge: 8, op: 'set' },
    // the waste sits in a hollow
    { kind: 'disc', x: -4, y: 92, r: 44, h: -2.5, edge: 16, op: 'add' },
    // the bowl: dunes left, right and behind, their feet at the edge of the green
    ...dunes([[-52, 190, 31, 10], [52, 192, 31, 10], [-40, 240, 34, 9], [42, 242, 34, 9], [0, 242, 36, 12], [-78, 120, 40, 7], [80, 110, 40, 8], [-84, 20, 40, 6], [86, 10, 36, 6]]),
    ...greenComplex(GREEN, GROUND, { lift: 0.4, edge: 8, tilt: [0.5, 0.7], rolls: [[-6, -4, 6, 0.3], [7, 5, 6, -0.25]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: gorse([[-34, 142], [38, 140], [-64, 162], [66, 168], [-30, 268], [28, 272], [-50, 40], [52, 50]]),
  movers: [],
  pushes: [],
  zones: [{ id: 'backstop', poly: blob(BANK.x, BANK.y + 4, BANK.rx - 2, BANK.ry - 5, 4, 0.06) }],
  secret: { name: 'The Backstop', zone: 'backstop', hint: 'The bank behind the green is mown short. Fly the flag, land on the bank, and it comes back to the edge of the green.' },
  flyover: [
    { x: 20, y: -30 },
    { x: 30, y: 60 },
    { x: 20, y: 140 },
    { x: 0, y: 188 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'sheep', x: -70, y: 236, rot: 0.8 },
    { kind: 'sheep', x: 74, y: 240, rot: -2 },
    { kind: 'sheep', x: 60, y: 262, rot: 1.4 },
  ],
};
