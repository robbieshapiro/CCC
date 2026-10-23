// Daisy, drawn differently from the members: smooth, realistic proportions instead of the club's toy golfers.
// About 5'7" in a fitted club polo and a tennis skort, long layered hair, and her own way of moving:
// weight on one hip, a hand resting on it, a turn of the head, a laugh that tips her head back.
// Faces +z like the golfers; units are feet.
import * as THREE from 'three';

export type HostessPose = 'idle' | 'wave' | 'laugh';

const smooth = (color: string, rough = 0.6, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function part(geo: THREE.BufferGeometry, mat: THREE.Material) {
  const o = new THREE.Mesh(geo, mat);
  o.castShadow = true;
  return o;
}

// a solid of revolution from (radius, height) pairs
const lathe = (pts: [number, number][], segs = 32) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

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
  private arms: { shoulder: THREE.Group; elbow: THREE.Group; side: number }[] = [];
  private legs: THREE.Group[] = [];
  private pose: HostessPose = 'idle';
  private t = 0;
  private cur = { sway: 0, lean: 0, headX: 0, headY: 0, headZ: 0, bounce: 0, rA: [0, 0, 0, 0], lA: [0, 0, 0, 0] };

  constructor() {
    const skin = smooth('#e8bf9c', 0.5);
    const shirt = smooth('#163b2c', 0.7);
    const white = smooth('#f6f3ec', 0.6);
    const hairMat = smooth('#4b2f1d', 0.45);
    const hairLight = smooth('#6e4628', 0.45);
    const gold = smooth('#d4af37', 0.25, { metalness: 0.9 });
    const dark = smooth('#1b1714', 0.3);

    this.group.add(this.body);
    this.body.position.y = 2.95;

    // legs, hanging from the hip joints
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.25 * side, 2.95, 0);
      const leg = part(lathe([[0.001, -2.68], [0.1, -2.66], [0.12, -2.4], [0.165, -2.0], [0.135, -1.5], [0.15, -1.38], [0.2, -0.9], [0.245, -0.3], [0.25, 0.05], [0.001, 0.08]], 24), skin);
      hip.add(leg);
      const shoe = part(new THREE.CapsuleGeometry(0.12, 0.32, 4, 12), white);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1, 1, 0.8);
      shoe.position.set(0, -2.8, 0.1);
      hip.add(shoe);
      this.group.add(hip);
      this.legs.push(hip);
    }

    // skort, belt and the fitted polo: in at the waist, out at the hip
    this.body.add(part(lathe([[0.5, 0.36], [0.58, 0.12], [0.62, -0.12], [0.66, -0.42], [0.65, -0.44]]), smooth('#f6f3ec', 0.6, { side: THREE.DoubleSide })));
    const belt = part(new THREE.TorusGeometry(0.49, 0.035, 8, 32), smooth('#2a1d14', 0.4));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.36;
    this.body.add(belt);
    this.body.add(this.chest);
    this.chest.position.y = 0.3;
    const torso = part(lathe([[0.001, -0.02], [0.5, 0], [0.46, 0.18], [0.46, 0.36], [0.53, 0.66], [0.57, 0.86], [0.55, 1.02], [0.56, 1.16], [0.5, 1.3], [0.3, 1.42], [0.001, 1.46]]), shirt);
    torso.scale.set(1, 1, 0.7);
    this.chest.add(torso);
    // open collar, placket and a brass name badge
    for (const side of [-1, 1]) {
      const c = part(new THREE.BoxGeometry(0.2, 0.05, 0.14), white);
      c.position.set(0.11 * side, 1.34, 0.17);
      c.rotation.set(-0.5, 0, 0.5 * side);
      this.chest.add(c);
    }
    this.chest.add(part(new THREE.BoxGeometry(0.05, 0.28, 0.02), smooth('#0f2a1f', 0.7)).translateY(1.18).translateZ(0.37));
    const badge = part(new THREE.BoxGeometry(0.22, 0.07, 0.02), gold);
    badge.position.set(-0.27, 0.98, 0.385);
    badge.rotation.y = -0.35;
    this.chest.add(badge);

    // arms: shoulder -> elbow -> hand, each a joint we can bend
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.53 * side, 1.16, 0);
      this.chest.add(shoulder);
      shoulder.add(part(new THREE.SphereGeometry(0.15, 16, 12), shirt));
      shoulder.add(part(lathe([[0.15, 0], [0.145, -0.3], [0.13, -0.42], [0.001, -0.43]], 20), shirt));
      shoulder.add(part(lathe([[0.001, -0.95], [0.085, -0.93], [0.1, -0.6], [0.115, -0.3], [0.001, -0.25]], 16), skin));
      const elbow = new THREE.Group();
      elbow.position.y = -0.93;
      shoulder.add(elbow);
      elbow.add(part(lathe([[0.001, -0.8], [0.062, -0.78], [0.08, -0.45], [0.088, -0.1], [0.001, 0.02]], 16), skin));
      const hand = part(new THREE.SphereGeometry(0.09, 14, 10), skin);
      hand.scale.set(0.7, 1.3, 0.45);
      hand.position.y = -0.9;
      elbow.add(hand);
      if (side < 0) elbow.add(part(new THREE.TorusGeometry(0.075, 0.018, 6, 16), gold).rotateX(Math.PI / 2).translateZ(0.68));
      this.arms.push({ shoulder, elbow, side });
    }

    // neck and head
    this.chest.add(part(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 16), skin).translateY(1.46));
    this.chest.add(this.head);
    this.head.position.y = 1.52;
    const skull = part(new THREE.SphereGeometry(0.33, 32, 24), skin);
    skull.scale.set(0.86, 1.02, 0.95);
    skull.position.set(0, 0.36, 0);
    this.head.add(skull);
    const jaw = part(new THREE.SphereGeometry(0.27, 28, 20), skin);
    jaw.scale.set(0.82, 0.78, 0.9);
    jaw.position.set(0, 0.2, 0.05);
    this.head.add(jaw);
    // eyes: almond whites, hazel irises, a lid line and a catch light
    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(0.105 * side, 0.4, 0.268);
      eye.rotation.y = 0.18 * side;
      const white_ = part(new THREE.SphereGeometry(0.05, 16, 12), smooth('#f7f4ef', 0.3));
      white_.scale.set(1.3, 0.7, 0.45);
      eye.add(white_);
      eye.add(part(new THREE.CircleGeometry(0.03, 20), smooth('#6b7a3e', 0.3)).translateZ(0.023));
      eye.add(part(new THREE.CircleGeometry(0.015, 16), dark).translateZ(0.024));
      eye.add(part(new THREE.CircleGeometry(0.007, 8), smooth('#ffffff', 0.1, { emissive: '#ffffff', emissiveIntensity: 0.6 })).translateX(0.01).translateY(0.01).translateZ(0.025));
      const lid = part(new THREE.TorusGeometry(0.066, 0.01, 6, 16, Math.PI), dark);
      lid.scale.set(1, 0.55, 1);
      lid.position.set(0, 0.002, 0.01);
      eye.add(lid);
      this.head.add(eye);
      const brow = part(new THREE.TorusGeometry(0.085, 0.011, 6, 14, 1.9), smooth('#5a3a22', 0.6));
      brow.position.set(0.105 * side, 0.43, 0.268);
      brow.rotation.z = Math.PI / 2 - 0.95 + (side > 0 ? -0.08 : 0.08);
      brow.scale.set(1, 0.8, 1);
      this.head.add(brow);
      // ears and gold hoops
      const ear = part(new THREE.SphereGeometry(0.055, 12, 10), skin);
      ear.scale.set(0.45, 1, 0.75);
      ear.position.set(0.285 * side, 0.36, -0.02);
      this.head.add(ear);
      this.head.add(part(new THREE.TorusGeometry(0.05, 0.007, 6, 20), gold).translateX(0.29 * side).translateY(0.26).translateZ(0.0).rotateY(Math.PI / 2));
    }
    // nose and lips
    const bridge = part(new THREE.SphereGeometry(0.04, 12, 10), skin);
    bridge.scale.set(0.7, 1.7, 0.8);
    bridge.position.set(0, 0.32, 0.29);
    this.head.add(bridge);
    this.head.add(part(new THREE.SphereGeometry(0.032, 12, 10), skin).translateY(0.265).translateZ(0.305));
    const lip = smooth('#b65a62', 0.35);
    const upper = part(new THREE.CapsuleGeometry(0.02, 0.085, 4, 10), lip);
    upper.rotation.z = Math.PI / 2;
    upper.position.set(0, 0.18, 0.283);
    this.head.add(upper);
    const lower = part(new THREE.SphereGeometry(0.045, 14, 10), lip);
    lower.scale.set(1.15, 0.5, 0.55);
    lower.position.set(0, 0.155, 0.278);
    this.head.add(lower);

    // hair: dark brunette with lighter ends, parted on the side, falling in soft curtains past the shoulders
    this.head.add(this.hair);
    const cap = part(new THREE.SphereGeometry(0.355, 32, 20, 0, Math.PI * 2, 0, 1.62), hairMat);
    cap.scale.set(0.92, 0.96, 0.98);
    cap.position.set(0, 0.37, -0.03);
    cap.rotation.set(-0.3, 0, 0.06);
    this.hair.add(cap);
    // the part: a little more hair swept to one side of the forehead
    const sweep = part(new THREE.SphereGeometry(0.2, 20, 14), hairMat);
    sweep.scale.set(1.1, 0.3, 0.55);
    sweep.position.set(-0.1, 0.58, 0.19);
    sweep.rotation.set(0.6, 0, 0.42);
    this.hair.add(sweep);
    // curtains either side of the face, down onto the shoulders
    for (const side of [-1, 1]) {
      const curtain = part(new THREE.CapsuleGeometry(0.15, 0.78, 6, 16), side < 0 ? hairMat : hairLight);
      curtain.scale.set(0.55, 1, 0.95);
      curtain.position.set(0.27 * side, -0.02, -0.01);
      curtain.rotation.set(0.12, 0, -0.1 * side);
      this.hair.add(curtain);
      // a lighter lock that falls forward over the collarbone
      this.hair.add(strand([[0.26 * side, 0.4, 0.12], [0.3 * side, 0.1, 0.17], [0.31 * side, -0.2, 0.3], [0.29 * side, -0.48, 0.4]], 0.075, hairLight));
    }
    // the length down her back
    const back = part(new THREE.CapsuleGeometry(0.3, 0.85, 6, 18), hairMat);
    back.scale.set(1.2, 1, 0.48);
    back.position.set(0, -0.1, -0.3);
    back.rotation.x = 0.12;
    this.hair.add(back);
    const ends = part(new THREE.CapsuleGeometry(0.26, 0.4, 6, 16), hairLight);
    ends.scale.set(1.2, 1, 0.42);
    ends.position.set(0, -0.62, -0.42);
    this.hair.add(ends);

    this.group.traverse((o) => (o.castShadow = true));
  }

  setPose(p: HostessPose) {
    this.pose = p;
  }

  update(dt: number) {
    this.t += dt;
    const t = this.t;
    const p = this.pose;
    // [shoulder out, shoulder forward, elbow bend, forearm twist] for her right and left arms
    // idle: right hand resting on her hip, left arm loose
    let rA = [0.62, -0.1, 1.85, 0];
    let lA = [0.12, 0.05, 0.25, 0];
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
    this.head.rotation.set(c.headX, c.headY, c.headZ - w * 0.05);
    this.hair.rotation.z = -c.headZ * 0.15;
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
