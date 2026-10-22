// Hole 2, The Island (par 4, about 330 ft): an island green in the lake.
// The gamble: a driver straight at the island. The safe way: lay up on the peninsula and wedge on.
// The secret: putt hard up the stone bridge and fly the gap.
import { circle, rect } from '../terrain';
import type { Hole } from '../types';

const ISLAND = { x: 10, y: 322, r: 30 };

export const island: Hole = {
  id: 'island',
  name: 'The Island',
  par: 4,
  tee: { x: 0, y: 0 },
  cup: { x: 16, y: 330 },
  aim: 0,
  bounds: { x0: -150, y0: -22, x1: 130, y1: 420 },
  border: [
    { x: -146, y: -16 },
    { x: 126, y: -16 },
    { x: 126, y: 416 },
    { x: -146, y: 416 },
  ],
  base: 'fringe',
  regions: [
    { poly: rect(-36, 16, 36, 236), surface: 'fairway' },
    { poly: rect(-146, 398, 126, 416), surface: 'path' },
    { poly: rect(-146, 0, -114, 416), surface: 'path' },
    { poly: rect(-4, 234, 4, 262), surface: 'stone' },
    { poly: rect(-4, 268, 4, 294), surface: 'wood' },
    { poly: rect(-4, 350, 4, 398), surface: 'wood' },
    { poly: circle(ISLAND.x, ISLAND.y, ISLAND.r), surface: 'green' },
    { poly: circle(34, 344, 6), surface: 'sand' },
    { poly: circle(-58, 100, 10), surface: 'sand' },
    { poly: circle(60, 120, 11), surface: 'sand' },
  ],
  water: [rect(-110, 140, 120, 396)],
  terrain: [
    { kind: 'tilt', gx: 0, gy: 0.003 },
    // the lake bed
    { kind: 'box', x0: -110, y0: 140, x1: 120, y1: 396, h: -3.5, edge: 4, op: 'add' },
    // the peninsula and the island back up at lawn height
    { kind: 'box', x0: -36, y0: 130, x1: 36, y1: 236, h: 0.3, edge: 2, op: 'set' },
    { kind: 'disc', x: ISLAND.x, y: ISLAND.y, r: ISLAND.r, h: 0.8, edge: 4, op: 'set' },
    // the island green tilts toward the lake on the left, with a crown by the pin
    { kind: 'ramp', x0: -20, y0: 292, x1: 40, y1: 352, axis: 'x', h0: -0.6, h1: 0.5, op: 'add' },
    { kind: 'hill', x: 6, y: 316, r: 14, h: 0.8 },
    { kind: 'disc', x: 34, y: 344, r: 6, h: -0.8, edge: 2, op: 'add' },
    { kind: 'disc', x: -58, y: 100, r: 10, h: -0.9, edge: 3, op: 'add' },
    { kind: 'disc', x: 60, y: 120, r: 11, h: -0.9, edge: 3, op: 'add' },
    // the stone bridge: climbs, stops short, then a landing ramp onto the island
    { kind: 'ramp', x0: -4, y0: 234, x1: 4, y1: 262, axis: 'y', h0: 0.3, h1: 3.4, op: 'set' },
    { kind: 'ramp', x0: -4, y0: 268, x1: 4, y1: 295, axis: 'y', h0: 2.2, h1: 0.8, op: 'set' },
    // the boardwalk causeway at the back
    { kind: 'box', x0: -4, y0: 346, x1: 4, y1: 398, h: 0.4, edge: 0.8, op: 'set' },
  ],
  walls: [
    // hedges between the promenade and the lake, with a gap for the boardwalk
    { a: { x: -112, y: 140 }, b: { x: -112, y: 396 }, h: 3, look: 'hedge' },
    { a: { x: -112, y: 396 }, b: { x: -5, y: 396 }, h: 3, look: 'hedge' },
    { a: { x: 5, y: 396 }, b: { x: 120, y: 396 }, h: 3, look: 'hedge' },
    // bridge rails
    { a: { x: -4.3, y: 236 }, b: { x: -4.3, y: 262 }, h: 1.2, look: 'stone' },
    { a: { x: 4.3, y: 236 }, b: { x: 4.3, y: 262 }, h: 1.2, look: 'stone' },
    { a: { x: -4.3, y: 352 }, b: { x: -4.3, y: 396 }, h: 1, look: 'rail' },
    { a: { x: 4.3, y: 352 }, b: { x: 4.3, y: 396 }, h: 1, look: 'rail' },
  ],
  posts: [
    { x: -130, y: 80, r: 2, h: 34, look: 'oak' },
    { x: -132, y: 200, r: 2, h: 34, look: 'oak' },
    { x: -130, y: 320, r: 2, h: 34, look: 'oak' },
    { x: 80, y: 408, r: 1.4, h: 30, look: 'cypress' },
    { x: -60, y: 408, r: 1.4, h: 30, look: 'cypress' },
    { x: 100, y: 40, r: 2, h: 34, look: 'oak' },
    { x: -100, y: 30, r: 1.4, h: 30, look: 'cypress' },
  ],
  movers: [
    {
      id: 'swan1',
      look: 'swan',
      at: (t) => {
        const a = t * 0.12;
        const pos = { x: 70 + Math.cos(a) * 32, y: 240 + Math.sin(a) * 50 };
        return { walls: [], posts: [{ ...pos, r: 1.6, h: 2.2, look: 'post' }], pos, heading: a + Math.PI / 2 };
      },
    },
    {
      id: 'swan2',
      look: 'swan',
      at: (t) => {
        const a = -t * 0.1 + 2;
        const pos = { x: -60 + Math.cos(a) * 30, y: 300 + Math.sin(a) * 50 };
        return { walls: [], posts: [{ ...pos, r: 1.6, h: 2.2, look: 'post' }], pos, heading: a - Math.PI / 2 };
      },
    },
  ],
  // the fountain's spray drifts across the bridge gap
  pushes: [{ id: 'fountain', look: 'fountain', x: 40, y: 262, r: 20, at: (t) => ({ x: Math.sin(t * 1.3) * 10, y: 0 }) }],
  zones: [{ id: 'bridge', poly: rect(-5, 263, 5, 268) }],
  secret: { name: 'Over the Bridge', zone: 'bridge', hint: 'The stone bridge stops short. Putt it hard enough and you will fly the gap.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 220 },
    { x: 10, y: 322 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'fountain', x: 40, y: 262 },
    { kind: 'bench', x: -132, y: 140, rot: Math.PI / 2 },
    { kind: 'bench', x: -132, y: 260, rot: Math.PI / 2 },
    { kind: 'lamp', x: -116, y: 60 },
    { kind: 'lamp', x: -116, y: 180 },
    { kind: 'lamp', x: -116, y: 300 },
    { kind: 'lamp', x: -40, y: 402 },
    { kind: 'lamp', x: 40, y: 402 },
    { kind: 'sign', x: -24, y: -9, rot: 0 },
  ],
};
