// The Western Reserve: northeast Ohio in October. Maples in red, orange and gold over tawny rough, split-rail fences,
// a red barn and silo, a covered bridge over the creek, hay bales and pumpkins, and corn stubble beyond the course.
// The sky and light are in engine.ts; scene.ts calls in here for the props, the barn and bridge roofs, and for what
// lies beyond the course.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { mat, mesh, pine } from './props';
import { heightAt } from './terrain';
import type { Decor, Hole, Surface, V2 } from './types';

export const AUTUMN_SURFACE: Partial<Record<Surface, string>> = {
  green: '#68a64e',
  fairway: '#78a24a',
  fringe: '#6a9242',
  rough: '#6f7d3a', // late-season grass, going over
  path: '#a3845c', // a dirt farm track
  wood: '#7c5236',
  sand: '#e0cc9b',
};
export const AUTUMN_FLOOR = '#64703a';

const LEAVES = ['#c43c1c', '#d9581f', '#e8862a', '#e9b13a', '#b9301c', '#d39a34'];
export const BARN_RED = '#9a2e23';
const TRIM = '#efe7d6';
const ROOF = '#4b4542';
const STRAW = '#d8b864';

// a sugar maple: a short trunk and a broad round crown in one autumn colour, with its leaves fallen round the foot
export function maple(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`maple:${seed}`);
  const leaf = LEAVES[Math.floor(rng.next() * LEAVES.length)];
  const leaf2 = LEAVES[Math.floor(rng.next() * LEAVES.length)];
  g.add(mesh(new THREE.CylinderGeometry(0.45 * scale, 0.7 * scale, 7 * scale, 6), mat('#4a3426')).translateY(3.5 * scale));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng.next();
    const r = (3.2 + rng.next() * 1.4) * scale;
    const blob = mesh(new THREE.IcosahedronGeometry(r, 1), mat(i % 2 ? leaf : leaf2));
    blob.position.set(Math.cos(a) * 2.2 * scale * (i ? 1 : 0), (9.5 + rng.next() * 2.5) * scale, Math.sin(a) * 2.2 * scale * (i ? 1 : 0));
    g.add(blob);
  }
  const fallen = new THREE.Mesh(new THREE.CircleGeometry(5.5 * scale, 14), new THREE.MeshStandardMaterial({ color: leaf, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }));
  fallen.rotation.x = -Math.PI / 2;
  fallen.position.y = 0.25;
  fallen.receiveShadow = true;
  g.add(fallen);
  g.rotation.y = rng.next() * Math.PI * 2;
  return g;
}

// A barn or a covered bridge: a pitched roof over the walls (which the hole draws as 'barn' walls), its ridge along
// the long side of the outline, with a gable and a header over the opening at each end. The ball can roll through.
export function gableRoof(h: Hole, poly: V2[], eave: number, ridge: number): THREE.Object3D {
  const xs = poly.map((q) => q.x);
  const ys = poly.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const alongY = y1 - y0 >= x1 - x0;
  const len = alongY ? y1 - y0 : x1 - x0;
  const half = (alongY ? x1 - x0 : y1 - y0) / 2;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const base = heightAt(h, cx, cy);
  const g = new THREE.Group();
  const rise = ridge - eave;
  const slope = Math.hypot(half + 1, rise);
  const tilt = Math.atan2(rise, half + 1);
  for (const side of [-1, 1]) {
    const plane = mesh(new THREE.BoxGeometry(slope, 0.5, len + 3), mat(ROOF));
    plane.position.set((side * (half + 1)) / 2, eave + rise / 2, 0);
    plane.rotation.z = -side * tilt;
    g.add(plane);
  }
  // the gables, and a header over each opening down to door height
  const tri = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
  for (const end of [-1, 1]) {
    const gable = mesh(new THREE.ShapeGeometry(tri), mat(BARN_RED));
    (gable.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    gable.position.set(0, eave, (end * len) / 2);
    g.add(gable);
    const header = mesh(new THREE.BoxGeometry(half * 2, eave - 8, 0.6), mat(BARN_RED));
    header.position.set(0, (eave + 8) / 2, (end * len) / 2);
    g.add(header);
    const trim = mesh(new THREE.BoxGeometry(half * 2 + 0.4, 0.5, 0.8), mat(TRIM));
    trim.position.set(0, 8, (end * len) / 2);
    g.add(trim);
  }
  g.position.set(cx, base, -cy);
  if (!alongY) g.rotation.y = Math.PI / 2;
  return g;
}

function silo(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(5 * scale, 5 * scale, 34 * scale, 16), mat('#b9b3a6')).translateY(17 * scale));
  g.add(mesh(new THREE.SphereGeometry(5 * scale, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#7d8a8c', { rough: 0.5, metal: 0.4 })).translateY(34 * scale));
  for (const y of [8, 18, 28]) {
    const hoop = mesh(new THREE.TorusGeometry(5.05 * scale, 0.18 * scale, 4, 20), mat('#6e685d'));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y * scale;
    g.add(hoop);
  }
  return g;
}

function haybale(scale = 1) {
  const b = mesh(new THREE.CylinderGeometry(2.2 * scale, 2.2 * scale, 3.4 * scale, 14), mat(STRAW));
  b.rotation.z = Math.PI / 2;
  b.position.y = 2.2 * scale;
  const g = new THREE.Group();
  g.add(b);
  return g;
}

function pumpkins(seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`pumpkin:${seed}`);
  for (let i = 0; i < 3; i++) {
    const r = 0.8 + rng.next() * 0.7;
    const p = mesh(new THREE.SphereGeometry(r, 12, 8), mat(i === 2 ? '#d98a2b' : '#e07a22'));
    p.scale.y = 0.7;
    p.position.set((i - 1) * 2, r * 0.7, (rng.next() - 0.5) * 2);
    g.add(p);
    g.add(mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 5), mat('#4e5a2a')).translateX((i - 1) * 2).translateY(r * 1.4).translateZ(p.position.z));
  }
  return g;
}

// a patch of standing corn, cut short for harvest: rows of tan stalks
function corn(w: number, d: number, seed: number) {
  const rng = makeRng(`corn:${seed}`);
  const n = Math.max(1, Math.floor((w / 3) * (d / 3)));
  const stalks = new THREE.InstancedMesh(new THREE.ConeGeometry(0.35, 6, 4), mat('#c9a95c'), n);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = -w / 2; x < w / 2 && i < n; x += 3)
    for (let z = -d / 2; z < d / 2 && i < n; z += 3) {
      const s = 0.7 + rng.next() * 0.5;
      m.compose(new THREE.Vector3(x + rng.next(), 3 * s, z + rng.next() * 0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler((rng.next() - 0.5) * 0.25, 0, (rng.next() - 0.5) * 0.25)), new THREE.Vector3(s, s, s));
      stalks.setMatrixAt(i++, m);
    }
  stalks.count = i;
  stalks.castShadow = true;
  stalks.receiveShadow = true;
  return stalks;
}

function farmhouse() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(24, 16, 18), mat('#efe9dc')).translateY(8));
  const roof = mesh(new THREE.ConeGeometry(17, 9, 4), mat('#3f3a39'));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.8;
  roof.position.y = 20.5;
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(2, 6, 2), mat('#7a3a2c')).translateX(6).translateY(24));
  return g;
}

// the decor a hole can place: d.scale sizes it (for corn, the side of a square patch in ft)
export function autumnDecor(d: Decor): THREE.Object3D | null {
  if (d.kind === 'silo') return silo(d.scale ?? 1);
  if (d.kind === 'haybale') return haybale(d.scale ?? 1);
  if (d.kind === 'pumpkins') return pumpkins(Math.round(d.x + d.y));
  if (d.kind === 'farmhouse') return farmhouse();
  if (d.kind === 'corn') return corn(d.scale ?? 40, d.scale ?? 40, Math.round(d.x * 3 + d.y));
  return null;
}

// Beyond the course: a wood of maples (and the odd pine) all round, low rolling farm hills under the fog, and a farm
// or two on the skyline.
export function autumnFrame(h: Hole, root: THREE.Group, floor: number) {
  const rng = makeRng(`autumn:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  for (let i = 0; i < 90; i++) {
    const side = Math.floor(rng.next() * 4);
    const t = rng.next();
    const off = 10 + rng.next() * 70;
    const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 + (x1 - x0 + 140) * t - 70;
    const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 + (y1 - y0 + 140) * t - 70;
    const tree = rng.next() < 0.82 ? maple(1 + rng.next() * 0.5, i * 7 + 1) : pine(1 + rng.next() * 0.4);
    tree.position.set(x, floor, -y);
    root.add(tree);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + rng.next() * 0.3;
    const r = 900 + rng.next() * 400;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(240 + rng.next() * 200, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 3 ? '#6f7a3e' : '#8a6a3a'));
    hill.scale.y = 0.18 + rng.next() * 0.12;
    hill.position.set(cx + Math.cos(a) * r, floor - 6, -(cy + Math.sin(a) * r));
    root.add(hill);
  }
  for (const [a, r] of [[0.6, 520], [2.6, 620]]) {
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const house = farmhouse();
    house.position.set(x, floor, -y);
    house.rotation.y = a;
    root.add(house);
    const s = silo(1.2);
    s.position.set(x + 34, floor, -y);
    root.add(s);
  }
}
