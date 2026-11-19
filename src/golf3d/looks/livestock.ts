// The animals of the links (Nov 18, Robbie: "Way more sheep, everywhere. And hairy cows."): a flock on every links
// hole, a few dozen sheep grazing in loose groups on the rough, the dunes and past the out of bounds, and a small herd
// of shaggy Highland cattle. Scenery only: a ball goes straight through them, and they keep off the tees, fairways,
// greens, sand and the line of play, so they never hide a ball or the cup.
//
// The sheep are three instanced meshes (wool, faces, legs), so a flock of sixty costs about what one sheep did.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import { mat, mesh } from '../props';
import { heightAt, inPoly, surfaceAt, wetIn } from '../terrain';
import type { Hole, V2 } from '../types';

// how far a point is from a polyline
function toLine(p: V2, line: V2[]) {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

// somewhere an animal may stand: dry land, not where the golf is
function grazing(h: Hole, p: V2) {
  const { x0, y0, x1, y1 } = h.bounds;
  const inside = p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1;
  if (inside) {
    const s = surfaceAt(h, p);
    if (s !== 'rough') return false;
    if (wetIn(h, p)) return false;
  }
  if (h.water.some((w) => inPoly(p, w.poly) && heightAt(h, p.x, p.y) < w.level + 1.5)) return false;
  // clear of the line of play, the tee and the green
  const line = [h.tee, ...h.flyover.filter((q) => q.y > h.tee.y + 20), h.cup];
  if (toLine(p, line) < 34) return false;
  if (Math.hypot(p.x - h.cup.x, p.y - h.cup.y) < 48 || Math.hypot(p.x - h.tee.x, p.y - h.tee.y) < 30) return false;
  if (h.posts.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < q.r + 3)) return false;
  // and not standing in a dry-stone wall
  if (h.walls.some((w) => toLine(p, [w.a, w.b]) < 9)) return false;
  return true;
}

// spots for groups of animals round a hole: in its rough and out past its edges
// front: how many of the groups go where they're seen from the tee (ahead and off to one side of the line)
function spots(h: Hole, rng: { next(): number }, groups: number, size: [number, number], spread: number, front = 0) {
  const { x0, y0, x1, y1 } = h.bounds;
  const out: { x: number; y: number; rot: number }[][] = [];
  const ahead = h.flyover.find((q) => Math.hypot(q.x - h.tee.x, q.y - h.tee.y) > 80) ?? h.cup;
  const len = Math.hypot(ahead.x - h.tee.x, ahead.y - h.tee.y) || 1;
  const dir = { x: (ahead.x - h.tee.x) / len, y: (ahead.y - h.tee.y) / len };
  for (let tries = 0; out.length < groups && tries < groups * 40; tries++) {
    const near = out.length < front && tries < front * 30;
    const d = 70 + rng.next() * 110;
    const side = (rng.next() < 0.5 ? -1 : 1) * (40 + rng.next() * 30);
    const c = near
      ? { x: h.tee.x + dir.x * d - dir.y * side, y: h.tee.y + dir.y * d + dir.x * side }
      : { x: x0 - 60 + rng.next() * (x1 - x0 + 120), y: y0 + rng.next() * (y1 - y0 + 60) };
    if (!grazing(h, c)) continue;
    const n = size[0] + Math.floor(rng.next() * (size[1] - size[0] + 1));
    const heading = rng.next() * Math.PI * 2;
    const herd: { x: number; y: number; rot: number }[] = [];
    for (let i = 0, t = 0; herd.length < n && t < n * 12; t++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.sqrt(rng.next()) * spread;
      const p = { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
      if (!grazing(h, p) || herd.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 4.5)) continue;
      // mostly facing the same way, as a flock does
      herd.push({ ...p, rot: heading + (rng.next() - 0.5) * 1.6 });
      i++;
    }
    if (herd.length) out.push(herd);
  }
  return out;
}

// A flock: lambs among the ewes, a few heads down grazing, the odd black sheep
export function flock(h: Hole, floor: number, count = 50) {
  const g = new THREE.Group();
  const rng = makeRng(`flock:${h.id}`);
  const herds = spots(h, rng, Math.ceil(count / 5), [3, 8], 14, 2);
  const all = herds.flat().slice(0, count);
  const n = all.length;
  if (!n) return g;
  const white = () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
  const woolGeo = new THREE.IcosahedronGeometry(1.4, 1);
  const wool = new THREE.InstancedMesh(woolGeo, white(), n);
  const face = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.9, 0.8), mat('#1f1d1b'), n);
  const legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 4), mat('#1f1d1b'), n * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  all.forEach((s, i) => {
    const lamb = rng.next() < 0.25;
    const k = lamb ? 0.62 : 0.9 + rng.next() * 0.2;
    const grazes = rng.next() < 0.4;
    const base = Math.max(floor, heightAt(h, s.x, s.y));
    q.setFromAxisAngle(up, s.rot);
    // in the sheep's own frame: x forward, y up
    const place = (lx: number, ly: number, lz: number) => v.set(lx * k, ly * k, lz * k).applyQuaternion(q).add(new THREE.Vector3(s.x, base, -s.y));
    m.compose(place(0, 1.9, 0), q, sc.set(1.4 * k, k, k));
    wool.setMatrixAt(i, m);
    wool.setColorAt(i, c.set(rng.next() < 0.06 ? '#2b2724' : lamb ? '#f6f3ea' : ['#efece2', '#e6e0cf', '#ece6d6'][Math.floor(rng.next() * 3)]));
    m.compose(grazes ? place(2, 1.1, 0) : place(1.9, 2.1, 0), q, sc.set(k, k, k));
    face.setMatrixAt(i, m);
    let j = 0;
    for (const x of [-1, 1]) for (const z of [-0.5, 0.5]) legs.setMatrixAt(i * 4 + j++, m.compose(place(x, 0.6, z), q, sc.set(k, k, k)));
  });
  for (const o of [wool, face, legs]) {
    o.castShadow = true;
    o.receiveShadow = true;
    o.instanceMatrix.needsUpdate = true;
    g.add(o);
  }
  if (wool.instanceColor) wool.instanceColor.needsUpdate = true;
  return g;
}

// shaggy: an icosahedron with its points pushed about, so the coat looks long and rough
function shag(r: number, seed: string, amount = 0.22) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const rng = makeRng(seed);
  const pos = geo.getAttribute('position');
  const seen = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    // the same corner moves the same way on every face it's on, so the coat doesn't tear
    if (!seen.has(key)) seen.set(key, 1 + (rng.next() - 0.5) * 2 * amount);
    const f = seen.get(key)!;
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
  }
  geo.computeVertexNormals();
  return geo;
}

// A Highland cow: a long ginger coat, a fringe over the eyes, and wide horns sweeping up
export function highlandCow(seed = 0) {
  const g = new THREE.Group();
  g.name = 'cow';
  const rng = makeRng(`cow:${seed}`);
  const coats = ['#b5652b', '#a3561f', '#c47a3a', '#8a4a22', '#d1a35f'];
  const coat = mat(coats[Math.floor(rng.next() * coats.length)]);
  const dark = mat('#3a2418');
  // the body, long and deep
  const body = mesh(shag(2.4, `cowbody:${seed}`), coat);
  body.scale.set(1.7, 1.05, 1);
  body.position.y = 3.6;
  g.add(body);
  // the coat hanging down the flanks
  const skirt = mesh(shag(2.2, `cowskirt:${seed}`, 0.3), coat);
  skirt.scale.set(1.6, 0.7, 1.05);
  skirt.position.y = 2.7;
  g.add(skirt);
  // the head, low and forward
  const grazing = rng.next() < 0.4;
  const head = new THREE.Group();
  head.position.set(4.1, grazing ? 2 : 3.9, 0);
  head.rotation.z = grazing ? -0.5 : -0.15;
  head.add(mesh(new THREE.BoxGeometry(1.9, 1.5, 1.5), coat));
  // the fringe, over the eyes
  const fringe = mesh(shag(1.05, `cowfringe:${seed}`, 0.35), coat);
  fringe.scale.set(0.8, 0.9, 1.15);
  fringe.position.set(0.3, 0.55, 0);
  head.add(fringe);
  // the muzzle
  head.add(mesh(new THREE.BoxGeometry(0.8, 0.9, 1.1), mat('#3d2a22')).translateX(1.1).translateY(-0.35));
  // the horns: straight out to the side, then up, pale with dark tips
  const horn = mat('#e8dcc0');
  for (const side of [-1, 1]) {
    const out = mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.8, 5), horn);
    out.rotation.x = Math.PI / 2;
    out.position.set(0, 0.75, side * 1.45);
    head.add(out);
    const rise = mesh(new THREE.CylinderGeometry(0.12, 0.17, 1.3, 5), horn);
    rise.rotation.x = side * -0.35;
    rise.position.set(0.1, 1.3, side * 2.45);
    head.add(rise);
    const tip = mesh(new THREE.ConeGeometry(0.12, 0.45, 5), dark);
    tip.rotation.x = side * -0.35;
    tip.position.set(0.1, 2.05, side * 2.72);
    head.add(tip);
  }
  g.add(head);
  // sturdy legs, shaggy at the top
  for (const x of [-2.4, 2.2]) for (const z of [-0.9, 0.9]) g.add(mesh(new THREE.CylinderGeometry(0.42, 0.34, 2.4, 6), dark).translateX(x).translateY(1.2).translateZ(z));
  // a tail with a tuft
  const tail = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 4), coat);
  tail.position.set(-4, 3, 0);
  tail.rotation.z = -0.3;
  g.add(tail);
  g.add(mesh(shag(0.4, `cowtail:${seed}`, 0.3), coat).translateX(-4.3).translateY(1.9));
  return g;
}

// A herd or two of Highland cattle on a hole
export function herd(h: Hole, floor: number, count = 4) {
  const g = new THREE.Group();
  const rng = makeRng(`herd:${h.id}`);
  const all = spots(h, rng, 2, [2, 3], 12, 1).flat().slice(0, count);
  all.forEach((s, i) => {
    const cow = highlandCow(i + Math.round(s.x));
    cow.position.set(s.x, Math.max(floor, heightAt(h, s.x, s.y)), -s.y);
    cow.rotation.y = s.rot;
    g.add(cow);
  });
  return g;
}
