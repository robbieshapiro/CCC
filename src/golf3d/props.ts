// Low-poly props for the club grounds. Everything is built from primitives, so there are no assets to load.
// World axes: three.js x = hole x, three.js y = height, three.js z = -hole y.
import * as THREE from 'three';

export const P = {
  hedge: '#2f5a2c',
  hedgeTop: '#3b6c35',
  stone: '#d9d0bd',
  wood: '#8a5a35',
  white: '#f4efe4',
  cream: '#f3ecdc',
  green: '#163b2c',
  gold: '#b8955a',
  pine: '#25472f',
  pineLight: '#2f5838',
  trunk: '#5b3b26',
  iron: '#2a2a2a',
};

const mats = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string } = {}) {
  const key = `${color}|${opts.rough ?? 0.9}|${opts.metal ?? 0}|${opts.emissive ?? ''}`;
  let m = mats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, flatShading: true });
    if (opts.emissive) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = 1;
    }
    mats.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, shadow = true) {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

export function pine(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.45, 0.6, 6, 6), mat(P.trunk)).translateY(3));
  const tiers = [
    [5.2, 8, 6],
    [4.2, 7, 10.5],
    [3, 6, 14.5],
    [1.8, 4.5, 18],
  ];
  tiers.forEach(([r, h, y], i) => g.add(mesh(new THREE.ConeGeometry(r, h, 12), mat(i % 2 ? P.pineLight : P.pine)).translateY(y)));
  g.scale.setScalar(scale);
  return g;
}

export function leafyTree(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.7, 8, 6), mat(P.trunk)).translateY(4));
  const leaf = mat('#3f7a3a');
  const leaf2 = mat('#4c8a43');
  for (const [x, y, z, r] of [
    [0, 11, 0, 5],
    [2.6, 9.5, 1, 3.6],
    [-2.4, 10, -1.2, 3.8],
    [0.6, 13.5, -1, 3.4],
  ])
    g.add(mesh(new THREE.IcosahedronGeometry(r, 0), r > 4 ? leaf : leaf2).translateX(x).translateY(y).translateZ(z));
  g.scale.setScalar(scale);
  return g;
}

export function azaleaBush(color: string) {
  const g = new THREE.Group();
  const leaf = mat('#3d6b34');
  const bloom = mat(color, { rough: 0.8 });
  g.add(mesh(new THREE.IcosahedronGeometry(2.4, 0), leaf).translateY(1.2));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.25, 0), bloom).translateX(Math.cos(a) * 1.7).translateY(1.6 + (i % 2) * 0.9).translateZ(Math.sin(a) * 1.7));
  }
  g.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), bloom).translateY(3.1));
  return g;
}

export function bench() {
  const g = new THREE.Group();
  const w = mat(P.wood);
  const iron = mat(P.iron, { rough: 0.5, metal: 0.4 });
  g.add(mesh(new THREE.BoxGeometry(5, 0.25, 1.4), w).translateY(1.5));
  g.add(mesh(new THREE.BoxGeometry(5, 1.2, 0.2), w).translateY(2.4).translateZ(0.7));
  for (const x of [-2.2, 2.2]) g.add(mesh(new THREE.BoxGeometry(0.2, 1.5, 1.4), iron).translateX(x).translateY(0.75));
  return g;
}

export function lamp() {
  const g = new THREE.Group();
  const iron = mat(P.iron, { rough: 0.5, metal: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.25, 9, 6), iron).translateY(4.5));
  g.add(mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), mat('#fff2c4', { emissive: '#d8b25a' })).translateY(9.4));
  g.add(mesh(new THREE.ConeGeometry(0.8, 0.6, 4), iron).translateY(10.3).rotateY(Math.PI / 4));
  return g;
}

export function umbrella() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.15, 14), mat(P.white)).translateY(2.6));
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 7, 5), mat(P.iron)).translateY(3.5));
  const canopy = new THREE.ConeGeometry(4.2, 1.6, 10, 1, true);
  const colors: number[] = [];
  const pos = canopy.attributes.position;
  const a = new THREE.Color(P.green);
  const b = new THREE.Color(P.cream);
  for (let i = 0; i < pos.count; i++) {
    const ang = Math.atan2(pos.getZ(i), pos.getX(i));
    const c = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 10) % 2 ? a : b;
    colors.push(c.r, c.g, c.b);
  }
  canopy.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, flatShading: true });
  g.add(mesh(canopy, cm).translateY(7));
  for (const [x, z] of [
    [2.4, 0],
    [-2.4, 0],
    [0, 2.4],
  ])
    g.add(mesh(new THREE.BoxGeometry(1, 1.8, 1), mat(P.white)).translateX(x).translateY(0.9).translateZ(z));
  return g;
}

export function textTexture(lines: { text: string; font: string; color: string; y: number }[], w = 256, h = 128, bg = P.green) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.strokeStyle = P.gold;
  x.lineWidth = 4;
  x.strokeRect(6, 6, w - 12, h - 12);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  for (const l of lines) {
    x.font = l.font;
    x.fillStyle = l.color;
    x.fillText(l.text, w / 2, l.y);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function sign(title: string, sub: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 5), mat(P.wood)).translateY(2).translateX(-1.6));
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 5), mat(P.wood)).translateY(2).translateX(1.6));
  const tex = textTexture([
    { text: title, font: '600 34px Georgia, serif', color: P.cream, y: 52 },
    { text: sub, font: '700 18px Manrope, Arial, sans-serif', color: P.gold, y: 92 },
  ]);
  const face = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.2, 0.2), [mat(P.wood), mat(P.wood), mat(P.wood), mat(P.wood), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }), mat(P.wood)]);
  face.castShadow = true;
  face.position.y = 4;
  g.add(face);
  return g;
}

export function flagpole() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.2, 0.3, 28, 6), mat(P.white, { rough: 0.4 })).translateY(14));
  g.add(mesh(new THREE.SphereGeometry(0.45, 8, 6), mat(P.gold, { rough: 0.3, metal: 0.8 })).translateY(28.3));
  const tex = textTexture([{ text: 'CCC', font: '600 64px Georgia, serif', color: P.gold, y: 66 }]);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6, 12, 4), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  cloth.geometry.translate(3.5, 0, 0);
  cloth.position.set(0.2, 25.6, 0);
  cloth.name = 'cloth';
  g.add(cloth);
  return g;
}

export function fountain() {
  const g = new THREE.Group();
  const stone = mat(P.stone);
  g.add(mesh(new THREE.CylinderGeometry(5.5, 6, 1.4, 20), stone).translateY(0.4));
  g.add(mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.3, 20), mat('#5f8f98', { rough: 0.2 })).translateY(1.1));
  g.add(mesh(new THREE.CylinderGeometry(0.7, 1, 5, 10), stone).translateY(3));
  g.add(mesh(new THREE.CylinderGeometry(2.6, 1.2, 0.9, 16), stone).translateY(5.6));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 8), stone).translateY(7));
  g.add(mesh(new THREE.SphereGeometry(0.6, 10, 8), mat(P.gold, { rough: 0.3, metal: 0.7 })).translateY(8.4));
  return g;
}

export function swan() {
  const g = new THREE.Group();
  const white = mat('#fbfaf6', { rough: 0.7 });
  const body = mesh(new THREE.SphereGeometry(1.3, 12, 8), white);
  body.scale.set(1, 0.6, 1.6);
  body.position.y = 0.5;
  g.add(body);
  const tail = mesh(new THREE.ConeGeometry(0.6, 1.4, 6), white);
  tail.rotation.x = -Math.PI / 2.6;
  tail.position.set(0, 0.9, 1.9);
  g.add(tail);
  const neck = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.8, -1.2), new THREE.Vector3(0, 2.2, -1.6), new THREE.Vector3(0, 3.1, -1.2), new THREE.Vector3(0, 3.1, -1.9)]), 12, 0.22, 6);
  g.add(mesh(neck, white));
  g.add(mesh(new THREE.ConeGeometry(0.16, 0.6, 5), mat('#e0742c')).rotateX(-Math.PI / 2).translateY(2.4).translateZ(3.05));
  return g;
}

export function cart() {
  const g = new THREE.Group();
  const body = mat('#f4f1ea', { rough: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(4.6, 1.6, 7.6), body).translateY(1.6));
  g.add(mesh(new THREE.BoxGeometry(4.4, 1.4, 2.4), mat(P.green)).translateY(2.9).translateZ(0.8));
  for (const [x, z] of [
    [-2.1, -3.4],
    [2.1, -3.4],
    [-2.1, 1.6],
    [2.1, 1.6],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.6, 4), mat(P.iron)).translateX(x).translateY(4.2).translateZ(z));
  g.add(mesh(new THREE.BoxGeometry(5, 0.25, 6), mat(P.green)).translateY(6).translateZ(-0.9));
  for (const [x, z] of [
    [-2.3, -2.6],
    [2.3, -2.6],
    [-2.3, 2.6],
    [2.3, 2.6],
  ]) {
    const w = mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 10), mat('#1d1d1d'));
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.75, z);
    g.add(w);
  }
  // golf bags on the back
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.6, 8), mat('#7a2e2e')).translateY(3.2).translateZ(3.4).rotateX(0.3));
  return g;
}

export function sprinklerHead() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.5, 8), mat(P.gold, { rough: 0.3, metal: 0.8 })).translateY(0.25));
  return g;
}

export function clubhouse(length: number) {
  const g = new THREE.Group();
  const wall = mat(P.cream);
  const trim = mat(P.white);
  const roof = mat('#2b4a3a');
  const depth = 46;
  const h = 26;
  g.add(mesh(new THREE.BoxGeometry(depth, h, length), wall).translateY(h / 2));
  const roofGeo = new THREE.CylinderGeometry(depth * 0.62, depth * 0.62, length + 4, 3, 1);
  const r = mesh(roofGeo, roof);
  r.rotation.x = Math.PI / 2;
  r.rotation.y = Math.PI / 2;
  r.scale.set(1, 1, 0.42);
  r.position.y = h + 6;
  g.add(r);
  // windows, shutters and a cupola
  const win = mat('#33463d', { rough: 0.3 });
  for (let z = -length / 2 + 12; z < length / 2 - 6; z += 14)
    for (const y of [8, 18]) {
      g.add(mesh(new THREE.BoxGeometry(0.4, 5, 3.6), win, false).translateX(-depth / 2 - 0.1).translateY(y).translateZ(z));
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.5, 4.4), trim, false).translateX(-depth / 2 - 0.2).translateY(y + 2.8).translateZ(z));
    }
  g.add(mesh(new THREE.BoxGeometry(8, 7, 8), trim).translateY(h + 13));
  g.add(mesh(new THREE.ConeGeometry(6.4, 5, 4), roof).translateY(h + 19).rotateY(Math.PI / 4));
  g.add(mesh(new THREE.BoxGeometry(1, 12, 1), mat(P.cream)).translateY(h + 2).translateX(10).translateZ(length / 3));
  return g;
}

// soft cloud: a few flattened blobs
export function cloud() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + Math.random() * 8, 1), m);
    s.position.set(i * 14 - 28, Math.random() * 4, Math.random() * 10 - 5);
    s.scale.y = 0.5;
    g.add(s);
  }
  return g;
}

export function bird() {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: '#2a2a2a', side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -0.4), new THREE.Vector3(1.6, 0, 0), new THREE.Vector3(0, 0, 0.4)]);
  const l = new THREE.Mesh(wing, m);
  const r = new THREE.Mesh(wing, m);
  r.scale.x = -1;
  l.name = 'l';
  r.name = 'r';
  g.add(l, r);
  return g;
}

// A broad, rounded oak: smooth canopy clumps in two greens.
export function oak(scale = 1) {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#4e3826', roughness: 1 });
  g.add(mesh(new THREE.CylinderGeometry(0.9, 1.4, 12, 8), bark).translateY(6));
  for (const [x, z, r] of [
    [3, 1, 2.2],
    [-3, -1, 2],
  ]) {
    const branch = mesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 6), bark);
    branch.position.set(x * 0.6, 12, z * 0.6);
    branch.rotation.z = -x * 0.15;
    g.add(branch);
    void r;
  }
  const leaves = [new THREE.MeshStandardMaterial({ color: '#3b6e32', roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: '#4d8540', roughness: 0.9 })];
  for (const [x, y, z, r, k] of [
    [0, 18, 0, 8, 0],
    [5, 16, 2, 6, 1],
    [-5.5, 16.5, -1, 6.2, 1],
    [1, 21, -3, 5.5, 1],
    [-2, 15, 5, 5, 0],
    [3, 15, -5, 5, 0],
  ]) {
    const c = mesh(new THREE.IcosahedronGeometry(r, 2), leaves[k]);
    c.position.set(x, y, z);
    c.scale.y = 0.8;
    g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
}

// A tall Italian cypress.
export function cypress(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), new THREE.MeshStandardMaterial({ color: '#4e3826', roughness: 1 })).translateY(1.5));
  const f = mesh(new THREE.SphereGeometry(2.6, 14, 12), new THREE.MeshStandardMaterial({ color: '#2a4f2c', roughness: 0.95 }));
  f.scale.set(1, 4.4, 1);
  f.position.y = 13;
  g.add(f);
  g.scale.setScalar(scale);
  return g;
}

// Brass-capped tee marker.
export function teeMarker() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.SphereGeometry(0.45, 14, 10), new THREE.MeshStandardMaterial({ color: '#b8955a', roughness: 0.3, metalness: 0.7 })).translateY(0.35));
  return g;
}

// a lichen-grey boulder, squashed and turned so no two look alike
export function rock(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const r = mesh(new THREE.DodecahedronGeometry(1, 0), mat(seed % 2 ? '#8d8a80' : '#7c7a72'));
  r.scale.set(1.3, 0.8 + (seed % 3) * 0.12, 1);
  r.rotation.set(seed * 0.7, seed * 1.3, seed * 0.4);
  r.position.y = 0.4;
  g.add(r);
  g.scale.setScalar(scale);
  return g;
}

// a far-off peak for the skyline: hazy blue rock with a snow cap, outside the fog
export function mountain(height: number, radius: number, seed = 0) {
  const g = new THREE.Group();
  const haze = (c: string) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const body = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7 + (seed % 3), 1), haze(seed % 2 ? '#8ea3b3' : '#99adbb'));
  body.position.y = height / 2;
  body.rotation.y = seed;
  g.add(body);
  const capH = height * 0.28;
  const cap = new THREE.Mesh(new THREE.ConeGeometry((radius * capH) / height + 1, capH, 7 + (seed % 3), 1), haze('#eef2f5'));
  cap.position.y = height - capH / 2 + 0.5;
  cap.rotation.y = seed;
  g.add(cap);
  return g;
}

// A coconut palm: a curved, ringed trunk and a crown of drooping fronds.
export function palm(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const bark = mat('#7a5f43');
  const lean = 0.18 + (seed % 3) * 0.06;
  let top = new THREE.Vector3();
  for (let i = 0; i < 7; i++) {
    const seg = mesh(new THREE.CylinderGeometry(0.42 - i * 0.03, 0.5 - i * 0.03, 3.1, 7), i % 2 ? bark : mat('#6b5239'));
    const k = i / 6;
    seg.position.set(Math.sin(k * 1.2) * lean * 14, 1.5 + i * 2.9, 0);
    seg.rotation.z = -Math.cos(k * 1.2) * lean;
    g.add(seg);
    top = seg.position.clone().add(new THREE.Vector3(0, 1.6, 0));
  }
  const frond = new THREE.BufferGeometry();
  // a long leaf that droops: a strip from the crown out and down
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const t0 = i / 6;
    const t1 = (i + 1) / 6;
    const y = (t: number) => Math.sin(t * Math.PI * 0.9) * 2.2 - t * t * 3;
    const w = (t: number) => Math.sin(t * Math.PI) * 1.3 + 0.1;
    pts.push(t0 * 9, y(t0), -w(t0), t1 * 9, y(t1), -w(t1), t1 * 9, y(t1), w(t1), t0 * 9, y(t0), -w(t0), t1 * 9, y(t1), w(t1), t0 * 9, y(t0), w(t0));
  }
  frond.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  frond.computeVertexNormals();
  const leafs = [mat('#3f7d36'), mat('#4f9141')];
  for (let i = 0; i < 9; i++) {
    const f = new THREE.Mesh(frond, leafs[i % 2]);
    (f.material as THREE.Material).side = THREE.DoubleSide;
    f.castShadow = true;
    f.position.copy(top);
    f.rotation.set(0, (i / 9) * Math.PI * 2 + seed, -0.15 + (i % 3) * 0.12);
    g.add(f);
  }
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.45, 6, 5), mat('#5a4126')).translateX(top.x + Math.cos(i * 2.1) * 0.6).translateY(top.y - 0.6).translateZ(Math.sin(i * 2.1) * 0.6));
  g.scale.setScalar(scale);
  return g;
}

// The volcano on the skyline: a dark cone with a broken top, hazy, outside the fog. The plume is animated by the scene.
export function volcano(height: number, radius: number) {
  const g = new THREE.Group();
  const haze = (c: string) => new THREE.MeshBasicMaterial({ color: c, fog: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius, height, 11, 1), haze('#8a8d99'));
  body.position.y = height / 2;
  g.add(body);
  const shoulder = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.25, height * 0.45, 9, 1), haze('#959aa5'));
  shoulder.position.set(radius * 0.4, height * 0.22, radius * 0.1);
  g.add(shoulder);
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.15, radius * 0.15, 4, 11), haze('#ff7a2e'));
  glow.position.y = height + 1;
  g.add(glow);
  return g;
}

// A sea stack: a column of rock standing in the sea, for the skyline.
export function seaStack(height: number, seed = 0) {
  const g = new THREE.Group();
  const haze = new THREE.MeshBasicMaterial({ color: seed % 2 ? '#6f7377' : '#7c8084', fog: false });
  const s = new THREE.Mesh(new THREE.CylinderGeometry(height * 0.18, height * 0.3, height, 6 + (seed % 3)), haze);
  s.position.y = height / 2 - 4;
  s.rotation.y = seed;
  g.add(s);
  return g;
}
