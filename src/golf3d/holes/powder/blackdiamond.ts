// Hole 4, The Black Diamond (par 5, 780 yd as shown), a black diamond, the long one (Nov 23, Robbie's note: the moguls
// weren't in play). Off the top of the expert run, in a gusting wind, 80 ft down onto a long, flat fairway; past it a
// band of rock drops into the mogul field, big moguls with firs standing among them in the fairway, then a mountain
// stream across the front of a small green in the firs. The mountain falls off a cliff down the whole right side.
// The decision is the second shot. Lay up on the flat, short of the rock band, and it's a long third over the moguls;
// or go for it, down into the moguls, and it's a short third, if a mogul doesn't kick it into a tree.
// The bail-out: the flat. Left of it is the mountainside in deep powder; right is the cliff.
// The secret: the Groomer. A strip of corduroy runs down the left of the mogul field, clear of the moguls and the trees.
// From the end of the flat, a low runner off the rock band onto it rides all the way down.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post, V2 } from '../../types';
import { greenComplex, greenside, bunker, FAIRWAY_DEPTH } from '../woods';
import { slope } from '../atlantic/common';
import { POWDER_PLAY, POWDER_TURF, cliff, firs, moguls, profile } from './common';

const TOP = 150;
// where the flat ends: the band of rock drops into the mogul field
const BAND = 760;
const GREEN = { x: -26, y: 1100, rx: 20, ry: 16 };
// the cliff edge down the right
const LIP = 70;
// the groomer: down the left of the mogul field, through the ridge and on down the lower run
const GROOMER: V2[] = [
  { x: -58, y: BAND - 6 },
  { x: -62, y: 860 },
  { x: -56, y: 1020 },
];
// the stream: across the front of the green, then up its left side
const STREAM: V2[] = [
  { x: 150, y: 1056 },
  { x: 20, y: 1060 },
  { x: -40, y: 1056 },
  { x: -62, y: 1086 },
  { x: -66, y: 1150 },
];
const traps = [bunker(30, 640, 12, 9, 1, FAIRWAY_DEPTH, -0.3), greenside(GREEN, 0, 1110, 7, 8, 2, 3.4, 0), greenside(GREEN, -16, 1124, 9, 6, 3, 3.4, 0)];
// firs standing among the moguls, in the fairway, on a jittered grid (the groomer's lane down the left is kept clear)
const among: Post[] = [];
// (Nov 24, Robbie: a second shot cleared them easily) across the middle of the field, a band of big old firs, tall and
// close, 30 to 46 ft: a long second going for it is coming down through them (it used to clear them about one time in
// eight; now hardly ever). A high third from the lay-up is near the top of its flight there and gets over about half the
// time. Above and below the band they're shorter and thinner, as before.
const T0 = 860;
const T1 = 960;
const HT = 30;
for (let y = 800, row = 0; y <= 1010; y += y >= T0 && y < T1 ? 21 : 26, row++)
  for (let x = -40 + (row % 2 ? 10 : 0); x <= 42; x += y >= T0 && y < T1 ? 20 : 27) {
    const tall = y >= T0 && y < T1;
    const j = ((x * 13 + y * 7) % 9) - 4;
    const h = tall ? HT + ((x * 7 + y * 3) % 17) : 18 + ((x * 7 + y * 3) % 14);
    among.push({ x: x + j, y: y + ((x * 3 + y) % 9) - 4, r: Math.max(4, Math.round(h * 0.24)), h, soft: true, look: 'snowpine' });
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
  greenFirm: 0.2,
  yards: 780,
  blurb: 'Black diamond. Down onto the flat, then lay up short of the rock band or go for it into the moguls and trees. A cliff all down the right.',
  teeTip: 'Driver onto the flat. Then decide: lay up, or take on the moguls. Right is the cliff.',
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
    // the flat, where the drive comes down and the lay-up stops: 84 ft across, to the rock band
    { poly: blob(-4, 545, 33, 215, 1, 0.04), surface: 'fairway' },
    // the mogul field, below the rock band, down to the stream
    { poly: blob(-4, 905, 46, 125, 2, 0.05), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 3, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 3, 0.06), surface: 'green' },
    // the rock band across the hole
    { poly: rect(-150, BAND, 150, BAND + 16), surface: 'rock' },
    // the lip of the cliff
    { poly: rect(LIP - 6, 170, LIP + 4, 950), surface: 'rock' },
    // the groomer: corduroy, firm and quick, down the left of the moguls
    { poly: band(GROOMER, 4), surface: 'path' },
    ...traps.map((t) => t.region),
  ],
  water: [{ poly: band(STREAM, 9), level: 2, look: 'lake' }],
  terrain: [
    ...profile(-150, 150, [
      [-50, TOP],
      [20, TOP],
      // the drop onto the flat
      [200, 72],
      [330, 66],
      // the flat
      [BAND, 58],
      // the rock band: a 14 ft step down into the mogul field
      [BAND + 16, 44],
      // the mogul field, down to the stream
      [1050, 8],
      [1190, 6],
    ]),
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    // the mountainside rises on the left, so the run tips right, toward the cliff
    { kind: 'hill', x: -170, y: 450, r: 180, h: 16 },
    // the moguls, big and tight, where a second shot that goes for it lands
    ...moguls(-46, 44, 798, 1020, 2.2, 14),
    { kind: 'channel', pts: STREAM, width: 18, depth: 5 },
    // the groomer is pressed smooth and a touch below the moguls, so a ball on it keeps to it
    { kind: 'channel', pts: GROOMER, width: 7, depth: 0.8 },
    ...greenComplex(GREEN, 5, { lift: 0.3, edge: 12, tilt: slope(GREEN, 9, [0.6, 0.8]), rolls: [[-9, -6, 9, 0.35], [10, 6, 9, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
    // the cliff down the right
    cliff([{ x: LIP + 36, y: 150 }, { x: LIP + 36, y: 970 }]),
  ],
  walls: [],
  posts: [
    ...among,
    ...firs([{ x: -80, y: 30 }, { x: -84, y: 760 }], 24, 'bd-l', 1),
    ...firs([{ x: -96, y: 800 }, { x: -96, y: 1170 }], 24, 'bd-gl', 1, 1),
    ...firs([{ x: 26, y: 1080 }, { x: 30, y: 1170 }], 24, 'bd-gr', -1, 1),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'groomer', poly: band(GROOMER, 4) }],
  secret: { name: 'The Groomer', zone: 'groomer', hint: 'A strip of corduroy runs down the left of the mogul field, clear of the moguls and the trees. Get a low one onto it off the rock band.' },
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
    // the rock band, boulders along its lip either side of the run
    { kind: 'rock', x: -70, y: BAND + 4, scale: 5 },
    { kind: 'rock', x: 54, y: BAND + 6, scale: 4 },
    { kind: 'rock', x: LIP + 2, y: 420, scale: 5 },
    { kind: 'rock', x: LIP, y: 820, scale: 4 },
  ],
};
