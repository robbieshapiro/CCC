// Hole 3, The Carry (par 3, about 185 ft, 135 yd as shown): the finisher, and all carry, from one cliff top to
// another over a cove where the surf comes in.
// The play: a high iron to the headland green. Short is the sea; long is the rocks.
// The bail-out: the cliff top swings round the left of the cove, for a chip on.
// The secret: Sea Lion Rock, a flat-topped rock in the cove. Land it there and you're a chip from the pin.
import { band, blob, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const GREEN = { x: 10, y: 182, rx: 16, ry: 13 };
const ROCK = { x: -12, y: 136, r: 9 };
// the cliff top round the left of the cove
const BAIL: V2[] = [
  { x: -30, y: 10 },
  { x: -86, y: 70 },
  { x: -92, y: 150 },
  { x: -48, y: 196 },
];

const cypress: Post[] = [
  { x: -40, y: -24, r: 2.4, h: 22, look: 'torrey' },
  { x: -118, y: 96, r: 2.2, h: 20, look: 'torrey' },
  { x: -112, y: 190, r: 2.2, h: 20, look: 'torrey' },
  { x: -48, y: 232, r: 2.4, h: 22, look: 'torrey' },
];

const rocks: Post[] = [
  [52, 206, 3], [40, 222, 2.6], [-6, 224, 2.8], [60, 160, 2.4],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

export const thecarry: Hole = {
  id: 'thecarry',
  name: 'The Carry',
  par: 3,
  theme: 'coastal',
  tour: true,
  chipDrop: 0.7,
  noCart: true, // the tee is out on its own bluff: nowhere for the cart to come from
  yards: 135,
  blurb: 'Cliff top to cliff top, over the cove. Short is the sea. The cliff swings round the left if you need it.',
  tee: { x: 0, y: 0 },
  cup: { x: 10, y: 184 },
  pins: [{ x: 10, y: 184 }, { x: 0, y: 176 }, { x: 20, y: 188 }, { x: 6, y: 192 }],
  greenFirm: 0.06,
  aim: 0.05,
  bounds: { x0: -150, y0: -50, x1: 120, y1: 270 },
  border: [
    { x: -146, y: -46 },
    { x: 116, y: -46 },
    { x: 116, y: 266 },
    { x: -146, y: 266 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-12, -12, 12, 12), surface: 'fairway' },
    // the bail-out, up on the cliff round the left
    { poly: band(BAIL.slice(1), 18), surface: 'fairway' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 1, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 1, 0.06), surface: 'green' },
    { poly: blob(-20, 196, 7, 6, 2, 0.15), surface: 'sand' },
    { poly: blob(38, 196, 6, 8, 3, 0.15), surface: 'sand' },
    // the top of Sea Lion Rock, worn smooth
    { poly: circle(ROCK.x, ROCK.y, ROCK.r - 1), surface: 'fringe' },
  ],
  water: [{ poly: rect(-146, -46, 116, 266), level: 0, look: 'sea', tide: { amp: 1, period: 44 } }],
  terrain: [
    { kind: 'ramp', x0: -150, y0: -50, x1: 120, y1: 270, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the tee, out on its own bluff
    { kind: 'embankment', pts: [{ x: 0, y: -50 }, { x: 0, y: 14 }], h: [27, 26], width: 34, edge: 10, wobble: 4 },
    // the cliff round the left of the cove
    { kind: 'embankment', pts: BAIL, h: [25.5, 24, 23, 22.5], width: 26, edge: 10, wobble: 5 },
    // the headland the green sits on
    { kind: 'embankment', pts: [{ x: -48, y: 200 }, { x: 10, y: 196 }, { x: 44, y: 190 }], h: [22.5, 22, 22], width: 30, edge: 10, wobble: 4 },
    // the land behind, up to the back of the hole
    { kind: 'embankment', pts: [{ x: -146, y: 250 }, { x: 116, y: 250 }], h: [23, 23], width: 18, edge: 10, wobble: 4 },
    // Sea Lion Rock: a flat top a few feet below the green
    { kind: 'disc', x: ROCK.x, y: ROCK.y, r: ROCK.r + 5, h: 17, edge: 7, op: 'set' },
    // weathered: lumpy shoulders, and a buttress running down into the water
    { kind: 'hill', x: ROCK.x + 7, y: ROCK.y - 6, r: 9, h: -3 },
    { kind: 'hill', x: ROCK.x - 8, y: ROCK.y + 4, r: 8, h: -4 },
    // the green: a shelf, a touch higher at the back
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.rx + 8, h: 21.8, edge: 8, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.35, h1: 0.35, op: 'add' },
    ...[[-20, 196, 7], [38, 196, 7]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...cypress, ...rocks],
  movers: [],
  pushes: [],
  zones: [{ id: 'sealionrock', poly: circle(ROCK.x, ROCK.y, ROCK.r - 1) }],
  secret: { name: 'Sea Lion Rock', zone: 'sealionrock', hint: 'There is a flat-topped rock out in the cove. Land one on it and stay dry.' },
  flyover: [
    { x: 20, y: -30 },
    { x: 40, y: 60 },
    { x: 30, y: 140 },
    { x: 10, y: 184 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -12, rot: 0 },
    { kind: 'iceplant', x: -22, y: 16, scale: 1.2 },
    { kind: 'iceplant', x: -96, y: 110, scale: 1.4 },
    { kind: 'iceplant', x: 44, y: 172, scale: 1 },
    // the rock's own residents
    { kind: 'sealions', x: ROCK.x + 2, y: ROCK.y + 3, rot: 0.4 },
    { kind: 'iceplant', x: -70, y: 40, scale: 1 },
  ],
};
