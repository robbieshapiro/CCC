// The golfer's anatomy: a sculpted head and face, a shaped torso and limbs, gripping hands and proper shoes. All
// built in code from deformed primitives (no model files), sized so the same golfer reads in the locker, the shop's
// fitting room, on the tee and in the stands. golfer.ts dresses and rigs it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- the head ----------

// The head is a unit sphere pushed into shape: taller than wide, a rounded jaw and chin, a fuller back, a flatter
// face with eye sockets and a brow. Head-local units: the skull's centre is at HEAD_Y, its radius HEAD_R.
export const HEAD_R = 0.42;
export const HEAD_Y = 0.5;

export function shapeOf(v: THREE.Vector3) {
  let { x, y, z } = v;
  x *= 0.88;
  y *= 1.02;
  z *= 0.97;
  // the jaw: the lower face narrows to the chin, and the back of the lower head tucks in to the neck
  if (y < 0) {
    const k = Math.min(1, -y / 1.02);
    x *= 1 - 0.22 * k * k;
    z *= z > 0 ? 1 - 0.1 * k : 1 - 0.42 * k;
  }
  // the chin, a little forward
  if (z > 0) z += 0.07 * smooth(0.55, 0.95, -y) * smooth(0.2, 0.8, z);
  // a fuller crown at the back
  if (z < 0 && y > -0.3) z *= 1.07;
  // a flatter face
  if (z > 0.62) z = 0.62 + (z - 0.62) * 0.7;
  // eye sockets, and the brow above them
  for (const s of [-1, 1]) {
    const d = Math.hypot(x - 0.3 * s, y - 0.08);
    if (z > 0.3 && d < 0.22) z -= 0.055 * (1 - d / 0.22) ** 2;
  }
  if (z > 0.4) z += 0.03 * smooth(0.16, 0.24, y) * (1 - smooth(0.3, 0.42, y)) * (1 - smooth(0.4, 0.6, Math.abs(x)));
  // cheekbones
  if (z > 0.3 && y < 0.02 && y > -0.32) x *= 1 + 0.04 * (1 - Math.abs(y + 0.15) / 0.17);
  return V(x, y, z);
}

function shaped(g: THREE.BufferGeometry, scale = 1, keep?: (p: THREE.Vector3) => number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const out = shapeOf(v);
    // keep: how much of a layer (hair, a beard) stays out at its full size here, from 0 (tucked inside the skull) to 1
    const k = keep ? keep(out) : 1;
    out.multiplyScalar(HEAD_R * (1 + (scale - 1) * k - (keep ? (1 - k) * 0.06 : 0)));
    p.setXYZ(i, out.x, out.y + HEAD_Y, out.z);
  }
  g.computeVertexNormals();
  return g;
}

// Shapes every golfer shares (the head, a hairstyle, a hand) are built once and reused: shared marks them so nobody
// disposes of them while other golfers still use them.
const cache = new Map<string, THREE.BufferGeometry>();
export function shared(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    cache.set(key, g);
  }
  return g;
}
export const disposeGeo = (g: THREE.BufferGeometry) => void (g.userData.shared || g.dispose());

export const headGeo = () => shared('head', () => shaped(new THREE.SphereGeometry(1, 28, 20)));

// A layer over the head (hair, a beard, a cap's crown): the head's own shape, a little bigger, shown only where keep
// says (smoothly, so the edge is soft rather than stepped).
export const headLayer = (key: string, scale: number, keep: (p: THREE.Vector3) => number, seg = 28) => shared(`layer|${key}`, () => shaped(new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75)), scale, keep));

// Where the face's surface is, front-on, at a point (x, y) in head units: for placing the eyes, nose and mouth on it.
let surfCache: THREE.Vector3[] | null = null;
export function faceZ(x: number, y: number) {
  if (!surfCache) {
    const g = shaped(new THREE.SphereGeometry(1, 40, 30));
    const p = g.attributes.position as THREE.BufferAttribute;
    surfCache = [];
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      if (v.z > 0) surfCache.push(v);
    }
    g.dispose();
  }
  let best = surfCache[0];
  let bd = Infinity;
  for (const v of surfCache) {
    const d = (v.x - x) ** 2 + (v.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best.z;
}

// ---------- shaped limbs ----------

// A limb from a to b with a profile of [share of the way, radius] pairs: a bicep's swell, a calf, a tapered wrist.
// flat squashes it front to back (a forearm is flatter than it is wide).
export function lathe(a: THREE.Vector3, b: THREE.Vector3, profile: [number, number][], seg = 14, flat = 1) {
  const len = a.distanceTo(b);
  const pts = profile.map(([t, r]) => new THREE.Vector2(Math.max(0.001, r), t * len));
  // close the ends so nothing shows through
  pts.unshift(new THREE.Vector2(0.001, profile[0][0] * len));
  pts.push(new THREE.Vector2(0.001, profile[profile.length - 1][0] * len));
  const g = new THREE.LatheGeometry(pts, seg);
  g.scale(1, 1, flat);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  return g;
}

// A ball joint: rounds off where two limb pieces meet
export const joint = (at: THREE.Vector3, r: number, flat = 1) => {
  const g = new THREE.SphereGeometry(r, 12, 8);
  g.scale(1, 1, flat);
  g.translate(at.x, at.y, at.z);
  return g;
};

// ---------- hands ----------

// A hand gripping a shaft that runs along y through the origin: fingers wrapped round the grip, the back of the
// hand facing out (+x for the lead hand, the way it faces the target), the thumb down the front of the shaft.
// side: -1 lead hand, 1 trail hand. Returns geometry in the shaft's frame.
export const gripHand = (side: number) => shared(`grip|${side}`, () => makeGripHand(side));
function makeGripHand(side: number) {
  const parts: THREE.BufferGeometry[] = [];
  const out = -side; // the back of the lead hand faces the target
  // the fingers: four rings round the grip, a little open at the thumb side
  for (let i = 0; i < 4; i++) {
    const r = 0.075 - Math.abs(i - 1.5) * 0.004;
    const f = new THREE.TorusGeometry(r, 0.031 - i * 0.002, 6, 10, Math.PI * 1.45);
    f.rotateX(Math.PI / 2);
    // open toward the front (+z) where the thumb lies
    f.rotateY(Math.PI * 0.3 + (out > 0 ? 0 : Math.PI * 0.4));
    f.translate(0, -0.05 - i * 0.058, 0);
    parts.push(f);
  }
  // the back of the hand and the heel of the palm
  const back = new THREE.SphereGeometry(1, 10, 8);
  back.scale(0.06, 0.14, 0.1);
  back.translate(0.065 * out, -0.1, -0.01);
  parts.push(back);
  const heel = new THREE.SphereGeometry(1, 8, 6);
  heel.scale(0.07, 0.07, 0.08);
  heel.translate(0.02 * out, 0.02, -0.03);
  parts.push(heel);
  // the thumb, down the front of the shaft
  const thumb = new THREE.CapsuleGeometry(0.03, 0.11, 3, 6);
  thumb.rotateZ(0.12 * out);
  thumb.translate(0.012 * out, -0.1, 0.075);
  parts.push(thumb);
  // knuckles across the back of the fingers
  for (let i = 0; i < 4; i++) {
    const k = new THREE.SphereGeometry(0.028, 6, 4);
    k.translate(0.07 * out, -0.035 - i * 0.055, 0.035);
    parts.push(k);
  }
  return merge(parts);
}

// An open hand, hanging relaxed at the side or raised in a wave: palm in, fingers together and slightly curled.
export function openHand(side: number) {
  const parts: THREE.BufferGeometry[] = [];
  const palm = new THREE.SphereGeometry(1, 14, 10);
  palm.scale(0.055, 0.13, 0.1);
  palm.translate(0, -0.1, 0);
  parts.push(palm);
  for (let i = 0; i < 4; i++) {
    const len = [0.1, 0.12, 0.115, 0.09][i];
    const f = new THREE.CapsuleGeometry(0.024, len, 4, 8);
    f.rotateX(-0.25);
    f.translate(0, -0.25 - len / 2 + 0.03, 0.065 - i * 0.043);
    parts.push(f);
  }
  const thumb = new THREE.CapsuleGeometry(0.027, 0.09, 4, 8);
  thumb.rotateX(0.6);
  thumb.rotateZ(0.3 * -side);
  thumb.translate(0.03 * -side, -0.13, 0.1);
  parts.push(thumb);
  return merge(parts);
}

// ---------- shoes ----------

// A golf shoe: a rounded toe box, a heel, a lighter sole, and a tongue. Origin at the ankle; the toe points +z.
export function shoe(upper: THREE.Material, sole: THREE.Material, trim?: THREE.Material) {
  const g = new THREE.Group();
  const body = shared('shoe', () => shoeGeo());
  const top = new THREE.Mesh(body, upper);
  top.position.y = -0.04;
  g.add(top);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 18), sole);
  base.scale.set(0.16, 0.045, 0.37);
  base.position.set(0, -0.1, 0.12);
  g.add(base);
  if (trim) {
    // a saddle: the darker panel over the instep
    const sad = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.42);
    sad.scale(0.165, 0.12, 0.2);
    const m = new THREE.Mesh(sad, trim);
    m.position.set(0, -0.02, 0.08);
    g.add(m);
  }
  return g;
}

function shoeGeo() {
  const body = new THREE.SphereGeometry(1, 16, 10);
  const p = body.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    // long and low, fuller at the toe, flat underneath
    x *= 0.155 * (z > 0 ? 1 - z * 0.12 : 1);
    z = z * 0.36 + 0.12;
    y = Math.max(y, -0.45) * 0.13;
    // the ankle opening rises at the back
    if (z < 0.05) y += 0.05 * (1 - Math.abs(x) / 0.16) * smooth(0, 0.3, y + 0.06);
    p.setXYZ(i, x, y, z);
  }
  body.computeVertexNormals();
  return body;
}

// ---------- merging ----------

// Bake each direct child mesh's transform into its geometry and merge the ones that share a material, so a golfer is
// a handful of draw calls rather than a hundred. Only static pieces (meshes that are direct children of `parent`) are
// merged; groups (the rig) are left alone and merged in turn.
export function mergeStatic(parent: THREE.Object3D) {
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();
  for (const c of parent.children) {
    const mesh = c as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || c.name) continue;
    const list = byMat.get(mesh.material) ?? [];
    list.push(mesh);
    byMat.set(mesh.material, list);
  }
  for (const [mat, list] of byMat) {
    if (list.length < 2) continue;
    const geos = list.map((m) => {
      m.updateMatrix();
      const g = (m.geometry.index ? m.geometry : m.geometry).clone();
      g.applyMatrix4(m.matrix);
      return g;
    });
    const merged = merge(geos);
    if (!merged) continue;
    for (const m of list) {
      parent.remove(m);
      disposeGeo(m.geometry);
    }
    const one = new THREE.Mesh(merged, mat);
    one.castShadow = true;
    parent.add(one);
  }
  for (const c of [...parent.children]) if (!(c as THREE.Mesh).isMesh) mergeStatic(c);
}

// mergeGeometries needs the same attributes on every piece: keep position, normal and uv, all indexed
function merge(geos: THREE.BufferGeometry[]) {
  const clean = geos.map((g) => {
    const x = g.index ? g : g.toNonIndexed();
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
    if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((x.attributes.position.count) * 2), 2));
    if (!x.attributes.normal) x.computeVertexNormals();
    return x.index ? x : indexed(x);
  });
  return mergeGeometries(clean, false) as THREE.BufferGeometry;
}

function indexed(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}
