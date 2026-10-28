// Hole 6, The Homecoming (par 4, about 640 ft, 470 yd as shown): the walk home. A long par 4 back down to the
// clubhouse, the sea down the left, and the hardest hole on the course.
// The barranca: a ditch of lava cuts across the fairway about 320 ft out. A full drive carries it; anything less finds
// it or lays up short.
// The speed slot: past the barranca the fairway rises gently to a lip, and from the lip a cinder gully runs straight
// down the middle of the hill toward the green. Only a drive that's absolutely nuked down the middle carries far enough
// to land in it, and then the slope takes it most of the way home. Everyone else has a long second.
// The green: big and wild, in a bowl, with a tier, ridges and hollows. Two-putts are earned.
// The stadium: the green sits in a bowl with a bank of seats right round it, the back and both sides, packed with
// every member of the Open who has finished the hole this month (their score on a card overhead) and the club's
// patrons. The bank also stops a ball that's long from going far.
import { band, blob, rect } from '../terrain';
import type { Decor, Hole, Post, V2 } from '../types';

const TEE = 34; // the tee, up on the headland
const PLATEAU = 30; // the landing area past the barranca
const CREST = 34; // it rises gently to the lip, so an ordinary drive pulls up short of it
const LIP = 440; // where the plateau ends and the hill down to the green begins
const LOW = 18; // the floor of the bowl
const GREEN = { x: 8, y: 640, r: 34 };
const DITCH = { y0: 318, y1: 338 }; // the barranca, across the hole
// the speed slot: down the middle of the hill from the lip to just short of the green
const SLOT: V2[] = [
  { x: 0, y: LIP - 8 },
  { x: 2, y: 500 },
  { x: 6, y: 590 },
];

// ground height down the hole, before the green and its bowl
const ground = (y: number) =>
  y <= DITCH.y0 ? TEE - ((TEE - PLATEAU) * Math.max(0, y)) / DITCH.y0 : y <= LIP ? PLATEAU + ((CREST - PLATEAU) * (y - DITCH.y0)) / (LIP - DITCH.y0) : CREST - ((CREST - LOW) * Math.min(1, (y - LIP) / (GREEN.y - 40 - LIP)));

const way: V2[] = [
  { x: 0, y: 18 },
  { x: 4, y: 200 },
  { x: -4, y: 340 },
  { x: 0, y: LIP },
  { x: 4, y: 520 },
  { x: 8, y: 600 },
];

// The stadium: a horseshoe of banks round the back and both sides of the green, on the rim of the bowl, each turned
// to face the pin. The open end faces the tee, so the approach can run in.
const RING = 62;
export const STANDS: Decor[] = Array.from({ length: 11 }, (_, i) => {
  const a = ((i - 5) * 25 * Math.PI) / 180; // -125° to 125°, 0 straight behind the green
  return { kind: 'stands' as const, x: GREEN.x + Math.sin(a) * RING, y: GREEN.y + Math.cos(a) * RING, rot: a };
});
// the rim of the bowl the stands sit on
const BERM: V2[] = Array.from({ length: 15 }, (_, i) => {
  const a = ((i - 7) * 20 * Math.PI) / 180;
  return { x: GREEN.x + Math.sin(a) * (RING + 8), y: GREEN.y + Math.cos(a) * (RING + 8) };
});

const palms: Post[] = [
  [-70, 60], [-74, 160], [-78, 260], [-70, 420], [-72, 520], [86, 120], [92, 220], [96, 400], [96, 500],
].map(([x, y]) => ({ x, y, r: 1, h: 22, look: 'palm' as const }));
const rocks: Post[] = [[70, 30, 3], [-56, 380, 3.2], [60, 440, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const lavatube: Hole = {
  id: 'lavatube',
  name: 'The Homecoming',
  par: 4,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 10, y: 646 },
  // two on the lower front tier, two on the upper back one
  pins: [{ x: 10, y: 646 }, { x: -6, y: 624 }, { x: 26, y: 660 }, { x: 0, y: 662 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 170, y1: 800 },
  border: [
    { x: -166, y: -46 },
    { x: 166, y: -46 },
    { x: 166, y: 796 },
    { x: -166, y: 796 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -10, 12, 10), surface: 'fairway' },
    { poly: band(way, 42), surface: 'fringe' },
    // generous off the tee, tighter on the hill down to the green
    { poly: band(way.slice(0, 4), 36), surface: 'fairway' },
    { poly: band(way.slice(3), 24), surface: 'fairway' },
    // the barranca's banks: rough, so a ball that lands on the lip doesn't skip on
    { poly: rect(-100, DITCH.y0 - 6, 140, DITCH.y1 + 6), surface: 'rough' },
    // the speed slot: a gully of hard-packed track, quick as you like
    { poly: band(SLOT, 6), surface: 'path' },
    // the green and its fringe, with bunkers round it
    { poly: blob(GREEN.x, GREEN.y, GREEN.r + 5, GREEN.r + 4, 6, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r * 0.9, 6, 0.06), surface: 'green' },
    { poly: blob(-30, 616, 8, 6, 7, 0.15), surface: 'sand' },
    { poly: blob(48, 628, 9, 7, 8, 0.15), surface: 'sand' },
    { poly: blob(-24, 520, 9, 6, 10, 0.15), surface: 'sand' },
    { poly: blob(34, 470, 8, 6, 11, 0.15), surface: 'sand' },
  ],
  water: [
    // the sea down the left, below the cliff
    { poly: rect(-166, -46, -96, 796), level: 0, look: 'sea', tide: { amp: 1, period: 40 } },
    // the barranca: a ditch of lava right across the hole
    { poly: rect(-100, DITCH.y0, 140, DITCH.y1), level: ground(DITCH.y0) - 5, look: 'lava', tide: { amp: 0.6, period: 8 } },
  ],
  terrain: [
    // the land: down off the tee to the barranca, flat out to the lip, then down the hill to the bowl
    { kind: 'ramp', x0: -170, y0: -50, x1: 170, y1: DITCH.y0, axis: 'y', h0: TEE, h1: ground(DITCH.y0), op: 'set' },
    { kind: 'ramp', x0: -170, y0: DITCH.y0, x1: 170, y1: LIP, axis: 'y', h0: PLATEAU, h1: CREST, op: 'set' },
    { kind: 'ramp', x0: -170, y0: LIP, x1: 170, y1: GREEN.y - 40, axis: 'y', h0: CREST, h1: LOW, op: 'set' },
    { kind: 'ramp', x0: -170, y0: GREEN.y - 40, x1: 170, y1: 800, axis: 'y', h0: LOW, h1: LOW, op: 'set' },
    // the cliff down to the sea on the left
    { kind: 'box', x0: -170, y0: -50, x1: -98, y1: 800, h: -8, edge: 14, op: 'set' },
    // the barranca, cut down below the lava
    { kind: 'box', x0: -100, y0: DITCH.y0, x1: 140, y1: DITCH.y1, h: ground(DITCH.y0) - 9, edge: 4, op: 'set' },
    // the speed slot, cut into the hill: a ball in it stays in it and runs
    { kind: 'channel', pts: SLOT, width: 6, depth: 2.2, taper: 30 },
    // the bowl's rim, round the back and sides, with the stands on it
    { kind: 'embankment', pts: BERM, h: BERM.map(() => LOW + 12), width: 10, edge: 18 },
    // the green: lower tier in front, upper tier behind, a ridge between, and hollows and humps on both
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 8, h: LOW + 1, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 6, x1: GREEN.x + 40, y1: GREEN.y + 10, axis: 'y', h0: 0, h1: 2.2, op: 'add' },
    { kind: 'ramp', x0: GREEN.x - 40, y0: GREEN.y - 40, x1: GREEN.x + 40, y1: GREEN.y + 40, axis: 'x', h0: 0.9, h1: -0.9, op: 'add' },
    { kind: 'hill', x: GREEN.x - 14, y: GREEN.y - 14, r: 9, h: -1 },
    { kind: 'hill', x: GREEN.x + 16, y: GREEN.y - 8, r: 8, h: 0.9 },
    { kind: 'hill', x: GREEN.x - 6, y: GREEN.y + 20, r: 10, h: 0.8 },
    { kind: 'hill', x: GREEN.x + 18, y: GREEN.y + 22, r: 7, h: -0.8 },
    ...[[-30, 616, 8], [48, 628, 9], [-24, 520, 9], [34, 470, 8]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.2, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...palms, ...rocks],
  movers: [],
  pushes: [],
  // the slot counts once the ball is rolling in it (feat id kept from the old culvert)
  zones: [{ id: 'seaarch', poly: band([SLOT[0], { x: 1, y: LIP + 40 }], 6) }],
  secret: { name: 'The Speed Slot', zone: 'seaarch', hint: 'Absolutely nuke one down the middle and it finds the gully off the lip. The hill does the rest.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 300 },
    { x: 4, y: 520 },
    { x: 10, y: 646 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 14, y: -8, rot: 0 },
    { kind: 'clubhouse', x: GREEN.x, y: 770, rot: Math.PI / 2, scale: 170 },
    ...STANDS,
  ],
};

