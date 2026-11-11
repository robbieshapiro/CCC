// High Roller's stages. World 1 is The Lounge: card-table felt floating over the city at dusk. Each stage is a handful
// of solids, a goal gate, some chips to pick up on the way, and the route the robot takes to prove it can be cleared
// (npm run check-roller). Stages run away from you along -z; x is to your right.
import type { Solid, Stage, V3 } from './sim';

const T = 0.3; // half the thickness of a floor

// a flat floor with its top at height y: w wide (x), d deep (z), centred at (x, z)
const floor = (x: number, z: number, w: number, d: number, y = 0, more: Partial<Solid> = {}): Solid => ({ kind: 'box', c: [x, y - T, z], h: [w / 2, T, d / 2], look: 'felt', ...more });
// a low rail along a floor's edge
const rail = (x: number, z: number, w: number, d: number, y = 0): Solid => ({ kind: 'box', c: [x, y + 0.3, z], h: [w / 2, 0.3, d / 2], look: 'rail' });
// a slope w wide from height y0 at z0 to height y1 at z1 (z1 further away)
function ramp(x: number, z0: number, z1: number, w: number, y0: number, y1: number): Solid {
  const run = z0 - z1;
  const pitch = Math.atan2(y1 - y0, run);
  const len = Math.hypot(run, y1 - y0);
  // the top face's middle, then down half a thickness along the slope's own upright
  return { kind: 'box', c: [x, (y0 + y1) / 2 - T * Math.cos(pitch), (z0 + z1) / 2 - T * Math.sin(pitch)], h: [w / 2, T, len / 2], pitch, look: 'felt' };
}
// a round table (spin: radians a second)
const disc = (x: number, z: number, r: number, y = 0, spin = 0): Solid => ({ kind: 'disc', c: [x, y - T, z], h: [r, T, r], spin, look: 'wheel' });
// a stack of chips that throws the ball back
const bumper = (x: number, z: number, y = 0, r = 0.7): Solid => ({ kind: 'disc', c: [x, y + 0.6, z], h: [r, 0.6, r], bouncy: 0.9, look: 'bumper' });
const chip = (x: number, z: number, y = 0): V3 => [x, y + 0.55, z];
const line = (x0: number, z0: number, x1: number, z1: number, n: number, y = 0): V3[] => Array.from({ length: n }, (_, i) => chip(x0 + ((x1 - x0) * i) / (n - 1), z0 + ((z1 - z0) * i) / (n - 1), y));
const start = (x = 0, z = 0, y = 0): V3 => [x, y + 0.5, z];

const LOUNGE: Stage[] = [
  {
    id: 'ante',
    name: 'Ante',
    tip: 'Drag to tilt the table. Roll through the gold gate.',
    time: 60,
    start: start(),
    goal: { p: [0, 0, -20] },
    solids: [floor(0, -9.5, 6, 25), rail(-3.2, -9.5, 0.4, 25), rail(3.2, -9.5, 0.4, 25), rail(0, -22.2, 6.8, 0.4)],
    chips: line(0, -4, 0, -16, 5),
    path: [{ x: 0, z: -10, speed: 8 }],
  },
  {
    id: 'turn',
    name: 'The Turn',
    tip: 'No rails now. Ease off before the corner.',
    time: 60,
    start: start(),
    goal: { p: [13, 0, -14], yaw: Math.PI / 2 },
    solids: [floor(0, -6, 5, 16), floor(5, -14, 15, 5), rail(-2.7, -14, 0.4, 5.8), rail(2.5, -16.7, 10, 0.4)],
    chips: [...line(0, -3, 0, -10, 3), ...line(4, -14, 10, -14, 3)],
    path: [
      { x: 0, z: -11, speed: 6 },
      { x: 3, z: -14, speed: 4 },
      { x: 10, z: -14, speed: 6 },
    ],
  },
  {
    id: 'margins',
    name: 'Narrow Margins',
    tip: 'Small tilts. Let the ball settle before the bridge.',
    time: 60,
    start: start(),
    goal: { p: [5, 0, -29.5] },
    solids: [floor(0, 0, 5, 5), floor(0, -8.5, 1.7, 12), floor(0, -16.5, 4.5, 4), floor(2.5, -19.6, 6.5, 2.2), floor(5, -24, 1.3, 7), floor(5, -29.5, 4.5, 4.5)],
    chips: [...line(0, -5, 0, -12, 4), ...line(5, -22, 5, -26, 3)],
    path: [
      { x: 0, z: -3, speed: 4 },
      { x: 0, z: -14.5, speed: 4.5 },
      { x: 0.4, z: -19.4, speed: 3 },
      { x: 5, z: -19.8, speed: 3.5 },
      { x: 5, z: -27.5, speed: 3.5 },
    ],
  },
  {
    id: 'upante',
    name: 'Up the Ante',
    tip: 'Carry speed up the slope. Brake on the way down.',
    time: 60,
    start: start(),
    goal: { p: [0, 0, -37] },
    solids: [
      floor(0, 0, 6, 6),
      ramp(0, -3, -13, 3.2, 0, 3),
      floor(0, -15, 4.5, 4, 3),
      floor(0, -21, 1.6, 8, 3),
      ramp(0, -25, -33, 3.2, 3, 0),
      floor(0, -36, 6, 6),
      rail(0, -39.2, 6.8, 0.4),
    ],
    chips: [...line(0, -5, 0, -11, 3).map((c, i): V3 => [c[0], 0.55 + 0.6 + i * 0.9, c[2]]), ...line(0, -18, 0, -24, 4, 3)],
    path: [
      { x: 0, z: -3, speed: 7 },
      { x: 0, z: -14.5, speed: 7 },
      { x: 0, z: -24.5, speed: 4 },
      { x: 0, z: -33.5, speed: 4 },
    ],
  },
  {
    id: 'shuffle',
    name: 'The Shuffle',
    tip: 'Wait for the table to come to you, then ride it.',
    time: 75,
    start: start(),
    goal: { p: [13, 0, -18.6], yaw: Math.PI / 2 },
    solids: [
      floor(0, 0, 6, 6),
      floor(0, -4.6, 3.2, 3, 0, { move: { to: [0, 0, -6.8], period: 7 } }),
      floor(0, -15, 4.5, 4),
      floor(0, -18.6, 3, 3.2, 0, { move: { to: [7, 0, 0], period: 7, phase: 0.5 } }),
      floor(11.5, -18.6, 6, 5),
      rail(14.7, -18.6, 0.4, 5.8),
    ],
    chips: [chip(0, -15), chip(11, -18.6)],
    path: [
      { x: 0, z: -2.2, speed: 4 },
      { x: 0, z: 0, on: 1, speed: 4 },
      { x: 0, z: -13.6, speed: 4 },
      { x: 0, z: -16.3, speed: 3 },
      { x: 0, z: 0, on: 3, speed: 4 },
      { x: 9.2, z: -18.6, speed: 4 },
      { x: 11, z: -18.6, speed: 4 },
    ],
  },
  {
    id: 'deck',
    name: 'Stacked Deck',
    tip: 'The chip stacks kick back. Thread between them.',
    time: 75,
    start: start(),
    goal: { p: [0, 0, -33] },
    solids: [
      floor(0, -11, 8, 28),
      bumper(-1.6, -6),
      bumper(2.2, -9.5),
      bumper(-2.4, -13),
      bumper(1, -15.5),
      bumper(-0.6, -20),
      bumper(3, -21),
      bumper(-3, -22.5),
      floor(0, -29.5, 2, 9),
      floor(0, -34, 4.5, 4),
      rail(0, -36.2, 5.3, 0.4),
    ],
    chips: [chip(0.4, -7.5), chip(-0.4, -11.5), chip(-0.8, -15), chip(1.2, -19), chip(0, -26), chip(0, -30)],
    path: [
      { x: 0.4, z: -7.6, speed: 4.5 },
      { x: -0.3, z: -11.4, speed: 4 },
      { x: -0.9, z: -15.3, speed: 4 },
      { x: 1.3, z: -20.6, speed: 4 },
      { x: 0, z: -24.5, speed: 4 },
      { x: 0, z: -32, speed: 4.5 },
    ],
  },
  {
    id: 'roulette',
    name: 'Roulette',
    tip: 'The wheel carries you round. Step off when the way out comes by.',
    time: 75,
    start: start(),
    goal: { p: [0, 0, -22] },
    solids: [floor(0, 0, 5, 6), disc(0, -9.6, 6.4, 0, 0.55), bumper(0, -9.6, 0, 1.4), floor(0, -19.5, 4, 7), rail(0, -23.2, 4.8, 0.4)],
    chips: [chip(4, -9.6), chip(-4, -9.6), chip(0, -13.8), chip(0, -5.4)],
    path: [
      { x: 0, z: -2.4, speed: 4 },
      { x: 3.2, z: -6.5, speed: 4 },
      { x: 4, z: -10.5, speed: 4 },
      { x: 2.2, z: -14, speed: 4 },
      { x: 0, z: -17.5, speed: 4 },
    ],
  },
  {
    id: 'allin',
    name: 'All In',
    tip: 'Everything you have learned. Take your time: the clock is generous.',
    time: 100,
    start: start(),
    goal: { p: [8, 2.5, -50.5] },
    solids: [
      floor(0, 0, 5, 5),
      floor(0, -7.5, 1.4, 10),
      floor(0, -14, 4, 3),
      ramp(0, -15.5, -23.5, 3, 0, 2.5),
      floor(0, -25.2, 4, 3.4, 2.5),
      floor(0, -28.6, 3, 3, 2.5, { move: { to: [0, 0, -6], period: 6.5 } }),
      disc(0, -40.6, 4.2, 2.5, 0.5),
      bumper(0, -40.6, 2.5, 1),
      floor(5.9, -40.6, 3.4, 2, 2.5),
      floor(8, -44.8, 1.3, 9, 2.5),
      floor(8, -51, 4.2, 4.2, 2.5),
      rail(8, -53.3, 5, 0.4, 2.5),
    ],
    chips: [...line(0, -4, 0, -11, 4), chip(0, -25.2, 2.5), chip(-2.6, -40.6, 2.5), chip(0, -43.4, 2.5), ...line(8, -43, 8, -47, 3, 2.5)],
    path: [
      { x: 0, z: -2, speed: 4 },
      { x: 0, z: -13.6, speed: 4 },
      { x: 0, z: -16, speed: 6 },
      { x: 0, z: -24.6, speed: 6 },
      { x: 0, z: -26.3, speed: 3 },
      { x: 0, z: 0, on: 5, speed: 4 },
      { x: 0, z: -37, speed: 4 },
      { x: 2.6, z: -39, speed: 4 },
      { x: 5.6, z: -40.6, speed: 4 },
      { x: 8, z: -41, speed: 3 },
      { x: 8, z: -49.5, speed: 3.5 },
    ],
  },
];

export type World = { id: string; name: string; blurb: string; stages: Stage[] };
export const WORLDS: World[] = [{ id: 'lounge', name: 'The Lounge', blurb: 'Card tables over the city at dusk', stages: LOUNGE }];
// worlds still to come, shown locked on the menu
export const COMING = [{ name: 'The Rooftop', blurb: 'Wind, glass and a long way down' }];

// every stage in order, numbered from 1 (what the server stores)
export const ALL_STAGES = WORLDS.flatMap((w) => w.stages);
export const stageNumber = (id: string) => ALL_STAGES.findIndex((s) => s.id === id) + 1;
