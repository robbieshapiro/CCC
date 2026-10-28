// Hole 6, The Ascent (par 5, about 670 ft, 490 yd as shown): the craziest hole on the course, and the hardest. Three
// islands of turf stand up out of the sea on spires of rock, each higher than the last, and you hop from one to the next
// up to the final green: a bowl cut into the side of the volcano itself, which gathers a ball toward the middle. Miss
// an island and it's the sea, a long way down. A big drive can skip the first island.
// The stands: the volcano's flank behind the green is a stadium, full of members who have finished the hole this month
// (their score on it on a card overhead) and the club's patrons.
// The updraft: a vent on the last island blows every few seconds. Roll onto it as it goes and it lifts you onto the green.
import { blob, circle, rect } from '../terrain';
import type { Decor, Hole, Post } from '../types';

// the tee and the three islands: where, how big, how high
const TEE = { x: 0, y: 0, r: 24, h: 30 };
const ISLES = [
  { x: 0, y: 180, r: 30, h: 42 },
  { x: 36, y: 345, r: 30, h: 56 },
  { x: -14, y: 505, r: 28, h: 70 },
];
const GREEN = { x: 12, y: 665, r: 18, h: 86 };
const VENT = { x: -10, y: 522, r: 3.2 };
const PERIOD = 7;
const firing = (t: number) => t % PERIOD > PERIOD - 1.4;

// the stadium: two banks of seating on the volcano's flank, either side behind the green, facing it
export const STANDS: Decor[] = [
  { kind: 'stands', x: -34, y: 714, rot: -0.75 },
  { kind: 'stands', x: 60, y: 716, rot: 0.75 },
];

const rocks: Post[] = ISLES.map((s, i) => ({ x: s.x + (i % 2 ? -s.r * 0.6 : s.r * 0.6), y: s.y + 8, r: 2.6, h: 2.6, e: 0.5, look: 'rock' as const }));

export const lavatube: Hole = {
  id: 'lavatube',
  name: 'The Ascent',
  par: 5,
  theme: 'volcanic',
  tour: true,
  noCart: true,
  tee: { x: TEE.x, y: TEE.y },
  cup: { x: 14, y: 668 },
  pins: [{ x: 14, y: 668 }, { x: 6, y: 660 }, { x: 20, y: 662 }, { x: 10, y: 674 }],
  aim: 0,
  bounds: { x0: -170, y0: -50, x1: 210, y1: 900 },
  border: [
    { x: -166, y: -46 },
    { x: 206, y: -46 },
    { x: 206, y: 896 },
    { x: -166, y: 896 },
  ],
  base: 'rock',
  maxTime: 30,
  regions: [
    { poly: circle(TEE.x, TEE.y, TEE.r - 2), surface: 'rough' },
    { poly: rect(-12, -10, 12, 10), surface: 'fairway' },
    ...ISLES.flatMap((s, i) => [
      { poly: blob(s.x, s.y, s.r - 2, (s.r - 2) * 0.9, 30 + i, 0.08), surface: 'rough' as const },
      { poly: blob(s.x, s.y, s.r - 7, (s.r - 7) * 0.9, 30 + i, 0.08), surface: 'fairway' as const },
    ]),
    { poly: circle(VENT.x, VENT.y, VENT.r + 1.5), surface: 'rock' },
    // the green, in its bowl on the volcano
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 7), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.r, GREEN.r * 0.92, 6, 0.05), surface: 'green' },
    { poly: blob(GREEN.x - 22, GREEN.y - 14, 5, 4, 7, 0.15), surface: 'sand' },
  ],
  // the sea, a long way down
  water: [{ poly: rect(-166, -46, 206, 896), level: 0, look: 'sea', tide: { amp: 1, period: 40 } }],
  terrain: [
    { kind: 'ramp', x0: -170, y0: -50, x1: 210, y1: 900, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the volcano, rising out of the sea at the far end
    { kind: 'disc', x: 30, y: 830, r: 230, h: 170, edge: 170, op: 'set' },
    // the tee and the islands: spires of rock with flat tops, sheer to the sea
    { kind: 'disc', x: TEE.x, y: TEE.y, r: TEE.r, h: TEE.h, edge: 5, op: 'set' },
    ...ISLES.map((s) => ({ kind: 'disc' as const, x: s.x, y: s.y, r: s.r, h: s.h, edge: 5, op: 'set' as const })),
    // each island lifts a little toward its far side, so a ball coming in low isn't kicked off the back
    ...ISLES.map((s) => ({ kind: 'hill' as const, x: s.x, y: s.y + s.r * 0.5, r: s.r * 0.8, h: 0.8 })),
    // the vent's little dip, so a ball near it finds it
    { kind: 'disc', x: VENT.x, y: VENT.y, r: VENT.r + 3, h: -0.6, edge: 3, op: 'add' },
    // the green: a terrace cut into the volcano's flank, dished into a bowl
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 9, h: GREEN.h, edge: 6, op: 'set' },
    { kind: 'hill', x: GREEN.x, y: GREEN.y, r: GREEN.r + 6, h: -1.6 },
    { kind: 'disc', x: GREEN.x - 22, y: GREEN.y - 14, r: 5, h: -1.1, edge: 2, op: 'add' },
  ],
  walls: [],
  posts: rocks,
  movers: [],
  pushes: [
    {
      id: 'updraft',
      look: 'geyser',
      x: VENT.x,
      y: VENT.y,
      r: VENT.r,
      at: () => ({ x: 0, y: 0 }),
      // up and on toward the green
      erupt: (t) => (firing(t) ? { x: 10, y: 76, z: 40 } : null),
    },
  ],
  zones: [{ id: 'liftoff', poly: circle(VENT.x, VENT.y, VENT.r) }],
  secret: { name: 'The Updraft', zone: 'liftoff', hint: 'There is a vent on the last island. Every few seconds it blows. Some say it blows toward the green.' },
  flyover: [
    { x: 0, y: -30 },
    { x: 0, y: 260 },
    { x: -10, y: 520 },
    { x: 12, y: 665 },
  ],
  decor: [{ kind: 'teebox', x: 0, y: 0 }, { kind: 'sign', x: 14, y: -8, rot: 0 }, ...STANDS],
};
