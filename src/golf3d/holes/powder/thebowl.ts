// Hole 3, The Bowl (par 3, 155 yd as shown), a blue square, the fun one (Robbie, Nov 23): off a tee on the rim, down
// into a round snow bowl with the green on its flat floor. The bowl's sides are packed snow, slick as a halfpipe: a
// ball that lands anywhere inside the rim runs down onto the green, swings across it and settles. Some go in.
// The play: an iron anywhere inside the rim. The closer to the middle it lands, the less it rolls about.
// The bail-out: there isn't one needed. Short of the rim, or over it, is deep powder up on the lip.
// The secret: the Back Wall. Fly it long onto the steep wall behind the green: it comes straight back down the slope
// at the pin.
import { blob, circle } from '../../terrain';
import type { Hole, V2 } from '../../types';
import { POWDER_TURF, firs } from './common';

const RIM = 30;
const FLOOR = 12;
const C: V2 = { x: 0, y: 214 };
const R = 66; // the bowl, rim to rim
const GREEN = { x: C.x, y: C.y, rx: 18, ry: 18 };

export const thebowl: Hole = {
  id: 'thebowl',
  name: 'The Bowl',
  par: 3,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.06,
  yards: 155,
  blurb: 'Blue square. Down into the bowl. Its sides are slick: land anywhere inside the rim and it runs down to the green. Some go in.',
  teeTip: 'An iron anywhere inside the rim. The bowl does the rest.',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 214 },
  pins: [{ x: 0, y: 214 }, { x: -6, y: 210 }, { x: 6, y: 217 }, { x: 2, y: 207 }],
  aim: 0,
  bounds: { x0: -140, y0: -50, x1: 140, y1: 340 },
  border: [
    { x: -136, y: -46 },
    { x: 136, y: -46 },
    { x: 136, y: 336 },
    { x: -136, y: 336 },
  ],
  base: 'rough',
  regions: [
    { poly: circle(0, 0, 13, 20), surface: 'fairway' },
    // the bowl's sides: packed snow, slick (it plays as a path, so a ball keeps running down to the floor)
    { poly: circle(C.x, C.y, R - 2, 40), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.03), surface: 'green' },
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -50, x1: 140, y1: 340, axis: 'y', h0: RIM, h1: RIM, op: 'set' },
    // the tee up on a hump of the rim
    { kind: 'hill', x: 0, y: -10, r: 50, h: 10 },
    { kind: 'disc', x: 0, y: 0, r: 14, h: RIM + 10, edge: 10, op: 'set' },
    // the bowl: a smooth hollow, steepest halfway down its sides
    { kind: 'hill', x: C.x, y: C.y, r: R + 6, h: FLOOR - RIM },
    // its floor flattened for the green, easing into the sides all round
    { kind: 'disc', x: C.x, y: C.y, r: 26, h: FLOOR, edge: 10, op: 'set' },
    // and the green gently dished toward the middle, so a ball still rolling finds its way toward the cup
    { kind: 'hill', x: C.x, y: C.y, r: 22, h: -0.7 },
  ],
  walls: [],
  posts: [...firs([{ x: -110, y: 60 }, { x: -116, y: 320 }], 26, 'tb-l', 1, 1), ...firs([{ x: 110, y: 60 }, { x: 116, y: 320 }], 26, 'tb-r', -1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'backwall', poly: blob(C.x, C.y + 44, 26, 12, 4, 0.05) }],
  secret: { name: 'The Back Wall', zone: 'backwall', hint: 'Fly it long onto the steep wall behind the green. It comes straight back down at the pin.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 120 },
    { x: C.x, y: C.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'blue' },
    { kind: 'snowman', x: 74, y: 160, rot: -0.5 },
    { kind: 'snowman', x: -80, y: 250, rot: 0.6, scale: 0.8 },
  ],
};
