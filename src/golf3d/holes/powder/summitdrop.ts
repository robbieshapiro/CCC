// Hole 3, Summit Drop (par 3, 205 yd as shown), a black diamond: off the summit ridge, 110 ft straight down the face to
// a green on a shelf cut into the mountain. Cliffs fall away either side of the shelf and behind it: off the edge is
// gone. A cornice of snow stands up behind the green.
// The play: two clubs less than the yardage (it's all downhill), to the middle of the shelf.
// The bail-out: short. A cut apron at the foot of the face leaves a chip up the green.
// The secret: the Cornice. The bank behind the green is groomed snow. Fly the flag, land on it, and it slides back down
// onto the green.
import { blob, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs } from './common';

const TOP = 150;
const SHELF = 40;
const GREEN = { x: 6, y: 290, rx: 13, ry: 11 };
const BANK = { x: 6, y: 324, rx: 20, ry: 14 };
// the shelf: a ledge on the face with the mountain falling away off both sides and behind the cornice
const SL = -34;
const SR = 46;
const traps = [greenside(GREEN, -12, 284, 7, 6, 1, 3.4, 0.4), greenside(GREEN, 24, 294, 6, 7, 2, 3.4, 0)];

export const summitdrop: Hole = {
  id: 'summitdrop',
  name: 'Summit Drop',
  par: 3,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.17,
  yards: 205,
  blurb: 'Black diamond. Off the summit ridge, 110 feet down to a green on a shelf. Off either side is a cliff.',
  teeTip: 'All downhill: take less club than it looks.',
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 291 },
  pins: [{ x: 6, y: 291 }, { x: -1, y: 287 }, { x: 13, y: 293 }, { x: 4, y: 296 }],
  aim: 0.02,
  bounds: { x0: -130, y0: -50, x1: 130, y1: 350 },
  border: [
    { x: -126, y: -46 },
    { x: 126, y: -46 },
    { x: 126, y: 190 },
    { x: SR, y: 214 },
    { x: SR, y: 352 },
    { x: SL, y: 352 },
    { x: SL, y: 214 },
    { x: -126, y: 190 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the apron at the foot of the face: the bail-out
    { poly: blob(4, 252, 18, 12, 2, 0.08), surface: 'fairway' },
    // the lips of the shelf: bare rock
    { poly: rect(SL - 2, 220, SL + 4, 352), surface: 'rock' },
    { poly: rect(SR - 4, 220, SR + 2, 352), surface: 'rock' },
    // the Cornice: groomed snow behind the green
    { poly: blob(BANK.x, BANK.y, BANK.rx, BANK.ry, 4, 0.06), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -130, y0: -50, x1: 130, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    // the face
    { kind: 'ramp', x0: -130, y0: 20, x1: 130, y1: 245, axis: 'y', h0: TOP, h1: SHELF + 3, op: 'set' },
    { kind: 'ramp', x0: -130, y0: 245, x1: 130, y1: 400, axis: 'y', h0: SHELF + 3, h1: SHELF, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 15, h: TOP + 1, edge: 10, op: 'set' },
    // the ridge the tee sits on, falling away either side
    { kind: 'hill', x: -90, y: 0, r: 70, h: -30 },
    { kind: 'hill', x: 90, y: 0, r: 70, h: -30 },
    // the cornice behind the green
    { kind: 'hill', x: 6, y: 338, r: 34, h: 11 },
    ...greenComplex(GREEN, SHELF, { lift: 0.6, edge: 10, tilt: slope(GREEN, 10, [0.4, -0.9]), rolls: [[-7, -4, 7, 0.3], [8, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliffs either side of the shelf and behind the cornice: off the edge is gone
    cliff([{ x: SL - 34, y: 200 }, { x: SL - 34, y: 386 }, { x: SR + 34, y: 386 }, { x: SR + 34, y: 200 }]),
  ],
  walls: [],
  posts: [
    // rocks poking out of the face
    { x: 38, y: 150, r: 5, h: 6, look: 'rock' },
    { x: -34, y: 120, r: 6, h: 7, look: 'rock' },
    { x: -22, y: 182, r: 4, h: 5, look: 'rock' },
    ...firs([{ x: -100, y: 120 }, { x: -104, y: 330 }], 26, 'sd-l', 1, 1),
    ...firs([{ x: 104, y: 120 }, { x: 106, y: 330 }], 26, 'sd-r', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'cornice', poly: blob(BANK.x, BANK.y + 4, BANK.rx - 2, BANK.ry - 5, 4, 0.06) }],
  secret: { name: 'The Cornice', zone: 'cornice', hint: 'The bank behind the green is groomed. Fly the flag, land on the cornice, and it slides back to the green.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 14, y: 100 },
    { x: 10, y: 240 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'black' },
  ],
};
