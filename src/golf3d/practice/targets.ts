// The Target Range (src/targets.ts): a target-golf arena at night (the look is src/golf3d/looks/arena.ts). You hit
// from the top deck of the bays, about 30 ft up, over a floodlit field with six targets at 50 to 210 yd and the back
// net at 235. Each target is a green funnel with its rings drawn round it, and the back net is drawn across the end, by
// the engine (Drill.rings, Drill.net); the nets catch the ball (netShot). The wind is never more than 9 mph. The same
// field every day, so the boards compare.
import { NET, TARGETS } from '../../targets';
import { DECK } from '../looks/arena';
import { band, blob, rect } from '../terrain';
import type { Hole } from '../types';

const FLOOR = 10;
// the top deck: the tee sits at its front edge
const BAY = { x0: -22, y0: -30, x1: 22, y1: 3 };

const far = TARGETS[TARGETS.length - 1];
export const targetRange: Hole = {
  id: 'targets',
  name: 'The Target Range',
  par: 0,
  windCap: 9,
  theme: 'arena',
  tour: true,
  flag: String(far.yards),
  tee: { x: 0, y: 0 },
  cup: { ...far.at },
  aim: 0,
  bounds: { x0: -145, y0: -40, x1: 145, y1: 440 },
  border: [
    { x: -141, y: -36 },
    { x: 141, y: -36 },
    { x: 141, y: 436 },
    { x: -141, y: 436 },
  ],
  base: 'rough',
  regions: [
    { poly: band([{ x: 0, y: 10 }, { x: 0, y: 420 }], 130), surface: 'fairway' },
    { poly: rect(BAY.x0, BAY.y0, BAY.x1, BAY.y1), surface: 'stone' },
    { poly: rect(-5, -5, 5, 2), surface: 'fairway' },
    ...TARGETS.map((t) => ({ poly: blob(t.at.x, t.at.y, 22, 22, 3, 0.04), surface: 'green' as const })),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -145, y0: -40, x1: 145, y1: 440, axis: 'y', h0: FLOOR, h1: FLOOR + 3, op: 'set' },
    // the top deck
    { kind: 'box', x0: BAY.x0, y0: BAY.y0, x1: BAY.x1, y1: BAY.y1, h: FLOOR + DECK, edge: 0.5, op: 'set' },
    // each target a funnel, so a ball caught in it drops to the middle
    ...TARGETS.map((t) => ({ kind: 'disc' as const, x: t.at.x, y: t.at.y, r: 21, h: -2.2, edge: 16, op: 'add' as const })),
  ],
  walls: [],
  posts: [],
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: NET.y },
  ],
  // a flag in each target but the farthest (the hole's own pin is there)
  decor: TARGETS.slice(0, -1).map((t) => ({ kind: 'target', x: t.at.x, y: t.at.y, label: String(t.yards) })),
};
