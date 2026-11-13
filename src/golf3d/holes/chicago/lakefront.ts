// Hole 1, The Lakefront (par 4, 420 yd): a beach hole, north along Lake Michigan with the whole skyline ahead. Off the
// fairways and a sliver of rough it's all sand, down to the water and up to the street. Lake Shore Drive and its
// traffic are in play all down the left (out of bounds until Nov 12), maples line the lakefront trail, and the lake runs the whole right side.
// Halfway up, the harbour cuts deep into the right of the fairway, so the hole bends left round it and back right to a
// green out on a point, water right and long.
// The play: a drive up the left-centre short of the harbour, then a mid iron across the corner of it to the green.
// The secret: the breakwater, a strip of fairway along the harbour's far wall. Carry the harbour and run out on it.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenside } from '../woods';
import { CHI_CUP, CHI_TURF, CHI_WALLS, chiGreen, chiGreenRegions, FACE, gallery, teeGallery } from './common';

const LAND = 6;
// bigger greens, for longer putts (about a third bigger each way since Nov 10)
// a fifth bigger again each way since Nov 13, and no longer a plain oval (see chiGreenRegions)
const SEED = 1;
// (and a few feet in from the lake, so the bigger green stays clear of the water's edge)
const GREEN = { x: 32, y: 564, rx: 35, ry: 25 };
const traps = [greenside(GREEN, 4, 560, 8, 10, 1, 3, 0), greenside(GREEN, 30, 600, 10, 5, 2, 3, 0)];
// the harbour: a big bite out of the right half of the hole
// (its near wall was at x 6 until Nov 12: a slight push off the tee found it, 30% of members' real drives)
const HARBOUR = { x0: 28, y0: 300, x1: 200, y1: 450 };
const BREAKWATER = band([{ x: 30, y: 462 }, { x: 70, y: 470 }], 6);

const trees: Post[] = [
  // maples along the trail, crowding the left edge of the fairway
  ...[40, 110, 180, 250, 320, 390, 460, 530].map((y, i) => ({ x: -40 + (i % 2) * 4, y, r: 6, h: 24 + (i % 3) * 4, soft: true, look: 'maple' as const })),
  // a pair on the bank where the harbour starts, pinching the landing area
  { x: 14, y: 286, r: 6, h: 26, soft: true, look: 'maple' },
  { x: 2, y: 262, r: 5, h: 22, soft: true, look: 'maple' },
];
const lights: Post[] = [[-54, 30], [-54, 200], [-54, 370], [-54, 540]].map(([x, y]) => ({ x, y, r: 0.4, h: 16, look: 'streetlight' as const }));

export const lakefront: Hole = {
  id: 'lakefront',
  name: 'The Lakefront',
  par: 4,
  theme: 'chicago',
  weather: 'gale',
  tour: true,
  turf: CHI_TURF,
  wallBounce: CHI_WALLS,
  windByHeight: true,
  ...CHI_CUP,
  greenFirm: 0.03,
  teeTip: 'The harbour cuts in on the right from halfway. Keep it left: the Drive is in play.',
  yards: 420,
  blurb: 'A beach hole on Lake Michigan. Miss the fairway and you are in the sand; the harbour bites in right, and Lake Shore Drive is in play on the left.',
  tee: { x: 0, y: 0 },
  cup: { x: 32, y: 567 },
  pins: [{ x: 32, y: 567 }, { x: 15, y: 556 }, { x: 49, y: 572 }, { x: 27, y: 578 }],
  aim: -0.02,
  bounds: { x0: -110, y0: -50, x1: 170, y1: 660 },
  border: [
    // (the Drive is in play since Nov 12: out of bounds is its far kerb, not the trail)
    { x: -104, y: -46 },
    { x: 166, y: -46 },
    { x: 166, y: 656 },
    { x: -104, y: 656 },
  ],
  // a beach: everything off the turf is sand (it plays as a waste bunker), down to the water and up to the street
  base: 'sand',
  regions: [
    // a sliver of rough round the tee, the fairways and the green, then the beach
    { poly: rect(-18, -18, 18, 18), surface: 'rough' },
    { poly: blob(-12, 196, 46, 132, 1, 0.05), surface: 'rough' },
    { poly: blob(-10, 384, 48, 102, 2, 0.06), surface: 'rough' },
    { poly: blob(14, 506, 48, 36, 3, 0.06), surface: 'rough' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 10, GREEN.ry + 10, 3, 0.06), surface: 'rough' },
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // (Nov 13: every leg a quarter wider and longer again)
    // the first leg up the left-centre, between the trail's maples and the harbour (half as wide again since Nov 11:
    // members hit 6% of fairways the week before)
    { poly: blob(-12, 196, 40, 126, 1, 0.05), surface: 'fairway' },
    // a ribbon up the left past the harbour, and the run-in to the green
    { poly: blob(-10, 384, 42, 96, 2, 0.06), surface: 'fairway' },
    { poly: blob(14, 506, 42, 30, 3, 0.06), surface: 'fairway' },
    { poly: BREAKWATER, surface: 'fairway' },
    { poly: band([{ x: -46, y: -40 }, { x: -46, y: 650 }], 3), surface: 'path' },
    // Lake Shore Drive: asphalt, in play (a ball bounces and runs on it)
    { poly: rect(-106, -46, -54, 656), surface: 'path' },
    // the stone revetment along the water
    { poly: band([{ x: 100, y: -40 }, { x: 100, y: 290 }], 5), surface: 'stone' },
    { poly: band([{ x: 22, y: 296 }, { x: 22, y: 452 }], 4), surface: 'stone' },
    ...chiGreenRegions(GREEN, SEED),
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: rect(-60, -46, 166, 656), level: 0, look: 'sea', tide: { amp: 0.4, period: 9 } }],
  terrain: [
    { kind: 'ramp', x0: -110, y0: -50, x1: 170, y1: 660, axis: 'y', h0: LAND, h1: LAND, op: 'set' },
    // the lake: down the right, round the back of the green, and the harbour cut into the middle of the hole
    { kind: 'box', x0: 106, y0: -60, x1: 220, y1: 700, h: -6, edge: 1, op: 'set' },
    { kind: 'box', x0: HARBOUR.x0, y0: HARBOUR.y0, x1: HARBOUR.x1, y1: HARBOUR.y1, h: -6, edge: 1, op: 'set' },
    { kind: 'box', x0: -120, y0: 612, x1: 220, y1: 700, h: -6, edge: 1, op: 'set' },
    { kind: 'box', x0: 78, y0: 520, x1: 220, y1: 700, h: -6, edge: 1, op: 'set' },
    { kind: 'hill', x: -20, y: 140, r: 40, h: 0.6 },
    ...chiGreen(GREEN, LAND, [0.5, 0.6], [[-8, -6, 7, 0.25], [10, 6, 6, -0.2]]),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: [...trees, ...lights],
  movers: [],
  pushes: [],
  zones: [{ id: 'breakwater', poly: BREAKWATER }],
  secret: { name: 'The Breakwater', zone: 'breakwater', hint: 'Past the harbour a strip of fairway runs along its far wall. Carry the water and it runs out on there.' },
  flyover: [
    { x: 10, y: -30 },
    { x: -10, y: 240 },
    { x: -10, y: 440 },
    { x: 32, y: 564 },
  ],
  decor: [
    // a few patrons (Nov 13)
    teeGallery({ x: 0, y: 0 }),
    // on the lakefront trail, level with the green (the beach is in play, so nobody stands on it)
    gallery(-46, 556, FACE.east, 90, 14, 1),
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'banner', x: -26, y: -20, label: 'THE WINDY CITY' },
    { kind: 'streetsign', x: -58, y: 8, rot: Math.PI / 2, label: 'LAKE SHORE DR' },
    { kind: 'lake', x: 84, y: 300, rot: Math.PI / 2, scale: 0 }, // the city's land sits low, under the harbour
    { kind: 'traffic', x: -84, y: 300, rot: Math.PI / 2, scale: 900, size: [14, 0, 0] },
    { kind: 'walkers', x: -46, y: 300, rot: Math.PI / 2, scale: 600, size: [9, 0, 0] },
    { kind: 'hancock', x: -190, y: 920 },
    { kind: 'aon', x: 20, y: 1180 },
    { kind: 'willis', x: -440, y: 1400 },
    { kind: 'marina', x: -330, y: 1100 },
  ],
};
