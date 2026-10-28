// Builds the 3D world for one hole from its data: terrain mesh, water, walls, props and moving parts.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { cupR, curbs } from './physics';
import * as props from './props';
import * as stands from './stands';
import { mat, mesh, P } from './props';
import { gradAt, heightAt, inPoly, levelOf, surfaceAt, wetIn } from './terrain';
import type { Hole, Surface, V2, Wall, Water } from './types';

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
  rock: '#34302e',
  cinder: '#5e3c30', // a road of crushed lava: grippy, so a ball rolling down a steep one keeps an even pace
};
// on the volcanic island the sand is black, the paths are cinder and the cliffs are basalt
const VOLCANIC: Partial<Record<Surface, string>> = { sand: '#4a4541', path: '#6b5f55', rough: '#3f6a2f' };
const surfaceColor = (h: Hole, s: Surface) => (h.theme === 'volcanic' ? VOLCANIC[s] : undefined) ?? SURFACE[s];

const ROCK = new THREE.Color('#8a8270');
const BASALT = new THREE.Color('#2f2b29');

export type Occluder = { obj: THREE.Object3D; x: number; z: number; r: number };

export type World = {
  root: THREE.Group;
  occluders: Occluder[];
  update: (clock: number, dt: number) => void;
  dispose: () => void;
};

// The ground's colours, painted at ~5 px per foot so region edges and mowing stripes stay sharp up close.
function surfaceTexture(h: Hole, shade: (paint: (x: number, y: number, size: number, color: THREE.Color, alpha: number) => void) => void) {
  const { x0, y0, x1, y1 } = h.bounds;
  const ppf = Math.min(5, 4096 / Math.max(x1 - x0, y1 - y0));
  const c = document.createElement('canvas');
  c.width = Math.ceil((x1 - x0) * ppf);
  c.height = Math.ceil((y1 - y0) * ppf);
  const g = c.getContext('2d')!;
  // canvas y runs down from the far end of the hole
  g.setTransform(ppf, 0, 0, -ppf, -x0 * ppf, y1 * ppf);
  const trace = (poly: V2[]) => {
    g.beginPath();
    poly.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
  };
  const hex = (s: Surface, dl = 0) => '#' + new THREE.Color(surfaceColor(h, s)).offsetHSL(0, 0, dl).getHexString();
  g.fillStyle = h.theme === 'volcanic' ? '#2a2624' : '#284a25';
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  const layers: { poly: V2[]; surface: Surface }[] = [{ poly: h.border, surface: h.base }, ...h.regions];
  for (const { poly, surface } of layers) {
    g.save();
    trace(h.border);
    g.clip();
    trace(poly);
    g.clip();
    g.fillStyle = hex(surface);
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    // mowing patterns
    g.fillStyle = hex(surface, 0.035);
    if (surface === 'green') {
      for (let d = Math.floor((x0 + y0) / 10) * 10 - (y1 - y0); d < x1 + y1; d += 10) {
        g.beginPath();
        g.moveTo(d, y0);
        g.lineTo(d + 5, y0);
        g.lineTo(d + 5 - (y1 - y0), y1);
        g.lineTo(d - (y1 - y0), y1);
        g.fill();
      }
    } else if (surface === 'fairway') {
      g.fillStyle = hex(surface, 0.04);
      for (let y = Math.floor(y0 / 28) * 28; y < y1; y += 28) g.fillRect(x0, y, x1 - x0, 14);
    } else if (surface === 'wood') {
      g.fillStyle = hex(surface, -0.05);
      for (let x = Math.floor(x0 / 1.4) * 1.4; x < x1; x += 1.4) g.fillRect(x, y0, 0.12, y1 - y0);
    }
    g.restore();
    // a crisp collar where the green meets the fringe
    if (surface === 'green') {
      g.save();
      trace(poly);
      g.strokeStyle = hex('green', -0.06);
      g.lineWidth = 0.35;
      g.stroke();
      g.restore();
    }
  }
  // lake beds and scree, from the heightfield
  g.setTransform(1, 0, 0, 1, 0, 0);
  shade((x, y, size, color, alpha) => {
    g.globalAlpha = alpha;
    g.fillStyle = '#' + color.getHexString();
    g.fillRect((x - x0 - size / 2) * ppf, (y1 - y - size / 2) * ppf, size * ppf + 1, size * ppf + 1);
  });
  g.globalAlpha = 1;
  // grain, so close-up grass isn't flat colour
  const img = g.getImageData(0, 0, c.width, c.height);
  const rng = makeRng(`grain:${h.id}`);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rng.next() - 0.5) * 14;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.userData.ownCanvas = true; // this hole's alone: its canvas is let go when the hole is
  return t;
}

// A small tile of fine grain: blades of turf and grit, seamless, laid over the ground every 7 ft.
let detailTex: THREE.CanvasTexture | null = null;
function detailTexture() {
  if (detailTex) return detailTex;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, N, N);
  const rng = makeRng('detail');
  // short strokes, light and dark, wrapped at the edges so the tile repeats without a seam
  for (let i = 0; i < 9000; i++) {
    const x = rng.next() * N;
    const y = rng.next() * N;
    const v = Math.round(70 + rng.next() * 120);
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    g.lineWidth = 0.6 + rng.next() * 0.8;
    const a = -Math.PI / 2 + (rng.next() - 0.5) * 0.9;
    const l = 2 + rng.next() * 5;
    for (const [ox, oy] of [[0, 0], [-N, 0], [0, -N], [-N, -N]]) {
      g.beginPath();
      g.moveTo(x + ox, y + oy);
      g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
      g.stroke();
    }
  }
  detailTex = new THREE.CanvasTexture(c);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.anisotropy = 16;
  return detailTex;
}

function terrainMesh(h: Hole) {
  const { x0, y0, x1, y1 } = h.bounds;
  // about 150k vertices whatever the hole's size: 1 ft on small holes, a little coarser on long ones
  const S = Math.max(1, Math.sqrt(((x1 - x0) * (y1 - y0)) / 150000));
  const nx = Math.ceil((x1 - x0) / S) + 1;
  const ny = Math.ceil((y1 - y0) / S) + 1;
  const pos = new Float32Array(nx * ny * 3);
  const bed = new THREE.Color('#58705a');
  const beds: Record<string, THREE.Color> = { lake: bed, sea: new THREE.Color('#2f5560'), lava: new THREE.Color('#1a0d09') };
  const cliff = h.theme === 'volcanic' ? BASALT : ROCK;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3;
      const x = x0 + i * S;
      const y = y0 + j * S;
      pos[k] = x;
      pos[k + 1] = heightAt(h, x, y);
      pos[k + 2] = -y;
    }
  const map = surfaceTexture(h, (paint) => {
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const p = { x: x0 + i * S, y: y0 + j * S };
        if (!inPoly(p, h.border)) continue;
        const wet = wetIn(h, p);
        if (wet) {
          paint(p.x, p.y, S, beds[wet.look ?? 'lake'], 1);
          continue;
        }
        // steep rough turns to scree and rock, the way a mountainside does
        const s = surfaceAt(h, p);
        if (s !== 'rough' && s !== 'fringe') continue;
        const g = gradAt(h, p.x, p.y);
        const steep = Math.min(1, Math.max(0, (Math.hypot(g.x, g.y) - 0.55) / 0.6));
        if (steep > 0) paint(p.x, p.y, S, cliff, steep * 0.85);
      }
  });
  const idx: number[] = [];
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
    }
  const uv = new Float32Array(nx * ny * 2);
  for (let k = 0; k < nx * ny; k++) {
    uv[k * 2] = (pos[k * 3] - x0) / (x1 - x0);
    uv[k * 2 + 1] = (-pos[k * 3 + 2] - y0) / (y1 - y0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ roughness: 0.92, map });
  // tour courses: a fine grain tiled over the painted ground, so turf and rock stay crisp right up close
  if (h.tour) {
    const detail = detailTexture();
    material.onBeforeCompile = (sh) => {
      sh.uniforms.detailMap = { value: detail };
      sh.uniforms.detailRepeat = { value: new THREE.Vector2((x1 - x0) / 7, (y1 - y0) / 7) };
      sh.fragmentShader = 'uniform sampler2D detailMap;\nuniform vec2 detailRepeat;\n' + sh.fragmentShader.replace(
        '#include <map_fragment>',
        '#include <map_fragment>\ndiffuseColor.rgb *= 0.84 + 0.32 * texture2D(detailMap, vMapUv * detailRepeat).r;',
      );
    };
  }
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  let low = Infinity;
  for (let k = 1; k < pos.length; k += 3) low = Math.min(low, pos[k]);
  return { mesh: m, low };
}

// Lava: cooled basalt plates, near black, split by thin cracks of molten rock, with the odd pool where the crust has
// broken open. Two tiling textures (the crust, and the glow) cover LAVA_TILE ft each; built once and shared.
const LAVA_TILE = 90;
let lavaTex: { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } | null = null;
function lavaTextures() {
  if (lavaTex) return lavaTex;
  const N = 1024;
  const G = 8; // cells across the tile, one plate each: about 11 ft
  const rng = makeRng('lava');
  const pts: V2[] = [];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push({ x: (i + 0.05 + rng.next() * 0.9) / G, y: (j + 0.05 + rng.next() * 0.9) / G });
  const shade = pts.map(() => rng.next());
  // smooth noise that tiles (whole numbers of waves across the tile), to bend the plates and vary the heat
  const wave = (u: number, v: number, f: number, o: number) => Math.sin((u * f + o) * Math.PI * 2) * Math.sin((v * f + o * 1.7) * Math.PI * 2);
  const crust = document.createElement('canvas');
  const glow = document.createElement('canvas');
  crust.width = crust.height = glow.width = glow.height = N;
  const ci = crust.getContext('2d')!.createImageData(N, N);
  const gi = glow.getContext('2d')!.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u0 = x / N;
      const v0 = y / N;
      // warp the space first, so the plate edges wander instead of running straight
      const u = u0 + wave(u0, v0, 3, 0.2) * 0.018 + wave(u0, v0, 11, 0.6) * 0.006;
      const v = v0 + wave(v0, u0, 3, 0.45) * 0.018 + wave(v0, u0, 13, 0.1) * 0.006;
      // the nearest two plate centres, wrapping so the tile repeats seamlessly
      const cx = Math.floor(u * G);
      const cy = Math.floor(v * G);
      let d1 = 9;
      let d2 = 9;
      let near = 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = (((cx + di) % G) + G) % G;
          const jj = (((cy + dj) % G) + G) % G;
          const p = pts[jj * G + ii];
          const d = Math.hypot(u - (p.x + (cx + di - ii) / G), v - (p.y + (cy + dj - jj) / G));
          if (d < d1) {
            d2 = d1;
            d1 = d;
            near = jj * G + ii;
          } else if (d < d2) d2 = d;
        }
      const edge = (d2 - d1) * G; // 0 on a crack, ~0.5 in the middle of a plate
      // some cracks run hot, most have crusted over to a dull red; the odd one has closed up
      const run = 0.5 + wave(u0, v0, 5, 0.35) * 0.35 + wave(u0, v0, 9, 0.8) * 0.15;
      const width = 0.012 + Math.max(0, run) * 0.035;
      const crack = Math.max(0, 1 - edge / width);
      const pool = Math.max(0, (wave(u0, v0, 2, 0.1) * 0.6 + wave(u0, v0, 3, 0.55) * 0.4 - 0.72) / 0.22);
      const heat = Math.min(1, crack ** 1.4 * (0.35 + run * 0.8) + pool * 0.9);
      // fine pitting on the crust
      const grit = wave(u0, v0, 61, 0.3) * 0.5 + wave(u0, v0, 97, 0.9) * 0.5;
      const mott = 0.7 + shade[near] * 0.4 + grit * 0.12 + edge * 0.5;
      const k = (y * N + x) * 4;
      // crust: near-black basalt, a little warm where the heat comes through
      const base = 13 * mott;
      ci.data[k] = base + 40 * heat;
      ci.data[k + 1] = base * 0.92 + 10 * heat;
      ci.data[k + 2] = base * 0.88;
      ci.data[k + 3] = 255;
      // glow: deep red at the edge of a crack, orange, then yellow-white only in the hottest cores
      gi.data[k] = 255 * Math.min(1, heat * 1.5);
      gi.data[k + 1] = 255 * Math.max(0, heat - 0.45) * 1.1;
      gi.data[k + 2] = 255 * Math.max(0, heat - 0.88) * 2.5;
      gi.data[k + 3] = 255;
    }
  crust.getContext('2d')!.putImageData(ci, 0, 0);
  glow.getContext('2d')!.putImageData(gi, 0, 0);
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    return t;
  };
  lavaTex = { map: tex(crust), glow: tex(glow) };
  return lavaTex;
}

// Each lake is a flat sheet at its level; the banks hide what's under them. The sea rides its tide; lava glows.
function waterMesh(h: Hole, w: Water) {
  const S = 2;
  const verts: number[] = [];
  const { poly, level } = w;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  // the sheet covers what the high tide can reach, a little beyond the border so the sea meets the skyline sea
  const reach = (w.tide?.amp ?? 0) + level;
  for (let x = Math.min(...xs) - S; x < Math.max(...xs) + S; x += S)
    for (let y = Math.min(...ys) - S; y < Math.max(...ys) + S; y += S) {
      const mid = { x: x + S / 2, y: y + S / 2 };
      if (!inPoly(mid, poly) || !inPoly(mid, h.border)) continue;
      // skip what is high and dry at every tide
      if (Math.min(heightAt(h, x, y), heightAt(h, x + S, y), heightAt(h, x, y + S), heightAt(h, x + S, y + S)) > reach + 0.5) continue;
      const q = [
        [x, y],
        [x + S, y],
        [x + S, y + S],
        [x, y + S],
      ].map(([a, b]) => [a, level, -b]);
      verts.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    }
  if (!verts.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  const look = w.look ?? 'lake';
  if (look === 'lava') {
    // the crust and its cracks tile across the flow
    const uv: number[] = [];
    for (let i = 0; i < verts.length; i += 3) uv.push(verts[i] / LAVA_TILE, -verts[i + 2] / LAVA_TILE);
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  const material =
    look === 'lava'
      ? new THREE.MeshStandardMaterial({
          map: lavaTextures().map,
          emissiveMap: lavaTextures().glow,
          emissive: new THREE.Color('#ff6a1c'),
          emissiveIntensity: 1.8,
          roughness: 0.95,
          metalness: 0,
        })
      : new THREE.MeshStandardMaterial({
          color: look === 'sea' ? '#2b6d84' : '#3a6f80',
          roughness: 0.05,
          metalness: 0.25,
          transparent: true,
          opacity: look === 'sea' ? 0.93 : 0.9,
          envMapIntensity: 1.4,
        });
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = look !== 'lava';
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
  const volcanic = h.theme === 'volcanic';
  // on the island the world beyond the grounds is the sea, at the sea's own level when the hole has one
  const sea = h.water.find((w) => w.look === 'sea');
  const floor = volcanic ? (sea ? sea.level : Math.min(0, terrain.low - 1.5)) : terrain.low - 1.5;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    volcanic
      ? new THREE.MeshStandardMaterial({ color: '#2b6d84', roughness: 0.08, metalness: 0.25, envMapIntensity: 1.4 })
      : new THREE.MeshStandardMaterial({ color: '#284a25', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floor - (volcanic && sea ? 0.05 : 0);
  ground.receiveShadow = true;
  root.add(ground);
  if (volcanic && sea) anim.push((clock) => (ground.position.y = levelOf(sea, clock) - 0.05));

  for (const w of h.water) {
    const water = waterMesh(h, w);
    if (!water) continue;
    root.add(water);
    if (w.look === 'lava') root.add(lavaSmoke(h, w, anim));
    const posAttr = water.geometry.attributes.position as THREE.BufferAttribute;
    const base = Float32Array.from(posAttr.array as Float32Array);
    const lava = w.look === 'lava';
    const material = water.material as THREE.MeshStandardMaterial;
    anim.push((clock) => {
      // the whole sheet rides the tide (or the swell of the lava); ripples on top
      water.position.y = levelOf(w, clock) - w.level;
      const a = posAttr.array as Float32Array;
      const speed = lava ? 0.35 : 1.6;
      const amp = lava ? 0.05 : 0.06;
      for (let i = 0; i < a.length; i += 3) a[i + 1] = base[i + 1] + Math.sin(clock * speed + base[i] * 0.35 + base[i + 2] * 0.22) * amp;
      posAttr.needsUpdate = true;
      // the cracks breathe, slowly and not quite in time
      if (lava) {
        // the flow creeps along
        const t = lavaTextures();
        t.map.offset.set(clock * 0.0025, clock * 0.001);
        t.glow.offset.copy(t.map.offset);
      }
      if (lava) material.emissiveIntensity = 1.75 + Math.sin(clock * 0.9) * 0.3 + Math.sin(clock * 2.3) * 0.12;
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
    else if (look === 'rock') root.add(at(volcanic ? basalt(props.rock(p.r, Math.round(p.x + p.y))) : props.rock(p.r, Math.round(p.x + p.y)), p.x, p.y, -0.3));
    else if (look === 'palm') root.add(fadeable(at(props.palm(vary, Math.round(p.x)), p.x, p.y, -0.2), p.x, p.y, 4));
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
    else if (d.kind === 'rock') o = volcanic ? basalt(props.rock(d.scale ?? 2, Math.round(d.x * 3 + d.y))) : props.rock(d.scale ?? 2, Math.round(d.x * 3 + d.y));
    else if (d.kind === 'teebox') {
      for (const side of [-1, 1]) root.add(at(props.teeMarker(), d.x + side * 6, d.y + 2, 0));
      continue;
    } else if (d.kind === 'stands') {
      // a bank of stone tiers stepping up the slope away from the green, each sat on the ground under it, with a banner
      // along the top
      const f = stands.facing(d);
      const wide = stands.COLS * stands.SEAT_GAP + 2;
      let top = 0;
      for (let r = 0; r < stands.ROWS; r++) {
        const back = (r + 0.5) * stands.ROW_DEPTH;
        const cx = d.x - f.x * back;
        const cy = d.y - f.y * back;
        top = heightAt(h, cx, cy) + stands.ROW_RISE;
        const tier = mesh(new THREE.BoxGeometry(wide, 10, stands.ROW_DEPTH), mat(r % 2 ? '#5a4a42' : '#6a5850'));
        tier.position.copy(w3(cx, cy, top - 5));
        tier.rotation.y = -(d.rot ?? 0);
        root.add(tier);
      }
      const back = stands.ROWS * stands.ROW_DEPTH + 0.6;
      const wall = mesh(new THREE.BoxGeometry(wide, 5, 0.8), mat('#7a1f2b'));
      wall.position.copy(w3(d.x - f.x * back, d.y - f.y * back, top + 2.5));
      wall.rotation.y = -(d.rot ?? 0);
      root.add(wall);
      continue;
    }
    else if (d.kind === 'flagpole') {
      o = props.flagpole();
      const cloth = o.getObjectByName('cloth') as THREE.Mesh;
      waveCloth(cloth, anim, 0.5);
    } else if (d.kind === 'fountain') {
      o = props.fountain();
      o.add(jets(anim));
    } else if (d.kind === 'target') {
      // a range flag: a pin with its distance on the flag
      o = new THREE.Group();
      o.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.5, 6), mat(P.white, { rough: 0.3 })).translateY(3.75));
      const tex = props.textTexture([{ text: d.label ?? '', font: '600 64px Georgia, serif', color: P.gold, y: 68 }], 192, 128);
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.7, 10, 3), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
      cloth.geometry.translate(1.3, 0, 0);
      cloth.position.y = 6.6;
      o.add(cloth);
      waveCloth(cloth, anim, 1);
    } else if (d.kind === 'steamvent') {
      o = steamVent(anim, d.x * 0.29 + d.y * 0.13);
    } else if (d.kind === 'lavafount') {
      o = lavaFountain(anim, d.scale ?? 1, d.x * 0.37 + d.y * 0.11);
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
      o.position.copy(w3(s.pos.x, s.pos.y, heightAt(h, s.pos.x, s.pos.y)));
      // swans ride on whichever lake they're on
      const lake = m.look === 'swan' ? h.water.find((w) => inPoly(s.pos, w.poly)) : undefined;
      if (lake) o.position.y = lake.level - 0.15 + Math.sin(clock * 2) * 0.05;
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

  // tunnels: a dark hole ringed with rock where a ball drops in, and a rock arch round the mouth where it comes out
  for (const pt of h.portals ?? []) {
    const ring = mesh(new THREE.TorusGeometry(pt.r * 1.05, 0.5, 6, 18), mat('#3a302b'));
    ring.rotation.x = Math.PI / 2;
    root.add(at(ring, pt.x, pt.y, 0.12));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(pt.r, 20), new THREE.MeshBasicMaterial({ color: '#070505' }));
    hole.rotation.x = -Math.PI / 2;
    root.add(at(hole, pt.x, pt.y, 0.07));
    const arch = mesh(new THREE.TorusGeometry(2.6, 0.9, 6, 12, Math.PI), mat('#2e2724'));
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(2.2, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#070505' }));
    const out = new THREE.Group();
    out.add(arch, mouth);
    // facing the cup, a step behind where the ball comes to rest
    const dx = h.cup.x - pt.to.x;
    const dy = h.cup.y - pt.to.y;
    const len = Math.hypot(dx, dy) || 1;
    out.rotation.y = Math.atan2(dx, dy);
    root.add(at(out, pt.to.x - (dx / len) * 3, pt.to.y - (dy / len) * 3, 0));
  }

  // geysers and blowholes: a ring of dark rock round the vent, a wisp of steam, and a burst when it goes
  for (const p of h.pushes) {
    if ((p.look !== 'geyser' && p.look !== 'blowhole') || !p.erupt) continue;
    const erupt = p.erupt;
    const base = heightAt(h, p.x, p.y);
    const ring = mesh(new THREE.TorusGeometry(p.r * 0.8, 0.45, 6, 14), mat('#2a2523'));
    ring.rotation.x = Math.PI / 2;
    root.add(at(ring, p.x, p.y, 0.1));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(p.r * 0.7, 16), new THREE.MeshBasicMaterial({ color: '#141110' }));
    hole.rotation.x = -Math.PI / 2;
    root.add(at(hole, p.x, p.y, 0.06));
    const n = 140;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array(n * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const steam = new THREE.PointsMaterial({ color: p.look === 'blowhole' ? '#e8f4f7' : '#f1efe9', size: 1.1, transparent: true, opacity: 0.7, depthWrite: false });
    const pts = new THREE.Points(geo, steam);
    pts.frustumCulled = false;
    root.add(pts);
    const tall = p.look === 'blowhole' ? 26 : 20;
    let burst = 0; // how far through the current burst, 0..1 (and on, while it settles)
    anim.push((clock, dt) => {
      const on = !!erupt(clock);
      burst = on ? Math.min(1, burst + dt * 3) : Math.max(0, burst - dt * 0.8);
      for (let i = 0; i < n; i++) {
        const k = (i / n + clock * (on ? 1.4 : 0.25)) % 1;
        const a = i * 2.39996;
        // a lazy wisp at rest; a column of spray while it goes off
        const h2 = burst > 0.02 ? k * tall * burst : k * 3;
        const r = (burst > 0.02 ? 0.4 + k * 2.4 : 0.3 + k * 1.2) * (1 + Math.sin(clock * 2 + i) * 0.15);
        arr[i * 3] = p.x + Math.cos(a) * r;
        arr[i * 3 + 1] = base + 0.5 + h2;
        arr[i * 3 + 2] = -(p.y + Math.sin(a) * r);
      }
      steam.opacity = 0.25 + burst * 0.6;
      geo.attributes.position.needsUpdate = true;
    });
  }

  // lava tubes: an arched roof of dark rock over each cave, with glowing seams and a warm light inside
  for (const c of h.ceilings ?? []) {
    const xs = c.poly.map((q) => q.x);
    const ys = c.poly.map((q) => q.y);
    const [cx0, cx1, cy0, cy1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const half = (cx1 - cx0) / 2;
    const len = cy1 - cy0;
    const mx = (cx0 + cx1) / 2;
    const my = (cy0 + cy1) / 2;
    const base = heightAt(h, mx, my);
    const tube = new THREE.Group();
    // a half cylinder, squashed to the roof height, running along the hole
    const arch = mesh(new THREE.CylinderGeometry(half + 1.5, half + 1.5, len, 24, 1, true, -Math.PI / 2, Math.PI), mat('#2b2523', { rough: 1 }));
    (arch.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    // the open half of the cylinder faces up once it's laid along the hole
    arch.rotation.x = -Math.PI / 2;
    arch.scale.set(1, 1, (c.h + 1) / (half + 1.5));
    arch.position.copy(w3(mx, my, base));
    tube.add(arch);
    // seams of lava glowing in the roof
    for (let k = 1; k < 5; k++) {
      const seam = new THREE.Mesh(new THREE.TorusGeometry(half + 1.2, 0.25, 4, 24, Math.PI), new THREE.MeshBasicMaterial({ color: '#ff7a2e' }));
      seam.scale.set(1, (c.h + 1) / (half + 1.5), 1);
      seam.position.copy(w3(mx, cy0 + (len * k) / 5, base));
      tube.add(seam);
    }
    const glow = new THREE.PointLight('#ff8a3d', 60, half * 6, 1.6);
    glow.position.copy(w3(mx, my, base + c.h * 0.7));
    tube.add(glow);
    root.add(tube);
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
  const R = cupR(h);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(R, 24), new THREE.MeshBasicMaterial({ color: '#0d0f0c', polygonOffset: true, polygonOffsetFactor: -4 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.copy(w3(h.cup.x, h.cup.y, cupZ + 0.04));
  root.add(hole);
  const liner = new THREE.Mesh(new THREE.RingGeometry(R * 0.92, R, 24), new THREE.MeshBasicMaterial({ color: '#f4efe4', polygonOffset: true, polygonOffsetFactor: -4 }));
  liner.rotation.x = -Math.PI / 2;
  liner.position.copy(hole.position).add(new THREE.Vector3(0, 0.01, 0));
  root.add(liner);
  const pin = new THREE.Group();
  pin.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 7.5, 6), mat(P.white, { rough: 0.3 })).translateY(3.75));
  const flagTex = props.textTexture([{ text: h.flag ?? String(number), font: `600 ${h.flag ? 64 : 90}px Georgia, serif`, color: P.gold, y: 68 }], 192, 128);
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
  for (let i = 0; i < (volcanic ? 0 : 70); i++) {
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

  // the range: peaks all round the valley, far beyond the fog
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (volcanic) {
    // the island's volcano beyond the far end of the hole, smoking, and sea stacks out in the water
    const tall = 380;
    const v = props.volcano(tall, 460);
    v.position.set(cx - 300, floor - 10, -(y1 + 1500));
    root.add(v);
    const plume = new THREE.Group();
    const smoke = new THREE.MeshBasicMaterial({ color: '#8b8890', transparent: true, opacity: 0.55, fog: false, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(40 + i * 9, 1), smoke);
      puff.position.set(i * 26, tall + 20 + i * 40, -i * 8);
      plume.add(puff);
    }
    plume.position.copy(v.position);
    root.add(plume);
    anim.push((clock) => plume.children.forEach((c, i) => (c.position.x = i * 26 + Math.sin(clock * 0.1 + i) * 10)));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.next() * 0.4;
      const r = 700 + rng.next() * 700;
      const st = props.seaStack(30 + rng.next() * 70, i);
      st.position.set(cx + Math.cos(a) * r, floor, -(cy + Math.sin(a) * r));
      root.add(st);
    }
  }
  for (let i = 0; i < (volcanic ? 0 : 26); i++) {
    const a = (i / 26) * Math.PI * 2 + rng.next() * 0.2;
    const r = 1150 + rng.next() * 350;
    const peak = props.mountain(180 + rng.next() * 260, 220 + rng.next() * 160, i);
    peak.position.set(cx + Math.cos(a) * r, floor - 20, -(cy + Math.sin(a) * r));
    root.add(peak);
  }

  return {
    root,
    occluders,
    update: (clock, dt) => anim.forEach((f) => f(clock, dt)),
    // Let go of everything the hole drew with, textures included. The ground alone can be a 4096 px image, and
    // phones and iPads have little graphics memory: keep a few old holes and the next one comes out scrambled or blank.
    // Shared materials and textures are fine to dispose too; three.js uploads them again the next time they're drawn.
    dispose: () => {
      const textures = new Set<THREE.Texture>();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        for (const mat of ([] as (THREE.Material | undefined)[]).concat(m.material)) {
          if (!mat) continue;
          for (const v of Object.values(mat)) if (v instanceof THREE.Texture) textures.add(v);
          mat.dispose();
        }
      });
      for (const t of textures) {
        t.dispose();
        // and the canvas behind it: iPads cap the total canvas memory a page can hold
        if (t.userData.ownCanvas && t.image instanceof HTMLCanvasElement) t.image.width = t.image.height = 0;
      }
    },
  };
}

// A steam vent: a ring of dark rock with a wisp coming off it and, every so often, a tall plume. Scenery only.
// Smoke off the lava: soft grey plumes that rise, spread and thin out, a few to each flow.
let smokeTex: THREE.CanvasTexture | null = null;
function lavaSmoke(h: Hole, w: Water, anim: ((c: number, dt: number) => void)[]) {
  if (!smokeTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(70,64,60,0.9)');
    grad.addColorStop(0.5, 'rgba(70,64,60,0.45)');
    grad.addColorStop(1, 'rgba(70,64,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    smokeTex = new THREE.CanvasTexture(c);
  }
  const xs = w.poly.map((p) => p.x);
  const ys = w.poly.map((p) => p.y);
  const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
  const rng = makeRng(`smoke:${h.id}:${xs[0]}:${ys[0]}`);
  const g = new THREE.Group();
  const n = Math.min(14, Math.max(3, Math.round(area / 4000)));
  for (let i = 0, tries = 0; i < n && tries < 400; tries++) {
    const p = { x: Math.min(...xs) + rng.next() * (Math.max(...xs) - Math.min(...xs)), y: Math.min(...ys) + rng.next() * (Math.max(...ys) - Math.min(...ys)) };
    if (!inPoly(p, w.poly) || !inPoly(p, h.border) || heightAt(h, p.x, p.y) > w.level) continue;
    i++;
    const m = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 });
    const sp = new THREE.Sprite(m);
    g.add(sp);
    const period = 9 + rng.next() * 6;
    const phase = rng.next() * period;
    anim.push((clock) => {
      const k = ((clock + phase) % period) / period;
      sp.position.set(p.x + Math.sin(clock * 0.2 + i) * 3 + k * 6, w.level + 1 + k * 30, -p.y - k * 4);
      sp.scale.setScalar(6 + k * 22);
      m.opacity = Math.sin(k * Math.PI) * 0.4;
    });
  }
  return g;
}

function steamVent(anim: ((c: number, dt: number) => void)[], phase: number) {
  const g = new THREE.Group();
  const ring = mesh(new THREE.TorusGeometry(2.2, 0.5, 6, 14), mat('#2a2523'));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.2;
  g.add(ring);
  const n = 90;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({ color: '#f1efe9', size: 1.3, transparent: true, opacity: 0.5, depthWrite: false });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  g.add(pts);
  const period = 6 + (Math.abs(phase) % 4);
  anim.push((clock) => {
    const t = (clock + phase) % period;
    const burst = t < 1.8 ? Math.sin((t / 1.8) * Math.PI) : 0;
    for (let i = 0; i < n; i++) {
      const k = (i / n + clock * (0.25 + burst)) % 1;
      const a = i * 2.39996;
      const r = (0.4 + k * (1.5 + burst * 2)) * (1 + Math.sin(clock + i) * 0.15);
      arr[i * 3] = Math.cos(a) * r + Math.sin(clock * 0.4) * k * 2;
      arr[i * 3 + 1] = 0.5 + k * (4 + burst * 24);
      arr[i * 3 + 2] = Math.sin(a) * r;
    }
    m.opacity = 0.35 + burst * 0.45;
    geo.attributes.position.needsUpdate = true;
  });
  return g;
}

// A fountain of lava out of the lake: a low bubbling, then every few seconds a burst of glowing spatter.
function lavaFountain(anim: ((c: number, dt: number) => void)[], size: number, phase: number) {
  const n = 120;
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const m = new THREE.PointsMaterial({ color: '#ffb347', size: 1.1 * size, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const pts = new THREE.Points(geo, m);
  pts.frustumCulled = false;
  const period = 5.5 + (Math.abs(phase) % 3);
  anim.push((clock) => {
    const t = (clock + phase) % period;
    // a burst lasts a couple of seconds; between them it only bubbles
    const burst = t < 2.2 ? 1 : 0.12;
    for (let i = 0; i < n; i++) {
      const k = (i / n + clock * 0.9) % 1;
      const a = i * 2.39996;
      const spread = (0.6 + (i % 4) * 0.5) * size;
      const up = (34 + (i % 5) * 6) * size * burst;
      arr[i * 3] = Math.cos(a) * spread * k * 4;
      arr[i * 3 + 1] = up * k - 0.5 * 52 * (k * 1.1) ** 2 * burst;
      arr[i * 3 + 2] = Math.sin(a) * spread * k * 4;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 0;
    }
    m.opacity = 0.5 + burst * 0.45;
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}

// basalt: the same rock, darker
function basalt(o: THREE.Object3D) {
  o.traverse((m) => {
    const mm = m as THREE.Mesh;
    if (mm.material) mm.material = mat('#3a3431');
  });
  return o;
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
