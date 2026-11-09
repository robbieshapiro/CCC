// Hole Lab: Summit Run (par 4, 410 yd), a ski resort in peak season. The tee is up at the top of the run and the hole
// drops 90 ft to a green in front of the lodge. The fairway is cut and kept green; everything else is deep snow,
// which plays like the thickest rough there is. Firs down both sides, the chairlift running up the left, skiers on
// the run to the right.
// The play: a drive that runs and runs down the slope, then a wedge, if you stay on the cut.
// The secret: the cat track, a groomed traverse cutting across the slope. A ball on it rolls a long way.
import { band, blob, rect } from '../../terrain';
import type { Hole, Post } from '../../types';
import { greenComplex, greenside, treeLine } from '../woods';

const TOP = 92;
const FOOT = 4;
const GREEN = { x: -14, y: 566, rx: 24, ry: 18 };
const traps = [greenside(GREEN, -48, 560, 8, 9, 1, 3, 0), greenside(GREEN, 22, 580, 9, 7, 2, 3, 0.4)];
// the snow: a full club gets about two thirds out of it, and a landing ball stops dead
const SNOW: NonNullable<Hole['turf']> = { roughKeep: 0.15, roughDrag: 2.2, roughLie: 0.68, roughScatter: 0.25, fairwayRoll: 1, sandLie: 0.75, sandScatter: 0.3 };
const TRACK = band([{ x: -70, y: 230 }, { x: 0, y: 270 }, { x: 70, y: 300 }], 6);

const firs: Post[] = [
  ...treeLine([{ x: -70, y: 0 }, { x: -76, y: 520 }], 26, 'sr-left', 5, 2, -1, 12),
  ...treeLine([{ x: 70, y: 0 }, { x: 74, y: 520 }], 26, 'sr-right', 5, 2, 1, 12),
].map((p) => ({ ...p, look: 'snowpine' as const }));

export const summitrun: Hole = {
  id: 'summitrun',
  name: 'Summit Run',
  par: 4,
  theme: 'alpine',
  tour: true,
  turf: SNOW,
  windByHeight: true,
  chipDrop: 0.7,
  greenFirm: 0.04,
  yards: 410,
  blurb: 'Off the top of the run, 90 feet down to the lodge. The cut is green. Everything else is deep snow.',
  tee: { x: 0, y: 0 },
  cup: { x: -14, y: 568 },
  pins: [{ x: -14, y: 568 }, { x: -28, y: 558 }, { x: 0, y: 572 }, { x: -18, y: 580 }],
  aim: -0.01,
  bounds: { x0: -140, y0: -50, x1: 140, y1: 660 },
  border: [
    { x: -110, y: -46 },
    { x: 110, y: -46 },
    { x: 110, y: 656 },
    { x: -110, y: 656 },
  ],
  base: 'rough',
  regions: [
    { poly: rect(-14, -14, 14, 14), surface: 'fairway' },
    { poly: blob(0, 280, 34, 220, 1, 0.05), surface: 'fairway' },
    { poly: blob(-8, 490, 30, 40, 2, 0.06), surface: 'fairway' },
    // the cat track: groomed snow, firm and quick (it plays as a path)
    { poly: TRACK, surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 4, GREEN.ry + 4, 4, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 4, 0.06), surface: 'green' },
    ...traps.map((t) => t.region),
  ],
  water: [],
  terrain: [
    // the run: steep off the top, easing out toward the lodge
    { kind: 'ramp', x0: -140, y0: -50, x1: 140, y1: 20, axis: 'y', h0: TOP, h1: TOP, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 20, x1: 140, y1: 300, axis: 'y', h0: TOP, h1: 30, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 300, x1: 140, y1: 520, axis: 'y', h0: 30, h1: FOOT + 1, op: 'set' },
    { kind: 'ramp', x0: -140, y0: 520, x1: 140, y1: 660, axis: 'y', h0: FOOT + 1, h1: FOOT, op: 'set' },
    // the tee on its own flat, and the fall line rolling a little
    { kind: 'disc', x: 0, y: 0, r: 16, h: TOP + 1, edge: 8, op: 'set' },
    { kind: 'hill', x: -30, y: 180, r: 50, h: 3 },
    { kind: 'hill', x: 30, y: 380, r: 50, h: -2.5 },
    ...greenComplex(GREEN, FOOT, { lift: 1, edge: 9, tilt: [0.6, -0.8], rolls: [[-8, -6, 6, 0.35], [10, 6, 5, -0.3]] }),
    ...traps.flatMap((t) => t.pieces),
  ],
  walls: [],
  posts: firs,
  movers: [],
  pushes: [],
  zones: [{ id: 'cattrack', poly: TRACK }],
  secret: { name: 'The Cat Track', zone: 'cattrack', hint: 'A groomed track cuts across the slope. Land one on it and it rolls a mile.' },
  flyover: [
    { x: 0, y: -24 },
    { x: 0, y: 200 },
    { x: -6, y: 440 },
    { x: -14, y: 566 },
  ],
  decor: [
    { kind: 'teebox', x: 0, y: 0 },
    { kind: 'sign', x: 22, y: -12, rot: 0 },
    { kind: 'lodge', x: -10, y: 630, rot: 0 },
  ],
};
