// The cart crew (Daisy and the others), drawn differently from the members: smooth, realistic proportions instead of the club's toy golfers.
// About 5'7" in a fitted club tank or a tailored polo and a tennis skort, glossy hair worn her own way, a made-up
// face (liner with a little wing, glossy lips, a touch of blush), gold hoops and a watch, and her own way of moving:
// weight on one hip, a hand resting on it, a turn of the head, a hair flip, a wink, a laugh that tips her head back.
// Faces +z like the golfers; units are feet.
import * as THREE from 'three';

export type HostessPose = 'idle' | 'wave' | 'laugh' | 'walk' | 'flip' | 'wink';

// The cart crew: a few attendants, each with their own look. Who comes out to the tee is a matter of luck.
// style: long glossy waves, a high ponytail, or sleek and straight. cut: the fitted tank or the tailored polo.
// extra: a visor, aviators pushed up on her head, or nothing.
export type Look = {
  name: string;
  skin: string;
  top: string;
  skort: string;
  hair: string;
  hairLight: string;
  eyes: string;
  lips: string;
  style: 'waves' | 'pony' | 'sleek';
  cut: 'tank' | 'polo';
  extra: 'visor' | 'shades' | 'none';
};
export const CREW: Look[] = [
  { name: 'Daisy', skin: '#e8bf9c', top: '#f4efe3', skort: '#163b2c', hair: '#4b2f1d', hairLight: '#7a5030', eyes: '#6b7a3e', lips: '#b8505c', style: 'waves', cut: 'tank', extra: 'shades' },
  { name: 'Jules', skin: '#c68e62', top: '#1f2d4a', skort: '#f6f3ec', hair: '#1e1611', hairLight: '#3a2a1e', eyes: '#4a2f1e', lips: '#9c3a4e', style: 'pony', cut: 'polo', extra: 'visor' },
  { name: 'Sam', skin: '#f2d2b8', top: '#7a1f2b', skort: '#e9e2d0', hair: '#c9a66b', hairLight: '#ead09a', eyes: '#3f6f8f', lips: '#c4566a', style: 'waves', cut: 'tank', extra: 'shades' },
  { name: 'Priya', skin: '#a8704a', top: '#2f6f5a', skort: '#f6f3ec', hair: '#1a1210', hairLight: '#3a2a20', eyes: '#3b2416', lips: '#8e3a3e', style: 'sleek', cut: 'polo', extra: 'none' },
  { name: 'Lucia', skin: '#d9a77e', top: '#b8955a', skort: '#1f2d4a', hair: '#7b3a1f', hairLight: '#b0643a', eyes: '#5a3a22', lips: '#b04a48', style: 'pony', cut: 'tank', extra: 'visor' },
];

const smooth = (color: string, rough = 0.6, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function part(geo: THREE.BufferGeometry, mat: THREE.Material) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  return o;
}

// a solid of revolution from (radius, height) pairs
const lathe = (pts: [number, number][], segs = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

// The bust, shaped into the front of the torso (and of the top over it): the surface eases forward in two soft
// rounds, so the fabric curves over it rather than meeting it at an edge
function bust(geo: THREE.BufferGeometry) {
  geo.rotateY(Math.PI); // the lathe's seam goes down her back, not her front
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z <= 0) continue;
    const lift = [-1, 1].reduce((a, side) => a + Math.exp(-(((x - 0.145 * side) / 0.135) ** 2 + ((y - 0.84) / 0.125) ** 2)), 0);
    pos.setZ(i, z + 0.14 * Math.min(1, lift) * (z / Math.hypot(x, z)));
  }
  geo.computeVertexNormals();
  return geo;
}

// Long hair worn down, as one sheet: rows from the crown to the ends, each an arc round the back of the head that
// opens at the face. Up top it follows the skull; below the nape it lies on her back, behind the shoulders, and the
// ends finish uneven. Waves ripple it; fine grooves read as strands. top: the part above the nape (it stays with the
// head), or the length below it (it swings).
function hairSheet(wavy: boolean, top: boolean, mat: THREE.Material) {
  // (radius, height) down the profile, in head space
  const prof: [number, number][] = [[0.1, 0.72], [0.24, 0.68], [0.33, 0.58], [0.365, 0.44], [0.37, 0.3], [0.36, 0.16], [0.35, 0.04], [0.37, -0.12], [0.41, -0.32], [0.42, -0.55], [0.41, -0.8], [0.38, -1.02]];
  const rows = top ? prof.filter(([, y]) => y >= 0.04) : prof.filter(([, y]) => y <= 0.16); // they overlap a row, so a swing never opens a gap
  const cols = 48;
  const pos: number[] = [];
  const idx: number[] = [];
  rows.forEach(([r0, y0], j) => {
    const low = Math.max(0, Math.min(1, (0.1 - y0) / 0.4)); // 0 at the head, 1 down her back
    const open = Math.PI * (0.64 - 0.14 * low); // how far round toward the face the row reaches
    for (let i = 0; i <= cols; i++) {
      const th = -open + (2 * open * i) / cols;
      const ripple = wavy ? 0.03 * Math.sin(y0 * 13 + th * 1.5) * low : 0;
      const r = r0 + ripple + 0.006 * Math.sin(th * 34);
      const last = j === rows.length - 1 && !top;
      const y = y0 - (last ? (wavy ? 0.12 : 0.06) * Math.abs(Math.sin(th * 5)) : 0);
      pos.push(r * Math.sin(th) * 0.92, y, -r * Math.cos(th) * (1 - 0.4 * low) - 0.14 * low - 0.03);
    }
  });
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = part(geo, mat);
  m.material = (mat as THREE.MeshStandardMaterial).clone();
  (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  return m;
}

// A front section of long hair: a curved ribbon from under the hair at the crown, past the temple, down over the front of the shoulder to the chest,
// narrowing to its ends
function frontLock(side: number, wavy: boolean, mat: THREE.Material) {
  const rows = 14;
  const cols = 8;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const y = 0.5 - t * 1.12;
    // out round the jaw, then forward over the shoulder (its top is about y -0.44 here)
    const cx = (0.22 + 0.15 * Math.sin(Math.min(1, t * 2) * Math.PI * 0.5) + (wavy ? 0.025 * Math.sin(t * 9) : 0)) * side;
    const cz = -0.05 + 0.27 * Math.min(1, Math.max(0, t - 0.15) * 1.5); // tucked under the hair at the top
    const w = 0.12 * (1 - 0.5 * t);
    for (let i = 0; i <= cols; i++) {
      const u = i / cols - 0.5;
      pos.push(cx + u * w * 2 * side, y - (j === rows ? 0.05 * Math.abs(Math.sin(u * 9)) : 0), cz + 0.04 * (0.25 - u * u) + 0.004 * Math.sin(i * 3.1));
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = part(geo, (mat as THREE.MeshStandardMaterial).clone());
  (m.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  return m;
}

// a strand of hair: a tube along a curve that thins toward the end
function strand(points: [number, number, number][], r: number, mat: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geo = new THREE.TubeGeometry(curve, 24, r, 8, false);
  // taper: squeeze each ring toward the curve as it goes
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const rings = 25;
  const per = pos.count / rings;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < rings; i++) {
    const k = 1 - (i / (rings - 1)) * 0.75;
    curve.getPoint(i / (rings - 1), c);
    for (let j = 0; j < per; j++) {
      const idx = i * per + j;
      v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  geo.computeVertexNormals();
  return part(geo, mat);
}

export class Hostess {
  readonly group = new THREE.Group();
  private body = new THREE.Group(); // pivots at the hips
  private chest = new THREE.Group();
  private head = new THREE.Group();
  private hair = new THREE.Group();
  private pony = new THREE.Group(); // the ponytail, or the length down her back: it swings
  private eyes: THREE.Group[] = []; // [her right, her left]: they blink, and the left one winks
  private arms: { shoulder: THREE.Group; elbow: THREE.Group; side: number }[] = [];
  private legs: THREE.Group[] = [];
  private pose: HostessPose = 'idle';
  private t = 0;
  private poseT = 0; // seconds in the current pose: the flip and the wink play once, then settle
  private cur = { sway: 0, lean: 0, headX: 0, headY: 0, headZ: 0, bounce: 0, rA: [0, 0, 0, 0], lA: [0, 0, 0, 0] };

  constructor(look: Look = CREW[0]) {
    // skin with a little of its own glow, so the face reads soft rather than shadowed under the jaw
    const skin = smooth(look.skin, 0.68, { emissive: look.skin, emissiveIntensity: 0.16 });
    const shirt = smooth(look.top, 0.7);
    const white = smooth('#f6f3ec', 0.6);
    // glossy hair: a lower roughness catches the light
    const hairMat = smooth(look.hair, 0.3);
    const hairLight = smooth(look.hairLight, 0.3);
    const gold = smooth('#d4af37', 0.25, { metalness: 0.9 });
    const dark = smooth('#1b1714', 0.3);

    this.group.add(this.body);
    this.body.position.y = 2.95;

    // legs, hanging from the hip joints
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.19 * side, 2.95, 0);
      const leg = part(lathe([[0.001, -2.68], [0.08, -2.66], [0.095, -2.42], [0.14, -2.02], [0.11, -1.52], [0.125, -1.38], [0.17, -0.9], [0.205, -0.3], [0.2, 0.05], [0.001, 0.08]], 24), skin);
      hip.add(leg);
      const shoe = part(new THREE.CapsuleGeometry(0.1, 0.3, 4, 12), white);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1, 1, 0.8);
      shoe.position.set(0, -2.8, 0.1);
      hip.add(shoe);
      this.group.add(hip);
      this.legs.push(hip);
    }

    // skort, belt and the top: in at the waist, out at the hip
    const skort = part(lathe([[0.37, 0.36], [0.46, 0.12], [0.52, -0.12], [0.56, -0.42], [0.55, -0.44]]), smooth(look.skort, 0.6, { side: THREE.DoubleSide }));
    skort.scale.z = 0.78;
    this.body.add(skort);
    const belt = part(new THREE.TorusGeometry(0.375, 0.03, 8, 32), smooth('#2a1d14', 0.4));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.36;
    belt.scale.y = 0.78;
    this.body.add(belt);
    this.body.add(part(new THREE.BoxGeometry(0.1, 0.07, 0.04), gold).translateY(0.36).translateZ(0.3));
    this.body.add(this.chest);
    this.chest.position.y = 0.3;
    const profile: [number, number][] = [[0.37, 0], [0.32, 0.18], [0.3, 0.34], [0.34, 0.55], [0.38, 0.72], [0.42, 0.86], [0.4, 0.98], [0.41, 1.15], [0.35, 1.3], [0.2, 1.42], [0.001, 1.46]];
    const torso = part(bust(lathe([[0.001, -0.02], ...profile], 48)), skin);
    torso.scale.set(1, 1, 0.66);
    this.chest.add(torso);

    if (look.cut === 'polo') {
      // the tailored polo: up to the collar, a short placket, the collar points, and short fitted sleeves (on the arms)
      const polo = part(bust(lathe([[0.001, -0.02], ...profile.filter(([, y]) => y < 1.36), [0.3, 1.36], [0.14, 1.42], [0.11, 1.43]], 48)), shirt);
      polo.scale.set(1.03, 1, 0.68);
      this.chest.add(polo);
      const collar = part(new THREE.TorusGeometry(0.135, 0.035, 8, 24), shirt);
      collar.rotation.x = Math.PI / 2 - 0.25;
      collar.scale.set(1.1, 1, 1);
      collar.position.set(0, 1.4, 0.02);
      this.chest.add(collar);
      const placket = part(new THREE.BoxGeometry(0.035, 0.22, 0.01), smooth(look.top, 0.5));
      placket.position.set(0, 1.16, 0.27);
      placket.rotation.x = -0.25;
      this.chest.add(placket);
      for (const y of [1.1, 1.2]) this.chest.add(part(new THREE.SphereGeometry(0.014, 8, 6), white).translateY(y).translateZ(0.28));
    } else {
      // the fitted tank: scoop neck, thin straps, bare shoulders
      const tank = part(bust(lathe([[0.001, -0.02], ...profile.filter(([, y]) => y < 1.0), [0.405, 1.0], [0.4, 1.03]], 48)), shirt);
      tank.scale.set(1.03, 1, 0.68);
      this.chest.add(tank);
      // straps over the shoulders, out where the hair doesn't hide them
      for (const side of [-1, 1]) {
        // up and over the top of the shoulder, sitting on the skin rather than inside it
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0.21 * side, 1.0, 0.27),
          new THREE.Vector3(0.24 * side, 1.22, 0.23),
          new THREE.Vector3(0.26 * side, 1.38, 0),
          new THREE.Vector3(0.24 * side, 1.22, -0.23),
          new THREE.Vector3(0.21 * side, 1.0, -0.27),
        ]);
        this.chest.add(part(new THREE.TubeGeometry(curve, 16, 0.022, 6, false), shirt));
      }
      // the neckline: a soft shadow between, a thin gold trim along the edge, and a fine gold chain
      const shade = part(new THREE.CapsuleGeometry(0.008, 0.07, 3, 6), smooth('#c99a76', 0.6));
      shade.position.set(0, 0.98, 0.3);
      this.chest.add(shade);
      const trim = part(new THREE.TorusGeometry(0.4, 0.007, 4, 40), gold);
      trim.rotation.x = Math.PI / 2;
      trim.scale.set(1.03, 0.7, 1);
      trim.position.y = 1.03;
      this.chest.add(trim);
      const chain = part(new THREE.TorusGeometry(0.2, 0.006, 4, 32, Math.PI), gold);
      chain.rotation.set(-0.35, 0, Math.PI);
      chain.position.set(0, 1.34, 0.13);
      this.chest.add(chain);
      this.chest.add(part(new THREE.SphereGeometry(0.018, 10, 8), gold).translateY(1.15).translateZ(0.27));
    }
    // the club crest, small, on the left
    const crestPin = part(new THREE.CircleGeometry(0.045, 16), gold);
    crestPin.position.set(-0.26, 0.62, 0.25);
    crestPin.rotation.y = -0.4;
    this.chest.add(crestPin);

    // arms: shoulder -> elbow -> hand, each a joint we can bend
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.39 * side, 1.12, 0);
      this.chest.add(shoulder);
      const cap = part(new THREE.SphereGeometry(0.105, 16, 12), skin);
      cap.scale.set(1.05, 0.8, 0.85);
      cap.position.y = -0.03;
      shoulder.add(cap);
      shoulder.add(part(lathe([[0.001, -0.96], [0.068, -0.95], [0.074, -0.88], [0.082, -0.6], [0.094, -0.25], [0.1, -0.05], [0.001, 0.06]], 16), skin));
      if (look.cut === 'polo') {
        const sleeve = part(lathe([[0.108, -0.34], [0.118, -0.2], [0.122, 0], [0.112, 0.09], [0.001, 0.13]], 16), shirt);
        shoulder.add(sleeve);
      }
      const elbow = new THREE.Group();
      elbow.position.y = -0.93;
      shoulder.add(elbow);
      elbow.add(part(new THREE.SphereGeometry(0.07, 12, 10), skin));
      elbow.add(part(lathe([[0.001, -0.8], [0.048, -0.78], [0.06, -0.55], [0.072, -0.2], [0.069, -0.02], [0.001, 0.07]], 16), skin));
      const hand = part(new THREE.SphereGeometry(0.08, 14, 10), skin);
      hand.scale.set(0.62, 1.35, 0.4);
      hand.position.y = -0.9;
      elbow.add(hand);
      if (side < 0) elbow.add(part(new THREE.TorusGeometry(0.058, 0.014, 6, 16), gold).rotateX(Math.PI / 2).translateZ(0.7));
      else {
        // a gold watch: a slim band and a small face
        elbow.add(part(new THREE.TorusGeometry(0.057, 0.012, 6, 16), gold).rotateX(Math.PI / 2).translateZ(0.68));
        const dial = part(new THREE.CylinderGeometry(0.036, 0.036, 0.018, 16), smooth('#f3ecdc', 0.2, { metalness: 0.3 }));
        dial.rotation.z = Math.PI / 2;
        dial.position.set(0.062, -0.68, 0);
        elbow.add(dial);
      }
      this.arms.push({ shoulder, elbow, side });
    }

    // neck and head
    this.chest.add(part(new THREE.CylinderGeometry(0.092, 0.11, 0.3, 16), skin).translateY(1.47));
    this.chest.add(this.head);
    this.head.position.y = 1.56;
    const skullGeo = new THREE.SphereGeometry(0.33, 40, 30);
    const sp = skullGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i);
      if (y >= 0) continue;
      const t = -y / 0.33;
      sp.setX(i, sp.getX(i) * (1 - 0.4 * t ** 1.4));
      sp.setZ(i, sp.getZ(i) * (sp.getZ(i) > 0 ? 1 - 0.05 * t : 1 - 0.35 * t));
      sp.setY(i, y * (1 + 0.12 * t));
    }
    skullGeo.computeVertexNormals();
    const skull = part(skullGeo, skin);
    skull.scale.set(0.86, 1.02, 0.95);
    skull.position.set(0, 0.36, 0);
    this.head.add(skull);
    // eyes: almond whites, her own iris colour, liner with a little wing, a catch light; each blinks (and winks)
    // brows a shade darker than her hair (fair hair gets a deeper brow so it still frames the eye)
    const hairCol = new THREE.Color(look.hair);
    const browCol = '#' + hairCol.clone().multiplyScalar(hairCol.getHSL({ h: 0, s: 0, l: 0 }).l > 0.4 ? 0.6 : 0.85).getHexString();
    const blushMat = new THREE.MeshStandardMaterial({ color: '#e07a7a', roughness: 0.8, transparent: true, opacity: 0.14, depthWrite: false });
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.105 * side, 0.4, 0.268);
      eye.rotation.y = 0.18 * side;
      const white_ = part(new THREE.SphereGeometry(0.058, 16, 12), smooth('#f7f4ef', 0.3));
      white_.scale.set(1.3, 0.7, 0.45);
      eye.add(white_);
      eye.add(part(new THREE.CircleGeometry(0.035, 20), smooth(look.eyes, 0.25)).translateZ(0.026));
      eye.add(part(new THREE.CircleGeometry(0.017, 16), dark).translateZ(0.027));
      eye.add(part(new THREE.CircleGeometry(0.008, 8), smooth('#ffffff', 0.1, { emissive: '#ffffff', emissiveIntensity: 0.6 })).translateX(0.012).translateY(0.012).translateZ(0.028));
      // the upper lid line, heavier: lashes and liner
      const lid = part(new THREE.TorusGeometry(0.076, 0.015, 6, 16, Math.PI), dark);
      lid.scale.set(1, 0.55, 1);
      lid.position.set(0, 0.002, 0.014);
      eye.add(lid);
      // the wing at the outer corner
      const wing = part(new THREE.CapsuleGeometry(0.006, 0.035, 3, 6), dark);
      wing.position.set(0.083 * side, 0.013, 0.014);
      wing.rotation.z = (Math.PI / 2 - 0.45) * -side;
      eye.add(wing);
      // a soft wash of shadow on the lid
      const shadow = part(new THREE.SphereGeometry(0.069, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), smooth('#' + new THREE.Color(look.skin).multiplyScalar(0.82).getHexString(), 0.5));
      shadow.scale.set(1.15, 0.45, 0.5);
      shadow.position.set(0, 0.006, -0.004);
      eye.add(shadow);
      this.head.add(eye);
      this.eyes.push(eye);
      const brow = part(new THREE.TorusGeometry(0.085, 0.012, 6, 14, 1.9), smooth(browCol, 0.6));
      brow.position.set(0.105 * side, 0.445, 0.268);
      brow.rotation.z = Math.PI / 2 - 0.95 + (side > 0 ? -0.08 : 0.08);
      brow.scale.set(1, 0.8, 1);
      this.head.add(brow);
      // a touch of blush high on the cheek
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.055, 16), blushMat);
      blush.position.set(0.165 * side, 0.29, 0.262);
      blush.rotation.y = 0.55 * side;
      this.head.add(blush);
      // ears and gold hoops
      const ear = part(new THREE.SphereGeometry(0.055, 12, 10), skin);
      ear.scale.set(0.45, 1, 0.75);
      ear.position.set(0.285 * side, 0.36, -0.02);
      this.head.add(ear);
      this.head.add(part(new THREE.TorusGeometry(0.06, 0.008, 6, 20), gold).translateX(0.29 * side).translateY(0.25).translateZ(0.0).rotateY(Math.PI / 2));
    }
    // nose and lips: fuller, glossy, with the corners turned up in a smile
    const bridge = part(new THREE.SphereGeometry(0.04, 12, 10), skin);
    bridge.scale.set(0.7, 1.7, 0.8);
    bridge.position.set(0, 0.32, 0.29);
    this.head.add(bridge);
    this.head.add(part(new THREE.SphereGeometry(0.032, 12, 10), skin).translateY(0.265).translateZ(0.305));
    const lip = smooth(look.lips, 0.18);
    const upper = part(new THREE.CapsuleGeometry(0.017, 0.075, 4, 10), lip);
    upper.rotation.z = Math.PI / 2;
    upper.position.set(0, 0.182, 0.284);
    this.head.add(upper);
    const lower = part(new THREE.SphereGeometry(0.042, 14, 10), lip);
    lower.scale.set(1.1, 0.5, 0.5);
    lower.position.set(0, 0.155, 0.279);
    this.head.add(lower);
    for (const side of [-1, 1]) {
      const corner = part(new THREE.CapsuleGeometry(0.008, 0.02, 3, 6), lip);
      corner.position.set(0.06 * side, 0.188, 0.272);
      corner.rotation.z = 0.9 * side;
      this.head.add(corner);
    }

    // hair: glossy, in her own style
    this.head.add(this.hair);
    const cap = part(new THREE.SphereGeometry(0.36, 32, 20, 0, Math.PI * 2, 0, 1.62), hairMat);
    cap.scale.set(0.94, 0.98, 1);
    cap.position.set(0, 0.37, -0.03);
    cap.rotation.set(-0.3, 0, 0.06);
    this.hair.add(cap);
    if (look.style === 'pony') {
      // swept back off the face into a high ponytail with a gold tie, which swings as she moves
      const crown = part(new THREE.SphereGeometry(0.2, 20, 14), hairMat);
      crown.scale.set(1, 0.6, 1);
      crown.position.set(0, 0.62, -0.08);
      this.hair.add(crown);
      this.pony.position.set(0, 0.62, -0.3);
      this.hair.add(this.pony);
      this.pony.add(part(new THREE.TorusGeometry(0.07, 0.025, 8, 16), gold).rotateX(0.5));
      this.pony.add(strand([[0, 0, 0], [0, 0.08, -0.18], [0, -0.2, -0.3], [0, -0.6, -0.26], [0, -0.95, -0.18]], 0.13, hairMat));
      this.pony.add(strand([[0.03, 0, -0.02], [0.05, 0.05, -0.2], [0.06, -0.3, -0.28], [0.04, -0.75, -0.22], [0.02, -1.0, -0.14]], 0.07, hairLight));
      // two loose pieces framing the face
      for (const side of [-1, 1]) this.hair.add(strand([[0.24 * side, 0.52, 0.2], [0.28 * side, 0.32, 0.25], [0.26 * side, 0.12, 0.27]], 0.025, hairLight));
    } else {
      // the part: a little more hair swept to one side of the forehead
      const sweep = part(new THREE.SphereGeometry(0.21, 20, 14), hairMat);
      sweep.scale.set(1.05, 0.24, 0.5);
      sweep.position.set(-0.1, 0.59, 0.19);
      sweep.rotation.set(0.6, 0, 0.42);
      this.hair.add(sweep);
      const wavy = look.style === 'waves';
      // the length: one flowing sheet from the crown round the back of her head, framing her face at the sides and
      // falling down her back past her shoulder blades. The part below the nape swings with the pony group.
      this.hair.add(this.pony);
      this.hair.add(hairSheet(wavy, true, hairMat));
      this.pony.add(hairSheet(wavy, false, hairMat));
      // a front section each side, falling over the front of the shoulder
      for (const side of [-1, 1]) this.pony.add(frontLock(side, wavy, side < 0 ? hairMat : hairLight));
      // the lighter underside, a little shorter, for depth
      const under = hairSheet(wavy, false, hairLight);
      under.scale.set(0.95, 0.97, 0.92);
      this.pony.add(under);
    }
    if (look.extra === 'visor') {
      // a white club visor: a band hugging the head from temple to temple, and a brim out over the eyes
      const band = part(new THREE.CylinderGeometry(0.31, 0.32, 0.08, 32, 1, true, -Math.PI * 0.8, Math.PI * 1.6), smooth('#f6f3ec', 0.6, { side: THREE.DoubleSide }));
      band.scale.set(0.92, 1, 1);
      band.position.set(0, 0.55, -0.02);
      band.rotation.x = -0.2;
      this.hair.add(band);
      const brim = part(new THREE.CircleGeometry(0.24, 24, 0, Math.PI), smooth('#f6f3ec', 0.6, { side: THREE.DoubleSide }));
      brim.scale.set(1, 0.75, 1);
      brim.rotation.x = -Math.PI / 2 + 0.25;
      brim.position.set(0, 0.53, 0.24);
      this.hair.add(brim);
      this.hair.add(part(new THREE.CircleGeometry(0.03, 12), gold).translateY(0.56).translateZ(0.305));
    } else if (look.extra === 'shades') {
      // aviators pushed up on her head: two dark teardrop lenses in a thin gold frame
      const shades = new THREE.Group();
      const lens = new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.05, metalness: 0.6 });
      for (const side of [-1, 1]) {
        const l = part(new THREE.CircleGeometry(0.075, 20), lens);
        l.scale.set(1.15, 0.9, 1);
        l.position.set(0.1 * side, 0, 0);
        shades.add(l);
        const frame = part(new THREE.TorusGeometry(0.078, 0.007, 4, 20), gold);
        frame.scale.set(1.15, 0.9, 1);
        frame.position.set(0.1 * side, 0, 0);
        shades.add(frame);
      }
      shades.add(part(new THREE.CapsuleGeometry(0.006, 0.07, 3, 6), gold).rotateZ(Math.PI / 2).translateX(0.04));
      shades.position.set(0, 0.68, 0.18);
      shades.rotation.x = -1.0;
      this.hair.add(shades);
    }

    this.group.traverse((o) => (o.castShadow = true));
  }

  setPose(p: HostessPose) {
    this.pose = p;
    this.poseT = 0;
  }

  update(dt: number) {
    this.t += dt;
    this.poseT += dt;
    const t = this.t;
    // the one-off moves hand back to an easy pose when they're done
    if (this.pose === 'flip' && this.poseT > 1.5) this.setPose('idle');
    if (this.pose === 'wink' && this.poseT > 1.0) this.setPose('laugh');
    const p = this.pose;
    const pt = this.poseT;
    // [shoulder out, shoulder forward, elbow bend, forearm twist] for her right and left arms
    // idle: right hand resting on her hip, left arm loose
    let rA = [0.5, 0.18, 1.55, 0];
    let lA = [0.2, 0.05, 0.2, 0];
    let headX = 0.04;
    let headY = Math.sin(t * 0.35) * 0.18;
    let headZ = 0.07 + Math.sin(t * 0.6 + 1) * 0.04;
    let lean = 0;
    let bounce = 0;
    const sway = Math.sin(t * 0.55) * 0.5 + 0.5; // slow shift of weight between hips
    if (p === 'wave') {
      rA = [2.55, 0.2, 0.5 + Math.sin(t * 8) * 0.35, 0];
      headZ = -0.1;
      headY = 0;
    } else if (p === 'walk') {
      // off the cart with some swagger: arms swinging, hips rolling, chin up
      rA = [0.18, Math.sin(t * 7) * 0.35, 0.3, 0];
      lA = [0.18, -Math.sin(t * 7) * 0.35, 0.3, 0];
      headX = -0.05;
      headY = 0;
      headZ = 0.04;
      bounce = Math.abs(Math.sin(t * 7)) * 0.05;
    } else if (p === 'flip') {
      // the hair flip: chin tips up and over to one side, a hand sweeps it back, then a settle
      // up in a third of a second, hold, then let it go
      const e = pt < 0.35 ? pt / 0.35 : pt < 0.95 ? 1 : Math.max(0, 1 - (pt - 0.95) / 0.35);
      const k = e * e * (3 - 2 * e);
      headX = -0.32 * k;
      headY = 0.35 * k;
      headZ = -0.2 * k;
      // her left arm up, the hand at her hair
      // (raised this high, the elbow folds the other way, back toward her head)
      lA = [0.12 + 2.38 * k, 0.05 - 0.05 * k, 0.25 - 2.35 * k, 0];
    } else if (p === 'wink') {
      // a wink and a little tilt of the head as she hands it over
      headX = 0.06;
      headY = 0.12;
      headZ = 0.16;
      rA = [0.35, 0.75, 0.6, 0];
    } else if (p === 'laugh') {
      lA = [0.25, 0.95, 1.9, 0];
      headX = -0.28;
      headY = 0.1;
      headZ = 0.12;
      lean = -0.06;
      bounce = Math.abs(Math.sin(t * 9)) * 0.025;
    }
    const k = 1 - Math.exp(-dt * 6);
    const c = this.cur;
    c.sway += (sway - c.sway) * k;
    c.lean += (lean - c.lean) * k;
    c.headX += (headX - c.headX) * k;
    c.headY += (headY - c.headY) * k;
    c.headZ += (headZ - c.headZ) * k;
    c.bounce += (bounce - c.bounce) * k;
    for (let i = 0; i < 4; i++) {
      c.rA[i] += (rA[i] - c.rA[i]) * k;
      c.lA[i] += (lA[i] - c.lA[i]) * k;
    }
    // contrapposto: hips one way, shoulders the other
    const w = c.sway - 0.5;
    this.body.position.set(w * 0.08, 2.95 + c.bounce, 0);
    this.body.rotation.set(c.lean, 0, w * 0.1);
    this.chest.rotation.set(0, 0, -w * 0.16);
    this.chest.scale.y = 1 + Math.sin(t * 1.7) * 0.006;
    this.legs[0].rotation.z = -w * 0.06 + 0.02;
    this.legs[1].rotation.z = -w * 0.06 - 0.02;
    this.legs[0].position.x = -0.25 + w * 0.08;
    this.legs[1].position.x = 0.25 + w * 0.08;
    if (p === 'walk') {
      this.legs[0].rotation.x = Math.sin(t * 7) * 0.4;
      this.legs[1].rotation.x = -Math.sin(t * 7) * 0.4;
      this.body.rotation.z += Math.sin(t * 7) * 0.06;
    } else {
      this.legs[0].rotation.x *= 1 - k;
      this.legs[1].rotation.x *= 1 - k;
    }
    this.head.rotation.set(c.headX, c.headY, c.headZ - w * 0.05);
    this.hair.rotation.z = -c.headZ * 0.15;
    // the ponytail (or the length down her back) trails the head, and really swings in a flip
    const flip = p === 'flip' ? Math.sin(Math.min(1, pt / 1.3) * Math.PI * 2) * 0.5 : 0;
    this.pony.rotation.z = -c.headZ * 0.8 + Math.sin(t * 1.3) * 0.03 + flip;
    this.pony.rotation.x = -c.headX * 0.6 + c.bounce * 3;
    // a blink every few seconds, and the left eye (hers) winks
    const blink = t % 3.7 < 0.12 ? 0.12 : 1;
    const wink = p === 'wink' && pt > 0.15 && pt < 0.6 ? 0.1 : 1;
    this.eyes[0].scale.y = blink;
    this.eyes[1].scale.y = Math.min(blink, wink);
    for (const a of this.arms) {
      const [out, fwd, bend, twist] = a.side < 0 ? c.rA : c.lA;
      a.shoulder.rotation.set(-fwd, twist, a.side * out);
      // the elbow folds inward, toward her body
      a.elbow.rotation.set(0, 0, -a.side * bend);
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }
}
