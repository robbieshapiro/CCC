// 3D golfers built from primitives: a body, an outfit, and a simple rig that swings a club.
// The golfer faces +z with the ball in front; the target is to their left (+x).
import * as THREE from 'three';
import type { ClubId } from './clubs';
import { kitByKey } from '../kits';

export type Build = 'slim' | 'regular' | 'broad';
export type HairStyle = 'short' | 'side' | 'curly' | 'long' | 'bun' | 'bald';
export type FaceHair = 'none' | 'stubble' | 'moustache' | 'beard';
export type Top = 'polo' | 'quarterzip' | 'vest' | 'cardigan' | 'cashmere' | 'blazer' | 'goldblazer' | 'tweed' | 'uniform';
export type Bottoms = 'trousers' | 'shorts' | 'plusfours' | 'tartan' | 'skirt';
export type Hat = 'none' | 'cap' | 'visor' | 'flatcap' | 'bucket';

export type GolferSpec = {
  skin: string;
  build: Build;
  height: number; // 0.92 .. 1.08
  hair: HairStyle;
  hairColor: string;
  face: FaceHair;
  top: Top;
  topColor: string;
  accent: string; // vest, collar trim or sweater colour
  bottoms: Bottoms;
  bottomsColor: string;
  hat: Hat;
  hatColor: string;
  glove: boolean;
  shoes: 'white' | 'saddle' | 'black';
  bag: string;
  putter?: 'classic' | 'gold';
  crestBag?: boolean;
  bowtie?: boolean;
  monocle?: boolean;
  kit?: string; // a school's fall kit (see kits.ts): a quarter-zip in its colours with its letters on the chest
  hand?: 'right' | 'left'; // which way they play: a righty's swing meter stands on the left of the screen
};

export const SKIN_TONES = ['#f6d7bf', '#eac09a', '#d29a6e', '#a8704a', '#7a4e33', '#563726'];
export const HAIR_COLOURS = ['#1e1611', '#4a3022', '#7b5232', '#b78a52', '#e3c48a', '#9c9c98', '#e8e6e0', '#8c3b22'];
export const CLOTH = ['#163b2c', '#f4f1e8', '#1f2d4a', '#7a1f2b', '#b8955a', '#6e8b74', '#d9c7a3', '#2b2b2b', '#8fb3d9', '#e9b9c2', '#c25b2a', '#4e5d3a'];

// Prestige pieces unlock with titles: October's monthly one and every weekly one since count the same. The steps
// are spaced for about four titles a month across the club.
export const PRESTIGE: { key: string; name: string; wins: number; apply: (s: GolferSpec) => void; has: (s: GolferSpec) => boolean }[] = [
  { key: 'tartan', name: 'Tartan plus-fours', wins: 1, apply: (s) => (s.bottoms = 'tartan'), has: (s) => s.bottoms === 'tartan' },
  { key: 'blazer', name: 'Club blazer', wins: 3, apply: (s) => (s.top = 'blazer'), has: (s) => s.top === 'blazer' },
  { key: 'cashmere', name: 'Cashmere quarter-zip', wins: 5, apply: (s) => (s.top = 'cashmere'), has: (s) => s.top === 'cashmere' },
  { key: 'goldputter', name: 'Gold putter', wins: 8, apply: (s) => (s.putter = s.putter === 'gold' ? 'classic' : 'gold'), has: (s) => s.putter === 'gold' },
  { key: 'crestbag', name: 'Crested tour bag', wins: 12, apply: (s) => (s.crestBag = !s.crestBag), has: (s) => !!s.crestBag },
  { key: 'goldblazer', name: "Members' blazer, gold trim", wins: 20, apply: (s) => (s.top = 'goldblazer'), has: (s) => s.top === 'goldblazer' },
];
export const LOCKED_TOPS: Partial<Record<Top, number>> = { blazer: 3, cashmere: 5, goldblazer: 20, tweed: 99, uniform: 99 };
export const LOCKED_BOTTOMS: Partial<Record<Bottoms, number>> = { tartan: 1, skirt: 0 };

export const DEFAULT_SPEC: GolferSpec = {
  hand: 'right',
  skin: SKIN_TONES[1],
  build: 'regular',
  height: 1,
  hair: 'short',
  hairColor: HAIR_COLOURS[1],
  face: 'none',
  top: 'polo',
  topColor: '#163b2c',
  accent: '#f4f1e8',
  bottoms: 'trousers',
  bottomsColor: '#d9c7a3',
  hat: 'cap',
  hatColor: '#f4f1e8',
  glove: true,
  shoes: 'white',
  bag: '#163b2c',
  putter: 'classic',
};

// Reginald, the Club Steward: in the welcome tour, and on the cart late in a round.
export const REGINALD_SPEC: GolferSpec = {
  ...DEFAULT_SPEC,
  skin: '#eac09a',
  hair: 'side',
  hairColor: '#cfd0cc',
  face: 'moustache',
  top: 'tweed',
  topColor: '#7a6a4f',
  bottoms: 'trousers',
  bottomsColor: '#4a4436',
  hat: 'none',
  shoes: 'black',
  glove: false,
  bowtie: true,
  monocle: true,
};

// ---------- materials and textures ----------

const mats = new Map<string, THREE.Material>();
function m(color: string, rough = 0.75, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = `${color}|${rough}|${JSON.stringify(extra)}`;
  let x = mats.get(key);
  if (!x) mats.set(key, (x = new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra })));
  return x;
}

// a school's letters, for the chest of a fall kit: transparent, so the top shows round them
function monoTex(text: string, color: string) {
  const key = `mono|${text}|${color}`;
  const hit = mats.get(key) as THREE.MeshBasicMaterial | undefined;
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 76;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `bold ${text.length > 3 ? 44 : text.length > 2 ? 54 : 68}px Georgia, serif`;
  x.fillText(text, 64, 40);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  mats.set(key, mat);
  return mat;
}

function patternTex(kind: 'argyle' | 'tartan' | 'tweed', a: string, b: string) {
  const key = `${kind}|${a}|${b}`;
  const hit = mats.get(key) as THREE.MeshStandardMaterial | undefined;
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = a;
  x.fillRect(0, 0, 64, 64);
  if (kind === 'argyle') {
    x.fillStyle = b;
    x.beginPath();
    x.moveTo(32, 0);
    x.lineTo(64, 32);
    x.lineTo(32, 64);
    x.lineTo(0, 32);
    x.fill();
    x.strokeStyle = '#f4f1e8';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(64, 64);
    x.moveTo(64, 0);
    x.lineTo(0, 64);
    x.stroke();
  } else if (kind === 'tartan') {
    x.globalAlpha = 0.55;
    x.fillStyle = b;
    x.fillRect(0, 20, 64, 14);
    x.fillRect(20, 0, 14, 64);
    x.fillStyle = '#e8c86a';
    x.fillRect(0, 46, 64, 3);
    x.fillRect(46, 0, 3, 64);
  } else {
    for (let i = 0; i < 400; i++) {
      x.fillStyle = Math.random() < 0.5 ? b : '#00000022';
      x.fillRect(Math.random() * 64, Math.random() * 64, 2, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  mats.set(key, mat);
  return mat;
}

const mesh = (g: THREE.BufferGeometry, mt: THREE.Material) => {
  const o = new THREE.Mesh(g, mt);
  o.castShadow = true;
  return o;
};

// a capsule from a to b
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, mt: THREE.Material, r2 = r) {
  const len = a.distanceTo(b);
  const g = r2 === r ? new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 10) : new THREE.CylinderGeometry(r2, r, len, 10);
  const o = mesh(g, mt);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return o;
}

// ---------- the club ----------

export function buildClub(id: ClubId, gold = false) {
  const g = new THREE.Group();
  const len = id === 'driver' ? 3.7 : id === 'wood' ? 3.5 : id === 'iron' ? 3.3 : id === 'wedge' || id === 'chip' ? 3.1 : 2.9;
  g.add(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -len, 0), 0.035, m('#c9ccd1', 0.25, { metalness: 0.8 })));
  g.add(limb(new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(0, -0.75, 0), 0.06, m('#1b1b1b', 0.9)));
  let head: THREE.Mesh;
  if (id === 'driver' || id === 'wood') {
    head = mesh(new THREE.SphereGeometry(id === 'wood' ? 0.2 : 0.26, 16, 10), m('#1d1f24', 0.3, { metalness: 0.5 }));
    head.scale.set(1.35, 0.7, 1);
    head.position.set(0.2, -len, 0.04);
  } else if (id === 'putter') {
    head = mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), m(gold ? '#d4af37' : '#b9bcc2', 0.25, { metalness: 0.9 }));
    head.position.set(0.15, -len, 0);
  } else {
    head = mesh(new THREE.BoxGeometry(0.36, 0.08, 0.2), m('#c9ccd1', 0.2, { metalness: 0.9 }));
    head.rotation.z = id === 'wedge' ? 0.9 : id === 'chip' ? 0.7 : 0.55;
    head.position.set(0.14, -len + 0.03, 0);
  }
  g.add(head);
  g.userData.len = len;
  return g;
}

function buildBag(color: string, crest: boolean) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.38, 0.34, 2.8, 14), m(color, 0.6));
  body.position.y = 1.5;
  g.add(body);
  g.add(mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 16), m('#f4f1e8', 0.5)).translateY(2.9).rotateX(Math.PI / 2));
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.SphereGeometry(0.16, 8, 6), m(['#7a1f2b', '#f4f1e8', '#1f2d4a', '#b8955a'][i], 0.7));
    c.position.set(Math.cos(i * 1.6) * 0.18, 3.15, Math.sin(i * 1.6) * 0.18);
    g.add(c);
  }
  if (crest) {
    const s = mesh(new THREE.CircleGeometry(0.2, 16), m('#b8955a', 0.3, { metalness: 0.6 }));
    s.position.set(0, 1.9, 0.37);
    g.add(s);
  }
  g.rotation.z = 0.18;
  return g;
}

// ---------- the golfer ----------

export type PoseName = 'idle' | 'address' | 'cheer' | 'groan' | 'wave' | 'clasp';

export class Golfer {
  readonly group = new THREE.Group();
  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private head = new THREE.Group();
  private swing = new THREE.Group(); // arms + club, tilted toward the ball
  private plane = new THREE.Group(); // rotates in the swing plane
  private club: THREE.Group | null = null;
  private clubId: ClubId | null = null;
  private legs: THREE.Group[] = [];
  private t = 0;
  private state: { pose: PoseName; hold?: number; swing?: { t: number; back: number; dur: number; impact: () => void; done: () => void; hit: boolean } } = { pose: 'idle' };
  private cur = { tilt: 0, phi: 0, twist: 0, bend: 0, knee: 0, headTilt: 0 };

  constructor(readonly spec: GolferSpec) {
    const kit = spec.top === 'quarterzip' ? kitByKey(spec.kit) : undefined;
    if (kit) spec = { ...spec, topColor: kit.primary };
    const s = spec;
    const w = s.build === 'slim' ? 0.88 : s.build === 'broad' ? 1.16 : 1;
    const skin = m(s.skin, 0.6);
    const topMat =
      s.top === 'tweed' ? patternTex('tweed', s.topColor, '#00000033') : m(s.top === 'cashmere' ? '#eadfc8' : s.topColor, s.top === 'cardigan' || s.top === 'cashmere' ? 0.95 : 0.7);
    const bottomMat = s.bottoms === 'tartan' ? patternTex('tartan', s.bottomsColor, '#163b2c') : m(s.bottomsColor, 0.8);
    const shoeMat = m(s.shoes === 'white' ? '#f4f2ec' : s.shoes === 'saddle' ? '#7b4a2a' : '#1c1c1c', 0.4);
    this.group.add(this.hips);
    this.hips.position.y = 3.05;

    // legs: hip joint -> knee -> ankle
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.27 * side * w, 0, 0);
      this.hips.add(hip);
      const thigh = new THREE.Vector3(0, 0, 0);
      const knee = new THREE.Vector3(0, -1.45, 0.02);
      const ankle = new THREE.Vector3(0, -2.85, 0);
      if (s.bottoms === 'shorts') {
        hip.add(limb(thigh, new THREE.Vector3(0, -1.0, 0.02), 0.26 * w, bottomMat));
        hip.add(limb(new THREE.Vector3(0, -1.0, 0.02), ankle, 0.17, skin, 0.2));
        hip.add(limb(new THREE.Vector3(0, -2.3, 0), ankle, 0.18, m('#f4f2ec', 0.9)));
      } else if (s.bottoms === 'plusfours' || s.bottoms === 'tartan') {
        hip.add(limb(thigh, new THREE.Vector3(0, -1.75, 0.04), 0.3 * w, bottomMat));
        hip.add(limb(new THREE.Vector3(0, -1.75, 0.04), ankle, 0.17, patternTex('argyle', '#1f2d4a', '#7a1f2b'), 0.2));
      } else if (s.bottoms === 'skirt') {
        const sk = mesh(new THREE.CylinderGeometry(0.42 * w, 0.62 * w, 1.2, 14), bottomMat);
        sk.position.set(-0.27 * side * w, -0.5, 0);
        if (side < 0) hip.add(sk);
        hip.add(limb(new THREE.Vector3(0, -1.0, 0), ankle, 0.17, skin, 0.19));
      } else {
        hip.add(limb(thigh, knee, 0.25 * w, bottomMat));
        hip.add(limb(knee, ankle, 0.22 * w, bottomMat, 0.2 * w));
      }
      const shoe = mesh(new THREE.BoxGeometry(0.32, 0.22, 0.62), shoeMat);
      shoe.position.set(0, -2.95, 0.12);
      hip.add(shoe);
      if (s.shoes === 'saddle') hip.add(mesh(new THREE.BoxGeometry(0.33, 0.1, 0.3), m('#f4f2ec', 0.4)).translateY(-2.88).translateZ(0.1));
      this.legs.push(hip);
    }

    // torso
    this.hips.add(this.spine);
    const torso = mesh(new THREE.CapsuleGeometry(0.52, 1.0, 6, 14), topMat);
    torso.scale.set(w * 1.05, 1, 0.72 * w);
    torso.position.y = 0.85;
    this.spine.add(torso);
    // belt
    if (s.top === 'polo' || s.top === 'quarterzip' || s.top === 'vest' || s.top === 'uniform')
      this.spine.add(mesh(new THREE.CylinderGeometry(0.55 * w, 0.55 * w, 0.14, 16), m('#2a1d14', 0.5)).translateY(0.12)).children.at(-1)!.scale.set(1, 1, 0.74);
    if (s.top === 'vest') {
      const v = mesh(new THREE.CapsuleGeometry(0.535, 0.8, 6, 14), m(s.accent, 0.95));
      v.scale.set(w * 1.06, 1, 0.75 * w);
      v.position.y = 0.95;
      this.spine.add(v);
    }
    if (s.top === 'polo' || s.top === 'vest' || s.top === 'uniform') {
      const collar = mesh(new THREE.TorusGeometry(0.26, 0.07, 6, 16), m(s.top === 'vest' ? '#f4f1e8' : s.accent, 0.7));
      collar.rotation.x = Math.PI / 2 - 0.2;
      collar.position.set(0, 1.78, 0.04);
      this.spine.add(collar);
    }
    if (s.top === 'quarterzip' || s.top === 'cashmere') {
      this.spine.add(mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.3, 14), kit ? m(kit.secondary, 0.8) : topMat).translateY(1.8));
      this.spine.add(mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), m('#b8955a', 0.3, { metalness: 0.7 })).translateY(1.55).translateZ(0.4));
    }
    // the kit's letters, on the left of the chest
    if (kit) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.25), monoTex(kit.mono, kit.secondary));
      patch.position.set(0.2 * w, 1.5, 0.395 * w);
      patch.rotation.y = 0.3;
      this.spine.add(patch);
    }
    if (s.top === 'cardigan' || s.top === 'blazer' || s.top === 'goldblazer' || s.top === 'tweed') {
      // shirt and tie showing at the open front, and lapels
      this.spine.add(mesh(new THREE.BoxGeometry(0.34, 0.75, 0.05), m('#f6f3ea', 0.6)).translateY(1.45).translateZ(0.37 * w));
      if (s.top !== 'cardigan' && !s.bowtie) this.spine.add(mesh(new THREE.BoxGeometry(0.1, 0.6, 0.03), m(s.top === 'goldblazer' ? '#b8955a' : '#7a1f2b', 0.5)).translateY(1.4).translateZ(0.4 * w));
      const trim = s.top === 'goldblazer' ? m('#c9a24a', 0.3, { metalness: 0.6 }) : topMat;
      for (const side of [-1, 1]) {
        const lap = mesh(new THREE.BoxGeometry(0.14, 0.7, 0.04), trim);
        lap.position.set(0.17 * side, 1.45, 0.39 * w);
        lap.rotation.z = 0.25 * side;
        this.spine.add(lap);
      }
      if (s.top === 'blazer' || s.top === 'goldblazer') {
        const badge = mesh(new THREE.CircleGeometry(0.08, 12), m('#b8955a', 0.3, { metalness: 0.6 }));
        badge.position.set(-0.3, 1.35, 0.41 * w);
        this.spine.add(badge);
      }
    }
    if (s.bowtie) this.spine.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), m('#163b2c', 0.5)).translateY(1.72).translateZ(0.38));

    // head
    this.spine.add(this.head);
    this.head.position.y = 1.95;
    this.head.add(limb(new THREE.Vector3(0, -0.15, 0), new THREE.Vector3(0, 0.15, 0), 0.15, skin));
    const skull = mesh(new THREE.SphereGeometry(0.42, 20, 16), skin);
    skull.scale.set(0.95, 1.06, 1);
    skull.position.y = 0.48;
    this.head.add(skull);
    for (const side of [-1, 1]) {
      this.head.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), skin).translateX(0.4 * side).translateY(0.48));
      this.head.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), m('#1d1a18', 0.3)).translateX(0.14 * side).translateY(0.55).translateZ(0.38));
      this.head.add(mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), m(s.hair === 'bald' ? '#8a7a6a' : s.hairColor, 0.8)).translateX(0.14 * side).translateY(0.65).translateZ(0.38));
    }
    this.head.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), skin).translateY(0.46).translateZ(0.42));
    this.head.add(mesh(new THREE.TorusGeometry(0.09, 0.018, 4, 10, Math.PI), m('#8a4b3a', 0.6)).translateY(0.35).translateZ(0.38).rotateZ(Math.PI));
    this.addHair(s);
    this.addFaceHair(s);
    this.addHat(s);
    if (s.monocle) {
      const mono = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16), m('#b8955a', 0.3, { metalness: 0.8 }));
      mono.position.set(-0.14, 0.55, 0.42);
      this.head.add(mono);
    }

    // arms and club live in the swing rig, pivoting at the chest
    this.spine.add(this.swing);
    this.swing.position.set(0, 1.45, 0.05);
    this.swing.add(this.plane);
    const hands = new THREE.Vector3(0, -2.05, 0.3);
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Vector3(0.62 * side * w, 0.15, 0);
      const elbow = shoulder.clone().lerp(hands, 0.5).add(new THREE.Vector3(0.12 * side, 0, 0.05));
      this.plane.add(mesh(new THREE.SphereGeometry(0.22 * w, 10, 8), topMat).translateX(shoulder.x).translateY(shoulder.y));
      const sleeve = s.top === 'polo' || s.top === 'vest' || s.top === 'uniform' ? shoulder.clone().lerp(elbow, 0.55) : elbow.clone().lerp(hands, 0.75);
      this.plane.add(limb(shoulder, sleeve, 0.17 * w, topMat));
      this.plane.add(limb(sleeve, hands.clone().add(new THREE.Vector3(0.05 * side, 0.1, 0)), 0.13, skin));
      const glove = s.glove && side > 0;
      this.plane.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), glove ? m('#f4f2ec', 0.6) : skin).translateX(hands.x + 0.05 * side).translateY(hands.y).translateZ(hands.z));
    }

    // bag at the side
    const bag = buildBag(s.bag, !!s.crestBag);
    bag.position.set(0.6, 0, -2.4);
    bag.name = 'bag';
    this.group.add(bag);

    this.group.scale.setScalar(s.height);
    this.group.traverse((o) => (o.castShadow = true));
    this.setPose('idle');
  }

  private addHair(s: GolferSpec) {
    if (s.hair === 'bald') return;
    const hm = m(s.hairColor, 0.85);
    const cap = mesh(new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, s.hair === 'long' ? 1.9 : 1.45), hm);
    cap.position.set(0, 0.5, -0.03);
    cap.scale.set(1, 1.05, 1.02);
    this.head.add(cap);
    if (s.hair === 'side') {
      const part = mesh(new THREE.SphereGeometry(0.2, 10, 8), hm);
      part.position.set(0.18, 0.86, 0.15);
      part.scale.set(1.4, 0.5, 1);
      this.head.add(part);
    } else if (s.hair === 'curly') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        this.head.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), hm).translateX(Math.cos(a) * 0.36).translateY(0.82 + Math.sin(i) * 0.04).translateZ(Math.sin(a) * 0.36));
      }
    } else if (s.hair === 'long') {
      const back = mesh(new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), hm);
      back.position.set(0, 0.2, -0.22);
      back.scale.set(1.15, 1, 0.6);
      this.head.add(back);
    } else if (s.hair === 'bun') {
      this.head.add(mesh(new THREE.SphereGeometry(0.17, 10, 8), hm).translateY(0.88).translateZ(-0.28));
    }
  }

  private addFaceHair(s: GolferSpec) {
    const hm = m(s.hairColor, 0.9);
    if (s.face === 'moustache') {
      for (const side of [-1, 1]) {
        const t = mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 6), hm);
        t.rotation.z = Math.PI / 2 + 0.35 * side;
        t.position.set(0.08 * side, 0.4, 0.42);
        this.head.add(t);
      }
    } else if (s.face === 'beard' || s.face === 'stubble') {
      const b = mesh(new THREE.SphereGeometry(0.43, 16, 10, 0, Math.PI * 2, 1.7, 1.2), s.face === 'stubble' ? new THREE.MeshStandardMaterial({ color: s.hairColor, transparent: true, opacity: 0.35 }) : hm);
      b.position.set(0, 0.5, 0.02);
      b.scale.set(0.98, s.face === 'beard' ? 1.2 : 1.07, 1.03);
      this.head.add(b);
    }
  }

  private addHat(s: GolferSpec) {
    if (s.hat === 'none') return;
    const hm = m(s.hatColor, 0.8);
    if (s.hat === 'cap' || s.hat === 'visor') {
      if (s.hat === 'cap') this.head.add(mesh(new THREE.SphereGeometry(0.47, 18, 10, 0, Math.PI * 2, 0, 1.35), hm).translateY(0.55));
      else this.head.add(mesh(new THREE.TorusGeometry(0.43, 0.06, 6, 20), hm).translateY(0.72).rotateX(Math.PI / 2));
      const brim = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16, 1, false, -Math.PI / 2, Math.PI), hm);
      brim.position.set(0, 0.72, 0.36);
      brim.scale.set(1.2, 1, 1.25);
      this.head.add(brim);
    } else if (s.hat === 'flatcap') {
      const c = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, 1.2), s.hatColor === '#f4f1e8' ? patternTex('tweed', '#8a7a5a', '#00000044') : hm);
      c.position.set(0, 0.58, 0.06);
      c.scale.set(1, 0.65, 1.15);
      this.head.add(c);
    } else {
      this.head.add(mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.38, 16), hm).translateY(0.86));
      this.head.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 20), hm).translateY(0.7));
    }
  }

  holdClub(id: ClubId | null) {
    if (this.clubId === id) return;
    if (this.club) this.plane.remove(this.club);
    this.club = null;
    this.clubId = id;
    if (!id) return;
    this.club = buildClub(id, this.spec.putter === 'gold' && id === 'putter');
    this.club.position.set(0, -2.05, 0.3);
    this.plane.add(this.club);
  }

  setPose(p: PoseName) {
    this.state = { pose: p };
  }

  get swinging() {
    return !!this.state.swing;
  }

  // How far back the club goes for this much power.
  private reach(club: ClubId, power: number) {
    return club === 'putter' ? 0.08 + power * 0.85 : club === 'chip' ? 0.4 + power * 0.9 : club === 'wedge' ? 0.8 + power * 1.4 : 1.2 + power * 1.5;
  }

  // The vertical meter: the club follows the meter back and down, and waits wherever it is.
  // share: how much of that backswing has happened (0 at address, 1 at the top).
  takeBack(club: ClubId, power: number, share = 1) {
    if (this.state.swing) return;
    this.state = { pose: 'address', hold: -this.reach(club, power) * Math.max(0, Math.min(1, share)) };
  }

  // Back, down through impact, follow through. `impact` fires as the club meets the ball.
  // from 'impact': the meter has already taken the club back and down; strike it and follow through.
  // from 'top': the club is already back (a putt pulled back); bring it through from there.
  swingClub(club: ClubId, power: number, impact: () => void, done: () => void = () => {}, from: 'start' | 'top' | 'impact' = 'start') {
    this.holdClub(club);
    const dur = club === 'putter' ? (from === 'top' ? 1.4 : 0.9) : 1.25;
    const t = from === 'impact' ? dur * 0.72 : from === 'top' ? dur * 0.55 : 0;
    this.state = { pose: 'address', swing: { t, back: -this.reach(club, power), dur, impact, done, hit: false } };
  }

  update(dt: number) {
    this.t += dt;
    const target = { tilt: 0, phi: 0, twist: 0, bend: 0, knee: 0, headTilt: 0 };
    const p = this.state.pose;
    const putting = this.clubId === 'putter';
    if (p === 'idle') {
      target.tilt = 0.18;
    } else if (p === 'clasp') {
      target.tilt = 0.12;
    } else if (p === 'address') {
      // arms hang from a bent-over spine, so the tilt toward the ball has to cancel the bend
      target.bend = putting ? 0.55 : 0.4;
      target.tilt = -(putting ? 0.3 : 0.48) - target.bend;
      target.knee = 0.22;
      target.headTilt = 0.35;
      if (this.state.hold !== undefined) {
        target.phi = this.state.hold;
        target.twist = putting ? 0 : this.state.hold * 0.32;
      }
    } else if (p === 'cheer') {
      target.tilt = Math.PI * 0.95;
      target.phi = Math.sin(this.t * 7) * 0.25;
      target.headTilt = -0.2;
    } else if (p === 'wave') {
      target.tilt = 2.2;
      target.phi = 0.6 + Math.sin(this.t * 8) * 0.35;
    } else if (p === 'groan') {
      target.tilt = 0.05;
      target.bend = 0.45;
      target.headTilt = 0.6;
      target.knee = 0.15;
    }
    const sw = this.state.swing;
    if (sw) {
      sw.t += dt;
      const k = sw.t / sw.dur;
      const follow = putting ? -sw.back * 0.9 : 2.5;
      let phi: number;
      if (k < 0.55) phi = sw.back * Math.sin((k / 0.55) * (Math.PI / 2));
      else if (k < 0.72) phi = sw.back * (1 - ((k - 0.55) / 0.17) ** 2);
      else phi = Math.min(follow, ((k - 0.72) / 0.28) * follow * 1.15);
      if (!sw.hit && k >= 0.72) {
        sw.hit = true;
        sw.impact();
      }
      target.phi = phi;
      target.twist = putting ? 0 : phi * 0.32;
      if (k > 1.35) {
        this.state = { pose: 'address' };
        sw.done();
      }
      this.cur.phi = phi;
    }
    const ease = 1 - Math.exp(-dt * 10);
    for (const key of Object.keys(this.cur) as (keyof typeof this.cur)[]) {
      if (key === 'phi' && sw) continue;
      this.cur[key] += (target[key] - this.cur[key]) * ease;
    }
    if (sw) this.cur.twist = target.twist;
    const c = this.cur;
    this.swing.rotation.x = c.tilt;
    this.plane.rotation.z = c.phi;
    this.spine.rotation.x = c.bend;
    this.spine.rotation.y = c.twist;
    this.head.rotation.x = c.headTilt - c.bend * 0.6;
    this.head.rotation.y = -c.twist * 0.7;
    this.hips.position.y = 3.05 - c.knee * 0.5;
    this.hips.rotation.x = -c.bend * 0.25;
    for (const l of this.legs) l.rotation.x = c.knee * 0.4;
    this.spine.scale.y = 1 + Math.sin(this.t * 1.6) * 0.006;
  }

  showBag(on: boolean) {
    const b = this.group.getObjectByName('bag');
    if (b) b.visible = on;
  }

  dispose() {
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  }
}

// ---------- 2D app portraits rendered from the 3D golfer ----------

let thumbRenderer: THREE.WebGLRenderer | null = null;
const thumbs = new Map<string, string>();

export function golferThumb(spec: GolferSpec, size = 96): string | null {
  const key = JSON.stringify([spec, size]);
  const hit = thumbs.get(key);
  if (hit) return hit;
  try {
    thumbRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    const r = thumbRenderer;
    r.setPixelRatio(2);
    r.setSize(size, size, false);
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff8ec', '#506048', 2.2));
    const key1 = new THREE.DirectionalLight('#ffffff', 1.6);
    key1.position.set(2, 4, 5);
    scene.add(key1);
    const g = new Golfer(spec);
    g.showBag(false);
    g.setPose('clasp');
    for (let i = 0; i < 40; i++) g.update(0.05);
    scene.add(g.group);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    const hy = 5.4 * spec.height;
    cam.position.set(0.9, hy + 0.2, 6.2);
    cam.lookAt(0, hy - 0.25, 0);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    const url = r.domElement.toDataURL('image/png');
    g.dispose();
    thumbs.set(key, url);
    return url;
  } catch {
    return null;
  }
}
