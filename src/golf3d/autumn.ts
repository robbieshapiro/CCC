// The Western Reserve: northeast Ohio in October. Maples in red, orange and gold over tawny rough, creeks and a river
// through wooded valleys, a red covered bridge and a little waterfall. (The barn, silo, hay bales and corn are from the
// course's first version; a hole can still place them.)
// The sky and light are in engine.ts; scene.ts calls in here for the props, the barn and bridge roofs, and for what
// lies beyond the course.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng } from '../seed';
import { mat, mesh, pine, textTexture } from './props';
import { heightAt } from './terrain';
import type { Decor, Hole, Surface, V2 } from './types';

export const AUTUMN_SURFACE: Partial<Record<Surface, string>> = {
  green: '#68a64e',
  fairway: '#78a24a',
  fringe: '#5e8f3e',
  rough: '#3f6630', // proper dark green rough, cut short enough to see the ball sit in it
  path: '#a3845c', // a dirt farm track
  wood: '#7c5236',
  sand: '#e0cc9b',
  rock: '#a48a63', // weathered Berea sandstone, mossy in the cracks
};
export const AUTUMN_FLOOR = '#3b5c2c';

// an Ohio October: mostly sugar-maple oranges and reds, some still turning, a few gold, the odd one hanging on to green
const LEAVES = ['#b8401f', '#cc5a22', '#d9792a', '#dca03a', '#a8321d', '#c98a32', '#8f8a34', '#6f8a3a'];
export const BARN_RED = '#9a2e23';
const TRIM = '#efe7d6';
const ROOF = '#4b4542';
const STRAW = '#d8b864';

// A sugar maple: a tall trunk forking into branches, under a crown of many small leaf clusters that are knobbly, not
// round, darker underneath and catching the light on top, so it reads as a tree in leaf and not a balloon. Its leaves
// lie fallen round the foot in a ragged patch. Drawn as one mesh with the colours painted on (one draw call a tree),
// from a handful of shapes kept and shared, so a course can stand hundreds of them.
const MAPLE_SHAPES = 16;
const mapleShapes = new Map<number, THREE.BufferGeometry>();
const MAPLE_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
// paint: one colour, shaded by height (shade(y) gives the factor) with a little noise per face
function paint(geo: THREE.BufferGeometry, color: string, shade?: (y: number) => number, rng?: { next(): number }, smooth = false) {
  if (smooth) geo.computeVertexNormals();
  const g = geo.toNonIndexed();
  geo.dispose();
  g.deleteAttribute('uv');
  const base = new THREE.Color(color);
  const c = new THREE.Color();
  const pos = g.attributes.position;
  const n = pos.count;
  const col = new Float32Array(n * 3);
  // smooth: shaded corner by corner, one tint for the whole cluster; otherwise face by face
  const tint = rng ? 0.9 + rng.next() * 0.2 : 1;
  for (let i = 0; i < n; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    for (let j = 0; j < 3; j++) {
      const k = (shade ? shade(smooth ? pos.getY(i + j) : y) : 1) * (smooth ? tint : rng ? 0.9 + rng.next() * 0.2 : 1);
      c.copy(base).multiplyScalar(k);
      col.set([c.r, c.g, c.b], (i + j) * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!smooth) g.computeVertexNormals();
  return g;
}
// a leaf cluster: a low ball with its surface pushed in and out, so the edge is broken
function cluster(r: number, rng: { next(): number }) {
  const ico = new THREE.IcosahedronGeometry(r, 1);
  ico.deleteAttribute('uv');
  ico.deleteAttribute('normal');
  const geo = mergeVertices(ico); // shared corners, so it can be smooth shaded and pushed about without cracks
  ico.dispose();
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(0.78 + rng.next() * 0.4);
    p.setXYZ(i, v.x, v.y * 0.82, v.z);
  }
  return geo;
}
function mapleShape(v: number) {
  let geo = mapleShapes.get(v);
  if (geo) return geo;
  const rng = makeRng(`maple:${v}`);
  const leaf = LEAVES[Math.floor(rng.next() * LEAVES.length)];
  const leaf2 = rng.next() < 0.6 ? leaf : LEAVES[Math.floor(rng.next() * LEAVES.length)];
  const tall = 0.9 + rng.next() * 0.25;
  const bark = '#43342a';
  const parts = [paint(new THREE.CylinderGeometry(0.32, 0.62, 8 * tall, 7).translate(0, 4 * tall, 0), bark, (y) => 0.8 + y * 0.02)];
  // the fork: three or four limbs reaching up and out into the crown
  const limbs = 3 + Math.floor(rng.next() * 2);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + rng.next() * 0.8;
    const len = 3.2 + rng.next() * 1.6;
    const limb = new THREE.CylinderGeometry(0.12, 0.26, len, 5).translate(0, len / 2, 0);
    limb.rotateZ(0.55 + rng.next() * 0.35).rotateY(a).translate(0, 6.2 * tall, 0);
    parts.push(paint(limb, bark));
  }
  // the crown: a dozen clusters through a wide, slightly flattened dome
  const top = 10.4 * tall;
  const shade = (y: number) => 0.62 + Math.min(1, Math.max(0, (y - (top - 4.5)) / 8)) * 0.5;
  const n = 11 + Math.floor(rng.next() * 4);
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const ring = Math.sqrt(rng.next());
    const x = Math.cos(a) * ring * 4.4;
    const z = Math.sin(a) * ring * 4.4;
    const y = top + (rng.next() - 0.45) * 4.4 * (1 - ring * 0.4);
    const r = 1.7 + rng.next() * 1.3;
    parts.push(paint(cluster(r, rng).translate(x, y, z), i % 3 ? leaf : leaf2, shade, rng, true));
  }
  // the fallen leaves: a ragged patch just off the ground, a shade darker than the tree
  const fallen = new THREE.Color(leaf).lerp(new THREE.Color('#3f6630'), 0.72).multiplyScalar(0.78).getStyle();
  const disc = new THREE.CircleGeometry(5.2, 16);
  const dp = disc.attributes.position;
  for (let i = 1; i < dp.count; i++) dp.setXYZ(i, dp.getX(i) * (0.7 + rng.next() * 0.5), dp.getY(i) * (0.7 + rng.next() * 0.5), 0);
  parts.push(paint(disc.rotateX(-Math.PI / 2).translate(0, 0.22, 0), fallen));
  geo = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  mapleShapes.set(v, geo);
  return geo;
}
export function maple(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(mapleShape(Math.abs(seed) % MAPLE_SHAPES), MAPLE_MAT);
  m.castShadow = true;
  m.receiveShadow = true;
  m.scale.setScalar(scale);
  m.rotation.y = (Math.abs(seed) % 360) * (Math.PI / 180);
  g.add(m);
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

// a little waterfall: a ledge of grey sandstone with white water spilling over it into a pool of foam. rot turns it
// to face the way the river runs.
function falls(scale = 1) {
  const g = new THREE.Group();
  const stone = mat('#7d776c');
  for (const [x, w, h] of [[-9, 7, 7], [0, 8, 5.5], [9, 7, 7.5]] as const) g.add(mesh(new THREE.BoxGeometry(w * scale, h * scale, 6 * scale), stone).translateX(x * scale).translateY((h / 2 - 2) * scale));
  const water = new THREE.Mesh(new THREE.PlaneGeometry(9 * scale, 6 * scale), new THREE.MeshStandardMaterial({ color: '#e8f2f4', roughness: 0.3, transparent: true, opacity: 0.8 }));
  water.position.set(0, 0.8 * scale, 3.2 * scale);
  water.rotation.x = -0.18;
  g.add(water);
  const foam = new THREE.Mesh(new THREE.CircleGeometry(6 * scale, 16), new THREE.MeshStandardMaterial({ color: '#f4f8f8', roughness: 0.6, transparent: true, opacity: 0.7, depthWrite: false }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, -1.6 * scale, 6 * scale);
  g.add(foam);
  return g;
}

// A red barn: board walls, a white-trimmed door, and a pitched grey roof. Faces +z.
function barn(scale = 1) {
  const g = new THREE.Group();
  const w = 26 * scale;
  const d = 18 * scale;
  const h = 12 * scale;
  g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(BARN_RED)).translateY(h / 2));
  // the roof: a prism along the barn's length
  const roof = new THREE.Shape([new THREE.Vector2(-d / 2 - 1, 0), new THREE.Vector2(d / 2 + 1, 0), new THREE.Vector2(0, 8 * scale)]);
  const prism = new THREE.ExtrudeGeometry(roof, { depth: w + 2, bevelEnabled: false });
  prism.translate(0, 0, -(w + 2) / 2);
  prism.rotateY(Math.PI / 2);
  g.add(mesh(prism, mat(ROOF)).translateY(h));
  const door = mesh(new THREE.BoxGeometry(8 * scale, 9 * scale, 0.4), mat('#7d241c'));
  door.position.set(0, 4.5 * scale, d / 2 + 0.2);
  g.add(door);
  for (const [x, y, ww, hh] of [[0, 9.2, 8.6, 0.5], [-4.2, 4.6, 0.5, 9.2], [4.2, 4.6, 0.5, 9.2], [0, 4.6, 11.4, 0.4]] as const) {
    const t = mesh(new THREE.BoxGeometry(ww * scale, hh * scale, 0.5), mat(TRIM));
    t.position.set(x * scale, y * scale, d / 2 + 0.3);
    if (ww === 11.4) t.rotation.z = Math.atan2(9.2, 8.6);
    g.add(t);
  }
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// The cider stand on the hillside: a wooden counter under a striped awning, jugs on top, and its sign. Faces +z.
function ciderStand() {
  const g = new THREE.Group();
  const wood = mat('#8a5a34');
  g.add(mesh(new THREE.BoxGeometry(8, 3.6, 3), wood).translateY(1.8));
  for (const x of [-3.8, 3.8]) for (const z of [-1.4, 1.4]) g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 7.2, 6), wood).translateX(x).translateY(3.6).translateZ(z));
  // the awning in red and cream stripes
  for (let i = 0; i < 8; i++) {
    const strip = mesh(new THREE.BoxGeometry(1, 0.2, 4.4), mat(i % 2 ? '#f1e6cf' : '#b7372a'));
    strip.position.set(-3.5 + i, 7.3, 0.3);
    strip.rotation.x = 0.18;
    g.add(strip);
  }
  for (let i = 0; i < 4; i++) {
    const jug = mesh(new THREE.CylinderGeometry(0.32, 0.4, 0.9, 10), mat(i % 2 ? '#a45a1e' : '#c8822e', { rough: 0.3 }));
    jug.position.set(-2.4 + i * 1.6, 4.05, 0.4);
    g.add(jug);
  }
  const tex = textTexture([{ text: 'Hot Cider', font: '600 54px Georgia, serif', color: '#f3e3c2', y: 80 }], 320, 128, '#5a2a18');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5, 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  sign.position.set(0, 2.4, 1.52);
  g.add(sign);
  g.traverse((o) => (o.castShadow = true));
  return g;
}

// The last hole's gallery on the Western Reserve: rows of square straw bales up the hillside for the members to stand
// on (in place of the Caldera's stone tiers), with a swag of festoon lights strung between two poles over the top row.
// x, y: the front middle of the bank; across, back: the bank's own axes in course space; ground: the height under a
// point. One instanced mesh of bales, one of bulbs.
export function strawTerraces(rows: number, cols: number, gap: number, depth: number, rise: number, place: (across: number, back: number) => THREE.Vector3, rot: number, anim: ((c: number, dt: number) => void)[]) {
  const g = new THREE.Group();
  const bales = new THREE.InstancedMesh(new THREE.BoxGeometry(gap - 0.25, rise, depth - 0.7), mat(STRAW), rows * cols);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0));
  const one = new THREE.Vector3(1, 1, 1);
  let i = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const p = place((c - (cols - 1) / 2) * gap, (r + 0.5) * depth);
      p.y += rise / 2;
      bales.setMatrixAt(i++, m.compose(p, q, one));
    }
  bales.castShadow = true;
  bales.receiveShadow = true;
  g.add(bales);
  // the lights: a pole at each back corner and a sagging line of warm bulbs between them
  const half = ((cols - 1) / 2) * gap + gap * 0.6;
  const backAt = rows * depth + 0.4;
  const ends = [place(-half, backAt), place(half, backAt)];
  for (const e of ends) g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 9, 6), mat('#4a3426')).translateX(e.x).translateY(e.y + 4.5).translateZ(e.z));
  const glow = new THREE.MeshStandardMaterial({ color: '#ffe7b0', emissive: '#f4b860', emissiveIntensity: 1 });
  const n = 18;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 6, 4), glow, n);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const p = ends[0].clone().lerp(ends[1], t);
    p.y = ends[0].y + (ends[1].y - ends[0].y) * t + 8.4 - Math.sin(t * Math.PI) * 1.8;
    bulbs.setMatrixAt(k, m.compose(p, new THREE.Quaternion(), one));
  }
  g.add(bulbs);
  anim.push((clock) => {
    glow.emissiveIntensity = 0.9 + Math.sin(clock * 0.8) * 0.12;
  });
  return g;
}

// the decor a hole can place: d.scale sizes it (for corn, the side of a square patch in ft)
export function autumnDecor(d: Decor): THREE.Object3D | null {
  if (d.kind === 'barn') return barn(d.scale ?? 1);
  if (d.kind === 'cider') return ciderStand();
  if (d.kind === 'falls') return falls(d.scale ?? 1);
  if (d.kind === 'silo') return silo(d.scale ?? 1);
  if (d.kind === 'haybale') return haybale(d.scale ?? 1);
  if (d.kind === 'pumpkins') return pumpkins(Math.round(d.x + d.y));
  if (d.kind === 'farmhouse') return farmhouse();
  if (d.kind === 'corn') return corn(d.scale ?? 40, d.scale ?? 40, Math.round(d.x * 3 + d.y));
  return null;
}

// Beyond the course: a deep wood of maples (and the odd pine) all round, and low wooded hills under the fog.
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
    const hill = new THREE.Mesh(new THREE.SphereGeometry(240 + rng.next() * 200, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(i % 3 ? '#4d6634' : '#7a5f36'));
    hill.scale.y = 0.18 + rng.next() * 0.12;
    hill.position.set(cx + Math.cos(a) * r, floor - 6, -(cy + Math.sin(a) * r));
    root.add(hill);
  }
}

