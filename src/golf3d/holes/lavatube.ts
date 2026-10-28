// Hole 6, The Homecoming (par 4, about 570 ft, 420 yd as shown): the walk home. A long, rising par 4 back up to the
// clubhouse, the sea down the left, and the hardest hole on the course.
// The barranca: a ditch of lava cuts across the fairway about 290 ft out. A big drive carries it and leaves an iron in;
// anything less has to lay up short of it and face a long second.
// The green: big and wild, in front of the clubhouse, with a tier, ridges and hollows. Two-putts are earned.
// The stands: either side of the green, every member of the Open who has finished the hole this month (their score on
// a card overhead), and the club's patrons.
// The culvert: at the right-hand end of the barranca a drain runs under the fairway. Roll a ball into its mouth and
// it comes out on the front of the green.
import { band, blob, circle, rect } from '../terrain';
import type { Decor, Hole, Post, V2 } from '../types';

const BASE = 24; // the fairway rises from here at the tee to the clubhouse
const TOP = 34;
const GREEN = { x: 22, y: 540, r: 34 };
const DITCH = { y0: 288, y1: 308 }; // the barranca, across the hole
const MOUTH = { x: 62, y: 280, r: 2.8 }; // the culvert, on the near bank at the right-hand end
const OUT: V2 = { x: 36, y: 506 }; // where the culvert lets out, on the front of the green

const way: V2[] = [
  { x: 0, y: 18 },
  { x: 6, y: 200 },
  { x: -4, y: 340 },
  { x: 8, y: 420 },
  { x: 20, y: 500 },
];

// the stadium: either side of the green, turned to face it
export const STANDS: Decor[] = [
  { kind: 'stands', x: -46, y: 570, rot: -1.12 },
  { kind: 'stands', x: 92, y: 570, rot: 1.12 },
];

const palms: Post[] = [
  [-70, 60], [-74, 160], [-78, 260], [-70, 420], [-66, 520], [86, 120], [92, 220], [96, 400], [90, 500],
].map(([x, y]) => ({ x, y, r: 1, h: 22, look: 'palm' as const }));
const rocks: Post[] = [[70, 30, 3], [-56, 380, 3.2], [110, 560, 3.4]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

const rise = (y: number) => BASE + ((TOP - BASE) * Math.max(0, Math.min(620, y))) / 620;

export const lavatube: Hole = {
  id: 'lavatube',
  name: 'The Homecoming',
  par: 4,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 24, y: 546 },
  // two on the lower front tier, two on the upper back one
  pins: [{ x: 24, y: 546 }, { x: 8, y: 524 }, { x: 40, y: 560 }, { x: 14, y: 562 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 170, y1: 700 },
  border: [
    { x: -166, y: -46 },
    { x: 166, y: -46 },
    { x: 166, y: 696 },
    { x: -166, y: 696 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -10, 12, 10), surface: 'fairway' },
    { poly: band(way, 40), surface: 'fringe' },
    // generous off the tee, tight past the barranca: the second shot comes from a narrow strip or the rough
    { poly: band(way.slice(0, 3), 34), surface: 'fairway' },
    { poly: band(way.slice(2), 22), surface: 'fairway' },
    // the barranca's banks: rough, so a ball that lands on the lip doesn't skip on
    { poly: rect(-100, DITCH.y0 - 6, 140, DITCH.y1 + 6), surface: 'rough' },
    // a cinder track off the right of the fairway to the culvert's mouth
    { poly: band([{ x: 30, y: 230 }, { x: 50, y: 262 }, { x: MOUTH.x, y: MOUTH.y }], 3.5), surface: 'path' },
    { poly: circle(MOUTH.x, MOUTH.y, MOUTH.r + 3), surface: 'stone' },
    // the green and its fringe, with bunkers round it
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 5, GREEN.r + 4, 6, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r * 0.9, 6, 0.06), surface: 'green' },
    { poly: blob(-14, 514, 8, 6, 7, 0.15), surface: 'sand' },
    { poly: blob(64, 532, 9, 7, 8, 0.15), surface: 'sand' },
    { poly: blob(24, 584, 10, 5, 9, 0.15), surface: 'sand' },
    { poly: blob(-30, 420, 9, 6, 10, 0.15), surface: 'sand' },
  ],
  water: [
    // the sea down the left, below the cliff
    { poly: rect(-166, -46, -96, 696), level: 0, look: 'sea', tide: { amp: 1, period: 40 } },
    // the barranca: a ditch of lava right across the hole
    { poly: rect(-100, DITCH.y0, 140, DITCH.y1), level: rise(DITCH.y0) - 5, look: 'lava', tide: { amp: 0.6, period: 8 } },
  ],
  terrain: [
    // the land rises gently from the tee to the clubhouse
    { kind: 'ramp', x0: -170, y0: 0, x1: 170, y1: 620, axis: 'y', h0: BASE, h1: TOP, op: 'set' },
    // the cliff down to the sea on the left
    { kind: 'box', x0: -170, y0: -50, x1: -98, y1: 700, h: -8, edge: 14, op: 'set' },
    // the barranca, cut down below the lava
    { kind: 'box', x0: -100, y0: DITCH.y0, x1: 140, y1: DITCH.y1, h: rise(DITCH.y0) - 9, edge: 4, op: 'set' },
    // the culvert's mouth: a dip in the bank so a ball that rolls near drops in
    { kind: 'hill', x: MOUTH.x, y: MOUTH.y, r: 9, h: -1.6 },
    // the green: lower tier in front, upper tier behind, a ridge between, and hollows and humps on both
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 8, h: rise(GREEN.y) + 1, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 6, x1: GREEN.x + 40, y1: GREEN.y + 10, axis: 'y', h0: 0, h1: 2.2, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 40, x1: GREEN.x + 40, y1: GREEN.y + 40, axis: 'x', h0: 0.9, h1: -0.9, op: 'add' },
    { kind: 'hill', x: GREEN.x - 14, y: GREEN.y - 14, r: 9, h: -1 },
    { kind: 'hill', x: GREEN.x + 16, y: GREEN.y - 8, r: 8, h: 0.9 },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y + 20, r: 10, h: 0.8 },
    { kind: 'hill', x: GREEN.x + 18, y: GREEN.y + 22, r: 7, h: -0.8 },
    ...[[-14, 514, 8], [64, 532, 9], [24, 584, 10], [-30, 420, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.2, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...palms, ...rocks],
  movers: [],
  pushes: [],
  portals: [{ id: 'seaarch', x: MOUTH.x, y: MOUTH.y, r: MOUTH.r, to: OUT, delay: 2 }],
  zones: [{ id: 'seaarch', poly: circle(MOUTH.x, MOUTH.y, MOUTH.r) }],
  secret: { name: 'The Culvert', zone: 'seaarch', hint: 'A drain runs under the fairway from the right-hand end of the barranca. Find its mouth.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 260 },
    { x: 20, y: 440 },
    { x: 24, y: 546 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 14, y: -8, rot: 0 },
    { kind: 'clubhouse', x: 22, y: 640, rot: Math.PI / 2, scale: 170 },
    ...STANDS,
  ],
};
