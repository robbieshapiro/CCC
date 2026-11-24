// The mountain's animals (the Powder Bowl, Nov 22): a bull moose by the water or in the willows, a small herd of elk
// in the open, a black bear ambling along the tree line now and then, mountain goats up on the rocks, and a red fox
// trotting about in the snow. Scenery only, like the sheep on the links: a ball goes straight through them, they keep
// off the tees, fairways, greens and water, and which turn up where is fixed for each hole.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim } from '../kits';
import { mat, mesh } from '../props';
import { heightAt, inPoly, surfaceAt, wetIn } from '../terrain';
import type { Hole, V2 } from '../types';

type Rng = { next(): number };

// a four-legged body: a barrel, four legs, a neck and a head, facing +x. Sizes in feet.
function beast(o: { len: number; girth: number; leg: number; neck: number; head: number; coat: string; dark?: string; legCoat?: string }) {
  const g = new THREE.Group();
  const coat = mat(o.coat);
  const dark = mat(o.dark ?? o.coat);
  const body = mesh(new THREE.CapsuleGeometry(o.girth / 2, o.len - o.girth, 4, 8), coat);
  body.rotation.z = Math.PI / 2;
  body.position.y = o.leg + o.girth / 2;
  g.add(body);
  const legs: THREE.Object3D[] = [];
  for (const x of [o.len / 2 - o.girth * 0.55, -o.len / 2 + o.girth * 0.55])
    for (const z of [-o.girth * 0.28, o.girth * 0.28]) {
      const l = mesh(new THREE.CylinderGeometry(o.girth * 0.09, o.girth * 0.07, o.leg + o.girth * 0.2, 5), mat(o.legCoat ?? o.dark ?? o.coat));
      l.position.set(x, (o.leg + o.girth * 0.2) / 2, z);
      g.add(l);
      legs.push(l);
    }
  const neck = new THREE.Group();
  neck.position.set(o.len / 2 - o.girth * 0.2, o.leg + o.girth * 0.75, 0);
  const n = mesh(new THREE.CylinderGeometry(o.girth * 0.22, o.girth * 0.3, o.neck, 6), dark);
  n.rotation.z = -0.7;
  n.position.set(o.neck * 0.3, o.neck * 0.35, 0);
  neck.add(n);
  const head = mesh(new THREE.BoxGeometry(o.head, o.head * 0.55, o.head * 0.5), dark);
  head.position.set(o.neck * 0.62 + o.head * 0.35, o.neck * 0.68, 0);
  head.rotation.z = -0.35;
  neck.add(head);
  g.add(neck);
  return { g, neck, head, legs };
}

// a bull moose: dark and tall, a shoulder hump, a long nose, a dewlap and broad palmate antlers
function moose() {
  const b = beast({ len: 9, girth: 3.8, leg: 4.6, neck: 2.6, head: 2.6, coat: '#3b2a1e', dark: '#2a1e15', legCoat: '#8a7a66' });
  b.g.add(mesh(new THREE.SphereGeometry(1.6, 8, 6), mat('#3b2a1e')).translateX(2.6).translateY(8.4));
  b.head.add(mesh(new THREE.BoxGeometry(0.4, 1, 0.3), mat('#2a1e15')).translateY(-0.9));
  for (const z of [-1, 1]) {
    const palm = mesh(new THREE.BoxGeometry(1.4, 0.25, 2.2), mat('#8f7a58'));
    palm.position.set(-0.6, 1.1, z * 1.7);
    palm.rotation.x = z * 0.5;
    b.head.add(palm);
  }
  return b;
}

// a bull elk: tan with a dark chestnut neck, a pale rump and tall branching antlers
function elk(bull: boolean) {
  const b = beast({ len: 7.4, girth: 2.9, leg: 3.6, neck: 2.6, head: 1.9, coat: '#b08856', dark: '#5a3a22', legCoat: '#4a3020' });
  b.g.add(mesh(new THREE.SphereGeometry(1.2, 8, 6), mat('#e8dcc0')).translateX(-3.4).translateY(5.1));
  if (bull)
    for (const z of [-1, 1]) {
      const beam = mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.6, 4), mat('#d8c8a6'));
      beam.position.set(-0.8, 1.8, z * 0.6);
      beam.rotation.set(z * 0.35, 0, 0.5);
      b.head.add(beam);
      for (let k = 0; k < 3; k++) {
        const tine = mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.2, 4), mat('#d8c8a6'));
        tine.position.set(-0.4 - k * 0.5, 1.2 + k * 0.7, z * (0.8 + k * 0.25));
        tine.rotation.z = -0.6;
        b.head.add(tine);
      }
    }
  return b;
}

// a black bear: round and heavy, a brown muzzle, small ears, the head carried low
function bear() {
  const b = beast({ len: 5.6, girth: 3, leg: 1.8, neck: 1, head: 1.6, coat: '#1d1a18' });
  b.head.add(mesh(new THREE.BoxGeometry(0.7, 0.5, 0.6), mat('#7a5a3e')).translateX(0.9).translateY(-0.1));
  for (const z of [-0.45, 0.45]) b.head.add(mesh(new THREE.SphereGeometry(0.25, 6, 4), mat('#1d1a18')).translateY(0.55).translateZ(z));
  return b;
}

// a mountain goat: shaggy and white, a beard, short black horns
function goat() {
  const b = beast({ len: 4.2, girth: 2, leg: 2, neck: 1.2, head: 1.1, coat: '#f3f0e6', legCoat: '#e6e1d2' });
  b.head.add(mesh(new THREE.ConeGeometry(0.2, 0.9, 5), mat('#f3f0e6')).translateY(-0.6).translateX(0.1));
  for (const z of [-0.2, 0.2]) {
    const horn = mesh(new THREE.ConeGeometry(0.09, 0.9, 5), mat('#1a1a1a'));
    horn.position.set(-0.2, 0.6, z);
    horn.rotation.z = 0.5;
    b.head.add(horn);
  }
  return b;
}

// a red fox: small and quick, a white-tipped brush of a tail
function fox() {
  const b = beast({ len: 2.4, girth: 0.8, leg: 0.9, neck: 0.5, head: 0.6, coat: '#c8581e', legCoat: '#2a1a12' });
  const tail = mesh(new THREE.CapsuleGeometry(0.25, 1.4, 3, 6), mat('#c8581e'));
  tail.rotation.z = 1.2;
  tail.position.set(-1.8, 1.3, 0);
  b.g.add(tail);
  b.g.add(mesh(new THREE.SphereGeometry(0.22, 6, 4), mat('#ffffff')).translateX(-2.45).translateY(0.95));
  return b;
}

// a clear spot in the powder: inside the hole's border (or a little past it), not on short grass, water or a path, not
// in a tree, and at least `clear` feet from any of those
function spot(h: Hole, rng: Rng, clear: number, near?: (p: V2) => boolean): V2 | null {
  const { x0, y0, x1, y1 } = h.bounds;
  for (let k = 0; k < 160; k++) {
    const p = { x: x0 + 10 + rng.next() * (x1 - x0 - 20), y: y0 + 60 + rng.next() * (y1 - y0 - 80) };
    if (near && !near(p)) continue;
    let ok = true;
    for (let a = 0; a < 8 && ok; a++) {
      const q = { x: p.x + Math.cos((a / 8) * Math.PI * 2) * clear, y: p.y + Math.sin((a / 8) * Math.PI * 2) * clear };
      ok = inPoly(q, h.border) && surfaceAt(h, q) === 'rough' && !wetIn(h, q);
    }
    if (!ok || surfaceAt(h, p) !== 'rough' || wetIn(h, p)) continue;
    if (h.posts.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < t.r + 4)) continue;
    // and clear of the buildings, signs and the après deck
    if (h.decor.some((d) => d.kind !== 'rock' && Math.hypot(d.x - p.x, d.y - p.y) < 40)) continue;
    // off the line of play: well clear of the straight line from the tee to the cup
    const vx = h.cup.x - h.tee.x;
    const vy = h.cup.y - h.tee.y;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - h.tee.x) * vx + (p.y - h.tee.y) * vy) / len2));
    if (Math.hypot(p.x - (h.tee.x + vx * t), p.y - (h.tee.y + vy * t)) < 45) continue;
    return p;
  }
  return null;
}

// grazing: the head goes down to the snow and comes up to look round, on a slow cycle of its own
function graze(neck: THREE.Object3D, anim: Anim, phase: number) {
  anim.push((clock) => {
    const k = (clock + phase) % 11;
    const up = k > 7 ? Math.min(1, (k - 7) * 2) * Math.min(1, (11 - k) * 2) : 0;
    neck.rotation.z = -(1 - up) * 0.75;
  });
}

// a moose placed by a hole's decor (`{ kind: 'moose' }`): the Double Black's, by its creeks (Nov 24, Robbie), grazing
export function mooseDecor(anim: Anim, seed = 0) {
  const m = moose();
  graze(m.neck, anim, seed % 11);
  return m.g;
}

export function mountainLife(h: Hole, floor: number, anim: Anim) {
  const root = new THREE.Group();
  root.name = 'mountainlife';
  const rng = makeRng(`mountainlife:${h.id}`);
  const put = (o: THREE.Object3D, p: V2, rot: number) => {
    o.position.set(p.x, Math.max(floor, heightAt(h, p.x, p.y)), -p.y);
    o.rotation.y = rot;
    root.add(o);
  };
  // a bull moose, by the water if the hole has any
  if (rng.next() < 0.75) {
    const water = h.water.length ? (p: V2) => h.water.some((w) => inPoly({ x: p.x, y: p.y - 30 }, w.poly) || inPoly({ x: p.x, y: p.y + 30 }, w.poly)) : undefined;
    const p = spot(h, rng, 12, water) ?? spot(h, rng, 12);
    if (p) {
      const m = moose();
      put(m.g, p, rng.next() * Math.PI * 2);
      graze(m.neck, anim, rng.next() * 11);
    }
  }
  // a small herd of elk, a bull and his cows
  if (rng.next() < 0.7) {
    const p = spot(h, rng, 16);
    if (p) {
      const n = 3 + Math.floor(rng.next() * 3);
      for (let i = 0; i < n; i++) {
        const e = elk(i === 0);
        put(e.g, { x: p.x + (rng.next() - 0.5) * 22, y: p.y + (rng.next() - 0.5) * 22 }, rng.next() * Math.PI * 2);
        graze(e.neck, anim, rng.next() * 11);
      }
    }
  }
  // now and then a black bear, ambling up and down along the trees
  if (rng.next() < 0.4) {
    const p = spot(h, rng, 10);
    if (p) {
      const b = bear();
      const home = { ...p };
      put(b.g, home, 0);
      const phase = rng.next() * 60;
      anim.push((clock) => {
        const t = ((clock + phase) * 0.05) % 2;
        const k = t < 1 ? t : 2 - t;
        const y = home.y - 12 + 24 * k;
        b.g.position.set(home.x, Math.max(floor, heightAt(h, home.x, y)), -y);
        b.g.rotation.y = t < 1 ? Math.PI / 2 : -Math.PI / 2;
        b.legs.forEach((l, i) => (l.rotation.z = Math.sin(clock * 4 + i * 1.6) * 0.3));
      });
    }
  }
  // mountain goats up high: on the highest rough of the hole
  if (rng.next() < 0.6) {
    let best: V2 | null = null;
    for (let i = 0; i < 12; i++) {
      const p = spot(h, rng, 8);
      if (p && (!best || heightAt(h, p.x, p.y) > heightAt(h, best.x, best.y))) best = p;
    }
    if (best) {
      for (let i = 0; i < 2; i++) {
        const gt = goat();
        put(gt.g, { x: best.x + i * 5, y: best.y + i * 3 }, rng.next() * Math.PI * 2);
        graze(gt.neck, anim, rng.next() * 11);
      }
    }
  }
  // a red fox, trotting a little circle in the snow
  if (rng.next() < 0.65) {
    const p = spot(h, rng, 8);
    if (p) {
      const f = fox();
      root.add(f.g);
      const phase = rng.next() * 30;
      anim.push((clock) => {
        const a = (clock + phase) * 0.25;
        const x = p.x + Math.cos(a) * 5;
        const y = p.y + Math.sin(a) * 5;
        f.g.position.set(x, Math.max(floor, heightAt(h, x, y)), -y);
        f.g.rotation.y = a + Math.PI / 2;
        f.legs.forEach((l, i) => (l.rotation.z = Math.sin(clock * 9 + i * 1.6) * 0.4));
      });
    }
  }
  return root;
}
