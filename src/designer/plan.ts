// A member's hole drawn from above, for the Design Desk and the Committee's queue: the rough, fairway, green,
// bunkers, water and trees, the tee and the flag, in the colours of its look. Drawn once into a canvas.
import type { Hole, Surface, V2 } from '../golf3d/types';

const BASE: Record<Surface, string> = {
  green: '#6fc062', fairway: '#62ae52', fringe: '#55993f', rough: '#3e6a31', path: '#cbb88f', stone: '#d2c9b6', wood: '#9b6c44', sand: '#ead9a6', rock: '#4a4541', cinder: '#5e3c30',
};
const LOOKS: Record<string, Partial<Record<Surface, string>> & { out: string }> = {
  highland: { out: '#2c4a26' },
  volcanic: { out: '#2a2624', sand: '#4a4541', rough: '#3f6a2f' },
  links: { out: '#a99d62', rough: '#b3a96a', fairway: '#8fb262', fringe: '#7da04f', green: '#78b862', sand: '#e1d3a6' },
  desert: { out: '#c9a46e', rough: '#d2b07a', sand: '#efdcab' },
};
const WATER: Record<string, string> = { lava: '#ff6a1c', lake: '#3a8fb0', sea: '#2b6d84', slime: '#6fdc3a' };
const TREE: Record<string, string> = { pine: '#24452c', oak: '#2f5a2c', palm: '#3f7a3a', gorse: '#55702f', cactus: '#4f7a3a', rock: '#7a756b' };

export function planCanvas(hole: Hole, width = 260): HTMLCanvasElement {
  const xs = hole.border.map((p) => p.x);
  const ys = hole.border.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  // fit the hole, the tee at the bottom; long holes are drawn taller, never wider than asked
  const k = Math.min(width / (x1 - x0), (width * 1.9) / (y1 - y0));
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round((x1 - x0) * k);
  const h = Math.round((y1 - y0) * k);
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const P = (p: V2) => [(p.x - x0) * k, (y1 - p.y) * k] as const;
  const poly = (pts: V2[]) => {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
    g.closePath();
  };
  const look = LOOKS[hole.theme ?? 'highland'] ?? LOOKS.highland;
  const colour = (s: Surface) => look[s] ?? BASE[s];
  g.fillStyle = look.out;
  g.fillRect(0, 0, w, h);
  poly(hole.border);
  g.fillStyle = colour(hole.base);
  g.fill();
  for (const w of hole.water) {
    poly(w.poly);
    g.fillStyle = WATER[w.look ?? 'lake'];
    g.fill();
  }
  // the land shown again over the sea where it stands above it, so a shore reads as a shore
  if (hole.water.some((w) => w.look === 'sea')) {
    g.save();
    poly(hole.border);
    g.clip();
    for (const r of hole.regions) {
      poly(r.poly);
      g.fillStyle = colour(r.surface);
      g.fill();
    }
    g.restore();
  } else
    for (const r of hole.regions) {
      poly(r.poly);
      g.fillStyle = colour(r.surface);
      g.fill();
    }
  for (const p of hole.posts) {
    g.fillStyle = TREE[p.look ?? 'pine'] ?? '#2f5a2c';
    g.beginPath();
    g.arc(...P(p), Math.max(1.6, (p.look === 'oak' ? 9 : p.look === 'rock' ? p.r : 5) * k), 0, Math.PI * 2);
    g.fill();
  }
  // the tee, and the flag on the green
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(...P(hole.tee), 3, 0, Math.PI * 2);
  g.fill();
  const [fx, fy] = P(hole.cup);
  g.strokeStyle = '#fff';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx, fy - 12);
  g.stroke();
  g.fillStyle = '#d64545';
  g.beginPath();
  g.moveTo(fx, fy - 12);
  g.lineTo(fx + 8, fy - 9);
  g.lineTo(fx, fy - 6);
  g.fill();
  return c;
}
