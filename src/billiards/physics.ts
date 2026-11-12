// 8-ball's table, top down. Units are inches on a 7 ft bar table: 78 by 39 inside the cushions, balls 2.25 across.
// The physics is plain: balls slide and roll with one friction, hit each other elastically (a touch of loss) and come
// off the cushions with some pace taken off. Pockets are circles at the corners and the middles of the long sides.
export const W = 78;
export const H = 39;
export const R = 1.125; // a ball's radius
const POCKET_CORNER = 2.35;
const POCKET_SIDE = 2.1;
const FRICTION = 9; // inches a second, lost every second, while a ball rolls
const CUSHION = 0.78; // share of the speed into a cushion that comes back
const BALL_E = 0.96; // share kept in a ball-to-ball hit
export const MAX_SPEED = 260; // a full break, inches a second

export type Ball = { n: number; x: number; y: number; vx: number; vy: number; down: boolean }; // n: 0 the cue ball, 8 the 8
export type Pocket = { x: number; y: number; r: number };
export const POCKETS: Pocket[] = [
  { x: 0, y: 0, r: POCKET_CORNER }, { x: W / 2, y: -0.6, r: POCKET_SIDE }, { x: W, y: 0, r: POCKET_CORNER },
  { x: 0, y: H, r: POCKET_CORNER }, { x: W / 2, y: H + 0.6, r: POCKET_SIDE }, { x: W, y: H, r: POCKET_CORNER },
];
export const HEAD_X = W * 0.25; // the head string: the cue ball starts behind it
export const FOOT = { x: W * 0.75, y: H / 2 }; // where the rack's front ball sits

// what one shot did: the first ball the cue ball touched, what went down, and whether anything hit a cushion
export type ShotLog = { first: number | null; potted: number[]; rail: boolean; scratch: boolean };

// a racked table: the 8 in the middle of the third row, a stripe and a solid in the back corners, the rest mixed
export function rack(): Ball[] {
  const balls: Ball[] = [{ n: 0, x: HEAD_X, y: H / 2, vx: 0, vy: 0, down: false }];
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  // shuffle all but the apex (1) and the 8 (middle), then make sure the back corners differ in kind
  const pos: [number, number][] = [];
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) pos.push([FOOT.x + row * R * 1.75, H / 2 + (i - row / 2) * R * 2.02]);
  const rest = order.filter((n) => n !== 1 && n !== 8).sort(() => Math.random() - 0.5);
  const placed: number[] = [];
  for (let k = 0; k < 15; k++) placed.push(k === 0 ? 1 : k === 4 ? 8 : rest.shift()!);
  const [a, b] = [10, 14];
  if ((placed[a] > 8) === (placed[b] > 8)) {
    const want = placed[a] > 8 ? (n: number) => n < 8 && n > 1 : (n: number) => n > 8;
    const j = placed.findIndex((n, k) => k !== 0 && k !== 4 && k !== a && k !== b && want(n));
    [placed[b], placed[j]] = [placed[j], placed[b]];
  }
  placed.forEach((n, k) => balls.push({ n, x: pos[k][0], y: pos[k][1], vx: 0, vy: 0, down: false }));
  return balls;
}

export const moving = (balls: Ball[]) => balls.some((b) => !b.down && (b.vx !== 0 || b.vy !== 0));

// one step of `dt` seconds; `log` collects what happened
export function step(balls: Ball[], dt: number, log: ShotLog) {
  const live = balls.filter((b) => !b.down);
  for (const b of live) {
    const s = Math.hypot(b.vx, b.vy);
    if (s === 0) continue;
    const ns = Math.max(0, s - FRICTION * dt - s * 0.12 * dt);
    if (ns < 0.6) (b.vx = 0), (b.vy = 0);
    else (b.vx *= ns / s), (b.vy *= ns / s);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  // pockets first: a ball whose centre is over one drops
  for (const b of live)
    for (const p of POCKETS)
      if (!b.down && Math.hypot(b.x - p.x, b.y - p.y) < p.r) {
        b.down = true;
        b.vx = b.vy = 0;
        if (b.n === 0) log.scratch = true;
        else log.potted.push(b.n);
      }
  // cushions (not across a pocket's mouth)
  for (const b of live) {
    if (b.down) continue;
    const nearPocket = POCKETS.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r + R * 1.3);
    if (nearPocket) continue;
    if (b.x < R) (b.x = R), (b.vx = Math.abs(b.vx) * CUSHION), (log.rail = true);
    if (b.x > W - R) (b.x = W - R), (b.vx = -Math.abs(b.vx) * CUSHION), (log.rail = true);
    if (b.y < R) (b.y = R), (b.vy = Math.abs(b.vy) * CUSHION), (log.rail = true);
    if (b.y > H - R) (b.y = H - R), (b.vy = -Math.abs(b.vy) * CUSHION), (log.rail = true);
  }
  // balls on balls
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], c = live[j];
      if (a.down || c.down) continue;
      const dx = c.x - a.x, dy = c.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 2 * R || d === 0) continue;
      const nx = dx / d, ny = dy / d;
      // push apart
      const over = (2 * R - d) / 2;
      a.x -= nx * over;
      a.y -= ny * over;
      c.x += nx * over;
      c.y += ny * over;
      const rel = (a.vx - c.vx) * nx + (a.vy - c.vy) * ny;
      if (rel <= 0) continue;
      const k = rel * (1 + BALL_E) / 2;
      a.vx -= k * nx;
      a.vy -= k * ny;
      c.vx += k * nx;
      c.vy += k * ny;
      if (log.first === null && (a.n === 0 || c.n === 0)) log.first = a.n === 0 ? c.n : a.n;
    }
}

// strike the cue ball: `angle` in radians (0 is toward the foot), `power` 0 to 1
export function strike(balls: Ball[], angle: number, power: number) {
  const cue = balls.find((b) => b.n === 0)!;
  const v = MAX_SPEED * Math.max(0.04, Math.min(1, power)) ** 1.2;
  cue.vx = Math.cos(angle) * v;
  cue.vy = Math.sin(angle) * v;
}

// run a shot to the end without drawing it (Mo thinking, and the tests); returns what happened
export function simulate(balls: Ball[], angle: number, power: number): ShotLog {
  const log: ShotLog = { first: null, potted: [], rail: false, scratch: false };
  strike(balls, angle, power);
  for (let i = 0; i < 4000 && moving(balls); i++) for (let k = 0; k < 4; k++) step(balls, 1 / 480, log);
  return log;
}

export const clone = (balls: Ball[]) => balls.map((b) => ({ ...b }));

// can the cue ball go here? on the table, and not on top of another ball
export function freeSpot(balls: Ball[], x: number, y: number) {
  if (x < R || x > W - R || y < R || y > H - R) return false;
  return balls.every((b) => b.n === 0 || b.down || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.05);
}
