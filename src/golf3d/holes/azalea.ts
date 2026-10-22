// Hole 1, The Azalea (par 4, about 470 ft): a downhill dogleg left over the creek.
// The gamble: a driver over the pines at the green. The secret: the banked cart path through the grove.
import { band, circle, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const cartPath: V2[] = [
  { x: -26, y: 176 },
  { x: -58, y: 196 },
  { x: -92, y: 222 },
  { x: -124, y: 252 },
  { x: -150, y: 278 },
  { x: -164, y: 294 },
];

const GREEN = { x: -182, y: 316, r: 26 };

// the grove in the corner of the dogleg, kept clear of the cart path
const pines: Post[] = [];
for (let gx = -222; gx <= -44; gx += 19)
  for (let gy = 112; gy <= 250; gy += 19) {
    const x = gx + ((gy * 7) % 9) - 4;
    const y = gy + ((gx * 3) % 7) - 3;
    const nearPath = cartPath.some((a, i) => {
      const b = cartPath[Math.min(i + 1, cartPath.length - 1)];
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1)));
      return Math.hypot(x - a.x - (b.x - a.x) * t, y - a.y - (b.y - a.y) * t) < 10;
    });
    if (x < -46 && y > 110 && y < 255 && !nearPath) pines.push({ x, y, r: 1.4, h: 34, e: 0.5, look: 'pine' });
  }
// a line of oaks down the right side
const oaks: Post[] = [40, 110, 200, 270].map((y) => ({ x: 64, y, r: 2, h: 34, e: 0.4, look: 'oak' as const }));

export const azalea: Hole = {
  id: 'azalea',
  name: 'The Azalea',
  par: 4,
  tee: { x: 0, y: 0 },
  cup: { x: -192, y: 322 },
  aim: 0,
  bounds: { x0: -236, y0: -22, x1: 70, y1: 384 },
  border: [
    { x: -42, y: -16 },
    { x: 50, y: -16 },
    { x: 56, y: 336 },
    { x: 26, y: 376 },
    { x: -232, y: 376 },
    { x: -232, y: 100 },
    { x: -42, y: 96 },
  ],
  base: 'fringe',
  regions: [
    // first cut everywhere, mown fairway down the chute and along the top leg
    { poly: rect(-28, 18, 38, 150), surface: 'fairway' },
    { poly: rect(-28, 164, 38, 352), surface: 'fairway' },
    { poly: rect(-150, 268, 38, 356), surface: 'fairway' },
    // the pine grove floor
    { poly: [{ x: -232, y: 100 }, { x: -42, y: 96 }, { x: -42, y: 262 }, { x: -232, y: 262 }], surface: 'rough' },
    { poly: rect(-232, 356, 56, 376), surface: 'rough' },
    { poly: band(cartPath, 6.5), surface: 'path' },
    { poly: band([{ x: -6, y: 172 }, { x: -40, y: 186 }], 9), surface: 'path' },
    { poly: rect(-4, 146, 4, 168), surface: 'stone' },
    // bunkers
    { poly: circle(-25, 236, 9), surface: 'sand' },
    { poly: circle(28, 318, 11), surface: 'sand' },
    { poly: circle(-150, 300, 8), surface: 'sand' },
    // the green
    { poly: circle(GREEN.x, GREEN.y, GREEN.r + 5), surface: 'fringe' },
    { poly: circle(GREEN.x, GREEN.y, GREEN.r), surface: 'green' },
  ],
  water: [rect(-232, 150, 56, 164)],
  terrain: [
    // it falls away from the tee and toward the inside of the dogleg
    { kind: 'tilt', gx: 0.008, gy: -0.012 },
    { kind: 'box', x0: -232, y0: 149, x1: 56, y1: 165, h: -2.6, edge: 3, op: 'add' },
    // the footbridge sits level with the banks
    { kind: 'box', x0: -4.4, y0: 144, x1: 4.4, y1: 170, h: -1.8, edge: 2.4, op: 'set' },
    { kind: 'hill', x: 30, y: 80, r: 26, h: 2.2 },
    { kind: 'hill', x: -10, y: 300, r: 30, h: 1.6 },
    { kind: 'channel', pts: cartPath, width: 6, depth: 2.2 },
    // a wide, shallow funnel at the mouth of the cart path
    { kind: 'channel', pts: [{ x: -6, y: 172 }, { x: -40, y: 186 }], width: 12, depth: 0.8 },
    // bunkers are scooped out
    { kind: 'disc', x: -25, y: 236, r: 9, h: -0.9, edge: 3, op: 'add' },
    { kind: 'disc', x: 28, y: 318, r: 11, h: -0.9, edge: 3, op: 'add' },
    { kind: 'disc', x: -150, y: 300, r: 8, h: -0.9, edge: 3, op: 'add' },
    // a raised green, high at the back left with a ridge through the middle
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: GREEN.r + 4, h: 1.4, edge: 8, op: 'add' },
    { kind: 'ramp', x0: -210, y0: 290, x1: -154, y1: 344, axis: 'x', h0: 1.1, h1: 0, op: 'add' },
    { kind: 'hill', x: -176, y: 314, r: 12, h: 0.7 },
  ],
  walls: [
    // footbridge rails
    { a: { x: -4.2, y: 148 }, b: { x: -4.2, y: 166 }, h: 1.1, look: 'stone' },
    { a: { x: 4.2, y: 148 }, b: { x: 4.2, y: 166 }, h: 1.1, look: 'stone' },
    // a rail along the outside of the bend
    { a: { x: 56, y: 336 }, b: { x: 26, y: 376 }, h: 1.4, look: 'wood' },
  ],
  posts: [...pines, ...oaks],
  movers: [],
  pushes: [],
  zones: [{ id: 'cartpath', poly: band(cartPath.slice(1, 4), 4) }],
  secret: { name: 'Cart Path Bank', zone: 'cartpath', hint: 'There is a gravel cart path hidden in the pines.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 150 },
    { x: -70, y: 220 },
    { x: -170, y: 300 },
  ],
  decor: [
    ...[20, 60, 100, 180, 230].map((y, i) => ({ kind: 'azalea', x: 46, y, color: i % 2 ? '#e86a92' : '#f2a3c0' })),
    ...[-215, -205, -160, -130].map((x, i) => ({ kind: 'azalea', x, y: i < 2 ? 352 : 350, color: i % 2 ? '#f2a3c0' : '#e86a92' })),
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'bench', x: 30, y: -8, rot: 0 },
    { kind: 'sign', x: -26, y: -9, rot: 0 },
  ],
};
