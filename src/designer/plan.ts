// A member's hole drawn from above, for the Design Desk and the Committee's queue: the felt, water, fences, stones,
// the moving parts where they start, the tunnel's two ends, the tee and the cup. Drawn once into a canvas.
import type { Hole, V2 } from '../golf3d/types';

const FELT: Record<string, string> = { haunted: '#2f5d3e', volcanic: '#3f7a4c', highland: '#5aa64c' };
const WATER: Record<string, string> = { slime: '#6fdc3a', lava: '#ff6a1c', lake: '#3a8fb0', sea: '#2b6d84' };

export function planCanvas(hole: Hole, width = 320): HTMLCanvasElement {
  const xs = hole.border.map((p) => p.x);
  const ys = hole.border.map((p) => p.y);
  const pad = 4;
  const x0 = Math.min(...xs) - pad;
  const x1 = Math.max(...xs) + pad;
  const y0 = Math.min(...ys) - pad;
  const y1 = Math.max(...ys) + pad;
  // fit the hole, the tee at the bottom
  const k = Math.min(width / (x1 - x0), (width * 1.4) / (y1 - y0));
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round((x1 - x0) * k * dpr);
  c.height = Math.round((y1 - y0) * k * dpr);
  c.style.width = `${Math.round((x1 - x0) * k)}px`;
  c.style.height = `${Math.round((y1 - y0) * k)}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const P = (p: V2) => [(p.x - x0) * k, (y1 - p.y) * k] as const;
  const poly = (pts: V2[]) => {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(...P(p)) : g.moveTo(...P(p))));
    g.closePath();
  };
  const night = hole.theme === 'haunted';
  g.fillStyle = night ? '#1b1526' : '#e9e1cc';
  g.fillRect(0, 0, c.width, c.height);
  poly(hole.border);
  g.fillStyle = FELT[hole.theme ?? 'highland'];
  g.fill();
  g.lineWidth = Math.max(2, k * 0.8);
  g.strokeStyle = night ? '#4a4652' : '#d2c9b6';
  g.stroke();
  for (const w of hole.water) {
    poly(w.poly);
    g.fillStyle = WATER[w.look ?? 'lake'];
    g.fill();
  }
  // planks over the water
  for (const r of hole.regions) {
    poly(r.poly);
    g.fillStyle = '#9b6c44';
    g.fill();
  }
  // slopes: a soft ring for each mound or dip
  for (const t of hole.terrain) {
    if (t.kind !== 'hill' && t.kind !== 'disc') continue;
    const up = t.kind === 'hill' || t.h > 0;
    const [cx, cy] = P(t);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, t.r * k);
    grad.addColorStop(0, up ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(cx, cy, t.r * k, 0, Math.PI * 2);
    g.fill();
  }
  // fences, and the pumpkin's shell
  g.lineCap = 'round';
  for (const w of hole.walls) {
    g.strokeStyle = w.look === 'teeth' ? '#e0701f' : night ? '#0e0c12' : '#6b4a2e';
    g.lineWidth = Math.max(2, k * (w.look === 'teeth' ? 1.4 : 0.7));
    g.beginPath();
    g.moveTo(...P(w.a));
    g.lineTo(...P(w.b));
    g.stroke();
  }
  for (const p of hole.posts) {
    g.fillStyle = p.look === 'cauldron' ? '#16141a' : p.look === 'deadtree' || p.look === 'pine' || p.look === 'palm' ? '#3b2a20' : '#8a8494';
    g.beginPath();
    g.arc(...P(p), Math.max(2.5, p.r * k), 0, Math.PI * 2);
    g.fill();
  }
  const icon = (p: V2, s: string, size = 16) => {
    g.font = `${size}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(s, ...P(p));
  };
  for (const pt of hole.portals ?? []) {
    g.setLineDash([4, 4]);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(...P(pt));
    g.lineTo(...P(pt.to));
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#07040a';
    g.beginPath();
    g.arc(...P(pt), Math.max(4, pt.r * k), 0, Math.PI * 2);
    g.fill();
    icon(pt.to, '⤴', 14);
  }
  for (const m of hole.movers) {
    const s = m.at(0);
    if (m.look === 'scythe') {
      g.strokeStyle = '#c9ccd6';
      g.lineWidth = Math.max(2, k * 0.5);
      g.beginPath();
      g.moveTo(...P({ x: s.pos.x - 7, y: s.pos.y }));
      g.lineTo(...P({ x: s.pos.x + 7, y: s.pos.y }));
      g.stroke();
      icon(s.pos, '🪓');
    } else if (m.look === 'ghost') icon(s.pos, '👻');
  }
  for (const p of hole.pushes) if (p.look === 'brew') icon({ x: p.x, y: p.y }, '♨', 12);
  for (const d of hole.decor) if (d.kind === 'bigpumpkin') icon(d, '🎃', 22);
  // the tee and the cup
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(...P(hole.tee), 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0d0f0c';
  g.beginPath();
  g.arc(...P(hole.cup), 4.5, 0, Math.PI * 2);
  g.fill();
  icon({ x: hole.cup.x + 1.6, y: hole.cup.y + 2.6 }, '⛳', 15);
  return c;
}
