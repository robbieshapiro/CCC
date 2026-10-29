// Hollow Hills Mini Golf: six short holes on the felt, by moonlight, for the bar's weekly contest. Putter only.
// Each hole has a trick: a field of headstones, a coffin that's a shortcut, a scythe over a slime moat, a cauldron that
// boils over, ghosts that drift across the gaps, and a giant jack-o'-lantern that eats the last cup.
import { rect } from './terrain';
import type { Decor, Hole, Mover, Post, Push, V2, Wall } from './types';

// a lane up from the tee that opens into a round green: the outline of both together
export function laneAndRound(half: number, y0: number, c: V2, r: number): V2[] {
  const meet = Math.asin(half / r); // where the lane's sides meet the circle, either side of straight down
  const start = -Math.PI / 2 + meet;
  const end = (3 * Math.PI) / 2 - meet;
  const arc: V2[] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) {
    const a = start + ((end - start) * i) / n;
    arc.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
  }
  return [{ x: -half, y: y0 }, { x: half, y: y0 }, ...arc];
}

const bbox = (poly: V2[], pad = 36) => ({
  x0: Math.min(...poly.map((p) => p.x)) - pad,
  y0: Math.min(...poly.map((p) => p.y)) - pad,
  x1: Math.max(...poly.map((p) => p.x)) + pad,
  y1: Math.max(...poly.map((p) => p.y)) + pad,
});

type Spec = Omit<Hole, 'bounds' | 'base' | 'theme' | 'putterOnly' | 'noCart' | 'flag' | 'aim' | 'regions' | 'water' | 'terrain' | 'walls' | 'posts' | 'movers' | 'pushes' | 'zones' | 'flyover' | 'decor'> &
  Partial<Hole>;

function mini(s: Spec): Hole {
  return {
    theme: 'haunted',
    putterOnly: true,
    noCart: true,
    flag: 'BOO',
    base: 'green',
    aim: Math.atan2(s.cup.x - s.tee.x, s.cup.y - s.tee.y),
    regions: [],
    water: [],
    terrain: [],
    walls: [],
    posts: [],
    movers: [],
    pushes: [],
    zones: [],
    flyover: [s.tee, { x: (s.tee.x + s.cup.x) / 2, y: (s.tee.y + s.cup.y) / 2 }, s.cup],
    decor: [],
    bounds: bbox(s.border),
    maxTime: 30,
    ...s,
  };
}

const tomb = (x: number, y: number, r = 1, h = 2.4): Post => ({ x, y, r, h, e: 0.5, look: 'tomb' });
const lamp = (x: number, y: number, lit = true): Decor => ({ kind: 'lantern', x, y, label: lit ? undefined : 'dim' });
const tee = (x: number, y: number): Decor[] => [{ kind: 'sign', x: x - 17, y: y + 2, rot: 0 }];

// 1. The Graveyard Shift: rows of old stones between you and the cup, one right on the line. Thread it or bank it.
// A fresh grave, still mounded, nudges anything short and left back toward the hole.
export const graveyard = mini({
  id: 'mg-graveyard',
  name: 'The Graveyard Shift',
  par: 2,
  tee: { x: 0, y: 0 },
  cup: { x: 3, y: 58 },
  border: rect(-12, -6, 12, 66),
  terrain: [
    { kind: 'hill', x: -5, y: 53, r: 5, h: 0.7 },
    { kind: 'ramp', x0: -12, y0: 46, x1: 12, y1: 66, axis: 'x', h0: 0.35, h1: 0, op: 'add' },
  ],
  posts: [tomb(-8, 18), tomb(-1.5, 18), tomb(5.5, 18), tomb(-5, 31), tomb(2.5, 31, 1.1, 2.8), tomb(9, 31), tomb(-9, 44), tomb(-2, 44), tomb(5, 44)],
  zones: [{ id: 'thread', poly: rect(0.4, 29, 1.2, 33) }],
  secret: { name: 'Grave Robber', zone: 'thread', hint: 'There is a line between the stones nobody takes. Nobody living.' },
  decor: [
    ...tee(0, 0),
    lamp(-10, -3),
    lamp(10, -3, false),
    lamp(10, 63),
    lamp(-10, 63, false),
    { kind: 'candles', x: -6.6, y: 46 },
    { kind: 'deadtree', x: -22, y: 30, scale: 1.4 },
    { kind: 'deadtree', x: 21, y: 52, scale: 1.1 },
    { kind: 'crow', x: 13.4, y: 20 },
  ],
});

// 2. The Crypt: up, across and up again round the mausoleum, with a bank in the far corner to turn you. Or find the
// open coffin in the top corner of the first lane: in you go, and out of the crypt door a short putt from the cup.
export const crypt = mini({
  id: 'mg-crypt',
  name: 'The Crypt',
  par: 3,
  tee: { x: 0, y: 0 },
  cup: { x: 54, y: 92 },
  border: [
    { x: -7, y: -7 },
    { x: 7, y: -7 },
    { x: 7, y: 42 },
    { x: 61, y: 42 },
    { x: 61, y: 100 },
    { x: 47, y: 100 },
    { x: 47, y: 56 },
    { x: -7, y: 56 },
  ],
  terrain: [{ kind: 'ramp', x0: 47, y0: 56, x1: 61, y1: 100, axis: 'y', h0: 0, h1: 0.8, op: 'add' }],
  walls: [{ a: { x: 53, y: 42 }, b: { x: 61, y: 50 }, h: 0.9, look: 'crypt' }],
  portals: [{ id: 'coffin', x: -4.3, y: 52.6, r: 1.3, to: { x: 54, y: 79 }, delay: 1.8 }],
  zones: [],
  secret: { name: 'Back from the Dead', zone: 'coffin', hint: 'Someone left a coffin open. It goes somewhere.' },
  decor: [
    ...tee(0, 0),
    { kind: 'mausoleum', x: 29, y: 15, scale: 0.75 },
    lamp(-5.5, 22),
    lamp(59, 44),
    lamp(49, 98, false),
    { kind: 'candles', x: 9.5, y: 38 },
    { kind: 'tomb', x: 12, y: 2, scale: 1.1 },
    { kind: 'tomb', x: 42, y: 4, scale: 0.9 },
    { kind: 'deadtree', x: 70, y: 70, scale: 1.3 },
    { kind: 'crow', x: 27, y: 33 },
  ],
});

// 3. The Pendulum: a plank bridge over a moat of slime, and a scythe swinging across it on a gallows. Go when it's
// out wide. Off the side, or knocked off, is a stroke and back you go.
const PIVOT = { x: 0, y: 34 };
const SWING_L = 13;
const swingAngle = (t: number) => 0.55 * Math.sin(t * 1.45);
const scythe: Mover = {
  id: 'scythe',
  look: 'scythe',
  at: (t) => {
    const a = swingAngle(t);
    const bx = PIVOT.x + SWING_L * Math.sin(a);
    const lift = SWING_L * (1 - Math.cos(a));
    // the blade's edge, across the bridge; it only catches a ball while it's down low
    const walls: Wall[] = lift < 1.2 ? [{ a: { x: bx - 1.5, y: PIVOT.y }, b: { x: bx + 1.5, y: PIVOT.y }, h: 1.4, look: 'blade' }] : [];
    return { walls, posts: [], pos: PIVOT, heading: a };
  },
};
export const pendulum = mini({
  id: 'mg-pendulum',
  name: 'The Pendulum',
  par: 3,
  tee: { x: 0, y: 0 },
  cup: { x: 2, y: 74 },
  border: rect(-11, -6, 11, 84),
  regions: [{ poly: rect(-2.6, 16, 2.6, 52), surface: 'wood' }],
  water: [{ poly: rect(-11, 16, 11, 52), level: -0.5, look: 'slime' }],
  terrain: [
    { kind: 'box', x0: -12, y0: 16, x1: 12, y1: 52, h: -1.3, edge: 0.5, op: 'add' },
    { kind: 'box', x0: -2.6, y0: 15.5, x1: 2.6, y1: 52.5, h: 0, edge: 0.2, op: 'set' },
  ],
  movers: [scythe],
  zones: [{ id: 'underblade', poly: rect(-2.6, 33, 2.6, 35) }],
  secret: { name: 'Close Shave', zone: 'underblade', hint: 'The scythe never misses. Almost never.' },
  decor: [
    ...tee(0, 0),
    lamp(-4.6, 13),
    lamp(4.6, 13, false),
    lamp(-4.6, 55),
    lamp(4.6, 55, false),
    { kind: 'tomb', x: -8, y: 64, scale: 1 },
    { kind: 'tomb', x: 8.5, y: 80, scale: 0.9 },
    { kind: 'deadtree', x: -20, y: 40, scale: 1.5 },
    { kind: 'deadtree', x: 21, y: 22, scale: 1.2 },
  ],
});

// 4. Double, Double: the cup sits in a dip, with a witch's cauldron square in front of it. Go round, but it boils
// over: the left side first, then the right. Pick the calm side.
const BREW_PERIOD = 5;
const brew = (id: string, x: number, side: number, from: number): Push => ({
  id,
  look: 'brew',
  x,
  y: 31,
  r: 3.6,
  at: (t) => {
    const k = (((t - from) % BREW_PERIOD) + BREW_PERIOD) % BREW_PERIOD;
    return k < 2 ? { x: side * 30, y: -6 } : { x: 0, y: 0 };
  },
});
export const cauldron = mini({
  id: 'mg-cauldron',
  name: 'Double, Double',
  par: 2,
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 40 },
  border: laneAndRound(5, -6, { x: 0, y: 34 }, 20),
  terrain: [{ kind: 'disc', x: 0, y: 40, r: 8, h: -0.55, edge: 7, op: 'add' }],
  posts: [{ x: 0, y: 30.5, r: 2.4, h: 3.5, e: 0.4, look: 'cauldron' }, tomb(-12, 46), tomb(12, 46), tomb(0, 51, 1.1, 2.8)],
  pushes: [brew('brew-l', -5.6, -1, 0), brew('brew-r', 5.6, 1, 2.5)],
  zones: [{ id: 'behind', poly: rect(-3, 44, 3, 53) }],
  secret: { name: 'Toil and Trouble', zone: 'behind', hint: 'Round the back of the pot is the long way. Or is it.' },
  decor: [
    ...tee(0, 0),
    lamp(-15, 25),
    lamp(15, 25, false),
    lamp(-10, 50, false),
    lamp(10, 50),
    { kind: 'candles', x: -3.2, y: 25 },
    { kind: 'candles', x: 3.6, y: 26 },
    { kind: 'deadtree', x: -28, y: 44, scale: 1.4 },
    { kind: 'crow', x: 13, y: 47 },
  ],
});

// 5. The Ghost Walk: an iron railing across the lane with three ways through. The middle gate is shortest, with a
// ghost drifting in front of it; the side gates are clear but long. Past it, another ghost patrols the green.
const ghost = (id: string, y: number, span: number, speed: number, phase: number, cx = 0): Mover => ({
  id,
  look: 'ghost',
  at: (t) => {
    const s = Math.sin(t * speed + phase);
    const pos = { x: cx + span * s, y };
    return { walls: [], posts: [{ ...pos, r: 1.5, h: 4, e: 0.7, look: 'ghost' }], pos, heading: Math.cos(t * speed + phase) > 0 ? 0 : Math.PI };
  },
});
export const ghostwalk = mini({
  id: 'mg-ghostwalk',
  name: 'The Ghost Walk',
  par: 3,
  tee: { x: 0, y: 0 },
  cup: { x: 7, y: 84 },
  border: rect(-14, -6, 14, 92),
  terrain: [
    { kind: 'hill', x: -6, y: 24, r: 7, h: 0.6 },
    { kind: 'hill', x: 7, y: 26, r: 6, h: 0.5 },
    { kind: 'disc', x: 7, y: 84, r: 6, h: -0.3, edge: 5, op: 'add' },
  ],
  walls: [
    { a: { x: -10, y: 46 }, b: { x: -1.7, y: 46 }, h: 1.2, look: 'iron' },
    { a: { x: 1.7, y: 46 }, b: { x: 10, y: 46 }, h: 1.2, look: 'iron' },
  ],
  posts: [tomb(-9, 62), tomb(-2, 77, 1, 2.2), { x: -8, y: 74, r: 0.8, h: 14, e: 0.4, look: 'deadtree' }],
  movers: [ghost('ghost-gate', 42, 4.5, 1.1, 0), ghost('ghost-green', 66, 9.5, 0.7, 1)],
  zones: [{ id: 'gate', poly: rect(-1.7, 45, 1.7, 47) }],
  secret: { name: 'Walk Through Walls', zone: 'gate', hint: 'The middle gate. While the ghost is looking the other way.' },
  decor: [
    ...tee(0, 0),
    lamp(-12, 49),
    lamp(12, 49),
    lamp(-12, 2, false),
    lamp(12, 89, false),
    { kind: 'candles', x: 12, y: 60 },
    { kind: 'deadtree', x: 24, y: 70, scale: 1.3 },
    { kind: 'tomb', x: -22, y: 20, scale: 1.2 },
  ],
});

// 6. The Jack-o'-Lantern: the last cup is inside a giant pumpkin. Its mouth is the way in, and it opens and shuts.
// There's a crack in the back, if you'd rather go round.
const PUMPKIN = { x: 0, y: 60, r: 8 };
const MOUTH = 0.59; // half the mouth's width, as an angle round the pumpkin
const BACK = 0.2; // half the crack in the back
const JAW_PERIOD = 4.2;
const shell: Wall[] = [];
{
  const n = 32;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const mid = (a0 + a1) / 2;
    // the mouth faces the tee (-y), the crack faces away (+y)
    if (Math.abs(Math.atan2(Math.sin(mid + Math.PI / 2), Math.cos(mid + Math.PI / 2))) < MOUTH) continue;
    if (Math.abs(Math.atan2(Math.sin(mid - Math.PI / 2), Math.cos(mid - Math.PI / 2))) < BACK) continue;
    shell.push({ a: { x: PUMPKIN.x + Math.cos(a0) * PUMPKIN.r, y: PUMPKIN.y + Math.sin(a0) * PUMPKIN.r }, b: { x: PUMPKIN.x + Math.cos(a1) * PUMPKIN.r, y: PUMPKIN.y + Math.sin(a1) * PUMPKIN.r }, h: 2.6, look: 'teeth' });
  }
}
const mouthY = PUMPKIN.y - PUMPKIN.r * Math.cos(MOUTH);
const mouthX = PUMPKIN.r * Math.sin(MOUTH);
// how open the mouth is: wide open for most of the cycle, then it snaps shut and opens again
export const jawOpen = (t: number) => {
  const k = ((t % JAW_PERIOD) + JAW_PERIOD) % JAW_PERIOD;
  if (k < 2.4) return 1;
  if (k < 2.7) return 1 - (k - 2.4) / 0.3;
  if (k < 3.9) return 0;
  return (k - 3.9) / 0.3;
};
const jaw: Mover = {
  id: 'jaw',
  look: 'jaw',
  at: (t) => {
    const open = jawOpen(t);
    const walls: Wall[] = open < 0.5 ? [{ a: { x: -mouthX, y: mouthY }, b: { x: mouthX, y: mouthY }, h: 2, look: 'teeth' }] : [];
    return { walls, posts: [], pos: { x: PUMPKIN.x, y: mouthY }, heading: 0, open };
  },
};
export const jackolantern = mini({
  id: 'mg-pumpkin',
  name: "The Jack-o'-Lantern",
  par: 3,
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 61 },
  border: laneAndRound(7, -6, { x: 0, y: 56 }, 22),
  terrain: [{ kind: 'disc', x: 0, y: 61, r: 6, h: -0.35, edge: 5, op: 'add' }],
  walls: shell,
  movers: [jaw],
  zones: [{ id: 'backdoor', poly: rect(-1.6, 66, 1.6, 69) }],
  secret: { name: 'Trick or Treat', zone: 'backdoor', hint: 'Every pumpkin has a back door. This one does.' },
  decor: [
    ...tee(0, 0),
    { kind: 'bigpumpkin', x: PUMPKIN.x, y: PUMPKIN.y, scale: PUMPKIN.r },
    lamp(-6, 30),
    lamp(6, 30, false),
    lamp(-18, 62, false),
    lamp(18, 62, false),
    { kind: 'candles', x: 12, y: 44 },
    { kind: 'candles', x: -12, y: 72 },
    { kind: 'deadtree', x: -32, y: 50, scale: 1.6 },
    { kind: 'deadtree', x: 30, y: 74, scale: 1.3 },
    { kind: 'crow', x: 9, y: 39 },
  ],
});

export const HOLLOW_HILLS: Hole[] = [graveyard, crypt, pendulum, cauldron, ghostwalk, jackolantern];
export const HOLLOW_HILLS_PAR = HOLLOW_HILLS.reduce((a, h) => a + h.par, 0);

