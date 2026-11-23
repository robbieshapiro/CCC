// Hole 2, Blue Ridge Cruiser (par 4, 460 yd as shown), a blue square, a dogleg right. Down off the ridge to an upslope
// fairway on the left, with the mountain falling off a cliff beyond it; the hole turns right round a stand of firs in
// tree wells and runs down over a creek to the green.
// The play: a driver to the upper fairway on the left (it stops on the upslope), then a mid iron round the corner and
// over the creek.
// The reward: cut the corner. A full drive over the firs lands on the lower run beyond them and runs down toward the
// green: a wedge in. Short of that, it's in the trees.
// The bail-out: there isn't a safe one. Left is the cliff; right is the trees and their wells.
// The secret: the Cat Track. The groomers' road comes round the corner below the firs, worn into a groove, and crosses
// the creek on a snow bridge. From the end of the upper fairway, a low runner onto it rolls to the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_TURF, cliff, firs, profile } from './common';

const TOP = 110;
const GREEN = { x: 188, y: 690, rx: 13, ry: 11 };
// the crest at the top of the upper fairway
const CREST = 500;
// the cliff edge down the left
const LIP = -82;
// the cat track: from the end of the upper fairway, round below the firs, over the creek on its snow bridge
const TRACK: V2[] = [
  { x: -6, y: 500 },
  { x: 44, y: 548 },
  { x: 100, y: 590 },
  { x: 140, y: 622 },
  { x: 160, y: 650 },
  { x: 176, y: 676 },
];
// the creek across the front of the green, in two runs either side of the snow bridge
const CREEK_L: V2[] = [
  { x: 40, y: 640 },
  { x: 124, y: 624 },
];
const CREEK_R: V2[] = [
  { x: 154, y: 626 },
  { x: 230, y: 632 },
  { x: 300, y: 650 },
];
// the stand of firs on the corner, each in a tree well
const corner: Post[] = [];
const WELLS: [number, number][] = [];
for (let y = 270, row = 0; y <= 430; y += 20, row++)
  for (let x = 40 + (row % 2 ? 10 : 0); x <= 150; x += 20) {
    const h = 20 + ((x * 7 + y * 3) % 18);
    corner.push({ x, y, r: Math.max(4, Math.round(h * 0.25)), h, soft: true, look: 'snowpine' });
    if ((x + y) % 40 === 0) WELLS.push([x, y]);
  }
const traps = [greenside(GREEN, 168, 686, 6, 8, 2, 3.4, 0), greenside(GREEN, 206, 702, 7, 7, 3, 3.4, 0.4), greenside(GREEN, 190, 710, 8, 5, 4, 3.4, 0)];

export const blueridge: Hole = {
  id: 'blueridge',
  name: 'Blue Ridge Cruiser',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.2,
  yards: 460,
  blurb: 'Blue square. A dogleg right: the upper fairway, the cliff beyond it, then round the firs and over the creek. Or cut the corner.',
  teeTip: 'Driver up the left onto the upper fairway. A full one can carry the firs on the right.',
  tee: { x: 0, y: 0 },
  cup: { x: 188, y: 692 },
  pins: [{ x: 188, y: 692 }, { x: 180, y: 687 }, { x: 196, y: 694 }, { x: 186, y: 698 }],
  aim: -0.052, // the middle of the upper fairway, where a good drive lands
  bounds: { x0: -140, y0: -50, x1: 300, y1: 760 },
  border: [
    { x: -136, y: -46 },
    { x: 296, y: -46 },
    { x: 296, y: 756 },
    { x: -40, y: 756 },
    { x: LIP, y: 640 },
    { x: LIP, y: 160 },
    { x: -136, y: 140 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the upper fairway, on the upslope to the crest: 72 ft across, the cliff off its left
    { poly: blob(-24, 448, 32, 68, 1, 0.05), surface: 'fairway' },
    // the lower run beyond the firs, round the corner and down to the creek
    { poly: band([{ x: 30, y: 466 }, { x: 80, y: 530 }, { x: 126, y: 590 }, { x: 138, y: 606 }], 30), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the cat track: packed by the groomers (it plays as a path)
    { poly: band(TRACK, 3.5), surface: 'path' },
    // the lip of the cliff
    { poly: rect(LIP - 4, 160, LIP + 6, 640), surface: 'rock' },
    ...traps.map((t) => t.region),
  ],
  water: [
    { poly: band(CREEK_L, 10), level: 17, look: 'lake' },
    { poly: band(CREEK_R, 10), level: 17, look: 'lake' },
  ],
  terrain: [
    ...profile(-140, 300, [
      [-50, TOP],
      [20, TOP],
      [200, 60],
      [330, 46],
      // the upslope to the crest
      [CREST, 54],
      // and down round the corner to the creek and the green
      [640, 20],
      [760, 18],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the mountainside rises on the right, so the upper fairway tips left, toward the cliff
    { kind: 'hill', x: 260, y: 300, r: 200, h: 14 },
    // the tree wells: deep hollows round the trunks on the corner
    ...WELLS.map(([x, y]) => ({ kind: 'disc' as const, x, y, r: 9, h: -4, edge: 4, op: 'add' as const })),
    { kind: 'channel', pts: CREEK_L, width: 18, depth: 4 },
    { kind: 'channel', pts: CREEK_R, width: 18, depth: 4 },
    // the cat track sits a little into the snow, so a ball on it keeps to it
    { kind: 'channel', pts: TRACK, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, 18, { lift: 0.8, edge: 10, tilt: slope(GREEN, 10, [-0.5, 0.85]), rolls: [[-8, -5, 7, 0.35], [9, 5, 6, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the left
    cliff([{ x: LIP - 36, y: 140 }, { x: LIP - 36, y: 660 }, { x: -76, y: 780 }]),
  ],
  walls: [],
  posts: [...corner, ...firs([{ x: 120, y: 30 }, { x: 160, y: 280 }], 26, 'br-r', -1), ...firs([{ x: 250, y: 300 }, { x: 270, y: 600 }], 26, 'br-rr', -1, 1)],
  movers: [],
  pushes: [],
  zones: [{ id: 'cattrack', poly: band(TRACK.slice(0, 4), 3.5) }],
  secret: { name: 'The Cat Track', zone: 'cattrack', hint: 'The groomers\' road comes round below the firs and crosses the creek on a snow bridge. Get a low one rolling onto it from the upper fairway.' },
  flyover: [
    { x: 0, y: -24 },
    { x: -20, y: 400 },
    { x: 80, y: 560 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'blue' },
    { kind: 'rock', x: LIP, y: 300, scale: 5 },
    { kind: 'rock', x: LIP + 2, y: 520, scale: 4 },
  ],
};
