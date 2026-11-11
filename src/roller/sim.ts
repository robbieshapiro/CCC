// High Roller's physics: a ball on a stage you tilt. Pure maths, no rendering, so the same code runs the game and the
// robot that proves every stage can be cleared (scripts/check-roller.ts).
//
// The stage never moves in here. Tilting it is the same as leaning gravity, so the stick leans gravity up to MAX_TILT and
// the camera rolls the other way to make it look like the floor tipped. y is up; a stage runs away from you along -z.

export type V3 = [number, number, number];

// A solid thing to roll on or bounce off. A box can be turned (yaw), sloped (pitch, the -z end up) or banked (roll).
// `move` slides it there and back; `spin` turns it about its upright axis (radians a second).
export type Solid = {
  kind: 'box' | 'disc';
  c: V3; // centre
  h: V3; // half sizes (a disc: [radius, half height, radius])
  yaw?: number;
  pitch?: number;
  roll?: number;
  move?: { to: V3; period: number; phase?: number };
  spin?: number;
  bouncy?: number; // a bumper: how hard it throws the ball back
  look?: 'felt' | 'rail' | 'bumper' | 'wheel' | 'gold';
};

export type Stage = {
  id: string;
  name: string;
  tip?: string;
  time: number; // seconds on the clock
  start: V3; // where the ball's centre starts
  goal: { p: V3; yaw?: number }; // the gate, standing on the floor at p
  solids: Solid[];
  chips: V3[];
  // the robot's route (x, z), and how fast it may go on each leg; `on` rides a moving solid (its index)
  path: { x: number; z: number; speed?: number; on?: number }[];
};

export const R = 0.5; // the ball's radius
export const GRAVITY = 30;
export const MAX_TILT = (23 * Math.PI) / 180;
const DRAG_GROUND = 0.42; // rolling resistance: what caps the top speed
const DRAG_AIR = 0.04;
const BOUNCE = 0.32; // a drop onto the floor
const BOUNCE_UNDER = 2.2; // slower landings than this don't bounce at all
const STEP = 1 / 120;

export type Ball = {
  p: V3;
  v: V3;
  t: number; // seconds since the stage began
  grounded: boolean;
  hit: number; // the hardest knock this step (for sound)
  chips: boolean[]; // which chips are taken
  state: 'rolling' | 'goal' | 'fell';
};

export const newBall = (stage: Stage): Ball => ({ p: [...stage.start], v: [0, 0, 0], t: 0, grounded: false, hit: 0, chips: stage.chips.map(() => false), state: 'rolling' });

// where a solid is at time t: its centre, its turn, and how fast it's travelling
export function poseOf(s: Solid, t: number): { c: V3; yaw: number; vel: V3 } {
  let c = s.c;
  let vel: V3 = [0, 0, 0];
  if (s.move) {
    const w = (2 * Math.PI) / s.move.period;
    const a = w * t + 2 * Math.PI * (s.move.phase ?? 0);
    const k = 0.5 * (1 - Math.cos(a));
    const dk = 0.5 * Math.sin(a) * w;
    c = [s.c[0] + s.move.to[0] * k, s.c[1] + s.move.to[1] * k, s.c[2] + s.move.to[2] * k];
    vel = [s.move.to[0] * dk, s.move.to[1] * dk, s.move.to[2] * dk];
  }
  return { c, yaw: (s.yaw ?? 0) + (s.spin ?? 0) * t, vel };
}

// the lowest thing on a stage: fall this far past it and you're out
export const floorOf = (stage: Stage) => Math.min(...stage.solids.map((s) => Math.min(s.c[1], s.c[1] + (s.move?.to[1] ?? 0)) - s.h[1])) - 9;

// world to a solid's own frame and back: R = Ry(yaw) Rx(pitch) Rz(roll)
function axes(yaw: number, pitch: number, roll: number): [V3, V3, V3] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  // the columns of R: where the solid's x, y and z point in the world
  return [
    [cy * cr + sy * sp * sr, cp * sr, -sy * cr + cy * sp * sr],
    [-cy * sr + sy * sp * cr, cp * cr, sy * sr + cy * sp * cr],
    [sy * cp, -sp, cy * cp],
  ];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// One solid against the ball: push it out, and take the bounce out of its speed. Returns the floor's velocity under
// the ball when it's standing on this solid (so a moving floor can carry it).
function collide(b: Ball, s: Solid): V3 | null {
  const { c, yaw, vel } = poseOf(s, b.t);
  const [ax, ay, az] = axes(yaw, s.pitch ?? 0, s.roll ?? 0);
  const d: V3 = [b.p[0] - c[0], b.p[1] - c[1], b.p[2] - c[2]];
  const l: V3 = [dot(d, ax), dot(d, ay), dot(d, az)];
  // the nearest point of the solid to the ball's centre, in the solid's frame
  let q: V3;
  if (s.kind === 'disc') {
    const rr = Math.hypot(l[0], l[2]);
    const k = rr > s.h[0] ? s.h[0] / rr : 1;
    q = [l[0] * k, Math.max(-s.h[1], Math.min(s.h[1], l[1])), l[2] * k];
  } else q = [Math.max(-s.h[0], Math.min(s.h[0], l[0])), Math.max(-s.h[1], Math.min(s.h[1], l[1])), Math.max(-s.h[2], Math.min(s.h[2], l[2]))];
  let n: V3 = [l[0] - q[0], l[1] - q[1], l[2] - q[2]];
  let dist = Math.hypot(n[0], n[1], n[2]);
  if (dist >= R) return null;
  if (dist < 1e-6) {
    // the centre is inside: out through the top
    n = [0, 1, 0];
    dist = l[1] - s.h[1];
  } else n = [n[0] / dist, n[1] / dist, n[2] / dist];
  // the normal, back in the world
  const nw: V3 = [ax[0] * n[0] + ay[0] * n[1] + az[0] * n[2], ax[1] * n[0] + ay[1] * n[1] + az[1] * n[2], ax[2] * n[0] + ay[2] * n[1] + az[2] * n[2]];
  const push = R - dist;
  b.p[0] += nw[0] * push;
  b.p[1] += nw[1] * push;
  b.p[2] += nw[2] * push;
  // how fast the solid is moving where the ball touches it (its slide, plus its spin about the upright axis)
  const w = s.spin ?? 0;
  const rx = b.p[0] - c[0], rz = b.p[2] - c[2];
  const u: V3 = [vel[0] + w * rz, vel[1], vel[2] - w * rx];
  const vn = (b.v[0] - u[0]) * nw[0] + (b.v[1] - u[1]) * nw[1] + (b.v[2] - u[2]) * nw[2];
  if (vn < 0) {
    const e = s.bouncy ?? (-vn > BOUNCE_UNDER ? BOUNCE : 0);
    // a bumper always gives a decent kick, however gently you touch it
    const out = s.bouncy ? Math.max(-vn * e, 5) : -vn * e;
    b.v[0] += (-vn + out) * nw[0];
    b.v[1] += (-vn + out) * nw[1];
    b.v[2] += (-vn + out) * nw[2];
    b.hit = Math.max(b.hit, -vn);
  }
  if (nw[1] > 0.6) {
    b.grounded = true;
    return u;
  }
  return null;
}

function tick(b: Ball, stage: Stage, tx: number, tz: number, floor: number) {
  const dt = STEP;
  // the stick leans gravity: full stick is MAX_TILT
  const m = Math.hypot(tx, tz);
  const ang = Math.min(m, 1) * MAX_TILT;
  const sx = m > 1e-6 ? tx / m : 0, sz = m > 1e-6 ? tz / m : 0;
  const g: V3 = [Math.sin(ang) * sx * GRAVITY, -Math.cos(ang) * GRAVITY, Math.sin(ang) * sz * GRAVITY];
  b.v[0] += g[0] * dt;
  b.v[1] += g[1] * dt;
  b.v[2] += g[2] * dt;
  const drag = Math.exp(-(b.grounded ? DRAG_GROUND : DRAG_AIR) * dt);
  b.v[0] *= drag;
  b.v[2] *= drag;
  b.p[0] += b.v[0] * dt;
  b.p[1] += b.v[1] * dt;
  b.p[2] += b.v[2] * dt;
  b.t += dt;
  b.grounded = false;
  let carry: V3 | null = null;
  for (let pass = 0; pass < 2; pass++) for (const s of stage.solids) carry = collide(b, s) ?? carry;
  // a moving or turning floor takes the ball with it
  if (carry) {
    b.p[0] += carry[0] * dt;
    b.p[2] += carry[2] * dt;
  }
  stage.chips.forEach((c, i) => {
    if (!b.chips[i] && Math.hypot(b.p[0] - c[0], b.p[1] - c[1], b.p[2] - c[2]) < 0.95) b.chips[i] = true;
  });
  const gp = stage.goal.p;
  if (Math.hypot(b.p[0] - gp[0], b.p[2] - gp[2]) < 0.85 && Math.abs(b.p[1] - (gp[1] + R)) < 1.1) b.state = 'goal';
  else if (b.p[1] < floor) b.state = 'fell';
}

// Advance the ball by `dt` seconds of play, in fixed small steps, with the stick at (tx, tz) in the world's frame
// (each -1 to 1; -z is away from the start). Left-over time is carried in `acc`.
export function advance(b: Ball, stage: Stage, tx: number, tz: number, dt: number, acc: { t: number }, floor = floorOf(stage)) {
  acc.t += Math.min(dt, 0.1);
  b.hit = 0;
  while (acc.t >= STEP && b.state === 'rolling') {
    tick(b, stage, tx, tz, floor);
    acc.t -= STEP;
  }
}

// ---------- the robot ----------

// Plays a stage along its `path` the way a careful member would: aims at the next point, eases off as it gets there,
// and waits for moving floors. Returns how it went.
export function botRun(stage: Stage, o: { wobble?: number; limit?: number } = {}): { state: Ball['state'] | 'timeout'; t: number; chips: number } {
  const b = newBall(stage);
  const floor = floorOf(stage);
  const acc = { t: 0 };
  const path = [...stage.path, { x: stage.goal.p[0], z: stage.goal.p[2], speed: 4 }];
  let i = 0;
  let go = -1; // the leg the robot has committed to (on or off a moving floor)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const centre = (idx: number): [number, number] => {
    const c = poseOf(stage.solids[idx], b.t).c;
    return [c[0], c[2]];
  };
  // how fast a moving floor is drawing away from a point (below zero: it's coming closer)
  const leaving = (idx: number, x: number, z: number) => {
    const { c, vel } = poseOf(stage.solids[idx], b.t);
    const d = Math.hypot(c[0] - x, c[2] - z) || 1;
    return (vel[0] * (c[0] - x) + vel[2] * (c[2] - z)) / d;
  };
  const limit = o.limit ?? stage.time;
  while (b.state === 'rolling' && b.t < limit) {
    const wp = path[i];
    const prev = path[i - 1];
    let [tx, tz] = wp.on !== undefined ? centre(wp.on) : [wp.x, wp.z];
    // there (the real point, not somewhere it's waiting): on to the next
    if (Math.hypot(tx - b.p[0], tz - b.p[2]) < (wp.on !== undefined ? 0.6 : 0.8) && i < path.length - 1) {
      i++;
      continue;
    }
    let speed = wp.speed ?? 6;
    // stepping onto a moving floor: wait at the last point (by the edge) until the gap has closed, then commit
    if (wp.on !== undefined && prev && prev.on === undefined && go !== i) {
      const [mx, mz] = centre(wp.on);
      const half = Math.max(stage.solids[wp.on].h[0], stage.solids[wp.on].h[2]);
      if (Math.hypot(mx - prev.x, mz - prev.z) <= half + 1.15 && leaving(wp.on, prev.x, prev.z) < 0.7) go = i;
      else [tx, tz, speed] = [prev.x, prev.z, 3];
    }
    // stepping off one: ride it until the next point (just past the far edge) is close, then commit
    if (wp.on === undefined && prev?.on !== undefined && go !== i) {
      const [mx, mz] = centre(prev.on);
      const half = Math.max(stage.solids[prev.on].h[0], stage.solids[prev.on].h[2]);
      if (Math.hypot(mx - wp.x, mz - wp.z) <= half + 1.15 && leaving(prev.on, wp.x, wp.z) < 0.7) go = i;
      else [tx, tz, speed] = [mx, mz, 3];
    }
    const dx = tx - b.p[0], dz = tz - b.p[2];
    const dist = Math.hypot(dx, dz);
    const want = Math.min(speed, dist * 2.2 + 0.6);
    const ix = ((dx / (dist || 1)) * want - b.v[0]) * 0.45 + (o.wobble ?? 0) * rnd();
    const iz = ((dz / (dist || 1)) * want - b.v[2]) * 0.45 + (o.wobble ?? 0) * rnd();
    advance(b, stage, Math.max(-1, Math.min(1, ix)), Math.max(-1, Math.min(1, iz)), 1 / 60, acc, floor);
  }
  return { state: b.state === 'rolling' ? 'timeout' : b.state, t: b.t, chips: b.chips.filter(Boolean).length };
}
