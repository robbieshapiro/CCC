// Ball physics on a real heightfield: slopes pull, crests launch, chips fly. Fixed step, deterministic.
import { CLUBS, carryOf } from './clubs';
import { gradAt, heightAt, inPoly, isWater, surfaceAt } from './terrain';
import type { Hole, Post, Shot, Surface, V2, Wall } from './types';

export const BALL_R = 0.3;
export const CUP_R = 0.65;
// how far a holed ball sits down the cup: deep enough to be in, shallow enough to see the white of it
const CUP_DEPTH = 0.42;
// Tour greens: a smaller cup, quicker greens, and a putt has to be dying to drop.
export const TOUR_CUP_R = 0.5;
export const cupR = (h: Hole) => (h.tour ? TOUR_CUP_R : CUP_R);
// the fastest a ball can roll over the dead centre of a tour cup and still drop (ft/s); it's slower toward the edge
export const DROP_SPEED = 6;
const TOUR_GREEN = 3;
export const G = 32;
const DT = 1 / 240;
const MAX_T = 24;
const CURB_H = 0.9;
const ROLL = 5 / 7; // a rolling ball feels 5/7 of the slope's pull
const FRICTION: Record<Surface, number> = { green: 4.2, fairway: 9, fringe: 11, rough: 24, path: 1.0, stone: 4.6, wood: 2.6, sand: 40, rock: 7 };
// how much of a landing ball's speed each surface lets it keep
const LANDING: Record<Surface, number> = { green: 1, fairway: 0.9, fringe: 0.8, rough: 0.45, path: 1, stone: 1, wood: 1, sand: 0.1, rock: 1 };
// how well each surface grabs a spinning ball: soft greens bite, rough and sand eat the spin
const GRIP: Record<Surface, number> = { green: 1, fairway: 0.8, fringe: 0.6, rough: 0.25, path: 0.4, stone: 0.4, wood: 0.4, sand: 0, rock: 0.3 };

export type Frame = { x: number; y: number; z: number; t: number };
export type Sound = { t: number; s: 'wall' | 'post' | 'land' | 'splash' | 'cup' | 'sand' | 'lip' | 'hop' | 'vent' };
export type Result = {
  end: V2;
  holed: boolean;
  penalty: boolean;
  zones: string[];
  frames: Frame[];
  sounds: Sound[];
  duration: number;
};

// An iron out of a bunker is possible, but the sand takes a fifth of the distance.
export function lieFactor(h: Hole, from: V2, club: Shot['club']) {
  return club === 'iron' && surfaceAt(h, from) === 'sand' ? 0.8 : 1;
}

export function curbs(h: Hole): Wall[] {
  return h.border.map((a, i) => ({ a, b: h.border[(i + 1) % h.border.length], h: CURB_H, look: 'stone' as const }));
}

function closest(px: number, py: number, a: V2, b: V2) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

export function launch(shot: Shot): { vx: number; vy: number; vz: number; ax: number; ay: number } {
  const club = CLUBS[shot.club];
  // angle 0 points up the hole (+y)
  if (shot.club === 'putter') {
    // a shaky stroke (error) starts it off line
    const v = carryOf('putter', shot.power);
    const a = shot.angle + shot.error * club.push;
    return { vx: Math.sin(a) * v, vy: Math.cos(a) * v, vz: 0, ax: 0, ay: 0 };
  }
  // backspin climbs a touch higher and carries a touch less; topspin comes out low
  const spin = shot.spin ?? 0;
  const loft = (club.loft * (1 + spin * (spin > 0 ? 0.08 : 0.1)) * Math.PI) / 180;
  const carry = carryOf(shot.club, shot.power, shot.boost) * (1 - 0.04 * Math.max(0, spin));
  // carry d on flat ground needs v² = d·g / sin(2·loft)
  const v = Math.sqrt((carry * G) / Math.sin(2 * loft));
  const vz = v * Math.sin(loft);
  // a played shape starts off line and bends back onto it at the same carry; a mishit just bends
  const bend = (shot.shape ?? 0) * club.bend;
  const off = Math.atan((0.5 * bend * ((2 * vz) / G)) / (v * Math.cos(loft)));
  const flat = (v * Math.cos(loft)) / Math.cos(off);
  const a = shot.angle + shot.error * club.push - off;
  const dx = Math.sin(a);
  const dy = Math.cos(a);
  // sideways pull, square to the target line: right for a slice or fade (> 0), left for a hook or draw
  const side = shot.error * club.curve + bend;
  return { vx: dx * flat, vy: dy * flat, vz, ax: Math.cos(shot.angle) * side, ay: -Math.sin(shot.angle) * side };
}

// slopes past 1.5 are cliff edges in the heightfield; treat them as steep, not vertical
function capped(g: V2): V2 {
  const m = Math.hypot(g.x, g.y);
  return m > 1.5 ? { x: (g.x * 1.5) / m, y: (g.y * 1.5) / m } : g;
}

export function simulate(h: Hole, from: V2, shot: Shot, keepFrames = true): Result {
  let { x, y } = from;
  const shotLaunch = launch({ ...shot, boost: (shot.boost ?? 1) * lieFactor(h, from, shot.club) });
  let { vx, vy, vz } = shotLaunch;
  const club = CLUBS[shot.club];
  let z = heightAt(h, x, y);
  let air = shot.club !== 'putter';
  let flying = air; // still on the first flight, so the hook or slice is still working
  const statics = [...curbs(h), ...h.walls];
  const frames: Frame[] = [];
  const sounds: Sound[] = [];
  const zones = new Set<string>();
  const last = new Map<string, number>();
  let t = 0;
  let step = 0;
  let still = 0;
  let prevGround = z;
  const R = cupR(h);
  const greenF = h.tour ? TOUR_GREEN : FRICTION.green;
  const friction = (s: Surface) => (s === 'green' ? greenF : FRICTION[s]);
  let lipped = false; // it has just caught the cup and spun out; it can't drop again on the same pass
  const vented = new Map<string, number>();

  const sound = (key: string, s: Sound['s']) => {
    const p = last.get(key);
    if (p === undefined || t - p > 0.1) sounds.push({ t, s });
    last.set(key, t);
  };
  const finish = (holed: boolean, penalty: boolean): Result => {
    if (keepFrames) frames.push({ x, y, z, t });
    return { end: penalty ? from : { x, y }, holed, penalty, zones: [...zones], frames, sounds, duration: t };
  };

  while (t < MAX_T) {
    t += DT;
    step++;
    const clock = shot.clock + t;
    const ground = heightAt(h, x, y);
    if (air) prevGround = ground;

    if (air) {
      vz -= G * DT;
      if (flying) {
        vx += shotLaunch.ax * DT;
        vy += shotLaunch.ay * DT;
      }
      if (shot.wind) {
        vx += shot.wind.x * DT;
        vy += shot.wind.y * DT;
      }
      z += vz * DT;
      x += vx * DT;
      y += vy * DT;
      const g2 = heightAt(h, x, y);
      if (h.roofs?.some((r) => z - g2 > 4 && inPoly({ x, y }, r.poly))) {
        sounds.push({ t, s: 'wall' });
        return finish(false, true);
      }
      if (z <= g2) {
        z = g2;
        if (isWater(h, { x, y }, clock)) {
          sounds.push({ t, s: 'splash' });
          return finish(false, true);
        }
        if (!inPoly({ x, y }, h.border)) return finish(false, true);
        // dropped straight in
        if (Math.hypot(x - h.cup.x, y - h.cup.y) < R) {
          x = h.cup.x;
          y = h.cup.y;
          z -= CUP_DEPTH;
          sounds.push({ t, s: 'cup' });
          return finish(true, false);
        }
        const surf = surfaceAt(h, { x, y });
        sound('land', surf === 'sand' ? 'sand' : 'land');
        // bounce off the local surface normal, then let it settle into a roll
        const gr = capped(gradAt(h, x, y));
        const vzRel = vz - (vx * gr.x + vy * gr.y);
        // the first landing takes the club's bite; later hops barely scrub
        const hard = Math.min(1, -vzRel / 30);
        const spin = shot.spin ?? 0;
        // a firm green lets a plain shot skip on; backspin is what holds it
        const firm = surf === 'green' ? (h.greenFirm ?? 0) : 0;
        const bite = club.keep + (1 - club.keep) * (1 - hard) + club.release * Math.max(0, -spin) + firm;
        const keep = (flying ? Math.min(1, bite) : 1 - Math.min(0.4, -vzRel * 0.02)) * LANDING[surf];
        vx *= keep;
        vy *= keep;
        // backspin grabs on the first landing: it checks up, or zips back if there's enough of it
        if (flying && spin > 0) {
          const sp = Math.hypot(vx, vy);
          const check = club.check * spin * GRIP[surf] * (0.35 + 0.65 * shot.power);
          const next = Math.max(sp - check, -0.6 * check);
          if (sp > 1e-6) {
            vx *= next / sp;
            vy *= next / sp;
          }
        }
        flying = false;
        if (vzRel < -9 && surf !== 'sand') vz = -vzRel * 0.24 + (vx * gr.x + vy * gr.y);
        else air = false;
      }
    } else {
      const gr = capped(gradAt(h, x, y));
      // gravity along the slope
      vx -= G * ROLL * gr.x * DT;
      vy -= G * ROLL * gr.y * DT;
      let vent = 0;
      for (const p of h.pushes) {
        if (Math.hypot(x - p.x, y - p.y) < p.r) {
          const f = p.at(clock);
          vx += f.x * DT;
          vy += f.y * DT;
          // a geyser or blowhole going off under the ball throws it in the air (once per eruption)
          const e = p.erupt?.(clock);
          if (e && t - (vented.get(p.id) ?? -9) > 1) {
            vented.set(p.id, t);
            vx = vx * 0.3 + e.x;
            vy = vy * 0.3 + e.y;
            vent = Math.max(vent, e.z);
          }
        }
      }
      const sp = Math.hypot(vx, vy);
      const fr = friction(surfaceAt(h, { x, y })) * DT;
      if (sp > fr) {
        vx -= (vx / sp) * fr;
        vy -= (vy / sp) * fr;
      } else if (Math.hypot(gr.x, gr.y) * G * ROLL < greenF * 0.9) {
        vx = 0;
        vy = 0;
      }
      // a rolling ball whose path crosses the cup drops; on tour greens only if it's slow enough
      const near = closest(h.cup.x, h.cup.y, { x, y }, { x: x + vx * DT, y: y + vy * DT });
      if (lipped && Math.hypot(x - h.cup.x, y - h.cup.y) > R + 1) lipped = false;
      if (Math.hypot(near.x - h.cup.x, near.y - h.cup.y) < R && !lipped) {
        // how far off dead centre its line runs: a centred putt can be firmer than one that catches the edge
        const v = Math.hypot(vx, vy) || 1;
        const off = Math.min(R, Math.abs(vx * (h.cup.y - y) - vy * (h.cup.x - x)) / v);
        const cap = h.tour ? DROP_SPEED * Math.sqrt(1 - (off / R) ** 2) : Infinity;
        if (Math.hypot(vx, vy) <= cap) {
          x = h.cup.x;
          y = h.cup.y;
          z = heightAt(h, x, y) - CUP_DEPTH;
          sounds.push({ t, s: 'cup' });
          return finish(true, false);
        }
        lipped = true;
        if (off < R * 0.45) {
          // straight over the top: it hops the hole and loses some pace
          vx *= 0.8;
          vy *= 0.8;
          sounds.push({ t, s: 'hop' });
        } else {
          // it catches the edge, swings round it and spins away
          const side = Math.sign(vx * (h.cup.y - y) - vy * (h.cup.x - x)) || 1;
          const turn = side * (0.6 + 0.9 * (1 - off / R));
          const c = Math.cos(turn);
          const s2 = Math.sin(turn);
          [vx, vy] = [(vx * c - vy * s2) * 0.65, (vx * s2 + vy * c) * 0.65];
          sounds.push({ t, s: 'lip' });
        }
      }
      // how fast the ground was rising under the ball a step ago
      const vzSurf = air ? 0 : (ground - prevGround) / DT;
      x += vx * DT;
      y += vy * DT;
      const g2 = heightAt(h, x, y);
      const predicted = ground + vzSurf * DT;
      // over a crest faster than the ground falls away: leave the ground
      if (predicted - g2 > 0.012 && Math.hypot(vx, vy) > 6) {
        // a lip can toss the ball up a little, never like a ski jump
        const lift = Math.min(vzSurf, Math.hypot(vx, vy) * 0.35);
        air = true;
        z = ground + lift * DT;
        vz = lift;
      } else z = g2;
      if (vent > 0) {
        air = true;
        z = g2 + 0.05;
        vz = vent;
        sounds.push({ t, s: 'vent' });
      }
      prevGround = ground;
      if (!air && isWater(h, { x, y }, clock)) {
        sounds.push({ t, s: 'splash' });
        return finish(false, true);
      }
    }

    // walls and posts the ball is low enough to hit
    const moving = h.movers.map((m) => m.at(clock));
    const walls: Wall[] = moving.length ? [...statics, ...moving.flatMap((m) => m.walls)] : statics;
    const posts: Post[] = moving.length ? [...h.posts, ...moving.flatMap((m) => m.posts)] : h.posts;
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      const c = closest(x, y, w.a, w.b);
      const dx = x - c.x;
      const dy = y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < BALL_R && d > 1e-6 && z - heightAt(h, c.x, c.y) < w.h) {
        const nx = dx / d;
        const ny = dy / d;
        x = c.x + nx * BALL_R;
        y = c.y + ny * BALL_R;
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= 1.72 * vn * nx;
          vy -= 1.72 * vn * ny;
          sound(`w${i}`, 'wall');
        }
      }
    }
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < BALL_R + p.r && d > 1e-6 && z - heightAt(h, p.x, p.y) < p.h) {
        const nx = dx / d;
        const ny = dy / d;
        x = p.x + nx * (BALL_R + p.r);
        y = p.y + ny * (BALL_R + p.r);
        const vn = vx * nx + vy * ny;
        if (vn < 0) {
          vx -= (1 + (p.e ?? 0.6)) * vn * nx;
          vy -= (1 + (p.e ?? 0.6)) * vn * ny;
          sound(`p${i}`, 'post');
        }
      }
    }
    if (!inPoly({ x, y }, h.border)) return finish(false, true);
    // secret routes count when you roll them (or putt into a jump), not when you fly over them
    if (!air || shot.club === 'putter') for (const zn of h.zones) if (!zones.has(zn.id) && inPoly({ x, y }, zn.poly)) zones.add(zn.id);
    if (keepFrames && step % 4 === 0) frames.push({ x, y, z, t });
    if (!air && vx === 0 && vy === 0) {
      still += DT;
      if (still > 0.1) break;
    } else still = 0;
  }
  return finish(false, false);
}
