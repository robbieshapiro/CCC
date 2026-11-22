// Hole 6, The Iceberg (par 3, 150 yd as shown), a black diamond: off a tee on the shore of a mountain lake, all
// carry over open water to a green on an iceberg. The top of the berg is the green and a thin collar; its sides are
// sheer, slick ice that falls away into the lake all round. Off the green is in the water.
// The play: a mid iron, all carry, landing soft in the middle. Short, long or wide slides off the ice.
// The bail-out: the shore spit to the left of the berg, for a chip across.
// The secret: the Ice Bridge. A narrow bridge of ice runs from the end of the spit to the berg. From the spit, a low
// runner along it rides up onto the green.
import { band, blob, circle, rect } from '../../terrain';
import type { Hole } from '../../types';
import { greenside } from '../woods';
import { stoneBridge } from '../atlantic/common';
import { POWDER_TURF, firs } from './common';

const SHORE = 22;
const BERG = 9;
const GREEN = { x: 6, y: 200, rx: 17, ry: 14 };
const BERG_R = 33;
// the shore spit, out from the left bank toward the berg
const SPIT_END = { x: -58, y: 202 };
const BRIDGE = stoneBridge({ x: SPIT_END.x + 4, y: SPIT_END.y }, { x: GREEN.x - BERG_R + 9, y: GREEN.y - 2 }, 3.5, BERG + 0.4, -6);
const traps = [greenside(GREEN, 18, 192, 4, 4, 2, 2.4, 0)];

export const iceberg: Hole = {
  id: 'iceberg',
  name: 'The Iceberg',
  par: 3,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.12,
  yards: 150,
  blurb: 'Black diamond. All carry over the lake to a green on an iceberg. Its sides are sheer ice: off the green is in the water.',
  teeTip: 'A mid iron, all carry. Land it soft in the middle. The spit on the left is the safe play.',
  tee: { x: 0, y: 0 },
  cup: { x: 6, y: 201 },
  pins: [{ x: 6, y: 201 }, { x: -2, y: 196 }, { x: 13, y: 203 }, { x: 4, y: 207 }],
  aim: 0.02,
  bounds: { x0: -140, y0: -50, x1: 140, y1: 330 },
  border: [
    { x: -136, y: -46 },
    { x: 136, y: -46 },
    { x: 136, y: 326 },
    { x: -136, y: 326 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the spit: a cut apron at its end, for the chip across
    { poly: blob(-82, 202, 22, 11, 2, 0.08), surface: 'fairway' },
    // the berg: sheer, slick ice (it plays as stone)
    { poly: circle(GREEN.x, GREEN.y, BERG_R + 2, 32), surface: 'stone' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 7, GREEN.ry + 7, 3, 0.05), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.05), surface: 'green' },
    BRIDGE.region,
    ...traps.map((t) => t.region),
  ],
  // the lake, open water round the berg
  water: [{ poly: rect(-136, 56, 136, 326), level: 0, look: 'lake' }],
  terrain: [
    // the shore, then the lake bed
    { kind: 'ramp', x0: -140, y0: -50, x1: 140, y1: 30, axis: 'y', h0: SHORE, h1: SHORE - 4, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 30, x1: 140, y1: 70, axis: 'y', h0: SHORE - 4, h1: -6, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 70, x1: 140, y1: 330, axis: 'y', h0: -6, h1: -6, op: 'set' },
    { kind: 'disc', x: 0, y: 0, r: 15, h: SHORE + 2, edge: 10, op: 'set' },
    // the spit, out from the left bank
    { kind: 'embankment', pts: [{ x: -150, y: 214 }, { x: -110, y: 204 }, SPIT_END], h: [BERG + 2, BERG, BERG], width: 12, edge: 6 },
    // the berg: a flat top and sheer sides down into the lake
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: BERG_R, h: BERG, edge: 8, op: 'set' },
    // the berg's top is domed, so a loose ball runs off toward the edge
    { kind: 'hill', x: GREEN.x, y: GREEN.y, r: 40, h: 1.8 },
    // the green tips gently toward the tee, with a roll in it
    { kind: 'hill', x: GREEN.x + 4, y: GREEN.y + 34, r: 46, h: 1.6 },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y + 4, r: 8, h: 0.35 },
    ...traps.flatMap((t) => t.pieces),
    BRIDGE.piece,
  ],
  walls: [...BRIDGE.walls],
  posts: [...firs([{ x: -110, y: -30 }, { x: -120, y: 40 }], 22, 'ib-l', 1, 1), ...firs([{ x: 110, y: -30 }, { x: 120, y: 40 }], 22, 'ib-r', -1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'icebridge', poly: band([{ x: SPIT_END.x + 2, y: SPIT_END.y }, { x: GREEN.x - BERG_R + 6, y: GREEN.y - 2 }], 4) }],
  secret: { name: 'The Ice Bridge', zone: 'icebridge', hint: 'A narrow bridge of ice runs from the end of the spit to the berg. A low runner along it rides up onto the green.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 10, y: 100 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'trailsign', x: -18, y: 12, rot: 0, label: 'black' },
    { kind: 'rock', x: -40, y: 40, scale: 4 },
    { kind: 'rock', x: 50, y: 44, scale: 3 },
    BRIDGE.decor,
  ],
};
