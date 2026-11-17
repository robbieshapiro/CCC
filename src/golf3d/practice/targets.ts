// The Target Range (src/targets.ts): a wide field from a stone bay, with six targets out at 50 to 210 yd and the
// back net at 235. Each target is a shallow green dish with its rings drawn round it, and the back net is drawn
// across the end, by the engine (Drill.rings, Drill.net); the nets catch the ball (netShot). The wind is never more
// than 9 mph. The same field every day, so the boards compare.
import { NET, TARGETS } from '../../targets';
import { band, blob, rect } from '../terrain';
import type { Hole, Post } from '../types';

const FLOOR = 10;
const rocks: Post[] = [
  [-120, 80, 3.4], [122, 150, 3], [-124, 280, 3.6], [120, 350, 3.2], [-60, 420, 3], [70, 425, 3.4],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));
const palms: Post[] = [-36, -20, 20, 36].map((x) => ({ x, y: -24, r: 1, h: 22, look: 'palm' as const }));

const far = TARGETS[TARGETS.length - 1];
export const targetRange: Hole = {
  id: 'targets',
  name: 'The Target Range',
  par: 0,
  windCap: 9,
  theme: 'volcanic',
  tour: true,
  flag: String(far.yards),
  tee: { x: 0, y: 0 },
  cup: { ...far.at },
  aim: 0,
  bounds: { x0: -140, y0: -40, x1: 140, y1: 440 },
  border: [
    { x: -136, y: -36 },
    { x: 136, y: -36 },
    { x: 136, y: 436 },
    { x: -136, y: 436 },
  ],
  base: 'rough',
  regions: [
    { poly: band([{ x: 0, y: 10 }, { x: 0, y: 410 }], 110), surface: 'fairway' },
    { poly: rect(-10, -8, 10, 8), surface: 'stone' },
    ...TARGETS.map((t) => ({ poly: blob(t.at.x, t.at.y, 22, 22, 3, 0.04), surface: 'green' as const })),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -140, y0: -40, x1: 140, y1: 440, axis: 'y', h0: FLOOR, h1: FLOOR + 3, op: 'set' },
    { kind: 'hill', x: -250, y: 200, r: 150, h: 30 },
    { kind: 'hill', x: 250, y: 200, r: 150, h: 30 },
    { kind: 'hill', x: 0, y: 580, r: 200, h: 50 },
    // each target a shallow dish, so a ball that lands in it gathers toward the middle
    ...TARGETS.map((t) => ({ kind: 'disc' as const, x: t.at.x, y: t.at.y, r: 18, h: -0.9, edge: 10, op: 'add' as const })),
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: NET.y },
  ],
  // a flag in each target but the farthest (the hole's own pin is there)
  decor: [{ kind: 'bench', x: -22, y: -12, rot: 0 }, ...TARGETS.slice(0, -1).map((t) => ({ kind: 'target', x: t.at.x, y: t.at.y, label: String(t.yards) }))],
};
