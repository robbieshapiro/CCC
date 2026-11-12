// Mo at the table: he looks at every ball he may hit and every pocket, picks the shot with the clearest path and the
// gentlest cut, checks it goes in on a copy of the table, then plays it with a bit of a wobble so he can be beaten.
import { clone, freeSpot, H, HEAD_X, POCKETS, R, simulate, W, type Ball } from './physics';
import { targets, type Game } from './rules';

const WOBBLE = 0.022; // radians, one standard deviation (about 1.3 degrees): he pots about 37% of his shots
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());

// is the straight line a to b clear of every ball but these?
function clear(balls: Ball[], ax: number, ay: number, bx: number, by: number, skip: number[]) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  return balls.every((o) => {
    if (o.down || skip.includes(o.n)) return true;
    const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.y - ay) * dy) / len2));
    return Math.hypot(o.x - (ax + dx * t), o.y - (ay + dy * t)) > 2 * R - 0.05;
  });
}

type Plan = { angle: number; power: number; score: number };
function plans(g: Game, cx: number, cy: number): Plan[] {
  const out: Plan[] = [];
  for (const n of targets(g, 'mo')) {
    const t = g.balls.find((b) => b.n === n)!;
    for (const p of POCKETS) {
      const px = p.x - t.x, py = p.y - t.y;
      const d2 = Math.hypot(px, py);
      const gx = t.x - (px / d2) * 2 * R, gy = t.y - (py / d2) * 2 * R;
      const ax = gx - cx, ay = gy - cy;
      const d1 = Math.hypot(ax, ay);
      if (d1 < 0.5) continue;
      const cut = Math.acos(Math.max(-1, Math.min(1, (ax * px + ay * py) / (d1 * d2))));
      if (cut > 1.25) continue;
      if (!clear(g.balls, cx, cy, gx, gy, [0, n]) || !clear(g.balls, t.x, t.y, p.x, p.y, [0, n])) continue;
      out.push({ angle: Math.atan2(ay, ax), power: Math.min(0.6, 0.14 + (d1 + d2 * 1.4) / (W * 3.6) + cut * 0.08), score: Math.cos(cut) ** 2 / (d1 + d2 * 1.5 + 10) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// the shot Mo plays (and, with the cue ball in hand, where he puts it first)
export function moShot(g: Game): { place?: { x: number; y: number }; angle: number; power: number } {
  const cue = g.balls.find((b) => b.n === 0)!;
  // the break: hard at the front of the rack
  if (!g.broken) return { place: { x: HEAD_X, y: H / 2 + (Math.random() - 0.5) * 6 }, angle: (Math.random() - 0.5) * 0.02, power: 1 };
  let place: { x: number; y: number } | undefined;
  let cx = cue.x, cy = cue.y;
  if (g.inHand) {
    let best = -1;
    for (let i = 0; i < 60; i++) {
      const x = R + Math.random() * (W - 2 * R), y = R + Math.random() * (H - 2 * R);
      if (!freeSpot(g.balls, x, y)) continue;
      const s = plans(g, x, y)[0]?.score ?? 0;
      if (s > best) (best = s), (place = { x, y });
    }
    if (place) (cx = place.x), (cy = place.y);
  }
  // check the best few on a copy, and keep the first that drops a ball of his without scratching
  const legal = targets(g, 'mo');
  for (const pl of plans(g, cx, cy).slice(0, 4)) {
    const copy = clone(g.balls);
    const c = copy.find((b) => b.n === 0)!;
    (c.x = cx), (c.y = cy);
    const log = simulate(copy, pl.angle, pl.power);
    const sank8 = log.potted.includes(8);
    if (!log.scratch && log.first !== null && legal.includes(log.first) && log.potted.some((n) => legal.includes(n)) && (!sank8 || (legal.length === 1 && legal[0] === 8)))
      return { place, angle: pl.angle + gauss() * WOBBLE, power: pl.power };
  }
  // nothing on: roll up to the nearest ball he may hit
  const near = legal.map((n) => g.balls.find((b) => b.n === n)!).sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy))[0];
  return { place, angle: near ? Math.atan2(near.y - cy, near.x - cx) + gauss() * WOBBLE : 0, power: 0.22 };
}
