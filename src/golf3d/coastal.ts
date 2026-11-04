// The Pacific Bluffs: the California coast at golden hour. Sandstone cliffs over a blue-green Pacific, Monterey
// cypress bent by the wind, ice plant in pink flower along the cliff tops, white surf on the rocks below, sea stacks
// offshore and a lighthouse on the last point. The sky and light are in engine.ts; scene.ts calls in here for the
// props, the surf, and for what lies beyond the course.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { mat, mesh } from './props';
import { heightAt, inPoly, levelOf } from './terrain';
import type { Decor, Hole, Surface, Water } from './types';

export const COASTAL_SURFACE: Partial<Record<Surface, string>> = {
  green: '#58a556',
  fairway: '#74b752', // kikuyu, lush from the sea fog
  fringe: '#62a048',
  rough: '#9db05c', // coastal grass going gold at the tips
  path: '#cdb58f', // decomposed granite
  sand: '#efe2bf', // pale beach sand
  rock: '#a98a66', // sandstone
  wood: '#8a6b4d',
};
// steep cliff faces: warm sandstone, not grey scree
export const SANDSTONE = new THREE.Color('#b39270');
// the sea itself: deep blue-green out past the rocks
export const PACIFIC = '#1d6b86';
export const PACIFIC_BED = new THREE.Color('#2f7f88');

const CYPRESS_DARK = '#2c4a2b';
const CYPRESS_LIGHT = '#3b5d36';

// A Monterey cypress: a short, twisted trunk leaning away from the sea, splitting into limbs that carry flat,
// wind-pruned pads of foliage, the whole crown swept to one side.
export function montereyCypress(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`cypress:${seed}`);
  const bark = mat('#5a4636');
  const lean = 0.25 + rng.next() * 0.25;
  // the trunk: three segments, each leaning a little more
  let at = new THREE.Vector3(0, 0, 0);
  let tilt = 0;
  for (let i = 0; i < 3; i++) {
    const len = (3.2 - i * 0.6) * scale;
    tilt += lean * (0.6 + i * 0.3);
    const seg = mesh(new THREE.CylinderGeometry((0.55 - i * 0.12) * scale, (0.75 - i * 0.12) * scale, len, 7), bark);
    const dir = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0);
    seg.position.copy(at.clone().add(dir.clone().multiplyScalar(len / 2)));
    seg.rotation.z = -tilt;
    g.add(seg);
    at = at.clone().add(dir.multiplyScalar(len));
  }
  // limbs out from the top of the trunk, each ending in a flat pad
  const pads = 5 + Math.floor(rng.next() * 3);
  for (let i = 0; i < pads; i++) {
    const a = (i / pads) * Math.PI * 2 + rng.next() * 0.6;
    // the crown spreads mostly downwind (+x), flat and wide
    const reach = (2.5 + rng.next() * 4) * scale;
    const end = new THREE.Vector3(at.x + Math.cos(a) * reach * 0.7 + reach * 0.5, at.y + (rng.next() * 2.5 - 0.5) * scale, at.z + Math.sin(a) * reach);
    const limb = end.clone().sub(at);
    const l = mesh(new THREE.CylinderGeometry(0.16 * scale, 0.26 * scale, limb.length(), 5), bark);
    l.position.copy(at.clone().add(limb.clone().multiplyScalar(0.5)));
    l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), limb.clone().normalize());
    g.add(l);
    const r = (2.4 + rng.next() * 1.6) * scale;
    const pad = mesh(new THREE.SphereGeometry(r, 10, 6), mat(i % 2 ? CYPRESS_DARK : CYPRESS_LIGHT, { rough: 0.95 }));
    pad.scale.set(1.35, 0.42, 1.1);
    pad.position.copy(end).add(new THREE.Vector3(0, 0.6 * scale, 0));
    g.add(pad);
  }
  // one broad cap over the top
  const cap = mesh(new THREE.SphereGeometry(4.2 * scale, 12, 7), mat(CYPRESS_DARK, { rough: 0.95 }));
  cap.scale.set(1.6, 0.38, 1.25);
  cap.position.set(at.x + 2 * scale, at.y + 1.6 * scale, at.z);
  g.add(cap);
  g.rotation.y = rng.next() * 0.6 - 0.3;
  return g;
}

// Ice plant: a low mat of fleshy green, thick with magenta flowers, spilling over the cliff edge
function icePlant(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`iceplant:${seed}`);
  const base = new THREE.Mesh(new THREE.CircleGeometry(4 * scale, 18), new THREE.MeshStandardMaterial({ color: '#5f8a3a', roughness: 0.8 }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = 0.12;
  base.receiveShadow = true;
  g.add(base);
  const n = Math.round(46 * scale * scale);
  const bloom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#e0418f', roughness: 0.6 }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * 3.8 * scale;
    m.makeTranslation(Math.cos(a) * r, 0.3, Math.sin(a) * r);
    bloom.setMatrixAt(i, m);
  }
  g.add(bloom);
  return g;
}

// The lighthouse: a white tower with a red band, a black gallery and lantern, and a light that turns
export function lighthouse(anim?: ((clock: number, dt: number) => void)[]) {
  const g = new THREE.Group();
  const white = mat('#f4f1ea', { rough: 0.55 });
  g.add(mesh(new THREE.CylinderGeometry(7, 8, 3, 18), mat('#cfc6b6')).translateY(1.5));
  g.add(mesh(new THREE.CylinderGeometry(3.6, 5.2, 40, 18), white).translateY(23));
  g.add(mesh(new THREE.CylinderGeometry(4.15, 4.45, 5, 18), mat('#b5322a', { rough: 0.5 })).translateY(27));
  g.add(mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.7, 18), mat('#22252a')).translateY(43.3));
  // the gallery rail
  const rail = mesh(new THREE.TorusGeometry(4.7, 0.12, 4, 24), mat('#22252a'));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 45;
  g.add(rail);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 3.6, 12), new THREE.MeshStandardMaterial({ color: '#fff6d2', emissive: '#ffd77a', emissiveIntensity: 1.2, roughness: 0.2 }));
  glass.position.y = 45.6;
  g.add(glass);
  g.add(mesh(new THREE.ConeGeometry(3.3, 3.4, 12), mat('#22252a')).translateY(49.1));
  g.add(mesh(new THREE.SphereGeometry(0.5, 8, 6), mat('#22252a')).translateY(51));
  // the keeper's cottage at the foot
  const cot = new THREE.Group();
  cot.add(mesh(new THREE.BoxGeometry(14, 8, 10), white).translateY(4));
  const roof = mesh(new THREE.ConeGeometry(10.5, 5, 4), mat('#b5322a'));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.75;
  roof.position.y = 10.5;
  cot.add(roof);
  cot.position.set(13, 0, 4);
  g.add(cot);
  // the beam: two soft cones of light sweeping round
  if (anim) {
    const beamMat = new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Group();
    for (const s of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(7, 80, 16, 1, true), beamMat);
      cone.rotation.z = (s * Math.PI) / 2;
      cone.position.x = s * 40;
      beam.add(cone);
    }
    beam.position.y = 45.6;
    g.add(beam);
    anim.push((clock) => (beam.rotation.y = clock * 0.6));
  }
  return g;
}

// a sailboat far out on the water, a white sail on a dark hull
function sailboat(seed = 0) {
  const g = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(3, 1.2, 12), mat('#1f2a36'), false);
  hull.position.y = 0.6;
  g.add(hull);
  const sail = new THREE.Mesh(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 1.2, -4), new THREE.Vector3(0, 16, -0.5), new THREE.Vector3(0, 1.2, 4)]),
    new THREE.MeshBasicMaterial({ color: '#f7f3e8', side: THREE.DoubleSide }),
  );
  g.add(sail);
  g.rotation.y = seed;
  return g;
}

// sea lions hauled out on a rock: sleek brown bodies, heads up, flippers out, one of them barking now and then
function seaLions(anim: ((clock: number, dt: number) => void)[], seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`sealions:${seed}`);
  const skin = [mat('#4a3a2c', { rough: 0.35 }), mat('#5b4634', { rough: 0.35 }), mat('#3b2f26', { rough: 0.35 })];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    const m = skin[i % 3];
    const body = mesh(new THREE.CapsuleGeometry(0.75, 2.6, 4, 10), m);
    body.rotation.z = Math.PI / 2 - 0.25;
    body.position.set(0, 0.8, 0);
    s.add(body);
    const head = new THREE.Group();
    head.add(mesh(new THREE.SphereGeometry(0.45, 10, 8), m));
    const snout = mesh(new THREE.SphereGeometry(0.24, 8, 6), m);
    snout.position.set(0.42, -0.06, 0);
    head.add(snout);
    head.position.set(1.95, 1.75, 0);
    s.add(head);
    for (const side of [-1, 1]) {
      const flip = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), m);
      flip.position.set(0.7, 0.25, side * 0.75);
      flip.rotation.y = side * 0.5;
      s.add(flip);
    }
    s.position.set((i - 1) * 2.6 + rng.next(), 0, (rng.next() - 0.5) * 3);
    s.rotation.y = rng.next() * Math.PI * 2;
    g.add(s);
    const phase = rng.next() * 9;
    anim.push((clock) => {
      const t = (clock + phase) % 9;
      head.rotation.z = t < 1.2 ? Math.sin(t * Math.PI * 4) * 0.25 + 0.3 : 0;
    });
  }
  return g;
}

// the decor a hole can place
export function coastalDecor(d: Decor, anim: ((clock: number, dt: number) => void)[]): THREE.Object3D | null {
  if (d.kind === 'lighthouse') return lighthouse(anim);
  if (d.kind === 'iceplant') return icePlant(d.scale ?? 1, Math.round(d.x * 5 + d.y));
  if (d.kind === 'sealions') return seaLions(anim, Math.round(d.x + d.y));
  return null;
}

// Surf: where the sea meets the rocks, a band of white water that swells and fades in sets, never quite in time.
export function surf(h: Hole, sea: Water, root: THREE.Group, anim: ((clock: number, dt: number) => void)[]) {
  const C = 3;
  const { x0, y0, x1, y1 } = h.bounds;
  const spots: { x: number; y: number; phase: number }[] = [];
  const rng = makeRng(`surf:${h.id}`);
  for (let x = x0; x < x1; x += C)
    for (let y = y0; y < y1; y += C) {
      const p = { x: x + rng.next() * C, y: y + rng.next() * C };
      if (!inPoly(p, h.border)) continue;
      const g = heightAt(h, p.x, p.y);
      // just above and below the waterline, where it breaks
      if (g < sea.level - 2.2 || g > sea.level + 1.4) continue;
      // only where the shore rises toward land: a neighbour a few feet off is well above the water
      const up = [[4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dy]) => heightAt(h, p.x + dx, p.y + dy) > sea.level + 1.5);
      if (!up) continue;
      spots.push({ ...p, phase: (p.x * 0.05 + p.y * 0.03) % (Math.PI * 2) });
    }
  if (!spots.length) return;
  const foam = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#f6fbfb', transparent: true, opacity: 0.78, depthWrite: false }),
    spots.length,
  );
  foam.renderOrder = 1;
  foam.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();
  root.add(foam);
  anim.push((clock) => {
    const level = levelOf(sea, clock);
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      // a set rolls in every eight seconds or so, along the shore
      const k = Math.max(0, Math.sin(clock * 0.8 + p.phase));
      const r = 1.4 + k * 2.6;
      s.set(r, 1, r);
      v.set(p.x, level + 0.12, -p.y);
      m.compose(v, q, s);
      foam.setMatrixAt(i, m);
    }
    foam.instanceMatrix.needsUpdate = true;
  });
}

// The coast beyond the hole: the ground at the edge of the hole carried on outward, so a cliff top runs on into the
// hills and the sea stays the sea. Past the edge the land rolls up into golden hills, gently at first.
function apronHeight(h: Hole, level: number, x: number, y: number) {
  const { x0, y0, x1, y1 } = h.bounds;
  const cx = Math.min(x1, Math.max(x0, x));
  const cy = Math.min(y1, Math.max(y0, y));
  const d = Math.hypot(x - cx, y - cy);
  const edge = heightAt(h, cx, cy);
  if (edge < level + 1) return level - 8;
  const roll = (Math.sin(x * 0.011 + y * 0.004) + Math.sin(y * 0.013 - x * 0.006 + 1.7)) * 0.5;
  return edge + Math.min(1, d / 520) ** 2 * (60 + roll * 40);
}

function apron(h: Hole, level: number) {
  const { x0, y0, x1, y1 } = h.bounds;
  const pad = 700;
  const W = x1 - x0 + pad * 2;
  const D = y1 - y0 + pad * 2;
  const n = 140;
  const geo = new THREE.PlaneGeometry(W, D, n, n).rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, -(y0 + y1) / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col: number[] = [];
  const grass = new THREE.Color('#a59c56');
  const gold = new THREE.Color('#c2a660');
  const scrub = new THREE.Color('#6f7a45');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = -pos.getZ(i);
    const inside = x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1;
    // under the hole itself it drops well out of sight
    const z = inside ? level - 30 : apronHeight(h, level, x, y);
    pos.setY(i, z);
    const t = Math.min(1, Math.max(0, (z - level) / 60));
    const c = z < level + 3 ? SANDSTONE.clone() : scrub.clone().lerp(grass, t).lerp(gold, Math.max(0, Math.sin(x * 0.02) * Math.sin(y * 0.017)) * 0.5);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // steep faces where the cliffs carry on: sandstone
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const ca = geo.attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (nrm.getY(i) < 0.75 && pos.getY(i) > level - 4) ca.setXYZ(i, SANDSTONE.r, SANDSTONE.g, SANDSTONE.b);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = true;
  return m;
}

// Beyond the course: the Pacific out to the horizon, sea stacks and a sail or two, and behind the course the coast
// running on into hills gone gold, dotted with dark cypress.
export function coastalFrame(h: Hole, root: THREE.Group, anim: ((clock: number, dt: number) => void)[], level: number, seaSide: number) {
  const rng = makeRng(`coastal:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const cy = (y0 + y1) / 2;
  root.add(apron(h, level));
  // cypress along the cliff tops just past the edge of the hole
  for (let i = 0, tries = 0; i < 60 && tries < 600; tries++) {
    const side = Math.floor(rng.next() * 4);
    const off = 14 + rng.next() * 200;
    const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 100 + (x1 - x0 + 200) * rng.next();
    const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 100 + (y1 - y0 + 200) * rng.next();
    if (x > x0 && x < x1 && y > y0 && y < y1) continue;
    const z = apronHeight(h, level, x, y);
    if (z < level + 4) continue;
    i++;
    const t = montereyCypress(1.1 + rng.next() * 0.7, i * 11 + 3);
    t.position.set(x, z - 0.5, -y);
    root.add(t);
  }
  // sea stacks: craggy sandstone, each with a ring of white water at its foot
  const stone = new THREE.MeshStandardMaterial({ color: '#a2856a', roughness: 1, flatShading: true });
  for (let i = 0, tries = 0; i < 9 && tries < 200; tries++) {
    const along = y0 - 300 + (y1 - y0 + 900) * rng.next();
    const out = (seaSide > 0 ? x1 : x0) + seaSide * (120 + rng.next() * 760);
    if (apronHeight(h, level, out, along) > level) continue;
    i++;
    const ht = 22 + rng.next() * 46;
    const st = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const r = ht * (0.34 - k * 0.07);
      const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), stone);
      lump.scale.set(1, (ht / 3 / r) * 1.25, 0.85 + rng.next() * 0.3);
      lump.position.set((rng.next() - 0.5) * r * 0.4, k * (ht / 3) + r * 0.3, (rng.next() - 0.5) * r * 0.4);
      lump.rotation.y = rng.next() * 3;
      lump.castShadow = true;
      st.add(lump);
    }
    // a scruff of green on the top, where the birds sit
    const top = new THREE.Mesh(new THREE.SphereGeometry(ht * 0.14, 8, 5), mat('#5d6f3a'));
    top.scale.y = 0.35;
    top.position.y = ht * 0.98;
    st.add(top);
    st.position.set(out, level - 3, -along);
    root.add(st);
    const ring = new THREE.Mesh(new THREE.RingGeometry(ht * 0.36, ht * 0.36 + 3, 18).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#f2f7f6', transparent: true, opacity: 0.5, depthWrite: false }));
    ring.position.set(out, level + 0.2, -along);
    root.add(ring);
    const phase = rng.next() * 6;
    anim.push((clock) => {
      const k = 0.5 + Math.sin(clock * 0.8 + phase) * 0.5;
      ring.scale.setScalar(1 + k * 0.35);
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.2 + k * 0.45;
    });
  }
  // a couple of sails out on the water, drifting
  for (let i = 0; i < 3; i++) {
    const b = sailboat(i * 1.7);
    const along = cy + (rng.next() - 0.5) * 1400;
    const out = (seaSide > 0 ? x1 : x0) + seaSide * (500 + rng.next() * 700);
    b.position.set(out, level, -along);
    root.add(b);
    anim.push((clock) => (b.position.z = -(along + Math.sin(clock * 0.02 + i) * 60)));
  }
}
