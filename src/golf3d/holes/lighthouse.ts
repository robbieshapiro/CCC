// Hole 2, The Lighthouse (par 5, about 800 ft, 585 yd as shown): the long way out along the cliffs, the sea on the
// left, to a green on the point under the lighthouse.
// The play: a drive up the right, a wood past the cove, then a wedge in.
// The gamble: carry the cove with the second and you're a wedge from the green. Short of it is the sandbar, or the sea.
// The secret: the keeper's road comes down off the rise behind the cove, straight at the green. Roll one down it.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: 20, y: 676, rx: 19, ry: 15 };
const LIGHT = { x: -34, y: 728 };
// the keeper's road, down from the rise to the front of the green
const ROAD: V2[] = [
  { x: 96, y: 470 },
  { x: 84, y: 540 },
  { x: 58, y: 600 },
  { x: 30, y: 650 },
];
const ROAD_H = [27, 25.2, 23.4, 21.8];

const cypress: Post[] = [
  // down the right, along the road
  ...[60, 150, 240, 330, 420].map((y, i) => ({ x: 176 + (i % 2) * 14, y, r: 2.2, h: 20, look: 'monterey' as const })),
  ...[560, 640, 710].map((y, i) => ({ x: 130 + (i % 2) * 12, y, r: 2.2, h: 20, look: 'monterey' as const })),
  // the lone one out on the corner of the cove
  { x: 6, y: 300, r: 2.4, h: 22, look: 'monterey' },
];

const rocks: Post[] = [
  [-52, 80, 3], [-56, 210, 3.2], [-76, 470, 3], [-30, 610, 2.6], [56, 726, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

const base: Hole = {
  id: 'lighthouse',
  name: 'The Lighthouse',
  par: 5,
  theme: 'coastal',
  tour: true,
  yards: 585,
  maxTime: 30,
  greenFirm: 0.04,
  blurb: 'The long one, with the sea on the left. Carry the cove with your second if you dare.',
  tee: { x: 0, y: 0 },
  cup: { x: 22, y: 678 },
  pins: [{ x: 22, y: 678 }, { x: 10, y: 670 }, { x: 32, y: 684 }, { x: 16, y: 688 }],
  aim: 0.02,
  bounds: { x0: -150, y0: -50, x1: 220, y1: 770 },
  border: [
    { x: -146, y: -46 },
    { x: 216, y: -46 },
    { x: 216, y: 766 },
    { x: -146, y: 766 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the drive
    { poly: blob(40, 190, 30, 116, 1, 0.08), surface: 'fringe' },
    { poly: blob(40, 190, 26, 112, 1, 0.08), surface: 'fairway' },
    // the layup, right of the cove
    { poly: blob(110, 430, 28, 40, 2, 0.1), surface: 'fairway' },
    { poly: blob(78, 346, 9, 7, 9, 0.15), surface: 'sand' },
    // over the cove: the landing short of the green
    { poly: blob(6, 580, 34, 34, 3, 0.1), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    { poly: band(ROAD, 3.2), surface: 'path' },
    // a sandbar out in the cove, dry at low tide
    { poly: blob(-30, 420, 36, 20, 5, 0.12), surface: 'sand' },
    // bunkers
    { poly: blob(56, 690, 7, 9, 6, 0.15), surface: 'sand' },
    { poly: blob(-10, 650, 7, 6, 7, 0.15), surface: 'sand' },
    { poly: blob(88, 260, 8, 12, 8, 0.15), surface: 'sand' },
    { poly: circle(LIGHT.x, LIGHT.y, 9), surface: 'stone' },
  ],
  water: [{ poly: rect(-146, -46, 216, 766), level: 0, look: 'sea', tide: { amp: 1, period: 56 } }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 220, y1: 770, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the coast up the right-hand side: high ground, falling slowly toward the point
    { kind: 'embankment', pts: [{ x: 120, y: -50 }, { x: 150, y: 260 }, { x: 172, y: 430 }, { x: 140, y: 770 }], h: [28, 27, 26.5, 23], width: 116, edge: 10, wobble: 6 },
    // the first leg reaches out left of that, to the cliff edge
    { kind: 'embankment', pts: [{ x: 10, y: -50 }, { x: 0, y: 160 }, { x: 16, y: 290 }], h: [28, 27.5, 26.8], width: 48, edge: 10, wobble: 6 },
    // past the cove, the point the green sits on
    { kind: 'embankment', pts: [{ x: 60, y: 540 }, { x: 10, y: 600 }, { x: 0, y: 690 }, { x: -30, y: 730 }], h: [24.5, 23.4, 22, 22], width: 44, edge: 10, wobble: 5 },
    // the sandbar: low sand out in the cove, just above the low tide
    { kind: 'embankment', pts: [{ x: -60, y: 420 }, { x: 0, y: 420 }], h: [1.4, 1.4], width: 12, edge: 14 },
    // the tee up on its knoll
    { kind: 'disc', x: 0, y: 0, r: 16, h: 29, edge: 10, op: 'set' },
    // the rise behind the cove that the road comes off
    { kind: 'hill', x: 104, y: 470, r: 40, h: 1.4 },
    // rolls in the fairway
    { kind: 'hill', x: 50, y: 140, r: 30, h: 1.2 },
    { kind: 'hill', x: 20, y: 250, r: 24, h: -0.8 },
    // the keeper's road: a gentle, steady fall to the green
    { kind: 'embankment', pts: ROAD, h: ROAD_H, width: 4, edge: 4 },
    // two wheel ruts worn into it, so a rolling ball keeps to the road
    { kind: 'channel', pts: ROAD, width: 4.5, depth: 0.7 },
    // the green: a big shelf, tipped back toward the lighthouse
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: 21.6, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.3, h1: 0.3, op: 'add' },
    { kind: 'hill', x: GREEN.x + 8, y: GREEN.y - 6, r: 12, h: -0.35 },
    ...[[56, 690, 8], [-10, 650, 7], [88, 260, 10], [78, 346, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...cypress, ...rocks, { x: LIGHT.x, y: LIGHT.y, r: 5.5, h: 50, e: 0.4, look: 'lighthouse' }],
  movers: [],
  pushes: [],
  zones: [{ id: 'road', poly: band(ROAD.slice(0, 3), 3.2) }],
  secret: { name: "The Keeper's Road", zone: 'road', hint: 'The old road comes down off the rise past the cove, straight at the green. Roll one down it.' },
  flyover: [
    { x: -40, y: -40 },
    { x: -60, y: 220 },
    { x: -40, y: 470 },
    { x: 20, y: 676 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -10, rot: 0 },
    { kind: 'bench', x: -20, y: -12, rot: -0.2 },
    { kind: 'iceplant', x: -36, y: 40, scale: 1.4 },
    { kind: 'iceplant', x: -40, y: 160, scale: 1.2 },
    { kind: 'iceplant', x: -24, y: 300, scale: 1.2 },
    { kind: 'iceplant', x: 60, y: 520, scale: 1 },
    { kind: 'iceplant', x: -36, y: 640, scale: 1.2 },
  ],
};

// 110 ft longer than it was drawn, from the cove on: two big hits can't get home, so it plays as a true three-shotter
export const lighthouse = extend(base, 300, 110);
