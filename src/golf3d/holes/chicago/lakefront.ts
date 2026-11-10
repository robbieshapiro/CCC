// Hole 1, The Lakefront (par 4, 410 yd): north along Lake Michigan with the whole skyline ahead. The lake runs the
// right side and wraps round behind the green, Lake Shore Drive and its traffic are out of bounds on the left, and a
// harbour inlet cuts in from the right where a big drive wants to land. The wind comes straight off the water.
// The play: a drive left of the inlet, then a mid iron to a green with the lake right and long.
// The secret: the breakwater, a strip of fairway out along the inlet's far wall. Carry the inlet and run out on it.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { CHI_TURF, chiGreen } from './common';

const LAND = 6;
const GREEN = { x: -10, y: 562, rx: 24, ry: 18 };
const traps = [greenside(GREEN, -46, 556, 8, 10, 1, 3, 0), greenside(GREEN, -22, 594, 10, 6, 2, 3, 0)];
const BREAKWATER = band([{ x: 26, y: 282 }, { x: 64, y: 286 }], 6);

const lights: Post[] = [[-52, 30], [-52, 160], [-52, 290], [-52, 420], [-52, 550]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const }));

export const lakefront: Hole = {
  id: 'lakefront',
  name: 'The Lakefront',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.03,
  yards: 410,
  blurb: 'North along Lake Michigan, the skyline dead ahead. The lake right and long, Lake Shore Drive out of bounds left.',
  tee: { x: 0, y: 0 },
  cup: { x: -10, y: 564 },
  pins: [{ x: -10, y: 564 }, { x: -24, y: 554 }, { x: 4, y: 568 }, { x: -14, y: 576 }],
  aim: -0.02,
  bounds: { x0: -110, y0: -50, x1: 160, y1: 660 },
  border: [
    { x: -60, y: -46 },
    { x: 156, y: -46 },
    { x: 156, y: 656 },
    { x: -60, y: 656 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    { poly: blob(-8, 220, 34, 150, 1, 0.05), surface: 'fairway' },
    { poly: blob(-14, 450, 30, 60, 2, 0.05), surface: 'fairway' },
    { poly: BREAKWATER, surface: 'fairway' },
    // the lakefront trail along the left, and the stone revetment steps down to the water
    { poly: band([{ x: -46, y: -40 }, { x: -46, y: 650 }], 3), surface: 'path' },
    { poly: band([{ x: 70, y: -40 }, { x: 70, y: 220 }], 6), surface: 'stone' },
    { poly: band([{ x: 70, y: 280 }, { x: 64, y: 520 }, { x: 30, y: 620 }], 6), surface: 'stone' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-60, -46, 156, 656), level: 0, look: 'sea', tide: { amp: 0.4, period: 9 } }],
  terrain: [
    { kind: 'ramp', x0: -110, y0: -50, x1: 160, y1: 660, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the lake: the land steps down to it on the right, and round the back of the green
    { kind: 'box', x0: 76, y0: -60, x1: 200, y1: 700, h: -6, edge: 1, op: 'set' },
    { kind: 'box', x0: -120, y0: 618, x1: 200, y1: 700, h: -6, edge: 1, op: 'set' },
    { kind: 'box', x0: 40, y0: 520, x1: 200, y1: 700, h: -6, edge: 1, op: 'set' },
    // the inlet, and its far wall where the breakwater runs
    { kind: 'box', x0: 14, y0: 226, x1: 130, y1: 272, h: -6, edge: 1, op: 'set' },
    { kind: 'hill', x: -20, y: 140, r: 50, h: 0.8 },
    ...chiGreen(GREEN, LAND, [0.5, 0.6], [[-8, -6, 7, 0.25], [10, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: lights,
  movers: [],
  pushes: [],
  zones: [{ id: 'breakwater', poly: BREAKWATER }],
  secret: { name: 'The Breakwater', zone: 'breakwater', hint: 'Past the inlet a strip of fairway runs along the far wall. Carry the water and it runs out on there.' },
  flyover: [
    { x: 10, y: -30 },
    { x: 20, y: 240 },
    { x: 0, y: 450 },
    { x: -10, y: 562 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'banner', x: -26, y: -20, label: 'THE WINDY CITY' },
    { kind: 'streetsign', x: -56, y: 8, rot: Math.PI / 2, label: 'LAKE SHORE DR' },
    // where the lake is, for the skyline to leave it open
    { kind: 'lake', x: 74, y: 300, rot: Math.PI / 2, scale: 6 },
    { kind: 'traffic', x: -82, y: 300, rot: Math.PI / 2, scale: 900, size: [14, 0, 0] },
    { kind: 'walkers', x: -46, y: 300, rot: Math.PI / 2, scale: 600, size: [9, 0, 0] },
    // the skyline ahead: Willis, the Aon, the Hancock
    { kind: 'hancock', x: -190, y: 920 },
    { kind: 'aon', x: 20, y: 1180 },
    { kind: 'willis', x: -440, y: 1400 },
    { kind: 'marina', x: -330, y: 1100 },
  ],
};
