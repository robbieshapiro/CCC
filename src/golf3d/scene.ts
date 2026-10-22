// Builds the 3D world for one hole from its data: terrain mesh, water, walls, props and moving parts.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { CUP_R, curbs } from './physics';
import * as props from './props';
import { mat, mesh, P } from './props';
import { heightAt, inPoly, isWater, surfaceAt } from './terrain';
import type { Hole, Surface, Wall } from './types';

export const w3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

const SURFACE: Record<Surface, string> = {
  green: '#66b25a',
  fairway: '#5aa64c',
  fringe: '#4a8c41',
  rough: '#3d6630',
  path: '#cbb88f',
  stone: '#d2c9b6',
  wood: '#9b6c44',
  sand: '#e4d3a3',
};

export type Occluder = { obj: THREE.Object3D; x: number; z: number; r: number };

export type World = {
  root: THREE.Group;
  occluders: Occluder[];
  update: (clock: number, dt: number) => void;
  dispose: () => void;
};

// fine grass and soil grain, multiplied over the vertex colours
let grain: THREE.CanvasTexture | null = null;
function grassTexture() {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = '#e6e6e6';
  x.fillRect(0, 0, 256, 256);
  const rng = makeRng('grain');
  for (let i = 0; i < 9000; i++) {
    const v = 190 + Math.floor(rng.next() * 65);
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(rng.next() * 256, rng.next() * 256, 1, 2 + rng.next() * 3);
  }
  grain = new THREE.CanvasTexture(c);
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.anisotropy = 4;
  return grain;
}

function terrainMesh(h: Hole) {
  const S = 1;
  const { x0, y0, x1, y1 } = h.bounds;
  const nx = Math.ceil((x1 - x0) / S) + 1;
  const ny = Math.ceil((y1 - y0) / S) + 1;
  const pos = new Float32Array(nx * ny * 3);
  const col = new Float32Array(nx * ny * 3);
  const c = new THREE.Color();
  const outside = new THREE.Color('#284a25');
  const bed = new THREE.Color('#58705a');
  const rng = makeRng(`terrain:${h.id}`);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + i * S;
      const y = y0 + j * S;
      const k = (j * nx + i) * 3;
      const z = heightAt(h, x, y);
      pos[k] = x;
      pos[k + 1] = z;
      pos[k + 2] = -y;
      const p = { x, y };
      if (!inPoly(p, h.border)) c.copy(outside);
      else if (isWater(h, p)) c.copy(bed);
      else {
        const s = surfaceAt(h, p);
        c.set(SURFACE[s]);
        // mowing stripes: tight on the green, broad on the fairway
        if (s === 'green') c.offsetHSL(0, 0, Math.floor((x + y) / 5) % 2 ? 0.035 : -0.01);
        else if (s === 'fairway') c.offsetHSL(0, 0.02, Math.floor(y / 14) % 2 ? 0.04 : -0.005);
        else if (s === 'fringe') c.offsetHSL(0, 0, Math.floor((y + x * 0.3) / 10) % 2 ? 0.015 : 0);
        else if (s === 'sand') c.offsetHSL(0, 0, (rng.next() - 0.5) * 0.04);
        else if (s === 'wood') c.offsetHSL(0, 0, Math.floor(x / 1.4) % 2 ? 0.03 : -0.02);
      }
      c.offsetHSL(0, 0, (rng.next() - 0.5) * 0.025);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
  const idx: number[] = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
    }
  const uv = new Float32Array(nx * ny * 2);
  for (let k = 0; k < nx * ny; k++) {
    uv[k * 2] = pos[k * 3] / 9;
    uv[k * 2 + 1] = pos[k * 3 + 2] / 9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, map: grassTexture() }));
  m.receiveShadow = true;
  let low = Infinity;
  for (let k = 1; k < pos.length; k += 3) low = Math.min(low, pos[k]);
  return { mesh: m, low };
}

// Water sits a little below the banks: level is the terrain with the water beds dug out removed.
function waterMesh(h: Hole) {
  if (!h.water.length) return null;
  const level: Hole = { ...h, terrain: h.terrain.filter((p) => !(p.kind === 'box' && p.op === 'add' && p.h < 0)) };
  const S = 2;
  const verts: number[] = [];
  for (const poly of h.water) {
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    for (let x = Math.min(...xs) - S; x < Math.max(...xs) + S; x += S)
      for (let y = Math.min(...ys) - S; y < Math.max(...ys) + S; y += S) {
        const mid = { x: x + S / 2, y: y + S / 2 };
        if (!inPoly(mid, poly) || !inPoly(mid, h.border)) continue;
        const z = (a: number, b: number) => heightAt(level, a, b) - 0.7;
        const q = [
          [x, y],
          [x + S, y],
          [x + S, y + S],
          [x, y + S],
        ].map(([a, b]) => [a, z(a, b), -b]);
        verts.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
      }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color: '#3a6f80', roughness: 0.05, metalness: 0.25, transparent: true, opacity: 0.9, envMapIntensity: 1.4 }),
  );
  m.receiveShadow = true;
  return m;
}

function wallMesh(h: Hole, w: Wall, group: THREE.Group, occ: Occluder[]) {
  const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
  const n = Math.max(1, Math.ceil(len / 3));
  const look = w.look ?? 'stone';
  const thick = look === 'hedge' ? 1.6 : look === 'rail' ? 0.25 : look === 'wood' ? 0.5 : 0.7;
  const color = look === 'hedge' ? P.hedge : look === 'wood' || look === 'rail' ? P.wood : P.stone;
  const ang = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = w.a.x + (w.b.x - w.a.x) * t;
    const y = w.a.y + (w.b.y - w.a.y) * t;
    const base = heightAt(h, x, y);
    const seg = len / n + (look === 'hedge' ? 0.4 : 0.05);
    if (look === 'rail') {
      const top = mesh(new THREE.BoxGeometry(seg, 0.22, 0.3), mat(P.wood));
      top.position.copy(w3(x, y, base + w.h - 0.1));
      top.rotation.y = ang;
      group.add(top);
      const post = mesh(new THREE.BoxGeometry(0.3, w.h, 0.3), mat(P.wood));
      post.position.copy(w3(w.a.x + (w.b.x - w.a.x) * (i / n), w.a.y + (w.b.y - w.a.y) * (i / n), base + w.h / 2));
      group.add(post);
      continue;
    }
    const hh = w.h + 0.4;
    const tall = w.h >= 3;
    const holder = new THREE.Group();
    const b = mesh(new THREE.BoxGeometry(seg, hh, thick), tall ? mat(color).clone() : mat(color));
    b.position.copy(w3(x, y, base + hh / 2 - 0.4));
    b.rotation.y = ang;
    holder.add(b);
    group.add(holder);
    if (tall) occ.push({ obj: holder, x, z: -y, r: seg / 2 + 1.5 });
    if (look === 'hedge') {
      const top = mesh(new THREE.BoxGeometry(seg, 0.5, thick + 0.2), tall ? mat(P.hedgeTop).clone() : mat(P.hedgeTop));
      top.position.copy(w3(x, y, base + w.h + 0.05));
      top.rotation.y = ang;
      holder.add(top);
    } else if (look === 'stone' && w.h > 1) {
      const cap = mesh(new THREE.BoxGeometry(seg, 0.2, thick + 0.25), mat(P.white));
      cap.position.copy(w3(x, y, base + w.h + 0.05));
      cap.rotation.y = ang;
      group.add(cap);
    }
  }
}

const CROQUET = ['#b8352b', '#2c5f8a', '#d4a017', '#222222'];

export function buildWorld(h: Hole, number: number): World {
  const root = new THREE.Group();
  const anim: ((clock: number, dt: number) => void)[] = [];
  const at = (o: THREE.Object3D, x: number, y: number, lift = 0) => {
    o.position.copy(w3(x, y, heightAt(h, x, y) + lift));
    return o;
  };

  const terrain = terrainMesh(h);
  root.add(terrain.mesh);
  const floor = terrain.low - 1.5;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: '#284a25', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floor;
  ground.receiveShadow = true;
  root.add(ground);

  const water = waterMesh(h);
  if (water) {
    root.add(water);
    const posAttr = water.geometry.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(posAttr.array as Float32Array);
    anim.push((clock) => {
      const a = posAttr.array as Float32Array;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = base[i + 1] + Math.sin(clock * 1.6 + base[i] * 0.35 + base[i + 2] * 0.22) * 0.06;
      posAttr.needsUpdate = true;
    });
  }

  const occluders: Occluder[] = [];
  // a prop that can fade: its own materials, so fading one tree doesn't fade them all
  const fadeable = (o: THREE.Object3D, x: number, y: number, r: number) => {
    o.traverse((m) => {
      const mm = m as THREE.Mesh;
      if (mm.material) mm.material = (mm.material as THREE.Material).clone();
    });
    occluders.push({ obj: o, x, z: -y, r });
    return o;
  };
  for (const w of [...curbs(h), ...h.walls]) wallMesh(h, w, root, occluders);

  // posts
  let wicketPrev: { x: number; y: number } | null = null;
  let croquet = 0;
  for (const p of h.posts) {
    const look = p.look ?? 'post';
    const vary = 0.9 + (Math.abs(p.x * 7 + p.y * 13) % 5) * 0.06;
    if (look === 'pine') root.add(fadeable(at(props.pine(vary), p.x, p.y, -0.2), p.x, p.y, 5.5));
    else if (look === 'tree') root.add(fadeable(at(props.leafyTree(1.1), p.x, p.y, -0.2), p.x, p.y, 6));
    else if (look === 'oak') root.add(fadeable(at(props.oak(vary), p.x, p.y, -0.2), p.x, p.y, 9));
    else if (look === 'cypress') root.add(fadeable(at(props.cypress(vary), p.x, p.y, -0.2), p.x, p.y, 3));
    else if (look === 'column') {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(p.r, p.r * 1.1, p.h, 12), mat(P.white, { rough: 0.6 })).translateY(p.h / 2));
      g.add(mesh(new THREE.BoxGeometry(p.r * 2.8, 0.6, p.r * 2.8), mat(P.white)).translateY(p.h));
      g.add(mesh(new THREE.BoxGeometry(p.r * 2.6, 0.5, p.r * 2.6), mat(P.white)).translateY(0.25));
      root.add(fadeable(at(g, p.x, p.y), p.x, p.y, 2.2));
    } else if (look === 'wicket') {
      root.add(at(mesh(new THREE.CylinderGeometry(0.12, 0.12, p.h, 5), mat(P.white, { rough: 0.4 })), p.x, p.y, p.h / 2));
      if (wicketPrev && Math.abs(wicketPrev.y - p.y) < 0.1 && Math.abs(wicketPrev.x - p.x) < 4) {
        const bar = mesh(new THREE.CylinderGeometry(0.12, 0.12, p.x - wicketPrev.x, 5), mat(P.white, { rough: 0.4 }));
        bar.rotation.z = Math.PI / 2;
        root.add(at(bar, (p.x + wicketPrev.x) / 2, p.y, p.h));
        wicketPrev = null;
      } else wicketPrev = p;
    } else if (look === 'croquet') root.add(at(mesh(new THREE.SphereGeometry(p.r, 14, 10), mat(CROQUET[croquet++ % 4], { rough: 0.35 })), p.x, p.y, p.r));
    else {
      const g = new THREE.Group();
      const hh = Math.min(p.h, 3);
      g.add(mesh(new THREE.CylinderGeometry(p.r, p.r * 1.15, hh, 10), mat(P.stone)).translateY(hh / 2));
      g.add(mesh(new THREE.SphereGeometry(p.r * 0.9, 10, 6), mat(P.stone)).translateY(hh));
      root.add(at(g, p.x, p.y));
    }
  }

  // decor
  for (const d of h.decor) {
    let o: THREE.Object3D | null = null;
    if (d.kind === 'azalea') o = props.azaleaBush(d.color ?? '#e86a92');
    else if (d.kind === 'bench') o = props.bench();
    else if (d.kind === 'lamp') o = props.lamp();
    else if (d.kind === 'umbrella') o = props.umbrella();
    else if (d.kind === 'sign') o = props.sign(h.name, `HOLE ${number} · PAR ${h.par}`);
    else if (d.kind === 'teebox') {
      for (const side of [-1, 1]) root.add(at(props.teeMarker(), d.x + side * 6, d.y + 2, 0));
      continue;
    }
    else if (d.kind === 'flagpole') {
      o = props.flagpole();
      const cloth = o.getObjectByName('cloth') as THREE.Mesh;
      waveCloth(cloth, anim, 0.5);
    } else if (d.kind === 'fountain') {
      o = props.fountain();
      o.add(jets(anim));
    } else if (d.kind === 'clubhouse') {
      o = props.clubhouse(420);
      o.position.copy(w3(d.x + 23, d.y, heightAt(h, d.x - 2, d.y)));
      root.add(o);
      continue;
    } else if (d.kind === 'lights') {
      o = stringLights(h, anim);
      root.add(o);
      continue;
    }
    if (!o) continue;
    at(o, d.x, d.y);
    if (d.rot) o.rotation.y = d.rot;
    if (d.scale) o.scale.setScalar(d.scale);
    root.add(o);
  }

  // movers
  for (const m of h.movers) {
    const o = m.look === 'swan' ? props.swan() : props.cart();
    root.add(o);
    anim.push((clock) => {
      const s = m.at(clock);
      const lift = m.look === 'swan' ? -0.75 : 0;
      o.position.copy(w3(s.pos.x, s.pos.y, heightAt(h, s.pos.x, s.pos.y) + lift));
      if (m.look === 'swan') o.position.y = Math.max(o.position.y, -1.25) + Math.sin(clock * 2) * 0.05;
      // heading is a hole-space angle from +x; the props face -z (up the hole) by default
      o.rotation.y = s.heading - Math.PI / 2;
    });
  }

  // sprinklers: a brass head and a rotating spray while they're on
  for (const p of h.pushes) {
    if (p.look !== 'sprinkler') continue;
    root.add(at(props.sprinklerHead(), p.x, p.y));
    const n = 60;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#d8eef5', size: 0.45, transparent: true, opacity: 0.8 }));
    const base = heightAt(h, p.x, p.y);
    root.add(pts);
    anim.push((clock) => {
      const f = p.at(clock);
      const on = f.x !== 0 || f.y !== 0;
      pts.visible = on;
      if (!on) return;
      const dir = Math.atan2(f.y, f.x);
      for (let i = 0; i < n; i++) {
        const k = ((i / n + clock * 1.5) % 1) * 1;
        const a = dir + (i % 5) * 0.06;
        const r = k * p.r;
        arr[i * 3] = p.x + Math.cos(a) * r;
        arr[i * 3 + 1] = base + 0.5 + Math.sin(k * Math.PI) * 3;
        arr[i * 3 + 2] = -(p.y + Math.sin(a) * r);
      }
      geo.attributes.position.needsUpdate = true;
    });
  }

  // verandas: a roof slab on the columns, with a white fascia
  for (const r of h.roofs ?? []) {
    const xs = r.poly.map((q) => q.x);
    const ys = r.poly.map((q) => q.y);
    const [rx0, rx1, ry0, ry1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    for (let y = ry0; y < ry1; y += 30) {
      const y1 = Math.min(ry1, y + 30);
      const cx = (rx0 + rx1) / 2;
      const cy = (y + y1) / 2;
      const seg = new THREE.Group();
      const top = heightAt(h, cx, cy) + r.h;
      const slab = mesh(new THREE.BoxGeometry(rx1 - rx0 + 4, 1.2, y1 - y), mat('#2b4a3a'));
      slab.position.copy(w3(cx, cy, top + 0.6));
      seg.add(slab);
      const fascia = mesh(new THREE.BoxGeometry(0.6, 1.6, y1 - y), mat(P.white));
      fascia.position.copy(w3(rx0 - 2, cy, top));
      seg.add(fascia);
      root.add(fadeable(seg, cx, cy, Math.max(rx1 - rx0, y1 - y) / 2 + 4));
    }
  }

  // the cup and the pin
  const cupZ = heightAt(h, h.cup.x, h.cup.y);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 24), new THREE.MeshBasicMaterial({ color: '#0d0f0c', polygonOffset: true, polygonOffsetFactor: -4 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(w3(h.cup.x, h.cup.y, cupZ + 0.04));
  root.add(hole);
  const liner = new THREE.Mesh(new THREE.RingGeometry(CUP_R * 0.92, CUP_R, 24), new THREE.MeshBasicMaterial({ color: '#f4efe4', polygonOffset: true, polygonOffsetFactor: -4 }));
  liner.rotation.x = -Math.PI / 2;
  liner.position.copy(hole.position).add(new THREE.Vector3(0, 0.01, 0));
  root.add(liner);
  const pin = new THREE.Group();
  pin.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.5, 6), mat(P.white, { rough: 0.3 })).translateY(3.75));
  const flagTex = props.textTexture([{ text: String(number), font: '600 90px Georgia, serif', color: P.gold, y: 68 }], 192, 128);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 10, 3), new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.9 }));
  flag.geometry.translate(1.3, 0, 0);
  flag.position.y = 6.6;
  flag.castShadow = true;
  pin.add(flag);
  pin.position.copy(w3(h.cup.x, h.cup.y, cupZ));
  pin.name = 'pin';
  root.add(pin);
  waveCloth(flag, anim, 1);

  // a frame of trees beyond the grounds
  const rng = makeRng(`frame:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const building = h.decor.find((d) => d.kind === 'clubhouse');
  for (let i = 0; i < 70; i++) {
    const side = Math.floor(rng.next() * 4);
    const t = rng.next();
    const off = 10 + rng.next() * 60;
    const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 + (x1 - x0 + 120) * t - 60;
    const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 + (y1 - y0 + 120) * t - 60;
    if (building && x > building.x - 6 && x < building.x + 60 && y > building.y - 120 && y < building.y + 120) continue;
    const tree = rng.next() < 0.55 ? props.pine(1 + rng.next() * 0.5) : props.leafyTree(1 + rng.next() * 0.6);
    tree.position.set(x, floor, -y);
    root.add(tree);
  }

  return {
    root,
    occluders,
    update: (clock, dt) => anim.forEach((f) => f(clock, dt)),
    dispose: () => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
      });
    },
  };
}

function waveCloth(cloth: THREE.Mesh, anim: ((c: number, dt: number) => void)[], amp: number) {
  const pos = cloth.geometry.attributes.position as THREE.BufferAttribute;
  const base = Float32Array.from(pos.array as Float32Array);
  anim.push((clock) => {
    const a = pos.array as Float32Array;
    for (let i = 0; i < a.length; i += 3) {
      const x = base[i];
      a[i + 2] = base[i + 2] + Math.sin(clock * 4 - x * 1.6) * 0.18 * amp * Math.min(1, x / 2);
    }
    pos.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  });
}

function jets(anim: ((c: number, dt: number) => void)[]) {
  const n = 160;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#e4f3f7', size: 0.5, transparent: true, opacity: 0.85 }));
  anim.push((clock) => {
    for (let i = 0; i < n; i++) {
      const k = (i / n + clock * 0.55) % 1;
      const a = i * 2.39996;
      const spread = 0.8 + (i % 3) * 0.6;
      const r = k * spread * 2.6 + Math.sin(clock * 1.3) * k * 2;
      arr[i * 3] = Math.cos(a) * r;
      arr[i * 3 + 1] = 8.6 + k * 7 - k * k * 9.5;
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

function stringLights(h: Hole, anim: ((c: number, dt: number) => void)[]) {
  // swags of bulbs strung between neighbouring veranda columns
  const g = new THREE.Group();
  const glow = mat('#fff3c9', { emissive: '#f0c96a' });
  const cols = h.posts.filter((p) => p.look === 'column');
  for (const a of cols) {
    const b = cols.find((c) => c.x === a.x && c.y > a.y && c.y - a.y < 45);
    if (!b) continue;
    for (let i = 1; i < 12; i++) {
      const t = i / 12;
      const yy = a.y + (b.y - a.y) * t;
      const sag = Math.sin(t * Math.PI) * 1.8;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 4), glow);
      bulb.position.copy(w3(a.x, yy, heightAt(h, a.x, yy) + a.h - 1.4 - sag));
      g.add(bulb);
    }
  }
  anim.push((clock) => {
    glow.emissiveIntensity = 0.8 + Math.sin(clock * 0.7) * 0.15;
  });
  return g;
}
