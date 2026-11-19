// Hole 4, The Fairy Fort (par 3, 125 yd as shown): the breather. A short iron to a big green inside an old ring fort,
// a round earth bank all the way round it but for a gap at the front.
// The play: a mid iron at the middle of the green, through or over the gap. Plenty of room once you're in.
// The bail-out: short, in front of the gap. Over the bank is long fescue and a hard chip back in.
// The secret: the Fort Wall. The inside of the bank is mown, and steep. Land on it and it feeds the ball down to the
// middle of the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { greenComplex } from '../woods';
import { dunes, gorse, LINKS_TURF, pot } from './common';

const GROUND = 8;
const FORT = { x: 0, y: 170, r: 38 };
const GREEN = { x: 0, y: 170, rx: 25, ry: 22 };
// the bank: a ring round the fort, open at the front (toward the tee)
const RING: V2[] = Array.from({ length: 23 }, (_, i) => {
  const a = -Math.PI / 2 + 0.42 + (i / 22) * (2 * Math.PI - 0.84);
  return { x: FORT.x + Math.cos(a) * FORT.r, y: FORT.y + Math.sin(a) * FORT.r };
});
// the mown inside of the bank
const INSIDE = blob(FORT.x, FORT.y, FORT.r - 4, FORT.r - 4, 2, 0.02);
// the Fort Wall: the mown inside face of the bank, between its top and the green
const FACE: V2[] = RING.map((p) => ({ x: FORT.x + (p.x - FORT.x) * 0.76, y: FORT.y + (p.y - FORT.y) * 0.76 }));
const traps = [pot(-26, 112, 6, 1), pot(24, 116, 6, 2)];

export const fairyfort: Hole = {
  id: 'fairyfort',
  name: 'The Fairy Fort',
  par: 3,
  theme: 'linksland',
  tour: true,
  turf: LINKS_TURF,
  gusts: true,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.08,
  yards: 125,
  blurb: 'A short iron into an old ring fort. A big green, a bank all round it, and a gap at the front.',
  teeTip: 'A short iron at the middle. The bank inside the fort feeds the ball down.',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 172 },
  pins: [{ x: 0, y: 172 }, { x: -14, y: 162 }, { x: 13, y: 177 }, { x: -5, y: 186 }],
  aim: 0,
  bounds: { x0: -120, y0: -50, x1: 120, y1: 280 },
  border: [
    { x: -116, y: -46 },
    { x: 116, y: -46 },
    { x: 116, y: 276 },
    { x: -116, y: 276 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the approach, up to the gap
    { poly: blob(0, 104, 20, 30, 1, 0.08), surface: 'fairway' },
    // the inside of the fort: mown, down to the green
    { poly: INSIDE, surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -120, y0: -50, x1: 120, y1: 280, axis: 'y', h0: GROUND, h1: GROUND, op: 'set' },
    { kind: 'disc', x: 0, y: -2, r: 15, h: GROUND + 3, edge: 8, op: 'set' },
    ...dunes([[-90, 60, 40, 7], [92, 70, 40, 7], [-84, 230, 40, 8], [86, 236, 40, 8]]),
    ...greenComplex(GREEN, GROUND, { lift: 0.3, edge: 8, tilt: [0.4, 0.5], rolls: [[-9, -6, 8, 0.3], [10, 7, 7, -0.25], [0, 11, 6, 0.2]] }),
    // the bank: four feet high, its inside face running down to the green
    { kind: 'embankment', pts: RING, h: RING.map(() => GROUND + 4), width: 3, edge: 9 },
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [
    ...gorse([[-50, 60], [52, 64], [-60, 210], [62, 214], [-30, 236], [32, 238]]),
    // a hawthorn on the bank: the fairy tree, left alone
    { x: -30, y: 200, r: 3, h: 12, soft: true, look: 'tree' },
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'fortwall', poly: band(FACE, 5) }],
  secret: { name: 'The Fort Wall', zone: 'fortwall', hint: 'The inside of the bank is mown short. Land on it and it feeds the ball down to the middle of the green.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 90 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'sheep', x: -70, y: 120, rot: 0.5 },
    { kind: 'sheep', x: 76, y: 150, rot: -1.6 },
  ],
};
