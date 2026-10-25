// The driving range: a wide, flat strip of turf from a mat, with flags out at 60, 120, 180, 240 and 300 ft.
// Caldera turf and greens, so what you learn here is what November plays like.
import { band, blob, rect } from '../terrain';
import type { Hole, Post } from '../types';

const FLOOR = 10;
export const TARGETS = [
  { label: '60', at: { x: -18, y: 60 } },
  { label: '120', at: { x: 22, y: 120 } },
  { label: '180', at: { x: -26, y: 180 } },
  { label: '240', at: { x: 28, y: 240 } },
  { label: '300', at: { x: 0, y: 300 } },
];

const rocks: Post[] = [
  [-110, 60, 3.4], [112, 120, 3], [-116, 260, 3.6], [110, 330, 3.2], [-60, 400, 3], [70, 410, 3.4],
].map(([x, y, r]) => ({ x, y, r, h: r, e: 0.5, look: 'rock' as const }));
const palms: Post[] = [-40, -24, 24, 40].map((x) => ({ x, y: -26, r: 1, h: 22, look: 'palm' as const }));

export const range: Hole = {
  id: 'range',
  name: 'Driving range',
  par: 0,
  theme: 'volcanic',
  tour: true,
  flag: '300',
  tee: { x: 0, y: 0 },
  cup: { x: 0, y: 300 },
  aim: 0,
  bounds: { x0: -130, y0: -40, x1: 130, y1: 430 },
  border: [
    { x: -126, y: -36 },
    { x: 126, y: -36 },
    { x: 126, y: 426 },
    { x: -126, y: 426 },
  ],
  base: 'rough',
  regions: [
    { poly: band([{ x: 0, y: 10 }, { x: 0, y: 400 }], 80), surface: 'fairway' },
    { poly: rect(-10, -8, 10, 8), surface: 'stone' },
    ...TARGETS.map((t) => ({ poly: blob(t.at.x, t.at.y, 13, 11, 2, 0.08), surface: 'green' as const })),
  ],
  water: [],
  terrain: [
    { kind: 'ramp', x0: -130, y0: -40, x1: 130, y1: 430, axis: 'y', h0: FLOOR, h1: FLOOR + 3, op: 'set' },
    // the valley sides rise to frame it
    { kind: 'hill', x: -230, y: 200, r: 150, h: 30 },
    { kind: 'hill', x: 230, y: 200, r: 150, h: 30 },
    { kind: 'hill', x: 0, y: 560, r: 200, h: 50 },
    ...TARGETS.map((t) => ({ kind: 'disc' as const, x: t.at.x, y: t.at.y, r: 14, h: 0.4, edge: 4, op: 'add' as const })),
  ],
  walls: [],
  posts: [...rocks, ...palms],
  movers: [],
  pushes: [],
  zones: [],
  secret: { name: '', zone: '', hint: '' },
  flyover: [
    { x: 0, y: -20 },
    { x: 0, y: 300 },
  ],
  decor: [{ kind: 'bench', x: -22, y: -12, rot: 0 }, ...TARGETS.slice(0, -1).map((t) => ({ kind: 'target', x: t.at.x, y: t.at.y, label: t.label }))],
};
