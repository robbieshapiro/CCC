// Chicago in late November: a low steel sky, snow flurries, a hard wind off Lake Michigan, and the city going about its
// day. Towers stand in play (their sides are walls, their roofs lose a ball), and the landmarks are drawn here: Willis
// Tower, the Hancock, the Aon Center, Marina City, Cloud Gate, the Pritzker bandshell, the bascule bridges, the CTA el
// with its trains running, Wrigley Field's marquee, and the Navy Pier wheel turning. People in winter coats on the
// sidewalks, traffic on Lake Shore Drive, steam from the vents.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim, Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Decor, Hole, Roof, V2, Wall } from '../types';

const SNOW = '#eef1f4';
const GLASS = ['#9fb0bd', '#aab9c4', '#8fa2b1', '#b5c2cc'];
const STONE = ['#cfc3ad', '#c2b59e', '#b7ab97', '#d8cdb8', '#9c7c66', '#8a6a55'];

// A sign: plain lettering on a coloured board (no club border), for the city's own signage
function signTexture(lines: { text: string; size: number; color: string; y: number; weight?: number }[], w: number, h: number, bg: string) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const l of lines) {
    x.font = `${l.weight ?? 800} ${l.size}px Helvetica, Arial, sans-serif`;
    x.fillStyle = l.color;
    x.fillText(l.text, w / 2, l.y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function board(lines: Parameters<typeof signTexture>[0], w: number, h: number, bg: string, ww: number, hh: number, glow = false) {
  const m = new THREE.MeshStandardMaterial({ map: signTexture(lines, w, h, bg), roughness: 0.6, emissive: glow ? new THREE.Color('#ffffff') : undefined, emissiveMap: glow ? signTexture(lines, w, h, bg) : undefined, emissiveIntensity: glow ? 0.55 : 0 });
  return new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), m);
}

// A tower: glass or stone, floor bands, windows lit against the grey day, snow on the roof
export function tower(w: number, d: number, hgt: number, seed: number) {
  const g = new THREE.Group();
  const rng = makeRng(`chi:${seed}`);
  const glassy = rng.next() < 0.5;
  const skin = mat(glassy ? GLASS[seed % GLASS.length] : STONE[seed % STONE.length], { rough: glassy ? 0.4 : 0.85, metal: glassy ? 0.1 : 0, emissive: glassy ? '#3d4852' : '#3f372e' });
  g.add(mesh(new THREE.BoxGeometry(w, hgt, d), skin).translateY(hgt / 2));
  const band = mat(glassy ? '#c9d3da' : '#6d5d4c');
  for (let y = 12; y < hgt - 4; y += glassy ? 22 : 11) g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.8, d + 0.4), band, false).translateY(y));
  // a few lit windows, warm, on the two faces you can see
  const lit = mat('#ffe2a8', { emissive: '#ffcf7a' });
  for (let i = 0; i < Math.min(30, hgt / 8); i++) {
    const y = 18 + rng.next() * (hgt - 24);
    const face = rng.next() < 0.5;
    const win = mesh(new THREE.BoxGeometry(face ? 3 : 0.2, 2.4, face ? 0.2 : 3), lit, false);
    win.position.set(face ? (rng.next() - 0.5) * (w - 4) : w / 2 + 0.05, y, face ? d / 2 + 0.05 : (rng.next() - 0.5) * (d - 4));
    g.add(win);
  }
  g.add(mesh(new THREE.BoxGeometry(w - 0.5, 1, d - 0.5), mat(SNOW, { rough: 0.6 }), false).translateY(hgt + 0.5));
  if (hgt > 260) g.add(mesh(new THREE.BoxGeometry(w * 0.6, 30, d * 0.6), skin).translateY(hgt + 15));
  g.add(mesh(new THREE.BoxGeometry(w + 0.6, 14, d + 0.6), mat('#4a4642', { rough: 0.5 })).translateY(7));
  return noShadow(g);
}

// The city's buildings cast no shadows: in the low November sun a tower's shadow reaches across a whole hole and
// turns the fairway the same grey as the snow
function noShadow<T extends THREE.Object3D>(o: T): T {
  o.traverse((m) => (m.castShadow = false));
  return o;
}

// Willis Tower: nine black square tubes bundled, stepping down at different heights, two white antennas
export function willis() {
  const g = new THREE.Group();
  const black = mat('#1c1d20', { rough: 0.35, metal: 0.4 });
  const s = 26;
  const tops = [500, 420, 330, 500, 500, 420, 330, 260, 260];
  for (let i = 0; i < 9; i++) {
    const h = tops[i];
    g.add(mesh(new THREE.BoxGeometry(s, h, s), black, false).translateX(((i % 3) - 1) * s).translateY(h / 2).translateZ((Math.floor(i / 3) - 1) * s));
  }
  for (let y = 40; y < 500; y += 70) g.add(mesh(new THREE.BoxGeometry(s * 3 + 0.6, 1.4, s * 3 + 0.6), mat('#2a2c30'), false).translateY(y));
  for (const x of [-8, 8]) g.add(mesh(new THREE.CylinderGeometry(1, 1.6, 120, 6), mat('#e8e8e8'), false).translateX(x).translateY(560).translateZ(-s / 2));
  return g;
}

// The Hancock: a tapering black tower with X-bracing and two antennas
export function hancock() {
  const g = new THREE.Group();
  const black = mat('#1e1f22', { rough: 0.4, metal: 0.4 });
  const body = mesh(new THREE.CylinderGeometry(22, 38, 450, 4, 1), black, false);
  body.rotation.y = Math.PI / 4;
  body.position.y = 225;
  g.add(body);
  const brace = mat('#3a3c40');
  for (let k = 0; k < 4; k++)
    for (const s of [-1, 1]) {
      const bar = mesh(new THREE.BoxGeometry(1.4, 120, 1.4), brace, false);
      bar.position.set(0, 60 + k * 110, 30 - k * 3.5);
      bar.rotation.z = s * 0.42;
      g.add(bar);
    }
  for (const x of [-7, 7]) g.add(mesh(new THREE.CylinderGeometry(0.8, 1.2, 90, 6), mat('#e0e0e0'), false).translateX(x).translateY(495));
  return g;
}

// The Aon Center: a plain, very tall white slab
export function aon() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(56, 470, 56), mat('#e9e6df', { rough: 0.6 }), false).translateY(235));
  for (let x = -24; x <= 24; x += 6) g.add(mesh(new THREE.BoxGeometry(0.6, 470, 56.4), mat('#c9c6c0'), false).translateX(x).translateY(235));
  return g;
}

// Marina City: the two corn cobs, round towers with scalloped balconies and parking spiralling up the bottom third
export function marinaCity() {
  const g = new THREE.Group();
  const conc = mat('#d9d6cf', { rough: 0.8 });
  for (const x of [-34, 34]) {
    g.add(mesh(new THREE.CylinderGeometry(15, 15, 270, 16), mat('#8f8c86'), false).translateX(x).translateY(135));
    for (let y = 8; y < 270; y += 6) {
      const ring = mesh(new THREE.CylinderGeometry(22, 22, 1.2, 16), conc, false);
      ring.position.set(x, y, 0);
      g.add(ring);
    }
    g.add(mesh(new THREE.CylinderGeometry(22, 22, 1.4, 16), mat(SNOW), false).translateX(x).translateY(271));
  }
  return g;
}

// Cloud Gate: the bean, polished steel reflecting the sky
export function bean() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: '#e4e8ec', metalness: 0.75, roughness: 0.12, envMapIntensity: 2, emissive: new THREE.Color('#5a6068') });
  const b = new THREE.Mesh(new THREE.SphereGeometry(10, 40, 24), steel);
  b.scale.set(1.5, 0.75, 1);
  b.position.y = 7.6;
  b.castShadow = true;
  g.add(b);
  // the omphalos: the arch underneath you can walk through
  const under = new THREE.Mesh(new THREE.SphereGeometry(4.2, 20, 12), new THREE.MeshStandardMaterial({ color: '#30343a', metalness: 1, roughness: 0.15 }));
  under.scale.set(1.6, 0.8, 1.2);
  under.position.y = 1.4;
  g.add(under);
  return g;
}

// The Pritzker bandshell: curling steel ribbons round a stage, and the lawn trellis reaching out over the grass
export function pritzker() {
  const g = new THREE.Group();
  const steel = mat('#cfd4d9', { metal: 0.8, rough: 0.25 });
  for (let i = 0; i < 9; i++) {
    const a = -0.9 + (i / 8) * 1.8;
    const r = 22 + (i % 3) * 5;
    const curl = mesh(new THREE.TorusGeometry(r, 1.2, 4, 18, Math.PI * (0.8 + (i % 3) * 0.15)), steel, false);
    curl.position.set(Math.sin(a) * 30, 40 + (i % 2) * 8, -Math.cos(a) * 8 - 10);
    curl.rotation.set(0.3 * (i % 2 ? 1 : -1), a, 0.4 + (i % 4) * 0.25);
    g.add(curl);
  }
  g.add(mesh(new THREE.BoxGeometry(50, 30, 16), mat('#7d6f60'), false).translateY(15).translateZ(-12));
  // the trellis: a grid of steel pipes out over the lawn
  const pipe = mat('#b8bec4', { metal: 0.7, rough: 0.3 });
  for (let k = -3; k <= 3; k++) {
    const p = mesh(new THREE.CylinderGeometry(0.5, 0.5, 160, 6), pipe, false);
    p.rotation.x = Math.PI / 2;
    p.position.set(k * 22, 34, 80);
    g.add(p);
    const q = mesh(new THREE.CylinderGeometry(0.5, 0.5, 140, 6), pipe, false);
    q.rotation.z = Math.PI / 2;
    q.position.set(0, 34, 20 + (k + 3) * 22);
    g.add(q);
  }
  return g;
}

// A bascule bridge over the river: two leaves raised, the bridge houses on the banks, the river's green-grey water
// beneath it is the hole's own
export function bascule(span: number) {
  const g = new THREE.Group();
  const steel = mat('#5e6a5a', { metal: 0.5, rough: 0.5 });
  for (const s of [-1, 1]) {
    const leaf = mesh(new THREE.BoxGeometry(span / 2, 2, 22), steel, false);
    leaf.geometry.translate(-s * span * 0.25, 0, 0);
    leaf.position.set((s * span) / 2, 8, 0);
    leaf.rotation.z = s * -1.05;
    g.add(leaf);
    const house = mesh(new THREE.BoxGeometry(10, 16, 10), mat('#b9a98e'), false);
    house.position.set((s * span) / 2 + s * 8, 8, 14);
    g.add(house);
    g.add(mesh(new THREE.ConeGeometry(7.6, 5, 4), mat(SNOW), false).translateX((s * span) / 2 + s * 8).translateY(18.5).translateZ(14));
  }
  return g;
}

// The CTA el: the steel trestle and a train running along it, out and back
export function el(len: number, anim: Anim, line: 'brown' | 'red' = 'brown') {
  const g = new THREE.Group();
  const steel = mat('#3f4448', { metal: 0.5, rough: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(len, 2, 16), steel).translateY(26));
  for (let x = -len / 2; x <= len / 2; x += 26) {
    for (const z of [-7, 7]) g.add(mesh(new THREE.BoxGeometry(1.1, 26, 1.1), steel).translateX(x).translateY(13).translateZ(z));
    g.add(mesh(new THREE.BoxGeometry(1, 1, 16), steel).translateX(x).translateY(18));
  }
  // snow along the deck edges
  for (const z of [-7.6, 7.6]) g.add(mesh(new THREE.BoxGeometry(len, 0.5, 0.8), mat(SNOW), false).translateY(27.2).translateZ(z));
  const stripe = line === 'red' ? '#c6283a' : '#62361b';
  const train = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group();
    car.add(mesh(new THREE.BoxGeometry(22, 9.5, 8.5), mat('#c4c8cc', { metal: 0.6, rough: 0.35 })).translateY(5));
    car.add(mesh(new THREE.BoxGeometry(22.2, 1.4, 8.7), mat(stripe)).translateY(3.4));
    car.add(mesh(new THREE.BoxGeometry(18, 2.2, 8.8), mat('#2a3138', { emissive: '#ffe4a8' }), false).translateY(7));
    car.position.x = i * 23;
    train.add(car);
  }
  train.position.set(0, 27.5, 4);
  g.add(train);
  const span = len + 92;
  anim.push((clock) => {
    // across in about 20 seconds, a pause off the end, and back on the other track
    const t = (clock / 26) % 2;
    const out = t < 1;
    const k = out ? t : t - 1;
    train.position.x = -span / 2 + k * span - 46;
    train.position.z = out ? 4 : -4;
  });
  return g;
}

// People in winter coats walking a sidewalk, out and back, n of them along len ft
export function walkers(len: number, n: number, seed: number, anim: Anim) {
  const g = new THREE.Group();
  const rng = makeRng(`walk:${seed}`);
  const coats = ['#1f2a44', '#5b1f24', '#2f3d2c', '#3a3a3a', '#7a5a3a', '#1c4c8c', '#c2402f'];
  const people: { o: THREE.Group; x0: number; v: number; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group();
    p.add(mesh(new THREE.CapsuleGeometry(0.7, 2.2, 3, 6), mat(coats[Math.floor(rng.next() * coats.length)])).translateY(2.4));
    p.add(mesh(new THREE.SphereGeometry(0.5, 6, 5), mat('#e5c3a2')).translateY(4.4));
    p.add(mesh(new THREE.SphereGeometry(0.54, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(rng.next() < 0.4 ? '#1c4c8c' : '#2a2a2a')).translateY(4.6));
    for (const s of [-0.3, 0.3]) p.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.6, 4), mat('#222')).translateZ(s).translateY(0.8));
    g.add(p);
    people.push({ o: p, x0: (rng.next() - 0.5) * len, v: (2.5 + rng.next() * 2) * (rng.next() < 0.5 ? -1 : 1), z: (rng.next() - 0.5) * 6 });
  }
  anim.push((clock) =>
    people.forEach((p) => {
      const span = len;
      let x = p.x0 + p.v * clock;
      x = ((((x + span / 2) % (2 * span)) + 2 * span) % (2 * span)) - span / 2;
      const back = x > span / 2;
      p.o.position.set(back ? span - x : x, Math.abs(Math.sin(clock * 6 + p.x0)) * 0.15, p.z);
      p.o.rotation.y = (p.v > 0) !== back ? 0 : Math.PI;
    }),
  );
  return g;
}

// Traffic on a road: cars and yellow cabs both ways along len ft
export function traffic(len: number, n: number, seed: number, anim: Anim) {
  const g = new THREE.Group();
  const rng = makeRng(`cars:${seed}`);
  const paints = ['#f2c12e', '#f2c12e', '#2c2f36', '#b9bec4', '#7a1f25', '#1d3d6b', '#e9e9e9'];
  const cars: { o: THREE.Group; x0: number; v: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = new THREE.Group();
    const paint = paints[Math.floor(rng.next() * paints.length)];
    c.add(mesh(new THREE.BoxGeometry(9, 2.4, 4.4), mat(paint, { metal: 0.3, rough: 0.4 })).translateY(1.8));
    c.add(mesh(new THREE.BoxGeometry(5, 1.8, 4), mat('#3a4450', { rough: 0.2 })).translateY(3.8));
    c.add(mesh(new THREE.BoxGeometry(0.3, 0.8, 3.6), mat('#ffffff', { emissive: '#fff4d6' }), false).translateX(4.6).translateY(1.9));
    c.add(mesh(new THREE.BoxGeometry(0.3, 0.8, 3.6), mat('#c0262c', { emissive: '#c0262c' }), false).translateX(-4.6).translateY(1.9));
    g.add(c);
    const dir = i % 2 ? 1 : -1;
    cars.push({ o: c, x0: rng.next() * len, v: dir * (28 + rng.next() * 14) });
  }
  anim.push((clock) =>
    cars.forEach((c) => {
      const x = ((((c.x0 + c.v * clock) % len) + len) % len) - len / 2;
      c.o.position.set(x, 0, c.v > 0 ? -4 : 4);
      c.o.rotation.y = c.v > 0 ? 0 : Math.PI;
    }),
  );
  return g;
}

// Steam rising off a street vent, drifting with the wind
export function steam(anim: Anim) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: '#eef0f2', transparent: true, opacity: 0.45, depthWrite: false });
  const puffs: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + i * 0.5, 0), m);
    g.add(p);
    puffs.push(p);
  }
  anim.push((clock) =>
    puffs.forEach((p, i) => {
      const t = (clock * 0.35 + i / puffs.length) % 1;
      p.position.set(t * 9, t * 14, Math.sin(clock + i) * 0.6);
      p.scale.setScalar(0.6 + t * 1.6);
    }),
  );
  return g;
}

// Wrigley Field from the street: the red marquee over the corner gate, the brick and the ivy, light towers, and the
// rooftop bleachers across the street
export function wrigley() {
  const g = new THREE.Group();
  const brick = mat('#7f3a2c');
  const ivy = mat('#5a4a2c'); // November: the ivy's gone brown
  for (let i = 0; i < 16; i++) {
    const a = -0.7 + (i / 15) * 1.4;
    const seg = new THREE.Group();
    seg.add(mesh(new THREE.BoxGeometry(14, 14, 1.6), brick).translateY(7));
    seg.add(mesh(new THREE.BoxGeometry(14, 12, 0.3), ivy).translateY(6.5).translateZ(0.95));
    seg.position.set(Math.sin(a) * 120, 0, -Math.cos(a) * 120 + 120);
    seg.rotation.y = -a;
    g.add(seg);
  }
  for (let i = 0; i < 12; i++) {
    const a = -0.6 + (i / 11) * 1.2;
    const b = mesh(new THREE.BoxGeometry(18, 34, 26), mat('#365043'));
    b.position.set(Math.sin(a) * 138, 17, -Math.cos(a) * 138 + 108);
    b.rotation.y = -a;
    g.add(b);
  }
  // the hand-turned scoreboard
  g.add(mesh(new THREE.BoxGeometry(56, 24, 4), mat('#1f4d36')).translateY(48).translateZ(-28));
  const sb = board([{ text: 'CHICAGO CUBS', size: 56, color: '#f4f1e6', y: 64 }], 512, 128, '#1f4d36', 52, 12);
  sb.position.set(0, 52, -25.9);
  g.add(sb);
  // the marquee: red, white letters, on its posts by the corner gate (off to the left of the outfield)
  const mq = new THREE.Group();
  for (const x of [-9, 9]) mq.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 22, 6), mat('#4a4a4a', { metal: 0.5 })).translateX(x).translateY(11));
  mq.add(mesh(new THREE.BoxGeometry(26, 12, 2), mat('#b8202c')).translateY(26));
  const face = board(
    [
      { text: 'WRIGLEY FIELD', size: 64, color: '#ffffff', y: 52 },
      { text: 'HOME OF CHICAGO CUBS', size: 30, color: '#ffffff', y: 104, weight: 700 },
    ],
    512,
    160,
    '#b8202c',
    25,
    8,
    true,
  );
  face.position.set(0, 27, 1.05);
  mq.add(face);
  mq.position.set(-110, 0, 40);
  mq.rotation.y = 0.5;
  g.add(mq);
  for (const x of [-100, 100]) {
    g.add(mesh(new THREE.CylinderGeometry(1, 1.4, 80, 6), mat('#4a4a4a', { metal: 0.5 })).translateX(x).translateY(40).translateZ(-40));
    g.add(mesh(new THREE.BoxGeometry(18, 9, 2), mat('#e9e6d6', { emissive: '#fff4d0' })).translateX(x).translateY(82).translateZ(-40));
  }
  return g;
}

// A brownstone three-flat: brick, bay windows, a cornice, snow on the flat roof, rooftop bleachers if asked
export function threeFlat(w: number, d: number, seed: number, bleachers = false) {
  const g = new THREE.Group();
  const rng = makeRng(`flat:${seed}`);
  const bricks = ['#7a4a3a', '#8a5a44', '#6b3f32', '#9a6a52', '#5f4a40'];
  const h = 34 + Math.floor(rng.next() * 3) * 4;
  g.add(mesh(new THREE.BoxGeometry(w, h, d), mat(bricks[seed % bricks.length])).translateY(h / 2));
  g.add(mesh(new THREE.BoxGeometry(w + 1.4, 2, d + 1.4), mat('#c9bba0')).translateY(h));
  g.add(mesh(new THREE.BoxGeometry(w - 1, 0.8, d - 1), mat(SNOW), false).translateY(h + 1.2));
  for (let f = 0; f < 3; f++) for (let k = -1; k <= 1; k++) g.add(mesh(new THREE.BoxGeometry(3.4, 5, 0.3), mat(rng.next() < 0.3 ? '#ffd98f' : '#2a2f36', rng.next() < 0.3 ? { emissive: '#ffbf5a' } : {}), false).translateX((k * w) / 3.4).translateY(8 + f * 10).translateZ(d / 2 + 0.05));
  if (bleachers) {
    for (let r = 0; r < 5; r++) g.add(mesh(new THREE.BoxGeometry(w - 4, 1, 3), mat('#2f5d8a')).translateY(h + 3 + r * 2.2).translateZ(-d / 2 + 4 + r * 3));
    for (const x of [-w / 2 + 2, w / 2 - 2]) g.add(mesh(new THREE.BoxGeometry(0.6, 14, 0.6), mat('#3a3a3a')).translateX(x).translateY(h + 7).translateZ(-d / 2 + 2));
  }
  return g;
}

// The Navy Pier wheel: a ring of gondolas on spokes, turning slowly, on its A-frame legs
export function ferrisWheel(anim: Anim) {
  const g = new THREE.Group();
  const white = mat('#e8ebee', { metal: 0.4, rough: 0.4 });
  const R = 42;
  for (const z of [-4, 4]) for (const s of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(1, 1.5, R + 12, 6), white);
    leg.position.set(s * 12, (R + 6) / 2, z);
    leg.rotation.z = s * 0.28;
    g.add(leg);
  }
  const wheel = new THREE.Group();
  wheel.position.y = R + 8;
  for (const z of [-3, 3]) wheel.add(mesh(new THREE.TorusGeometry(R, 0.8, 6, 48), white).translateZ(z));
  const cabs: THREE.Object3D[] = [];
  const colors = ['#d23b3b', '#2b6cd4', '#f2b134', '#2fa36b'];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const spoke = mesh(new THREE.CylinderGeometry(0.25, 0.25, R, 4), white, false);
    spoke.position.set(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const cab = mesh(new THREE.BoxGeometry(4, 4, 4), mat(colors[i % 4], { emissive: colors[i % 4] }));
    wheel.add(cab);
    cabs.push(cab);
  }
  g.add(wheel);
  anim.push((clock) => {
    const r = clock * 0.06;
    cabs.forEach((c, i) => {
      const a = (i / cabs.length) * Math.PI * 2 + r;
      c.position.set(Math.cos(a) * R, Math.sin(a) * R - 2.5, 0);
    });
  });
  return g;
}

// A green street sign on a pole
export function streetSign(text: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 12, 5), mat('#5a5a5a')).translateY(6));
  const s = board([{ text, size: 52, color: '#ffffff', y: 40 }], 512, 80, '#1d5a3a', 9, 1.4);
  s.position.set(0, 11.6, 0.1);
  g.add(s);
  return g;
}

// A building in play: hidden walls on its four sides, a roof that loses a ball, and the decor that draws it
export function building(x: number, y: number, w: number, d: number, hgt: number, seed: number, kind = 'tower'): { walls: Wall[]; roof: Roof; decor: Decor } {
  const c: V2[] = [
    { x: x - w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y + d / 2 },
    { x: x - w / 2, y: y + d / 2 },
  ];
  return {
    walls: c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: hgt, look: 'hidden' as const })),
    roof: { poly: c, h: hgt - 0.5, top: hgt + 40 },
    decor: { kind, x, y, size: [w, d, hgt], scale: seed },
  };
}

// The skyline: the city's towers packed beyond the grounds, all on the land side of the shore, and Lake Michigan out to
// the horizon on the other. The shore comes from the hole (decor 'lake': a point on the shoreline, rot the way the
// lake lies, 0 = up the hole, scale the height of the land there); a hole without one is all city.
function skyline(h: Hole, root: THREE.Group, floor: number, shore: Decor | undefined) {
  const rng = makeRng(`chicago:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const dir = shore ? { x: Math.sin(shore.rot ?? 0), y: Math.cos(shore.rot ?? 0) } : null;
  const wet = (x: number, y: number, margin: number) => !!(shore && dir && (x - shore.x) * dir.x + (y - shore.y) * dir.y > -margin);
  for (let ring = 0; ring < 3; ring++)
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2 + rng.next() * 0.08;
      const rx = (x1 - x0) / 2 + 110 + ring * 150 + rng.next() * 60;
      const ry = (y1 - y0) / 2 + 110 + ring * 150 + rng.next() * 60;
      const x = cx + Math.cos(a) * rx;
      const y = cy + Math.sin(a) * ry;
      if (wet(x, y, 60)) continue;
      // lower close in, so the landmarks stand up over the rest
      const hgt = [70, 150, 230][ring] + rng.next() * [90, 150, 260][ring];
      const t = tower(46 + rng.next() * 44, 46 + rng.next() * 44, hgt, i + ring * 40);
      t.position.set(x, (shore?.scale ?? floor) - 1.5, -y);
      root.add(t);
    }
  if (!shore || !dir) return;
  const sea = h.water.find((w) => w.look === 'sea');
  const level = sea ? sea.level : floor + 0.3;
  // the lake: a sheet to the horizon at the water's level
  const lake = new THREE.Mesh(new THREE.CircleGeometry(4200, 48), new THREE.MeshStandardMaterial({ color: '#5b7584', roughness: 0.2, metalness: 0.15 }));
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(cx, level - 0.05, -cy);
  root.add(lake);
  // the land: a slab on the city side of the shoreline, at the land's height, under the course's own ground
  const land = mesh(new THREE.BoxGeometry(9000, 4, 9000), mat('#9a9c98'), false);
  const top = shore.scale ?? level + 0.6;
  land.position.set(shore.x - dir.x * 4500, top - 3.6, -(shore.y - dir.y * 4500));
  land.rotation.y = -(shore.rot ?? 0);
  root.add(land);
}

export const chicago: Kit = {
  surface: { green: '#4c9a4a', fairway: '#5e9444', fringe: '#578a40', rough: '#9ea296', sand: '#d8d0bc', path: '#8e8f8c', stone: '#a3a39f', wood: '#7a6a58' },
  floor: '#9a9c98',
  lake: '#556e60', // the river, green-grey
  sea: '#5b7584', // Lake Michigan in November
  light: { sky: '#b9c0c7', ground: '#5e605c', hemi: 1.0, sunColor: '#eef0f3', sun: 1.7, fog: '#bcc3c9', near: 620, far: 2400, env: 0.6 },
  skyColors: ['#68727d', '#98a1aa', '#c9ced2'],
  sun: { color: '#eef0f2', at: [-900, 420, 1100], size: 40, glow: '#d9dde2' },
  clouds: true,
  snow: true,
  rail: true,
  post(_h, p) {
    if (p.look === 'streetlight') {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 16, 6), mat('#2b2b2b', { metal: 0.5 })).translateY(8));
      g.add(mesh(new THREE.BoxGeometry(4, 0.3, 0.3), mat('#2b2b2b')).translateX(2).translateY(16));
      g.add(mesh(new THREE.BoxGeometry(1.4, 0.6, 0.8), mat('#f4e9c8', { emissive: '#ffe9b0' })).translateX(3.8).translateY(15.7));
      g.userData.solid = true;
      return g;
    }
    if (p.look === 'tower' && p.h < 20) {
      // the bean's footprint (a post so the ball can hit it): drawn by its decor
      const g = new THREE.Group();
      g.userData.solid = true;
      return g;
    }
    return null;
  },
  decor(h, d, anim) {
    let o: THREE.Object3D | null = null;
    if (d.kind === 'tower' && d.size) o = tower(d.size[0], d.size[1], d.size[2], d.scale ?? 0);
    else if (d.kind === 'flat' && d.size) o = threeFlat(d.size[0], d.size[1], d.scale ?? 0);
    else if (d.kind === 'rooftop' && d.size) o = threeFlat(d.size[0], d.size[1], d.scale ?? 0, true);
    else if (d.kind === 'willis') o = willis();
    else if (d.kind === 'hancock') o = hancock();
    else if (d.kind === 'aon') o = aon();
    else if (d.kind === 'marina') o = marinaCity();
    else if (d.kind === 'bean') o = bean();
    else if (d.kind === 'pritzker') o = pritzker();
    else if (d.kind === 'bascule') o = bascule(d.scale ?? 60);
    else if (d.kind === 'el') o = el(d.scale ?? 300, anim, d.label === 'red' ? 'red' : 'brown');
    else if (d.kind === 'walkers') o = walkers(d.scale ?? 80, d.size?.[0] ?? 6, Math.round(d.x + d.y), anim);
    else if (d.kind === 'traffic') o = traffic(d.scale ?? 400, d.size?.[0] ?? 10, Math.round(d.x + d.y), anim);
    else if (d.kind === 'steam') o = steam(anim);
    else if (d.kind === 'wrigley') o = wrigley();
    else if (d.kind === 'ferris') o = ferrisWheel(anim);
    else if (d.kind === 'lake') o = new THREE.Group(); // the shoreline: the frame reads it
    else if (d.kind === 'streetsign') o = streetSign(d.label ?? 'LAKE SHORE DR');
    else if (d.kind === 'banner') {
      // a big sign on a frame: the course's own welcome
      o = new THREE.Group();
      for (const x of [-12, 12]) o.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 5), mat('#3a3a3a')).translateX(x).translateY(7));
      const b = board([{ text: d.label ?? 'CHICAGO', size: 72, color: '#ffffff', y: 64 }], 512, 128, '#1f3f7a', 26, 6.5);
      b.position.y = 12;
      o.add(b);
    }
    if (o && (d.kind === 'tower' || d.kind === 'flat' || d.kind === 'rooftop')) o.userData.solid = true;
    void h;
    return o;
  },
  frame(h: Hole, root, _anim, floor) {
    skyline(h, root, floor, h.decor.find((d) => d.kind === 'lake'));
    void heightAt;
  },
};
