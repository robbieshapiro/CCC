// The west of Ireland round the Atlantic Links (Nov 22, Robbie: "feel like Ireland"): whitewashed cottages under thatch
// with a thread of turf smoke, a pub, a castle on the high ground, a Celtic round tower, a ring of standing stones, a
// faint rainbow through the drizzle, and dry-stone walls cutting the land past the course into small fields.
// Scenery only: none of it is in play. Each piece is a few simple meshes; the walls are one instanced mesh.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim } from '../kits';
import { mat, mesh } from '../props';
import { heightAt, inPoly } from '../terrain';
import type { Hole } from '../types';

const WHITE = ['#f2efe6', '#ece6d6', '#f5f1e8'];
const DOORS = ['#b8322a', '#2a5a8a', '#2f6a3a', '#d8a23a'];
const STONE = ['#8d8a80', '#7a776e', '#9b978b'];

// a gable roof of thatch: a long triangular prism, rounded a touch at the eaves
function thatch(len: number, wide: number, high: number) {
  const s = new THREE.Shape();
  s.moveTo(-wide / 2 - 1.2, 0);
  s.lineTo(0, high);
  s.lineTo(wide / 2 + 1.2, 0);
  s.lineTo(-wide / 2 - 1.2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: len + 1.6, bevelEnabled: false });
  g.translate(0, 0, -(len + 1.6) / 2);
  g.rotateY(Math.PI / 2);
  return mesh(g, mat('#b49a5a'));
}

// turf smoke: a few soft grey puffs rising and drifting from a chimney top, round and round
function smoke(anim: Anim, seed: number) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: '#d9dcdc', transparent: true, opacity: 0.35, depthWrite: false });
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 4), m);
    g.add(p);
    puffs.push(p);
  }
  anim.push((clock) => {
    puffs.forEach((p, i) => {
      const t = (clock * 0.18 + i / puffs.length + seed * 0.13) % 1;
      p.position.set(t * 9, t * 16, Math.sin(t * 6 + i) * 1.2);
      p.scale.setScalar(0.8 + t * 2.6);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.35;
      p.visible = t < 0.95;
    });
  });
  return g;
}

// a whitewashed cottage: long and low, thatch, a coloured door, small windows, a chimney at each gable end
export function cottage(anim: Anim, seed = 0, long = 1) {
  const rng = makeRng(`cottage:${seed}`);
  const g = new THREE.Group();
  const len = 22 * long;
  g.add(mesh(new THREE.BoxGeometry(len, 9, 12), mat(WHITE[seed % 3])).translateY(4.5));
  g.add(thatch(len, 12, 8).translateY(9));
  g.add(mesh(new THREE.BoxGeometry(3, 6, 0.4), mat(DOORS[Math.floor(rng.next() * DOORS.length)]), false).translateY(3).translateZ(6.1).translateX(-len * 0.12));
  for (const x of [-len * 0.32, len * 0.12, len * 0.34]) g.add(mesh(new THREE.BoxGeometry(2.6, 2.6, 0.4), mat('#2a3236'), false).translateX(x).translateY(5).translateZ(6.1));
  for (const side of [-1, 1]) {
    const ch = mesh(new THREE.BoxGeometry(2.4, 5, 2.4), mat('#e6e0d0'));
    ch.position.set((side * len) / 2 - side * 1.6, 17, 0);
    g.add(ch);
  }
  const s = smoke(anim, seed);
  s.position.set(len / 2 - 1.6, 19.5, 0);
  g.add(s);
  return g;
}

// the pub: a longer cottage with a painted sign over the door
export function pub(anim: Anim, seed = 0) {
  const g = cottage(anim, seed, 1.5);
  g.add(mesh(new THREE.BoxGeometry(14, 2.2, 0.5), mat('#1f3d2e'), false).translateY(7.6).translateZ(6.3));
  g.add(mesh(new THREE.BoxGeometry(12, 1.2, 0.6), mat('#e6c35c', { emissive: '#6a5418' }), false).translateY(7.6).translateZ(6.4));
  return g;
}

// a castle: a square keep with battlements, corner turrets and a curtain wall round a bawn
export function castle(seed = 0) {
  const rng = makeRng(`castle:${seed}`);
  const g = new THREE.Group();
  const s = (i: number) => mat(STONE[i % 3]);
  g.add(mesh(new THREE.BoxGeometry(30, 56, 26), s(0)).translateY(28));
  for (let i = 0; i < 8; i++) {
    for (const z of [-13, 13]) g.add(mesh(new THREE.BoxGeometry(2.8, 3.5, 2.4), s(i)).translateX(-13 + i * 3.7).translateY(57.7).translateZ(z));
  }
  for (const [x, z] of [[-15, -13], [15, -13], [-15, 13], [15, 13]]) {
    g.add(mesh(new THREE.CylinderGeometry(3.6, 4, 62, 8), s(1)).translateX(x).translateY(31).translateZ(z));
    g.add(mesh(new THREE.ConeGeometry(4.4, 6, 8), mat('#5a5f62')).translateX(x).translateY(65).translateZ(z));
  }
  for (let y = 14; y < 52; y += 11) for (const x of [-7, 7]) g.add(mesh(new THREE.BoxGeometry(1.4, 4.4, 0.3), mat('#1e1d1b'), false).translateX(x).translateY(y).translateZ(13.1));
  // the bawn: a curtain wall out in front, with a gate
  for (let i = 0; i < 9; i++) {
    if (i === 4) continue;
    const h = 13 + rng.next() * 2;
    g.add(mesh(new THREE.BoxGeometry(8, h, 3.4), s(i + 1)).translateX(-32 + i * 8).translateY(h / 2).translateZ(30));
  }
  for (const x of [-36, 36]) g.add(mesh(new THREE.BoxGeometry(3.4, 14, 30), s(2)).translateX(x).translateY(7).translateZ(15));
  return g;
}

// a Celtic round tower: tall and thin, a conical stone cap, a door high off the ground
export function roundTower() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(5.2, 6.2, 82, 12), mat('#9a968a')).translateY(41));
  g.add(mesh(new THREE.ConeGeometry(5.6, 13, 12), mat('#7d796f')).translateY(88.5));
  g.add(mesh(new THREE.BoxGeometry(2, 5, 0.4), mat('#1e1d1b'), false).translateY(20).translateZ(5.9));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(1.2, 3, 0.4), mat('#1e1d1b'), false).translateY(76).translateX(Math.sin((i * Math.PI) / 2) * 5.3).translateZ(Math.cos((i * Math.PI) / 2) * 5.3).rotateY((i * Math.PI) / 2));
  return g;
}

// a ring of standing stones, weathered and leaning
export function stoneRing(r = 16, seed = 0) {
  const rng = makeRng(`stones:${seed}`);
  const g = new THREE.Group();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 5 + rng.next() * 4;
    const st = mesh(new THREE.BoxGeometry(2.2, h, 1.4), mat(STONE[i % 3]));
    st.position.set(Math.cos(a) * r, h / 2 - 0.4, Math.sin(a) * r);
    st.rotation.set((rng.next() - 0.5) * 0.18, -a, (rng.next() - 0.5) * 0.18);
    g.add(st);
  }
  return g;
}

// the stone arch under a bridge: a flat arch on each face, its crown just under the deck
export function bridgeArch(len: number, half: number) {
  const g = new THREE.Group();
  const R = len / 2 + 2;
  for (const z of [-half - 0.6, half + 0.6]) {
    const a = mesh(new THREE.TorusGeometry(R, 1.4, 5, 20, Math.PI), mat('#8a867b'));
    a.scale.y = 0.42;
    a.position.set(0, -R * 0.42 - 0.4, z);
    g.add(a);
    // the spandrel: the stone face over the arch, up to the deck
    g.add(mesh(new THREE.BoxGeometry(len + 6, 1.6, 1), mat('#7d796f')).translateY(-0.9).translateZ(z));
  }
  return g;
}

// The castle causeway (Nov 22): a long stone bridge over a sea gorge. Two tall faces of stone from the deck down into
// the sea, each with a run of arches (dark, the sea showing through in shadow), piers between them and a string
// course under the parapet. drop: how far the deck stands above the sea bed.
export function causeway(len: number, half: number, drop: number) {
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 16));
  const span = len / n;
  const face = drop + 1;
  for (const z of [-half - 0.6, half + 0.6]) {
    const out = Math.sign(z);
    g.add(mesh(new THREE.BoxGeometry(len + 4, face, 1.2), mat(STONE[1])).translateY(-face / 2 - 0.2).translateZ(z));
    // the string course, a lip of paler stone just under the parapet
    g.add(mesh(new THREE.BoxGeometry(len + 5, 0.7, 1.6), mat(STONE[2])).translateY(-0.4).translateZ(z));
    for (let i = 0; i < n; i++) {
      const cx = -len / 2 + span * (i + 0.5);
      const r = span * 0.36;
      // the arch: a dark opening, round topped, down to the water
      const top = -2.2 - r;
      const opening = new THREE.Group();
      opening.add(mesh(new THREE.CircleGeometry(r, 16, 0, Math.PI), mat('#1d2526'), false).translateY(top));
      opening.add(mesh(new THREE.PlaneGeometry(r * 2, face), mat('#1d2526'), false).translateY(top - face / 2));
      opening.position.set(cx, 0, z + out * 0.62);
      if (out < 0) opening.rotation.y = Math.PI;
      g.add(opening);
      // the voussoirs: a ring of paler stone round the arch
      const ring = mesh(new THREE.RingGeometry(r, r + 1.1, 16, 1, 0, Math.PI), mat(STONE[2]), false);
      ring.position.set(cx, top, z + out * 0.64);
      if (out < 0) ring.rotation.y = Math.PI;
      g.add(ring);
    }
    // the piers between the arches
    for (let i = 0; i <= n; i++) {
      const px = -len / 2 + span * i;
      g.add(mesh(new THREE.BoxGeometry(2.6, face, 2.2), mat(STONE[0])).translateX(px).translateY(-face / 2 - 0.2).translateZ(z + out * 1));
    }
  }
  return g;
}

// a faint rainbow standing in the drizzle: seven thin bands of colour, see-through, an arc over the far country
export function rainbow(radius = 900) {
  const g = new THREE.Group();
  const cols = ['#e0524a', '#ef9a3a', '#f2d24a', '#6ab85a', '#4a8ad8', '#5a5ab8', '#8a5ab8'];
  cols.forEach((c, i) => {
    const r = radius - i * 9;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(r, 4.5, 4, 64, Math.PI),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false, fog: false }),
    );
    g.add(band);
  });
  return g;
}

// dry-stone walls out past the course: the land cut into small fields, as one instanced mesh of stones following the
// ground. Kept off the course itself, off the sea and off the beach.
export function fieldWalls(h: Hole, floor: number, seed = 0) {
  const rng = makeRng(`fields:${h.id}:${seed}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const pts: { x: number; y: number; rot: number }[] = [];
  const wet = (x: number, y: number) => h.water.some((w) => w.look === 'sea' && inPoly({ x, y }, w.poly));
  const inside = (x: number, y: number) => x > x0 - 30 && x < x1 + 30 && y > y0 - 30 && y < y1 + 30;
  const lay = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const rot = Math.atan2(by - ay, bx - ax);
    for (let d = 0; d < len; d += 4) {
      const x = ax + ((bx - ax) * d) / len;
      const y = ay + ((by - ay) * d) / len;
      if (inside(x, y) || wet(x, y)) continue;
      pts.push({ x, y, rot });
    }
  };
  // a ragged grid of fields, 90 to 160 ft across, a little skewed
  const pad = 420;
  const skew = (rng.next() - 0.5) * 0.4;
  for (let x = x0 - pad; x < x1 + pad; x += 90 + rng.next() * 70) lay(x, y0 - pad, x + skew * (y1 - y0 + pad * 2), y1 + pad);
  for (let y = y0 - pad; y < y1 + pad; y += 90 + rng.next() * 70) lay(x0 - pad, y, x1 + pad, y - skew * (x1 - x0 + pad * 2) * 0.5);
  const geo = new THREE.BoxGeometry(4.2, 2.8, 2);
  const inst = new THREE.InstancedMesh(geo, mat('#8a867b'), pts.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  pts.forEach((p, i) => {
    q.setFromAxisAngle(up, -p.rot);
    const ground = Math.max(floor, heightAt(h, p.x, p.y));
    m.compose(new THREE.Vector3(p.x, ground + 1.1, -p.y), q, new THREE.Vector3(1, 0.85 + ((i * 7) % 5) * 0.08, 1));
    inst.setMatrixAt(i, m);
  });
  inst.receiveShadow = true;
  return inst;
}
