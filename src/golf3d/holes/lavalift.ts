// Hole 4, The Lava Lift (par 3, about 240 ft, 175 yd as shown): across a wide gorge of lava to a green on a slab of rock.
// The play: carry the gorge and hold the slab. It's a driver, eased off; an iron finds the lava. Behind the slab a wall of
// rock gives a long shot a chance; short is the gorge.
// The lift: a pillar of rock stands in the gorge with a geyser in its top that goes off every few seconds. Land one on
// the pillar as it fires and it throws you up onto the slab. Land on it between eruptions and it rolls off into the lava.
// The live hazard: the lava in the gorge rises and falls. When it's up it floods the slab's front apron, so a shot
// that comes up just short is gone; when it's down the apron is dry and you can chip from it.
// The secret: a ledge runs round the left end of the gorge. Roll one along it and it comes in from the side.
import { band, blob, circle, rect } from '../terrain';
import { extend } from './extend';
import type { Hole, Post, V2 } from '../types';

const RIM = 30; // the tee and the far side sit up here; the gorge is cut down to the lava
const LAVA = 8;
const SLAB = { x: 6, y: 182 };
const GREEN = { x: 6, y: 186, rx: 22, ry: 18 };

// the ledge: off the left of the tee, round the end of the gorge and in along the slab's flank
const ledge: V2[] = [
  { x: -16, y: 10 },
  { x: -52, y: 40 },
  { x: -84, y: 80 },
  { x: -92, y: 120 },
  { x: -80, y: 158 },
  { x: -52, y: 178 },
  { x: -20, y: 186 },
];
const ledgeH = ledge.map((_, i) => RIM - 0.5 - (i / (ledge.length - 1)) * 6);

const rocks: Post[] = [
  [40, 20, 3.2], [-30, -20, 3], [110, 230, 3.6], [-110, 240, 3.4], [60, 250, 3],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));

const base: Hole = {
  id: 'lavalift',
  name: 'The Lava Lift',
  par: 3,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 8, y: 190 },
  pins: [{ x: 8, y: 190 }, { x: -4, y: 182 }, { x: 18, y: 192 }, { x: 4, y: 198 }],
  aim: 0,
  bounds: { x0: -140, y0: -40, x1: 140, y1: 290 },
  border: [
    { x: -136, y: -36 },
    { x: 136, y: -36 },
    { x: 136, y: 286 },
    { x: -136, y: 286 },
  ],
  base: 'rock',
  regions: [
    { poly: blob(0, 0, 26, 20, 1, 0.1), surface: 'rough' },
    { poly: rect(-14, -12, 14, 12), surface: 'fairway' },
    { poly: band(ledge, 4), surface: 'path' },
    // the slab: an apron that floods at the front, the green on top
    { poly: blob(SLAB.x, SLAB.y, 44, 36, 2, 0.08), surface: 'rough' },
    { poly: blob(SLAB.x, SLAB.y - 22, 30, 12, 3, 0.1), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    { poly: blob(36, 200, 6, 5, 5, 0.15), surface: 'sand' },
  ],
  water: [
    // the gorge: the lava swells up over the apron and sinks back
    { poly: rect(-74, 50, 136, 156), level: LAVA, look: 'lava', tide: { amp: 2.6, period: 14 } },
  ],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -40, x1: 140, y1: 290, axis: 'y', h0: RIM, h1: RIM, op: 'set' },
    // the gorge, open at the left where the ledge goes round
    { kind: 'box', x0: -70, y0: 54, x1: 140, y1: 156, h: -RIM + 4, edge: 14, op: 'add' },
    // the slab: a table of rock whose front slopes down to the lava as an apron
    { kind: 'disc', x: SLAB.x, y: SLAB.y, r: 46, h: RIM - 10, edge: 10, op: 'set' },
    { kind: 'ramp', x0: SLAB.x - 50, y0: SLAB.y - 36, x1: SLAB.x + 50, y1: SLAB.y - 12, axis: 'y', h0: -14, h1: 0, op: 'add' },
    // the green: tipped toward the gorge, with a rise at the back
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 26, x1: GREEN.x + 30, y1: GREEN.y + 26, axis: 'y', h0: -0.5, h1: 0.6, op: 'add' },
    { kind: 'hill', x: GREEN.x + 8, y: GREEN.y + 4, r: 12, h: 0.4 },
    // a wall of rock behind the slab
    { kind: 'ramp', x0: -140, y0: 230, x1: 140, y1: 290, axis: 'y', h0: 0, h1: 22, op: 'add' },
    // the ledge round the end of the gorge, with a groove to keep a ball on it
    { kind: 'embankment', pts: ledge, h: ledgeH, width: 4, edge: 8 },
    { kind: 'channel', pts: ledge, width: 4, depth: 0.8, taper: 20 },
    // bunker
    { kind: 'disc', x: 36, y: 200, r: 6, h: -1.1, edge: 3, op: 'add' },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [],
  zones: [{ id: 'ledge', poly: band(ledge.slice(2, 6), 3.4) }],
  secret: { name: 'The Ledge', zone: 'ledge', hint: 'The gorge ends on the left. A ledge runs round it. Roll one along it and let it find the slab.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 30, y: 90 },
    { x: 8, y: 190 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'lavafount', x: 70, y: 104, scale: 0.9 },
    { kind: 'lavafount', x: -30, y: 96, scale: 0.7 },
  ],
};

// the gorge is 50 ft wider than it was drawn: everything from its middle on slides back
const PILLAR = { x: 8, y: 150, r: 8 };
const VENT_R = 3.2;
const PERIOD = 6;
const firing = (t: number) => t % PERIOD > PERIOD - 1.5;
const long = extend(base, 100, 50);

export const lavalift: Hole = {
  ...long,
  terrain: [
    ...long.terrain,
    // the pillar: a column of rock up out of the lava, its top domed so a ball that isn't thrown rolls off
    { kind: 'disc', x: PILLAR.x, y: PILLAR.y, r: PILLAR.r, h: LAVA + 6, edge: 3, op: 'set' },
    { kind: 'hill', x: PILLAR.x, y: PILLAR.y, r: PILLAR.r, h: 1.6 },
  ],
  pushes: [
    {
      id: 'lift',
      look: 'geyser',
      x: PILLAR.x,
      y: PILLAR.y,
      r: VENT_R,
      at: () => ({ x: 0, y: 0 }),
      // up and on toward the slab
      erupt: (t) => (firing(t) ? { x: 0, y: 36, z: 32 } : null),
    },
  ],
  zones: [...long.zones, { id: 'liftoff', poly: circle(PILLAR.x, PILLAR.y, VENT_R) }],
};
