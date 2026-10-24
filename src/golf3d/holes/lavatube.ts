// Hole 6, The Lava Tube (par 4, about 430 ft): tee off from inside a lava tube, out along the top of a sea cliff.
// The play: keep it low. The roof of the tube is 16 ft up; a high shot clips it and drops. A driver comes out low
// enough, an iron has to be punched. Then the fairway bends right round an inlet of the sea to a green out on a point.
// The secret: a natural arch of rock crosses the inlet. Roll one over it and it cuts the corner to the green.
import { band, blob, rect } from '../terrain';
import type { Hole, Post, V2 } from '../types';

const TOP = 30; // the cliff top; the sea is at 0
const GREEN = { x: 232, y: 368, rx: 22, ry: 20 };

const way: V2[] = [
  { x: 0, y: 10 },
  { x: 2, y: 140 },
  { x: -2, y: 250 },
  { x: 18, y: 330 },
  { x: 90, y: 372 },
  { x: 180, y: 376 },
];
// the arch over the inlet
const arch: V2[] = [
  { x: 8, y: 238 },
  { x: 30, y: 254 },
  { x: 80, y: 290 },
  { x: 140, y: 330 },
  { x: 196, y: 356 },
];

const rocks: Post[] = [
  [-60, 30, 3.2], [-70, 200, 3.4], [-60, 380, 3], [120, 440, 3.6], [300, 300, 3.2],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));
const palms: Post[] = [-50, -30, 60, 140].map((x, i) => ({ x, y: 430 + (i % 2) * 8, r: 1, h: 22, look: 'palm' as const }));

export const lavatube: Hole = {
  id: 'lavatube',
  name: 'The Lava Tube',
  par: 4,
  theme: 'volcanic',
  tour: true,
  tee: { x: 0, y: 0 },
  cup: { x: 236, y: 372 },
  pins: [{ x: 236, y: 372 }, { x: 222, y: 362 }, { x: 246, y: 376 }, { x: 230, y: 380 }],
  aim: 0,
  bounds: { x0: -110, y0: -50, x1: 330, y1: 470 },
  border: [
    { x: -106, y: -46 },
    { x: 326, y: -46 },
    { x: 326, y: 466 },
    { x: -106, y: 466 },
  ],
  base: 'rough',
  regions: [
    // the floor of the tube: smooth, dark obsidian
    { poly: rect(-16, -40, 16, 46), surface: 'stone' },
    { poly: rect(-12, -10, 12, 10), surface: 'fairway' },
    { poly: band(way.slice(1), 30), surface: 'fringe' },
    { poly: band(way.slice(1), 26), surface: 'fairway' },
    { poly: band(arch, 3.5), surface: 'path' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx + 5, GREEN.ry + 5, 2, 0.06), surface: 'fringe' },
    { poly: blob(GREEN.x, GREEN.y, GREEN.rx, GREEN.ry, 2, 0.06), surface: 'green' },
    { poly: blob(196, 392, 7, 5, 3, 0.15), surface: 'sand' },
    { poly: blob(-28, 300, 9, 6, 4, 0.15), surface: 'sand' },
  ],
  water: [{ poly: rect(-106, -46, 326, 466), level: 0, look: 'sea', tide: { amp: 1, period: 40 } }],
  ceilings: [{ poly: rect(-18, -40, 18, 46), h: 16 }],
  terrain: [
    { kind: 'ramp', x0: -110, y0: -50, x1: 330, y1: 470, axis: 'y', h0: -8, h1: -8, op: 'set' },
    // the headland: the tube comes out of the hillside onto a long cliff top that bends right out to a point
    { kind: 'embankment', pts: way, h: way.map(() => TOP), width: 54, edge: 12, wobble: 6 },
    { kind: 'disc', x: GREEN.x, y: GREEN.y, r: 46, h: TOP + 1, edge: 12, op: 'set' },
    // the hillside the tube comes out of
    { kind: 'hill', x: 0, y: -90, r: 120, h: 30 },
    { kind: 'box', x0: -16, y0: -60, x1: 16, y1: 48, h: TOP, edge: 3, op: 'set' },
    // the inlet: the sea cuts in inside the bend
    { kind: 'disc', x: 120, y: 250, r: 86, h: -8, edge: 18, op: 'set' },
    // the arch across it, a little below the cliff top so a ball runs along it
    { kind: 'embankment', pts: arch, h: [TOP, TOP - 0.5, TOP - 1, TOP - 1.2, TOP - 0.6], width: 3, edge: 2 },
    { kind: 'channel', pts: arch, width: 3, depth: 0.6, taper: 12 },
    // the green, tipped toward the sea on the right
    { kind: 'ramp', x0: GREEN.x - 30, y0: GREEN.y - 30, x1: GREEN.x + 30, y1: GREEN.y + 30, axis: 'x', h0: 0.6, h1: -0.6, op: 'add' },
    { kind: 'hill', x: GREEN.x - 8, y: GREEN.y + 6, r: 10, h: 0.4 },
    ...[[196, 392, 7], [-28, 300, 9]].map(([x, y, r]) => ({ kind: 'disc' as const, x, y, r, h: -1.1, edge: 3, op: 'add' as const })),
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [],
  zones: [{ id: 'seaarch', poly: band(arch.slice(2, 4), 3) }],
  secret: { name: 'The Sea Arch', zone: 'seaarch', hint: 'A natural arch of rock crosses the inlet. Roll one over it and it cuts the corner.' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 160 },
    { x: 100, y: 300 },
    { x: 236, y: 372 },
  ],
  decor: [{ kind: 'teebox', x: 0, y: 0 }],
};
