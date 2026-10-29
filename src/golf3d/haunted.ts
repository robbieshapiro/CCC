// Hollow Hills: the dressing for the haunted mini golf. Headstones, iron railings and crypt walls, dead trees, a
// cauldron, ghosts, a scythe on a gallows, a giant jack-o'-lantern, jack-o'-lantern lamps, slime, mist and a manor
// on the hill. Everything is built from primitives, like the rest of the props; scene.ts calls in here for the
// haunted looks.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { mat, mesh } from './props';
import { heightAt, inPoly } from './terrain';
import type { Decor, Hole, Mover, Post, Push, Surface, V2, Wall, Water } from './types';

const w3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);
type Anim = (clock: number, dt: number) => void;

export const HAUNTED_SURFACE: Partial<Record<Surface, string>> = {
  green: '#3f7a4c', // the felt
  fairway: '#3a6f46',
  fringe: '#2f5a3a',
  rough: '#24301f',
  path: '#57525e', // cobbles
  stone: '#6d6875',
  wood: '#5a3d2a',
  sand: '#6e6150',
};
export const HAUNTED_FLOOR = '#16121c';

const C = {
  stone: '#7d7887',
  stoneDark: '#4a4652',
  moss: '#3e5537',
  iron: '#16141a',
  bark: '#2b2026',
  pumpkin: '#e0701f',
  pumpkinDark: '#a8480f',
  stem: '#4a5a26',
  glow: '#ffb347',
  slime: '#6fdc3a',
  brew: '#7cff4a',
  sheet: '#eef0ff',
};

// a soft round dab, for mist, glows and the cauldron's steam
let dab: THREE.Texture | null = null;
function softDab() {
  if (dab) return dab;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  dab = new THREE.CanvasTexture(c);
  return dab;
}

// A carved face (eyes, nose, a jagged grin), glowing, for the pumpkins: drawn once, used as an emissive map.
let face: THREE.Texture | null = null;
function faceTexture() {
  if (face) return face;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffc04a';
  const tri = (pts: number[]) => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  // the face sits on the front quarter of the wrap: u 0.375..0.625
  tri([100, 40, 116, 18, 124, 44]);
  tri([132, 44, 140, 18, 156, 40]);
  tri([122, 56, 128, 46, 134, 56]);
  tri([98, 68, 106, 76, 112, 70, 118, 80, 124, 72, 132, 80, 138, 72, 144, 80, 150, 70, 158, 68, 150, 92, 106, 92]);
  face = new THREE.CanvasTexture(c);
  return face;
}

// ---------- posts ----------

export function hauntedPost(h: Hole, p: Post, anim: Anim[]): THREE.Object3D | null {
  const look = p.look;
  const at = (o: THREE.Object3D, lift = 0) => {
    o.position.copy(w3(p.x, p.y, heightAt(h, p.x, p.y) + lift));
    return o;
  };
  if (look === 'tomb') return at(headstone(p.r, p.h, Math.round(p.x * 13 + p.y * 7)), -0.1);
  if (look === 'deadtree') return at(deadTree(p.h / 14, Math.round(p.x * 3 + p.y)));
  if (look === 'cauldron') return at(cauldron(p.r, anim));
  return null;
}

// A headstone facing the tee: chunky old stone, a rounded top, a little moss and a lean. Some are crosses.
export function headstone(r: number, h: number, seed: number) {
  const g = new THREE.Group();
  const rng = makeRng(`tomb:${seed}`);
  const w = r * 2;
  const thick = Math.min(1.5, r * 1.3);
  const tall = Math.max(1.6, h);
  const stone = mat(rng.next() < 0.5 ? C.stone : '#8a8494');
  if (rng.next() < 0.22) {
    g.add(mesh(new THREE.BoxGeometry(0.55, tall + 0.8, 0.55), stone).translateY((tall + 0.8) / 2));
    g.add(mesh(new THREE.BoxGeometry(w * 0.9, 0.5, 0.5), stone).translateY(tall * 0.75));
    g.add(mesh(new THREE.BoxGeometry(w, 0.4, thick), mat(C.stoneDark)).translateY(0.2));
  } else {
    g.add(mesh(new THREE.BoxGeometry(w, tall - w / 2, thick), stone).translateY((tall - w / 2) / 2));
    const top = mesh(new THREE.CylinderGeometry(w / 2, w / 2, thick, 14, 1, false, 0, Math.PI), stone);
    top.rotation.x = Math.PI / 2;
    top.rotation.z = Math.PI / 2;
    top.position.y = tall - w / 2;
    g.add(top);
    // an engraved panel and a cap of moss
    const panel = mesh(new THREE.BoxGeometry(w * 0.6, (tall - w / 2) * 0.5, 0.06), mat(C.stoneDark), false);
    panel.position.set(0, (tall - w / 2) * 0.55, thick / 2 + 0.01);
    g.add(panel);
    const moss = mesh(new THREE.BoxGeometry(w * 0.7, 0.12, thick + 0.05), mat(C.moss), false);
    moss.position.y = 0.06;
    g.add(moss);
  }
  g.rotation.z = (rng.next() - 0.5) * 0.18;
  g.rotation.x = (rng.next() - 0.5) * 0.14;
  g.rotation.y = (rng.next() - 0.5) * 0.4;
  return g;
}

export function deadTree(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`dead:${seed}`);
  const bark = mat(C.bark);
  const limb = (from: THREE.Vector3, len: number, rad: number, dir: THREE.Vector3, depth: number) => {
    const to = from.clone().addScaledVector(dir, len);
    const m = mesh(new THREE.CylinderGeometry(rad * 0.6, rad, len, 5), bark);
    m.position.copy(from.clone().add(to).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(m);
    if (depth === 0) return;
    const n = depth > 1 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2;
      const d = new THREE.Vector3(Math.cos(a), 0.5 + rng.next() * 0.6, Math.sin(a)).normalize().lerp(dir, 0.3).normalize();
      limb(to, len * (0.55 + rng.next() * 0.2), rad * 0.6, d, depth - 1);
    }
  };
  limb(new THREE.Vector3(0, 0, 0), 7 * scale, 0.7 * scale, new THREE.Vector3((rng.next() - 0.5) * 0.3, 1, (rng.next() - 0.5) * 0.3).normalize(), 3);
  return g;
}

// The witch's cauldron: a black iron pot on stubby legs, a glowing green brew that bubbles, and steam.
function cauldron(r: number, anim: Anim[]) {
  const g = new THREE.Group();
  const pot = new THREE.LatheGeometry(
    [
      [0.2, 0],
      [r * 0.8, 0.3],
      [r, r * 0.7],
      [r * 0.92, r * 1.2],
      [r * 0.82, r * 1.32],
      [r * 0.9, r * 1.42],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    18,
  );
  const potMesh = mesh(pot, mat(C.iron, { rough: 0.5, metal: 0.6 }));
  (potMesh.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  potMesh.position.y = 0.5;
  g.add(potMesh);
  for (let i = 0; i < 3; i++) {
    const leg = mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5), mat(C.iron));
    leg.position.set(Math.cos((i / 3) * Math.PI * 2) * r * 0.6, 0.4, Math.sin((i / 3) * Math.PI * 2) * r * 0.6);
    g.add(leg);
  }
  const brewMat = new THREE.MeshStandardMaterial({ color: C.brew, emissive: C.brew, emissiveIntensity: 1.2, roughness: 0.4 });
  const brew = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 20), brewMat);
  brew.rotation.x = -Math.PI / 2;
  brew.position.y = 0.5 + r * 1.25;
  g.add(brew);
  const light = new THREE.PointLight('#7cff4a', 14, r * 9, 1.6);
  light.position.y = r * 1.6 + 1;
  g.add(light);
  // bubbles on the brew and a column of green steam
  const n = 40;
  const arr = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const steam = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDab(), color: '#a8ff7a', size: 1.6, transparent: true, opacity: 0.45, depthWrite: false }));
  steam.frustumCulled = false;
  g.add(steam);
  anim.push((clock) => {
    for (let i = 0; i < n; i++) {
      const k = (i / n + clock * 0.35) % 1;
      const a = i * 2.39996 + clock * 0.4;
      arr.set([Math.cos(a) * r * 0.5 * (1 + k), brew.position.y + k * 7, Math.sin(a) * r * 0.5 * (1 + k)], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
    brewMat.emissiveIntensity = 1 + Math.sin(clock * 5) * 0.25;
    light.intensity = 12 + Math.sin(clock * 7) * 3;
  });
  return g;
}

// ---------- walls ----------

// iron railings with spear tips; crypt walls of dark, mossy block. Returns false for looks it doesn't draw.
export function hauntedWall(h: Hole, w: Wall, group: THREE.Group): boolean {
  const look = w.look;
  // the scythe's blade and the pumpkin's shell and teeth are drawn by their own props
  if (look === 'blade' || look === 'teeth') return true;
  if (look !== 'iron' && look !== 'crypt') return false;
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  const ang = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
  const at = (t: number) => ({ x: w.a.x + (w.b.x - w.a.x) * t, y: w.a.y + (w.b.y - w.a.y) * t });
  if (look === 'crypt') {
    const n = Math.max(1, Math.ceil(len / 2.4));
    for (let i = 0; i < n; i++) {
      const p = at((i + 0.5) / n);
      const base = heightAt(h, p.x, p.y);
      const hh = w.h + 0.3;
      const b = mesh(new THREE.BoxGeometry(len / n + 0.04, hh, 0.8), mat(i % 3 === 1 ? '#55515e' : C.stoneDark));
      b.position.copy(w3(p.x, p.y, base + hh / 2 - 0.3));
      b.rotation.y = ang;
      group.add(b);
      if ((i * 7) % 5 === 0) {
        const moss = mesh(new THREE.BoxGeometry(len / n, 0.14, 0.86), mat(C.moss), false);
        moss.position.copy(w3(p.x, p.y, base + w.h + 0.05));
        moss.rotation.y = ang;
        group.add(moss);
      }
    }
    return true;
  }
  // iron: a bar every 0.7 ft with a spear tip, a rail near the top and one low down
  const bars = Math.max(2, Math.ceil(len / 0.7));
  const tall = w.h + 1.4;
  const iron = mat(C.iron, { rough: 0.45, metal: 0.7 });
  const bar = new THREE.CylinderGeometry(0.06, 0.06, tall, 4);
  const tip = new THREE.ConeGeometry(0.14, 0.35, 4);
  const inst = new THREE.InstancedMesh(bar, iron, bars + 1);
  const tips = new THREE.InstancedMesh(tip, iron, bars + 1);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i <= bars; i++) {
    const p = at(i / bars);
    const base = heightAt(h, p.x, p.y);
    inst.setMatrixAt(i, m4.makeTranslation(p.x, base + tall / 2, -p.y));
    tips.setMatrixAt(i, m4.makeTranslation(p.x, base + tall + 0.17, -p.y));
  }
  inst.castShadow = true;
  group.add(inst, tips);
  for (const k of [0.25, tall - 0.25]) {
    const mid = at(0.5);
    const rail = mesh(new THREE.BoxGeometry(len, 0.12, 0.12), iron);
    rail.position.copy(w3(mid.x, mid.y, heightAt(h, mid.x, mid.y) + k));
    rail.rotation.y = ang;
    group.add(rail);
  }
  return true;
}

// ---------- movers ----------

// The scythe swings from a gallows over the bridge (pos is the pivot on the ground, heading the arm's swing angle).
// The ghosts drift and bob. The jaw is the pumpkin's teeth, rising to shut its mouth (open: 1 is wide open).
export function hauntedMover(h: Hole, m: Mover, root: THREE.Group, anim: Anim[]): boolean {
  if (m.look === 'scythe') {
    const s0 = m.at(0);
    const L = 13;
    const base = heightAt(h, s0.pos.x, s0.pos.y);
    const frame = new THREE.Group();
    const wood = mat('#3a2a22');
    for (const side of [-1, 1]) frame.add(mesh(new THREE.BoxGeometry(0.7, L + 2.5, 0.7), wood).translateX(side * 9).translateY((L + 2.5) / 2));
    frame.add(mesh(new THREE.BoxGeometry(19, 0.8, 0.8), wood).translateY(L + 2.4));
    frame.position.copy(w3(s0.pos.x, s0.pos.y, base));
    root.add(frame);
    const arm = new THREE.Group();
    arm.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, L, 5), mat('#2a221d')).translateY(-L / 2));
    // the blade: a crescent of steel at the bottom, edge first along the bridge
    // the blade: a crescent of steel across the bridge, swinging in its own plane, its edge just off the boards
    const blade = new THREE.Shape();
    blade.moveTo(-1.5, 0.9);
    blade.quadraticCurveTo(0, -0.9, 1.5, 0.9);
    blade.quadraticCurveTo(0, 0.1, -1.5, 0.9);
    const bladeMesh = mesh(new THREE.ExtrudeGeometry(blade, { depth: 0.12, bevelEnabled: false }), mat('#c9ccd6', { rough: 0.25, metal: 0.9 }));
    bladeMesh.position.set(0, -L, -0.06);
    arm.add(bladeMesh);
    arm.position.copy(w3(s0.pos.x, s0.pos.y, base + L + 0.25));
    root.add(arm);
    anim.push((clock) => (arm.rotation.z = m.at(clock).heading));
    return true;
  }
  if (m.look === 'ghost') {
    const g = ghost();
    root.add(g);
    anim.push((clock) => {
      const s = m.at(clock);
      g.position.copy(w3(s.pos.x, s.pos.y, heightAt(h, s.pos.x, s.pos.y) + 0.4 + Math.sin(clock * 2.2 + s.pos.y) * 0.25));
      g.rotation.y = s.heading - Math.PI / 2;
      g.children[0].scale.x = 1 + Math.sin(clock * 3) * 0.05;
    });
    return true;
  }
  if (m.look === 'jaw') {
    const teeth = new THREE.Group();
    const toothMat = mat('#f2e2b0', { emissive: '#3a2a10' });
    const n = 9;
    const span = 8.6;
    for (let i = 0; i < n; i++) {
      const t = mesh(new THREE.ConeGeometry(0.45, 1.9, 4), toothMat);
      t.position.set(-span / 2 + (i + 0.5) * (span / n), 0.95, 0);
      teeth.add(t);
    }
    root.add(teeth);
    anim.push((clock) => {
      const s = m.at(clock);
      const base = heightAt(h, s.pos.x, s.pos.y);
      teeth.position.copy(w3(s.pos.x, s.pos.y, base - 2.1 * (s.open ?? 0)));
      teeth.rotation.y = s.heading;
    });
    return true;
  }
  return false;
}

function ghost() {
  const g = new THREE.Group();
  const sheetMat = new THREE.MeshStandardMaterial({ color: C.sheet, emissive: '#9aa4ff', emissiveIntensity: 0.35, transparent: true, opacity: 0.82, roughness: 0.8, side: THREE.DoubleSide });
  // a sheet: a dome on top, falling to a wavy hem
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * 1.3, 3.6 + Math.cos(a) * 1.3));
  }
  pts.push(new THREE.Vector2(1.45, 1.8), new THREE.Vector2(1.75, 0.2));
  const geo = new THREE.LatheGeometry(pts.reverse(), 20);
  // the wavy hem
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.5) pos.setY(i, pos.getY(i) + Math.sin(Math.atan2(pos.getZ(i), pos.getX(i)) * 6) * 0.25);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, sheetMat);
  g.add(body);
  const eye = new THREE.MeshBasicMaterial({ color: '#0b0812' });
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), eye);
    e.scale.set(1, 1.5, 0.5);
    e.position.set(side * 0.45, 3.9, 1.18);
    g.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), eye);
  mouth.scale.set(1, 1.3, 0.4);
  mouth.position.set(0, 3.2, 1.28);
  g.add(mouth);
  return g;
}

// ---------- pushes ----------

// The cauldron boils over: a slick of green brew runs across the felt the way it pushes, while it's on.
export function brewFx(h: Hole, p: Push, root: THREE.Group, anim: Anim[]) {
  if (p.look !== 'brew') return;
  const base = heightAt(h, p.x, p.y);
  const slick = new THREE.Mesh(
    new THREE.CircleGeometry(p.r, 24),
    new THREE.MeshStandardMaterial({ color: C.brew, emissive: C.brew, emissiveIntensity: 0.9, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
  );
  slick.rotation.x = -Math.PI / 2;
  slick.position.copy(w3(p.x, p.y, base + 0.05));
  root.add(slick);
  const n = 50;
  const arr = new Float32Array(n * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const drops = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDab(), color: '#a8ff7a', size: 0.9, transparent: true, opacity: 0.8, depthWrite: false }));
  drops.frustumCulled = false;
  root.add(drops);
  let on = 0;
  anim.push((clock, dt) => {
    const f = p.at(clock);
    const live = f.x !== 0 || f.y !== 0;
    on = live ? Math.min(1, on + dt * 4) : Math.max(0, on - dt * 2);
    (slick.material as THREE.MeshStandardMaterial).opacity = on * 0.55;
    drops.visible = on > 0.05;
    if (!drops.visible) return;
    const len = Math.hypot(f.x, f.y) || 1;
    const dx = f.x / len;
    const dy = f.y / len;
    for (let i = 0; i < n; i++) {
      const k = (i / n + clock * 0.9) % 1;
      const side = ((i * 37) % 11) / 11 - 0.5;
      arr.set([p.x - dx * p.r + dx * k * p.r * 2 - dy * side * p.r, base + 0.25 + Math.sin(k * Math.PI) * 0.6, -(p.y - dy * p.r + dy * k * p.r * 2 + dx * side * p.r)], i * 3);
    }
    geo.attributes.position.needsUpdate = true;
  });
}

// ---------- water ----------

export function slimeMaterial() {
  return new THREE.MeshStandardMaterial({ color: C.slime, emissive: '#3fb81c', emissiveIntensity: 0.75, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.94 });
}

// slime bubbles: they rise, swell and pop at random spots across the pool
export function slimeBubbles(h: Hole, w: Water, root: THREE.Group, anim: Anim[]) {
  const xs = w.poly.map((p) => p.x);
  const ys = w.poly.map((p) => p.y);
  const rng = makeRng(`slime:${h.id}`);
  const spots: V2[] = [];
  for (let i = 0; spots.length < 18 && i < 400; i++) {
    const p = { x: Math.min(...xs) + rng.next() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + rng.next() * (Math.max(...ys) - Math.min(...ys)) };
    if (inPoly(p, w.poly) && inPoly(p, h.border)) spots.push(p);
  }
  const bubbleMat = new THREE.MeshStandardMaterial({ color: '#9dff6a', emissive: '#4fd12a', emissiveIntensity: 0.8, transparent: true, opacity: 0.85, roughness: 0.2 });
  const bubbles = spots.map((p, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), bubbleMat);
    b.position.copy(w3(p.x, p.y, w.level));
    root.add(b);
    return { b, phase: i * 0.71 };
  });
  anim.push((clock) => {
    for (const { b, phase } of bubbles) {
      const k = (clock * 0.45 + phase) % 1;
      b.scale.setScalar(k < 0.85 ? 0.3 + k * 1.1 : 0.01);
      b.position.y = w.level + 0.05 + k * 0.15;
    }
  });
}

// ---------- portals ----------

// The coffin you can roll into, lid off and propped beside it; you come out of a crypt door with a purple glow.
export function hauntedPortal(h: Hole, pt: NonNullable<Hole['portals']>[number], root: THREE.Group) {
  const base = heightAt(h, pt.x, pt.y);
  const coffin = new THREE.Shape();
  const W = pt.r + 1;
  const Lh = pt.r + 2.6;
  coffin.moveTo(-W * 0.6, -Lh);
  coffin.lineTo(W * 0.6, -Lh);
  coffin.lineTo(W, Lh * 0.35);
  coffin.lineTo(W * 0.75, Lh);
  coffin.lineTo(-W * 0.75, Lh);
  coffin.lineTo(-W, Lh * 0.35);
  coffin.closePath();
  const inner = new THREE.Path();
  const k = 0.75;
  inner.moveTo(-W * 0.6 * k, -Lh * 0.88);
  inner.lineTo(W * 0.6 * k, -Lh * 0.88);
  inner.lineTo(W * k, Lh * 0.35 * k);
  inner.lineTo(W * 0.75 * k, Lh * 0.9);
  inner.lineTo(-W * 0.75 * k, Lh * 0.9);
  inner.lineTo(-W * k, Lh * 0.35 * k);
  inner.closePath();
  coffin.holes.push(inner);
  const box = mesh(new THREE.ExtrudeGeometry(coffin, { depth: 0.9, bevelEnabled: false }), mat('#3b2418'));
  box.rotation.x = -Math.PI / 2;
  box.position.copy(w3(pt.x, pt.y, base - 0.2));
  root.add(box);
  const dark = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(inner.getPoints())), new THREE.MeshBasicMaterial({ color: '#07040a' }));
  dark.rotation.x = -Math.PI / 2;
  dark.position.copy(w3(pt.x, pt.y, base + 0.03));
  root.add(dark);
  const lid = mesh(new THREE.ExtrudeGeometry(new THREE.Shape(coffin.getPoints()), { depth: 0.3, bevelEnabled: false }), mat('#4a2e1e'));
  lid.rotation.set(-Math.PI / 2 + 0.35, 0, 0.2);
  lid.position.copy(w3(pt.x - W - 1.6, pt.y + 0.5, base + 0.6));
  root.add(lid);
  // the way out: a little crypt door, a step behind where the ball comes to rest, facing the cup
  const out = new THREE.Group();
  out.add(mesh(new THREE.BoxGeometry(5, 4.4, 1.2), mat(C.stoneDark)).translateY(2.2));
  const roof = mesh(new THREE.ConeGeometry(3.6, 1.6, 4), mat('#3d3a45'));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 5.2;
  out.add(roof);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.8), new THREE.MeshBasicMaterial({ color: '#2a1440' }));
  door.position.set(0, 1.4, 0.61);
  out.add(door);
  const glow = new THREE.PointLight('#a66bff', 6, 10, 1.6);
  glow.position.set(0, 1.4, 1.6);
  out.add(glow);
  const dx = h.cup.x - pt.to.x;
  const dy = h.cup.y - pt.to.y;
  const len = Math.hypot(dx, dy) || 1;
  out.rotation.y = Math.atan2(dx, dy);
  out.position.copy(w3(pt.to.x - (dx / len) * 3, pt.to.y - (dy / len) * 3, heightAt(h, pt.to.x, pt.to.y)));
  root.add(out);
}

// ---------- decor ----------

export function hauntedDecor(d: Decor, anim: Anim[]): THREE.Object3D | null {
  if (d.kind === 'lantern') return lantern(anim, d.x * 0.3 + d.y * 0.7, d.label !== 'dim');
  if (d.kind === 'deadtree') return deadTree(d.scale ?? 1, Math.round(d.x * 5 + d.y));
  if (d.kind === 'tomb') return headstone(d.scale ?? 1, (d.scale ?? 1) * 2, Math.round(d.x * 11 + d.y * 3));
  if (d.kind === 'mausoleum') return mausoleum();
  if (d.kind === 'bigpumpkin') return bigPumpkin(d.scale ?? 9, anim);
  if (d.kind === 'candles') return candles(anim, d.x + d.y);
  if (d.kind === 'crow') return crow();
  return null;
}

// A jack-o'-lantern on the ground, lit from inside. Only a few carry a real light (`lit`); the rest just glow.
function lantern(anim: Anim[], seed: number, lit: boolean) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshStandardMaterial({ color: C.pumpkin, emissive: '#ffffff', emissiveMap: faceTexture(), emissiveIntensity: 1.4, roughness: 0.7 }),
  );
  body.scale.set(1.15, 0.85, 1.15);
  body.position.y = 0.8;
  body.castShadow = true;
  g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.5, 5), mat(C.stem)).translateY(1.75));
  if (lit) {
    const light = new THREE.PointLight('#ff9a3c', 9, 22, 1.7);
    light.position.y = 1.4;
    g.add(light);
    anim.push((clock) => (light.intensity = 8 + Math.sin(clock * 11 + seed) * 1.5 + Math.sin(clock * 23 + seed) * 1));
  }
  return g;
}

// The giant jack-o'-lantern round the last cup. Its front, with the face, stands tall; the back of the shell is cut
// low so the camera can see in. Its walls (hollow, a mouth at the front and a crack at the back) are in the hole.
// The face faces -y in hole space (toward the tee); rotate with rot.
function bigPumpkin(r: number, anim: Anim[]) {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: C.pumpkin, roughness: 0.75, side: THREE.DoubleSide, flatShading: true });
  const ribs = 14;
  // the low back half: a ring of ribbed wall 2.6 ft tall
  for (let i = 0; i < ribs; i++) {
    const a0 = (i / ribs) * Math.PI * 2;
    // the front third is the tall face, drawn below
    const mid = a0 + Math.PI / ribs;
    if (Math.cos(mid) > 0.5) continue; // theta 0 is +z in three: the front, toward the tee
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.8, 3, 1, true, a0, (Math.PI * 2) / ribs), i % 2 ? shell : new THREE.MeshStandardMaterial({ color: C.pumpkinDark, roughness: 0.75, side: THREE.DoubleSide, flatShading: true }));
    seg.position.y = 1.4;
    seg.castShadow = true;
    g.add(seg);
    // a rounded lip on top
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r, 0.45, 5, 3, (Math.PI * 2) / ribs), shell);
    lip.rotation.x = Math.PI / 2;
    lip.rotation.z = -a0 + Math.PI / 2 - (Math.PI * 2) / ribs;
    lip.position.y = 2.8;
    g.add(lip);
  }
  // the face: a tall curved front, carved, glowing from inside
  // (the mouth is cut out of it with an alpha map: that's where the ball goes in)
  const front = new THREE.Mesh(
    new THREE.SphereGeometry(r, 28, 18, Math.PI / 2 - 1.0, 2.0, 0.15, Math.PI / 2 - 0.15),
    new THREE.MeshStandardMaterial({ color: C.pumpkin, emissive: '#ffffff', emissiveMap: frontFace(), alphaMap: mouthCut(), alphaTest: 0.5, emissiveIntensity: 1.6, roughness: 0.75, side: THREE.DoubleSide, flatShading: true }),
  );
  front.scale.set(1, 0.6, 1);
  front.castShadow = true;
  g.add(front);
  // the stem and a curl of vine, on a lid knocked off to one side
  const lid = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  cap.scale.y = 0.6;
  lid.add(cap);
  lid.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 2, 6), mat(C.stem)).translateY(1.6));
  lid.position.set(r + 3, 0, -r * 0.4);
  lid.rotation.z = 0.5;
  g.add(lid);
  // a candle's glow inside, flickering
  const light = new THREE.PointLight('#ffa040', 26, r * 4, 1.4);
  light.position.set(0, 3, 0);
  g.add(light);
  anim.push((clock) => (light.intensity = 24 + Math.sin(clock * 9) * 4 + Math.sin(clock * 21) * 2));
  return g;
}

// the big pumpkin's face, laid out for the front cap's wrap: two eyes and a nose above the mouth, which is open
let bigFace: THREE.Texture | null = null;
function frontFace() {
  if (bigFace) return bigFace;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffc04a';
  const tri = (pts: number[]) => {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  tri([62, 140, 92, 50, 114, 140]);
  tri([142, 140, 164, 50, 194, 140]);
  tri([116, 172, 128, 146, 140, 172]);
  // the inside of the mouth glows too, at its edge
  g.fillRect(52, 176, 152, 14);
  bigFace = new THREE.CanvasTexture(c);
  return bigFace;
}

// white where the shell is, black where the mouth is cut: a wide, low grin at ground level, a third of the way round
let mouth: THREE.Texture | null = null;
function mouthCut() {
  if (mouth) return mouth;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(52, 256);
  g.lineTo(52, 196);
  g.quadraticCurveTo(128, 168, 204, 196);
  g.lineTo(204, 256);
  g.closePath();
  g.fill();
  mouth = new THREE.CanvasTexture(c);
  return mouth;
}

function mausoleum() {
  const g = new THREE.Group();
  const stone = mat('#6f6a78');
  const dark = mat(C.stoneDark);
  g.add(mesh(new THREE.BoxGeometry(16, 1, 14), dark).translateY(0.5));
  g.add(mesh(new THREE.BoxGeometry(13, 10, 11), stone).translateY(6));
  // a pediment roof
  const roof = new THREE.Shape();
  roof.moveTo(-8, 0);
  roof.lineTo(8, 0);
  roof.lineTo(0, 4.5);
  roof.closePath();
  const ped = mesh(new THREE.ExtrudeGeometry(roof, { depth: 13, bevelEnabled: false }), mat('#5b5764'));
  ped.position.set(0, 11, -6.5);
  g.add(ped);
  for (const x of [-5, -2, 2, 5]) g.add(mesh(new THREE.CylinderGeometry(0.6, 0.7, 9.5, 8), mat('#8a8494')).translateX(x).translateY(5.75).translateZ(6.2));
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6), new THREE.MeshBasicMaterial({ color: '#160a24' }));
  door.position.set(0, 4, 5.52);
  g.add(door);
  const glow = new THREE.PointLight('#a66bff', 10, 18, 1.6);
  glow.position.set(0, 4, 8);
  g.add(glow);
  // a stone angel on the roof
  const angel = new THREE.Group();
  angel.add(mesh(new THREE.ConeGeometry(0.9, 3, 8), stone).translateY(1.5));
  angel.add(mesh(new THREE.SphereGeometry(0.5, 8, 6), stone).translateY(3.4));
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.BoxGeometry(1.8, 2.2, 0.2), stone);
    wing.position.set(side * 1, 2.6, -0.3);
    wing.rotation.z = side * 0.5;
    angel.add(wing);
  }
  angel.position.y = 15.4;
  g.add(angel);
  return g;
}

function candles(anim: Anim[], seed: number) {
  const g = new THREE.Group();
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const tall = 0.8 + i * 0.35;
    const c = mesh(new THREE.CylinderGeometry(0.16, 0.18, tall, 8), mat('#efe6cf'));
    c.position.set(i * 0.5 - 0.5, tall / 2, (i % 2) * 0.4);
    g.add(c);
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }));
    f.position.set(c.position.x, tall + 0.18, c.position.z);
    g.add(f);
    flames.push(f);
  }
  anim.push((clock) => flames.forEach((f, i) => (f.scale.y = 1 + Math.sin(clock * 13 + i * 2 + seed) * 0.25)));
  return g;
}

function crow() {
  const g = new THREE.Group();
  const black = mat('#111014');
  const body = mesh(new THREE.SphereGeometry(0.45, 8, 6), black);
  body.scale.set(0.8, 0.8, 1.4);
  body.position.y = 0.5;
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.3, 8, 6), black).translateY(0.95).translateZ(0.45));
  const beak = mesh(new THREE.ConeGeometry(0.08, 0.35, 4), mat('#3a3428'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.92, 0.85);
  g.add(beak);
  return g;
}

// ---------- the night all round ----------

// Beyond the course: dead trees and old stones, low mist drifting over the felt, and the manor on the hill with a
// light on upstairs.
export function hauntedGrounds(h: Hole, root: THREE.Group, anim: Anim[], floor: number) {
  const rng = makeRng(`grounds:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  for (let i = 0; i < 44; i++) {
    const side = Math.floor(rng.next() * 4);
    const t = rng.next();
    const off = 6 + rng.next() * 50;
    const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 40 + (x1 - x0 + 80) * t;
    const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 40 + (y1 - y0 + 80) * t;
    const o = rng.next() < 0.45 ? deadTree(0.9 + rng.next() * 0.9, i) : headstone(0.8 + rng.next() * 0.5, 1.6 + rng.next(), i * 31);
    o.position.set(x, floor, -y);
    o.rotation.y = rng.next() * 0.6 - 0.3;
    root.add(o);
  }
  // the manor, far up the hill beyond the last hole
  const manor = new THREE.Group();
  const black = new THREE.MeshBasicMaterial({ color: '#0d0912', fog: false });
  const lit = new THREE.MeshBasicMaterial({ color: '#ffcf6a', fog: false });
  const box = (w: number, hh: number, d: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), black);
    m.position.set(x, y + hh / 2, 0);
    manor.add(m);
  };
  const spire = (r: number, hh: number, x: number, y: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, hh, 4), black);
    m.position.set(x, y + hh / 2, 0);
    manor.add(m);
  };
  const hill = new THREE.Mesh(new THREE.SphereGeometry(160, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), black);
  hill.position.y = -40;
  manor.add(hill);
  box(90, 60, 40, 0, 110);
  box(26, 100, 26, -50, 110);
  box(22, 80, 22, 52, 110);
  spire(22, 50, -50, 210);
  spire(18, 40, 52, 190);
  spire(60, 30, 0, 170);
  for (const [x, y] of [[-20, 140], [12, 140], [-50, 180], [30, 125]]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 10), lit);
    win.position.set(x, y, 21);
    manor.add(win);
  }
  manor.position.set((x0 + x1) / 2 + 60, floor - 30, -(y1 + 900));
  root.add(manor);
  // mist: soft dabs a foot or two over the ground, drifting slowly
  const n = 46;
  const mistMat = new THREE.SpriteMaterial({ map: softDab(), color: '#c9c2e8', transparent: true, opacity: 0.13, depthWrite: false });
  const dabs: { s: THREE.Sprite; x: number; y: number; sp: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(mistMat);
    const x = x0 + rng.next() * (x1 - x0);
    const y = y0 + rng.next() * (y1 - y0);
    s.scale.set(16 + rng.next() * 14, 5 + rng.next() * 3, 1);
    root.add(s);
    dabs.push({ s, x, y, sp: 0.6 + rng.next() * 1.2 });
  }
  anim.push((clock) => {
    for (const d of dabs) {
      const x = x0 + ((((d.x - x0 + clock * d.sp) % (x1 - x0)) + (x1 - x0)) % (x1 - x0));
      d.s.position.set(x, heightAt(h, x, d.y) + 1.4, -d.y);
    }
  });
}
