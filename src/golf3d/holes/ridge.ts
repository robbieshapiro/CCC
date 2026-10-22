// Hole 3, The Ridge (par 4, about 430 ft): down off the tee knoll, over a dip with a pond, up over a ridge to a raised green.
// The play: a drive that clears the dip and holds the climb, then a short iron up the hill to a green guarded by sand.
// The secret: the bank behind the green feeds a long ball back down toward the pin.
import { circle, rect } from '../terrain';
import type { Hole, Post } from '../types';

const GREEN = { x: -10, y: 420, r: 24 };
const POND = { x: 64, y: 165, r: 32 };

const trees: Post[] = [];
for (let i = 0, y = 30; y <= 500; y += 32, i++) {
  trees.push({ x: -96 - (i % 3) * 14, y: y + (i % 2) * 10, r: 1.2, h: 20, look: 'pine' });
  if (!(y > 120 && y < 220)) trees.push({ x: 104 + ((i + 1) % 3) * 14, y: y + ((i + 1) % 2) * 10, r: 1.2, h: 20, look: 'pine' });
}

export const ridge: Hole = {
  id: 'ridge',
  name: 'The Ridge',
  par: 4,
  tee: { x: 0, y: 0 },
  cup: { x: -6, y: 426 },
  aim: -0.02,
  bounds: { x0: -150, y0: -40, x1: 150, y1: 520 },
  border: [
    { x: -146, y: -36 },
    { x: 146, y: -36 },
    { x: 146, y: 516 },
    { x: -146, y: 516 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    { poly: rect(-46, 114, 36, 380), surface: 'fringe' },
    { poly: rect(-40, 120, 30, 215), surface: 'fairway' },
    { poly: rect(-42, 215, 34, 374), surface: 'fairway' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 4), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r), surface: 'green' },
    { poly: circle(-40, 285, 11), surface: 'sand' },
    { poly: circle(-42, 400, 8), surface: 'sand' },
    { poly: circle(22, 404, 8), surface: 'sand' },
  ],
  water: [{ poly: circle(POND.x, POND.y, POND.r), level: -0.6 }],
  terrain: [
    // tee knoll, down into the dip, up over the ridge, a little drop, then up to the green shelf
    { kind: 'ramp', x0: -150, y0: -40, x1: 150, y1: 20, axis: 'y', h0: 12, h1: 12, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 20, x1: 150, y1: 130, axis: 'y', h0: 12, h1: 0, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 130, x1: 150, y1: 200, axis: 'y', h0: 0, h1: 0, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 200, x1: 150, y1: 290, axis: 'y', h0: 0, h1: 11, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 290, x1: 150, y1: 360, axis: 'y', h0: 11, h1: 9, op: 'set' },
    { kind: 'ramp', x0: -150, y0: 360, x1: 150, y1: 520, axis: 'y', h0: 9, h1: 13, op: 'set' },
    // hillsides
    ...[0, 150, 300, 450].flatMap((y, i) => [
      { kind: 'hill' as const, x: -220, y: y + 30, r: 120, h: 24 + (i % 2) * 8 },
      { kind: 'hill' as const, x: 220, y, r: 120, h: 28 + ((i + 1) % 2) * 6 },
    ]),
    // the amphitheatre: the ground rises hard behind the green
    { kind: 'hill', x: GREEN.x, y: GREEN.y + 80, r: 72, h: 18 },
    // the green shelf, tipped toward the front
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 6, h: 12, edge: 10, op: 'set' },
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'y', h0: -0.4, h1: 0.6, op: 'add' },
    // the pond in the dip
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 12, h: 0, edge: 10, op: 'set' },
    { kind: 'disc', x: POND.x, y: POND.y, r: POND.r + 2, h: -4, edge: 10, op: 'add' },
    // bunkers
    ...[[-40, 285, 11], [-42, 400, 8], [22, 404, 8]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [
    ...trees,
    // a pair of oaks on the left of the approach, and one alone on the ridge
    { x: -62, y: 352, r: 2, h: 34, look: 'oak' },
    { x: -72, y: 318, r: 2, h: 34, look: 'oak' },
    { x: 48, y: 262, r: 2, h: 34, look: 'oak' },
    ...[[-120, 60, 3], [124, 90, 3.4], [-128, 440, 3.6], [110, 470, 3]].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const })),
  ],
  movers: [],
  pushes: [],
  zones: [{ id: 'amphi', poly: rect(-70, GREEN.y + GREEN.r + 2, 50, 505) }],
  secret: { name: 'The Amphitheatre', zone: 'amphi', hint: 'Long is not always wrong here. The bank behind the green sends things home.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 20, y: 200 },
    { x: -10, y: 340 },
    { x: -6, y: 426 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 20, y: -10, rot: 0 },
    { kind: 'bench', x: -24, y: -12, rot: 0 },
    { kind: 'rock', x: 34, y: 18, scale: 2.6 },
  ],
};
