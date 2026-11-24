// Hole 4, The Black Diamond (par 5, 780 yd as shown), a black diamond, the long one. One long run (Nov 24, Robbie: no
// shelves): off the top of the expert trail, in a gusting wind, straight down a single steep fairway to a small green in
// the firs, over a mountain stream. The run is crowned like a real ski slope: the middle is the high line, and either
// side it banks away into the trees, so a ball that drifts off the middle keeps running off it. Moguls in patches the
// whole way down, smooth groomed stretches between them, and firs dotted about the run. The mountain falls off a cliff
// down the whole right side.
// The play: driver down the middle, then two more down the run, picking a way between the mogul patches and the trees.
// Normal drives stop on the pitch where they land. Only a ball that's absolutely nuked (about 450 yd) gets onto the
// steeper lower run and keeps rolling down toward the green.
// The bail-out: the middle of the run. Off either side banks away into the trees; far right is the cliff.
// The secret: the Groomer. A strip of corduroy runs down the left of the lower run, clear of the moguls and the trees.
// Get a low runner onto it and it rides all the way down to the front of the green.
import { band, blob, rect } from '../../terrain';
import type { Hole, Piece, Post, V2 } from '../../types';
import { greenComplex, greenside } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_PLAY, POWDER_TURF, cliff, firs, moguls, profile } from './common';

const TOP = 150;
const GREEN = { x: -26, y: 1100, rx: 20, ry: 16 };
// the cliff edge down the right
const LIP = 70;
// the middle of the run, the high line, at y: a gentle wobble down the hill to the green
const mid = (y: number) => -4 + 8 * Math.sin(y / 170) - Math.max(0, y - 880) * 0.08;
const RUN: V2[] = [];
for (let y = 120; y <= 1060; y += 40) RUN.push({ x: mid(y), y });
// the groomer: down the left of the lower run to the front of the green
const GROOMER: V2[] = [
  { x: -40, y: 700 },
  { x: -42, y: 860 },
  { x: -40, y: 1020 },
  { x: -34, y: 1066 },
];
// the stream: across the front of the green, then up its left side
const STREAM: V2[] = [
  { x: 150, y: 1056 },
  { x: 20, y: 1060 },
  { x: -40, y: 1054 },
  { x: -62, y: 1086 },
  { x: -66, y: 1150 },
];
const traps = [greenside(GREEN, 0, 1110, 7, 8, 2, 3.4, 0), greenside(GREEN, -16, 1124, 9, 6, 3, 3.4, 0)];
// a cheap, steady jitter
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
// moguls in patches down the run, smooth groomed stretches between: [from y, to y, half-width, height, spacing]
const PATCHES: [number, number, number, number, number][] = [
  [250, 320, 30, 1.6, 16],
  [400, 490, 36, 2.0, 14],
  [560, 610, 22, 1.4, 18],
  [700, 800, 38, 2.2, 14],
  [880, 950, 30, 1.8, 15],
  [990, 1030, 20, 1.4, 16],
];
// (kept off the groomer)
const offGroomer = (p: V2) => !GROOMER.slice(1).some((b, i) => {
  const a = GROOMER[i];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2)));
  return Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t) < 9;
});
const bumps: Piece[] = PATCHES.flatMap(([y0, y1, w, h, step]) => {
  const c = mid((y0 + y1) / 2);
  return moguls(c - w, c + w, y0, y1, h, step).filter(offGroomer);
});
// firs dotted about the run: singles and the odd pair, never on the high line itself
const dotted: Post[] = [];
for (let y = 200, i = 0; y <= 1030; y += 34, i++) {
  const side = i % 2 ? 1 : -1;
  const off = 14 + hash(i, 1) * 26;
  const x = mid(y) + side * off;
  if (x > LIP - 10 || (y > 690 && !offGroomer({ x, y }))) continue;
  const h = 22 + Math.round(hash(i, 2) * 16);
  dotted.push({ x, y: y + hash(i, 3) * 20 - 10, r: Math.max(4, Math.round(h * 0.24)), h, soft: true, look: 'snowpine' });
  // now and then a second one close by
  if (hash(i, 4) > 0.6) dotted.push({ x: x + side * 9, y: y + 12, r: 4, h: h - 4, soft: true, look: 'snowpine' });
}

export const blackdiamond: Hole = {
  id: 'blackdiamond',
  name: 'The Black Diamond',
  par: 5,
  theme: 'alpine',
  tour: true,
  turf: POWDER_TURF,
  ...POWDER_PLAY,
  windByHeight: true,
  gusts: true,
  chipDrop: 0.7,
  greenFirm: 0.26, // a bit firmer (Nov 24, Robbie)
  yards: 780,
  blurb: 'Black diamond. One long steep run, crowned like a ski slope: moguls in patches, firs dotted about, and the cliff all down the right.',
  teeTip: 'Driver down the middle. Off the high line it banks away into the trees. Right is the cliff.',
  tee: { x: 0, y: 0 },
  cup: { x: -26, y: 1103 },
  pins: [{ x: -26, y: 1103 }, { x: -35, y: 1096 }, { x: -16, y: 1106 }, { x: -23, y: 1112 }],
  aim: -0.01,
  bounds: { x0: -150, y0: -50, x1: 150, y1: 1190 },
  border: [
    { x: -146, y: -46 },
    { x: 146, y: -46 },
    { x: 146, y: 150 },
    { x: LIP, y: 170 },
    { x: LIP, y: 950 },
    { x: 146, y: 970 },
    { x: 146, y: 1186 },
    { x: -146, y: 1186 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    // the run: one fairway, about 70 ft across, all the way down
    { poly: band(RUN, 35), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the lip of the cliff
    { poly: rect(LIP - 6, 170, LIP + 4, 950), surface: 'rock' },
    // the groomer: corduroy, firm and quick
    { poly: band(GROOMER, 4), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(STREAM, 9), level: 2, look: 'lake' }],
  terrain: [
    // one pitch, top to bottom: steep off the tee, a steady slope where drives come down, steeper below (only a
    // nuked drive gets that far and keeps running), easing out at the stream
    ...profile(-150, 150, [
      [-50, TOP],
      [20, TOP],
      [160, 112],
      // where drives come down (300 to 400 yd shown): a steady pitch that stops them
      [570, 92],
      // the lower run, steeper: only a nuked drive (about 450 yd) gets onto it and keeps running
      [600, 86],
      [1000, 18],
      [1050, 8],
      [1190, 6],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the crown: either side of the run banks away into the trees
    { kind: 'ramp', x0: -150, y0: -50, x1: -40, y1: 1040, axis: 'x', h0: -11, h1: 0, op: 'add' },
    { kind: 'ramp', x0: 34, y0: -50, x1: 150, y1: 1040, axis: 'x', h0: 0, h1: -11, op: 'add' },
    ...bumps,
    { kind: 'channel', pts: STREAM, width: 18, depth: 5 },
    // the groomer is pressed smooth and a touch low, so a ball on it keeps to it
    { kind: 'channel', pts: GROOMER, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, 5, { lift: 0.3, edge: 12, tilt: slope(GREEN, 9, [0.6, 0.8]), rolls: [[-9, -6, 9, 0.35], [10, 6, 9, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 970 }]),
  ],
  walls: [],
  posts: [
    ...dotted,
    ...firs([{ x: -96, y: 30 }, { x: -100, y: 1040 }], 24, 'bd-l', 1),
    ...firs([{ x: -96, y: 1060 }, { x: -96, y: 1170 }], 24, 'bd-gl', 1, 1),
    ...firs([{ x: 26, y: 1080 }, { x: 30, y: 1170 }], 24, 'bd-gr', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'groomer', poly: band(GROOMER, 4) }],
  secret: { name: 'The Groomer', zone: 'groomer', hint: 'A strip of corduroy runs down the left of the lower run, clear of the moguls and the trees. Get a low one rolling onto it.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 520 },
    { x: -6, y: 880 },
    { x: GREEN.x, y: GREEN.y },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'trailsign', x: -20, y: 12, rot: 0, label: 'black' },
    { kind: 'rock', x: LIP + 2, y: 420, scale: 5 },
    { kind: 'rock', x: LIP, y: 820, scale: 4 },
  ],
};
