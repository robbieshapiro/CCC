// Wildlife in the Ohio woods (the Western Reserve): white-tailed deer grazing, a few wild turkeys pecking about and
// the odd cottontail, out in the deep rough where you can see them. Never in play: they stand well off the line of
// play, clear of any short grass, they have no part in the physics, and they don't stray from their spot. Which turn up, and where, is
// different each time a hole is drawn, so it's a small surprise to spot them.
import * as THREE from 'three';
import { mat, mesh } from './props';
import { heightAt, inPoly, isWater, surfaceAt } from './terrain';
import type { Hole, V2 } from './types';

type Anim = (clock: number, dt: number) => void;
const R = Math.random;

const COAT = '#8a6040';
const COAT_DARK = '#5f4330';
const BELLY = '#d9c7a8';

export function deer(buck: boolean) {
  const g = new THREE.Group();
  const coat = mat(COAT);
  const body = mesh(new THREE.SphereGeometry(1, 16, 12), coat);
  body.scale.set(0.55, 0.6, 1.25);
  body.position.y = 1.95;
  g.add(body);
  const belly = mesh(new THREE.SphereGeometry(1, 12, 8), mat(BELLY));
  belly.scale.set(0.44, 0.4, 1.0);
  belly.position.set(0, 1.72, 0);
  g.add(belly);
  // haunches and shoulders, so the body isn't a plain egg
  for (const [z, r] of [[-0.75, 0.55], [0.7, 0.5]] as const) {
    const m = mesh(new THREE.SphereGeometry(r, 12, 8), coat);
    m.scale.set(1, 1.1, 1);
    m.position.set(0, 1.95, z);
    g.add(m);
  }
  // legs: slim, darker below the knee, with a hoof
  for (const [x, z] of [[-0.24, 0.72], [0.24, 0.72], [-0.26, -0.78], [0.26, -0.78]]) {
    const up = mesh(new THREE.CylinderGeometry(0.13, 0.09, 0.8, 7), coat);
    up.position.set(x, 1.3, z);
    g.add(up);
    const low = mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.95, 6), mat(COAT_DARK));
    low.position.set(x, 0.5, z);
    g.add(low);
    const hoof = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 6), mat('#2b211c'));
    hoof.position.set(x, 0.05, z);
    g.add(hoof);
  }
  const tail = mesh(new THREE.ConeGeometry(0.16, 0.45, 6), mat('#f1ece2'));
  tail.position.set(0, 2.2, -1.3);
  tail.rotation.x = -2.3;
  g.add(tail);
  // the neck on a pivot at the shoulder, the head on a pivot at the top of the neck, so it can graze nose down
  const neck = new THREE.Group();
  neck.position.set(0, 2.1, 0.95);
  g.add(neck);
  const n = mesh(new THREE.CylinderGeometry(0.19, 0.3, 1.35, 9), coat);
  n.position.y = 0.6;
  neck.add(n);
  const head = new THREE.Group();
  head.position.y = 1.3;
  neck.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.3, 12, 9), coat);
  skull.scale.set(0.85, 0.85, 1.0);
  skull.position.set(0, 0.05, 0.1);
  head.add(skull);
  const muzzle = mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.5, 9), coat);
  muzzle.rotation.x = Math.PI / 2;
  muzzle.position.set(0, -0.03, 0.42);
  head.add(muzzle);
  const nose = mesh(new THREE.SphereGeometry(0.1, 8, 6), mat('#2b211c'));
  nose.position.set(0, -0.02, 0.68);
  head.add(nose);
  const throat = mesh(new THREE.SphereGeometry(0.12, 8, 6), mat('#f1ece2'));
  throat.position.set(0, -0.2, 0.2);
  head.add(throat);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.16, 8, 6), coat);
    ear.scale.set(0.5, 1.4, 0.3);
    ear.position.set(s * 0.26, 0.3, -0.02);
    ear.rotation.z = -s * 0.85;
    head.add(ear);
    if (buck) {
      const bone = mat('#d8c9a8');
      const beam = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.85, 5), bone);
      beam.position.set(s * 0.22, 0.6, 0.05);
      beam.rotation.set(0.35, 0, -s * 0.45);
      head.add(beam);
      for (const k of [0.3, 0.65]) {
        const tine = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), bone);
        tine.position.set(s * (0.25 + k * 0.32), 0.45 + k * 0.35, 0.1 + k * 0.15);
        head.add(tine);
      }
    }
  }
  g.traverse((o) => (o.castShadow = true));
  // 0 = head up and looking, 1 = grazing
  const pose = (graze: number) => {
    neck.rotation.x = 0.35 + graze * 1.85;
    head.rotation.x = -neck.rotation.x + 0.05 + graze * 1.15;
  };
  pose(0);
  return { g, pose };
}

export function turkey() {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.62, 12, 8), mat('#3a2b22', { rough: 0.6, metal: 0.15 }));
  body.scale.set(0.85, 0.8, 1.05);
  body.position.y = 1.05;
  g.add(body);
  const fan = mesh(new THREE.CircleGeometry(0.85, 12, 0, Math.PI), mat('#5a3f2a'));
  fan.position.set(0, 1.2, -0.55);
  fan.rotation.x = 0.35;
  g.add(fan);
  const neck = new THREE.Group();
  neck.position.set(0, 1.3, 0.48);
  g.add(neck);
  const n = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 6), mat('#9fb4c4'));
  n.position.y = 0.22;
  neck.add(n);
  const head = mesh(new THREE.SphereGeometry(0.11, 8, 6), mat('#a8c0d0'));
  head.position.set(0, 0.5, 0.05);
  neck.add(head);
  const wattle = mesh(new THREE.SphereGeometry(0.06, 6, 4), mat('#c0352b'));
  wattle.position.set(0, 0.4, 0.12);
  neck.add(wattle);
  for (const x of [-0.16, 0.16]) {
    const leg = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 4), mat('#b88a5a'));
    leg.position.set(x, 0.28, 0.05);
    g.add(leg);
  }
  g.traverse((o) => (o.castShadow = true));
  return { g, neck };
}

export function rabbit() {
  const g = new THREE.Group();
  const fur = mat('#8b7560');
  const body = mesh(new THREE.SphereGeometry(0.32, 10, 8), fur);
  body.scale.set(0.85, 0.8, 1.15);
  body.position.y = 0.3;
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.17, 8, 6), fur);
  head.position.set(0, 0.52, 0.3);
  g.add(head);
  for (const x of [-0.06, 0.06]) {
    const ear = mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.32, 5), fur);
    ear.position.set(x, 0.78, 0.26);
    ear.rotation.x = -0.25;
    g.add(ear);
  }
  const tail = mesh(new THREE.SphereGeometry(0.08, 6, 4), mat('#f2ede4'));
  tail.position.set(0, 0.35, -0.36);
  g.add(tail);
  g.traverse((o) => (o.castShadow = true));
  return { g };
}

// A spot out in the deep rough where you can see it from the tee and as the ball flies: inside the hole, well off the
// line of play (clear of the tee-to-pin line and of any short grass, sand or water all round), and not under a tree.
// The animals have no part in the physics: a ball rolls by them, never into them.
function spot(h: Hole, from: number, to: number, off = 14, clear = 7): THREE.Vector3 | null {
  const tx = h.tee.x;
  const ty = h.tee.y;
  const vx = h.cup.x - tx;
  const vy = h.cup.y - ty;
  const len = Math.hypot(vx, vy) || 1;
  const ux = vx / len;
  const uy = vy / len;
  for (let tries = 0; tries < 120; tries++) {
    // how far down the hole (from the tee, in world units), and how far off the line to one side
    const d = Math.min(len * 0.95, from + R() * (to - from));
    const side = (R() < 0.5 ? -1 : 1) * (off + R() * off * 2);
    const s: V2 = { x: tx + ux * d - uy * side, y: ty + uy * d + ux * side };
    if (!inPoly(s, h.border) || surfaceAt(h, s) !== 'rough' || isWater(h, s)) continue;
    // a clear ring of rough round it: not on the edge of the fairway, a green, a bunker, the water or the boundary
    let ok = true;
    for (let k = 0; k < 10 && ok; k++) {
      const a = (k / 10) * Math.PI * 2;
      const q = { x: s.x + Math.cos(a) * clear, y: s.y + Math.sin(a) * clear };
      ok = inPoly(q, h.border) && surfaceAt(h, q) === 'rough' && !isWater(h, q);
    }
    if (!ok) continue;
    // not standing in a tree
    if (h.posts.some((p) => Math.hypot(p.x - s.x, p.y - s.y) < p.r + 2)) continue;
    return new THREE.Vector3(s.x, heightAt(h, s.x, s.y), -s.y);
  }
  return null;
}

export function wildlife(h: Hole, root: THREE.Group, anim: Anim[]) {
  const group = new THREE.Group();
  group.name = 'wildlife';
  root.add(group);
  // deer: on most holes a doe or two (sometimes a buck) within sight of the tee, and often another few further down
  // for the next shot, grazing and now and then looking up
  const herd = (at: THREE.Vector3 | null) => {
    if (!at) return;
    const n = 1 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const { g, pose } = deer(i === 0 && R() < 0.4);
      g.position.copy(at).add(new THREE.Vector3((R() - 0.5) * 8, 0, (R() - 0.5) * 8));
      g.position.y = heightAt(h, g.position.x, -g.position.z);
      g.rotation.y = R() * Math.PI * 2;
      g.scale.setScalar(1.15 + R() * 0.2);
      group.add(g);
      const phase = R() * 20;
      anim.push((t) => {
        // a 9 second cycle: head down grazing, then up and still for a couple of seconds
        const k = (t + phase) % 9;
        const up = k > 6.5 ? Math.min(1, (k - 6.5) * 2) * Math.min(1, (9 - k) * 2) : 0;
        pose((1 - up) * (0.92 + Math.sin(t * 3 + phase) * 0.05));
      });
    }
  };
  if (R() < 0.85) herd(spot(h, 50, 190));
  if (R() < 0.6) herd(spot(h, 220, 420));
  // wild turkeys: a little flock pecking about
  if (R() < 0.45) {
    const at = spot(h, 90, 360);
    if (at) {
      const n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const { g, neck } = turkey();
        g.scale.setScalar(1.4);
        const home = at.clone().add(new THREE.Vector3((R() - 0.5) * 8, 0, (R() - 0.5) * 8));
        g.position.copy(home);
        g.rotation.y = R() * Math.PI * 2;
        group.add(g);
        const phase = R() * 10;
        anim.push((t) => {
          neck.rotation.x = Math.max(0, Math.sin(t * 2.2 + phase)) * 1.2;
          // a slow amble round its spot
          const a = t * 0.12 + phase;
          g.position.set(home.x + Math.cos(a) * 1.2, home.y, home.z + Math.sin(a) * 1.2);
          g.rotation.y = -a;
        });
      }
    }
  }
  // a cottontail or two, sitting up, with a hop now and then
  if (R() < 0.55) {
    const n = 1 + Math.floor(R() * 2);
    for (let i = 0; i < n; i++) {
      const at = spot(h, 30, 150, 12, 5);
      if (!at) continue;
      const { g } = rabbit();
      g.position.copy(at);
      g.rotation.y = R() * Math.PI * 2;
      group.add(g);
      const phase = R() * 7;
      const dir = g.rotation.y;
      anim.push((t) => {
        const k = (t + phase) % 7;
        const hop = k < 0.45 ? Math.sin((k / 0.45) * Math.PI) : 0;
        g.position.y = at.y + hop * 0.45;
        // each hop moves it a little, out and back again, so it stays put
        const out = Math.floor((t + phase) / 7) % 2 === 0;
        const step = k < 0.45 ? k / 0.45 : 1;
        const off = (out ? step : 1 - step) * 0.8;
        g.position.x = at.x + Math.sin(dir) * off;
        g.position.z = at.z + Math.cos(dir) * off;
        g.rotation.y = out ? dir : dir + Math.PI;
      });
    }
  }
}
