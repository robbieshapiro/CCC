// 3D golfers built from primitives: a body, an outfit, and a simple rig that swings a club.
// The golfer faces +z with the ball in front; the target is to their left (+x).
import * as THREE from 'three';
import type { ClubId } from './clubs';
import { kitByKey } from '../kits';
import { disposeGeo, faceZ, gripHand, shared, HEAD_R, HEAD_Y, headGeo, headLayer, joint, lathe, mergeStatic, shapeOf, shoe } from './body';

export type Build = 'slim' | 'regular' | 'broad';
export type HairStyle = 'short' | 'side' | 'curly' | 'long' | 'bun' | 'bald';
export type FaceHair = 'none' | 'stubble' | 'moustache' | 'beard';
// the last four tops and hats come from the Pro Shop (src/shop.ts)
export type Top = 'polo' | 'quarterzip' | 'vest' | 'cardigan' | 'cashmere' | 'blazer' | 'goldblazer' | 'tweed' | 'uniform' | 'hawaiian' | 'argyle' | 'tourpolo';
export type Bottoms = 'trousers' | 'shorts' | 'plusfours' | 'tartan' | 'skirt';
export type Hat = 'none' | 'cap' | 'visor' | 'flatcap' | 'bucket' | 'printbucket' | 'tourcap' | 'goldvisor' | 'cowboy';

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
  putter?: 'classic' | 'gold' | 'chrome';
  crestBag?: boolean;
  // Pro Shop pieces (src/shop.ts)
  bagStyle?: 'goldstaff' | 'school';
  aviators?: boolean;
  chain?: boolean;
  watch?: boolean;
  caddie?: boolean; // the Club Legend's own caddie, standing by with the bag
  caddieBib?: string; // the name on the caddie's bib
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

// Hank, the starter: on the first tee in a navy club blazer and a flat cap, sending each group off.
export const HANK_SPEC: GolferSpec = {
  ...DEFAULT_SPEC,
  skin: '#d29a6e',
  build: 'broad',
  hair: 'short',
  hairColor: '#9c9c98',
  face: 'stubble',
  top: 'blazer',
  topColor: '#1f2d4a',
  bottoms: 'trousers',
  bottomsColor: '#6b6a64',
  hat: 'flatcap',
  hatColor: '#7a6a4f',
  shoes: 'saddle',
  glove: false,
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

function patternTex(kind: 'argyle' | 'tartan' | 'tweed' | 'hawaiian', a: string, b: string) {
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
  } else if (kind === 'hawaiian') {
    // hibiscus and palm fronds, loud
    const flower = (cx: number, cy: number, r: number, col: string) => {
      x.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        x.beginPath();
        x.ellipse(cx + Math.cos((k * 2 * Math.PI) / 5) * r, cy + Math.sin((k * 2 * Math.PI) / 5) * r, r * 0.9, r * 0.6, (k * 2 * Math.PI) / 5, 0, Math.PI * 2);
        x.fill();
      }
      x.fillStyle = '#f6d046';
      x.beginPath();
      x.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
      x.fill();
    };
    x.strokeStyle = '#2f7d4a';
    x.lineWidth = 3;
    for (const [px, py] of [[8, 50], [40, 18], [58, 58]]) {
      x.beginPath();
      x.moveTo(px, py);
      x.quadraticCurveTo(px + 10, py - 14, px + 20, py - 6);
      x.stroke();
    }
    flower(16, 16, 6, b);
    flower(46, 40, 7, b);
    flower(54, 8, 4, '#f4f1e8');
    flower(20, 48, 4, '#f4f1e8');
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

// a little sponsor patch for the tour polo: made-up names, no real brands
function patchTex(text: string, bg: string, fg: string) {
  const key = `patch|${text}|${bg}|${fg}`;
  const hit = mats.get(key) as THREE.MeshBasicMaterial | undefined;
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, 128, 48);
  x.fillStyle = fg;
  x.font = '800 26px system-ui, sans-serif';
  x.textAlign = 'center';
  x.fillText(text, 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  mats.set(key, mat);
  return mat;
}
const GOLD = () => m('#d4af37', 0.25, { metalness: 0.9 });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
// the torso's shape, hips to the base of the neck (from y -0.12 to 1.95 on the spine): [share of the way, radius]
const TORSO_FROM = 0.02;
const TORSO_TO = 1.95;
const TORSO: [number, number][] = [[0, 0.455], [0.1, 0.45], [0.27, 0.43], [0.45, 0.47], [0.63, 0.52], [0.75, 0.55], [0.85, 0.53], [0.925, 0.45], [0.972, 0.32], [1, 0.2]];
function torsoR(y: number) {
  const t = (y - TORSO_FROM) / (TORSO_TO - TORSO_FROM);
  for (let i = 1; i < TORSO.length; i++)
    if (t <= TORSO[i][0]) {
      const [t0, r0] = TORSO[i - 1];
      const [t1, r1] = TORSO[i];
      return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
    }
  return TORSO[TORSO.length - 1][1];
}
const smoothT = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// hair: matte, with fine strands combed through it so it doesn't shine like a helmet
function hairMat(color: string) {
  const key = `hair|${color}`;
  const hit = mats.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 160; i++) {
    x.strokeStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
    x.lineWidth = 1;
    const px = (i * 37) % 64;
    x.beginPath();
    x.moveTo(px, 0);
    x.quadraticCurveTo(px + 6, 32, px - 2, 64);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  const mt = new THREE.MeshStandardMaterial({ map: t, roughness: 0.92 });
  mats.set(key, mt);
  return mt;
}

// a colour lighter (k > 0) or darker (k < 0)
function shade(hex: string, k: number) {
  const c = new THREE.Color(hex);
  return '#' + (k < 0 ? c.multiplyScalar(1 + k) : c.lerp(new THREE.Color('#ffffff'), k)).getHexString();
}
// lips: the skin, a little deeper and rosier
const lipOf = (skin: string) => '#' + new THREE.Color(skin).lerp(new THREE.Color('#9b4a44'), 0.38).getHexString();
// eyes: brown for most, blue or green for fair skin with light hair
function eyeOf(s: GolferSpec) {
  const fair = new THREE.Color(s.skin).getHSL({ h: 0, s: 0, l: 0 }).l > 0.72;
  if (!fair) return '#4a301e';
  const light = new THREE.Color(s.hairColor).getHSL({ h: 0, s: 0, l: 0 }).l > 0.45;
  return light ? '#4c7694' : '#5d6e3f';
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

export function buildClub(id: ClubId, finish: GolferSpec['putter'] = 'classic') {
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
    const look = finish === 'gold' ? m('#d4af37', 0.25, { metalness: 0.9 }) : finish === 'chrome' ? m('#eef2f6', 0.05, { metalness: 1 }) : m('#b9bcc2', 0.25, { metalness: 0.9 });
    head = mesh(new THREE.BoxGeometry(0.42, 0.14, 0.12), look);
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

function buildBag(color: string, crest: boolean, style?: GolferSpec['bagStyle'], kit?: { primary: string; secondary: string; mono: string }) {
  const g = new THREE.Group();
  const gold = style === 'goldstaff';
  const school = style === 'school';
  const body = mesh(new THREE.CylinderGeometry(gold ? 0.44 : 0.38, gold ? 0.4 : 0.34, 2.8, 14), gold ? GOLD() : m(school && kit ? kit.primary : color, 0.6));
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
  // the gold staff bag: black bands top and bottom; the school bag: its colours, bands and letters
  if (gold || school) {
    const band = gold ? m('#141414', 0.4) : m(kit?.secondary ?? '#f4f1e8', 0.6);
    for (const y of [0.4, 2.55]) g.add(mesh(new THREE.CylinderGeometry(gold ? 0.45 : 0.39, gold ? 0.45 : 0.39, 0.22, 14), band).translateY(y));
    if (school && kit) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), monoTex(kit.mono, kit.secondary));
      p.position.set(0, 1.6, 0.36);
      g.add(p);
    }
  }
  g.rotation.z = 0.18;
  return g;
}

// ---------- the caddie ----------

// A Club Legend's caddie: club-green shirt under a white bib with the member's name across it, a white cap, and the
// member's own bag at their side.
function caddie(owner: GolferSpec) {
  const spec: GolferSpec = {
    ...DEFAULT_SPEC,
    skin: '#c08a60',
    hair: 'short',
    hairColor: '#2b1d14',
    top: 'vest',
    topColor: '#163b2c',
    accent: '#f7f7f4',
    bottoms: 'trousers',
    bottomsColor: '#1f2d4a',
    hat: 'cap',
    hatColor: '#f7f7f4',
    glove: false,
    shoes: 'white',
    bag: owner.bag,
    crestBag: owner.crestBag,
    bagStyle: owner.bagStyle,
    kit: owner.kit,
    height: 0.97,
    caddie: false,
  };
  const g = new Golfer(spec).group;
  const name = (owner.caddieBib ?? '').toUpperCase().slice(0, 12);
  if (name) {
    const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), patchTex(name, '#f7f7f4', '#163b2c'));
    bib.position.set(0, 4.3, 0.43);
    g.add(bib);
  }
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
      s.top === 'tweed'
        ? patternTex('tweed', s.topColor, '#00000033')
        : s.top === 'hawaiian'
          ? patternTex('hawaiian', '#1f8a9e', '#f0603f')
          : s.top === 'argyle'
            ? patternTex('argyle', s.topColor, s.accent)
            : m(s.top === 'cashmere' ? '#eadfc8' : s.top === 'tourpolo' ? '#f7f7f4' : s.topColor, s.top === 'cardigan' || s.top === 'cashmere' ? 0.95 : 0.7);
    // short sleeves and an open collar
    const shortSleeve = s.top === 'polo' || s.top === 'vest' || s.top === 'uniform' || s.top === 'hawaiian' || s.top === 'tourpolo';
    const bottomMat = s.bottoms === 'tartan' ? patternTex('tartan', s.bottomsColor, '#163b2c') : m(s.bottomsColor, 0.8);
    const shoeMat = m(s.shoes === 'white' ? '#f4f2ec' : s.shoes === 'saddle' ? '#7b4a2a' : '#1c1c1c', 0.4);
    this.group.add(this.hips);
    this.hips.position.y = 3.05;
    const tw = Math.sqrt(w); // limbs thicken less than the torso widens
    const lipM = m(lipOf(s.skin), 0.55);
    const sockM = m('#f4f2ec', 0.9);

    // the pelvis, in the bottoms (a skirt goes over it)
    const pelvis = mesh(lathe(V(0, -0.36, 0), V(0, 0.2, 0), [[0, 0.32], [0.25, 0.44], [0.6, 0.47], [1, 0.45]], 18), bottomMat);
    pelvis.scale.set(w * 1.02, 1, 0.66 * w);
    this.hips.add(pelvis);

    // legs: hip joint -> knee -> ankle, shaped: a thigh, a knee, a calf, a tapered ankle
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.24 * side * w, 0, 0);
      this.hips.add(hip);
      const top = V(0, 0.1, 0);
      const ankle = V(0, -2.78, 0);
      // a bare leg: thigh, knee, calf, ankle
      const LEG: [number, number][] = [[0, 0.24 * tw], [0.18, 0.225 * tw], [0.45, 0.16 * tw], [0.5, 0.155 * tw], [0.62, 0.175 * tw], [0.8, 0.135 * tw], [1, 0.09]];
      if (s.bottoms === 'shorts') {
        const hem = V(0, -0.98, 0.015);
        hip.add(mesh(lathe(top, hem, [[0, 0.27 * tw], [0.8, 0.255 * tw], [1, 0.25 * tw]], 16), bottomMat));
        hip.add(mesh(lathe(top, ankle, LEG, 14), skin));
        hip.add(mesh(lathe(V(0, -2.42, 0), ankle.clone().add(V(0, -0.05, 0)), [[0, 0.14], [1, 0.128]], 12), sockM));
      } else if (s.bottoms === 'plusfours' || s.bottoms === 'tartan') {
        const cuff = V(0, -1.8, 0.04);
        hip.add(mesh(lathe(top, cuff, [[0, 0.27 * tw], [0.55, 0.32 * tw], [0.9, 0.27 * tw], [1, 0.17 * tw]], 16), bottomMat));
        hip.add(mesh(lathe(cuff, ankle, [[0, 0.17], [0.3, 0.165], [1, 0.11]], 12), patternTex('argyle', '#1f2d4a', '#7a1f2b')));
      } else if (s.bottoms === 'skirt') {
        hip.add(mesh(lathe(top, ankle, LEG, 14), skin));
        hip.add(mesh(lathe(V(0, -2.5, 0), ankle.clone().add(V(0, -0.05, 0)), [[0, 0.135], [1, 0.125]], 12), sockM));
      } else {
        // trousers: a straight leg, a little fuller at the thigh, breaking over the shoe
        hip.add(mesh(lathe(top, ankle.clone().add(V(0, -0.06, 0.01)), [[0, 0.29 * tw], [0.2, 0.27 * tw], [0.48, 0.215 * tw], [0.9, 0.2 * tw], [1, 0.205 * tw]], 16), bottomMat));
      }
      if (s.bottoms === 'skirt' && side < 0) {
        const sk = mesh(lathe(V(0, -1.15, 0), V(0, 0.22, 0), [[0, 0.66], [0.5, 0.56], [1, 0.46]], 22), bottomMat);
        sk.scale.set(w, 1, 0.8 * w);
        sk.position.x = -0.24 * side * w;
        hip.add(sk);
      }
      const sh = shoe(shoeMat, m(s.shoes === 'black' ? '#2a2a2a' : '#f7f6f2', 0.5), s.shoes === 'saddle' ? m('#3a2416', 0.4) : undefined);
      sh.position.set(0, -2.93, 0.02);
      sh.rotation.y = 0.08 * side;
      hip.add(sh);
      this.legs.push(hip);
    }

    // torso: hips, waist, chest and shoulders in one shaped piece, flatter front to back
    this.hips.add(this.spine);
    const torso = mesh(lathe(V(0, TORSO_FROM, 0), V(0, TORSO_TO, 0), TORSO, 22), topMat);
    torso.scale.set(w * 1.05, 1, 0.66 * w);
    this.spine.add(torso);
    // where the front of the chest is at a height, for things worn on it
    const frontZ = (y: number) => torsoR(y) * 0.66 * w + 0.012;
    // belt
    if (s.top === 'polo' || s.top === 'quarterzip' || s.top === 'vest' || s.top === 'uniform' || s.top === 'hawaiian' || s.top === 'tourpolo' || s.top === 'argyle')
      {
      const belt = mesh(new THREE.CylinderGeometry(1, 1, 0.13, 22), m('#2a1d14', 0.5));
      belt.scale.set(torsoR(0.1) * 1.05 * w + 0.02, 1, torsoR(0.1) * 0.66 * w + 0.02);
      belt.position.y = 0.1;
      this.spine.add(belt);
      const buckle = mesh(new THREE.BoxGeometry(0.12, 0.09, 0.03), m('#c9a24a', 0.3, { metalness: 0.8 }));
      buckle.position.set(0, 0.1, torsoR(0.1) * 0.66 * w + 0.025);
      this.spine.add(buckle);
    }
    if (s.top === 'vest') {
      // a sweater vest over the shirt: the torso's own shape, a touch bigger, waist to chest
      const v = mesh(lathe(V(0, 0.18, 0), V(0, 1.78, 0), TORSO.slice(1, 8).map(([t, r]) => [(t * (TORSO_TO - TORSO_FROM) + TORSO_FROM - 0.18) / 1.6, r + 0.03] as [number, number]).filter(([t]) => t >= 0 && t <= 1), 22), m(s.accent, 0.95));
      v.scale.set(w * 1.05, 1, 0.66 * w);
      this.spine.add(v);
    }
    if (s.top === 'polo' || s.top === 'vest' || s.top === 'uniform' || s.top === 'hawaiian' || s.top === 'tourpolo' || s.top === 'argyle') {
      const collar = mesh(new THREE.TorusGeometry(0.21, 0.055, 8, 20), s.top === 'hawaiian' ? topMat : m(s.top === 'vest' || s.top === 'argyle' ? '#f4f1e8' : s.top === 'tourpolo' ? '#141414' : s.accent, 0.7));
      collar.rotation.x = Math.PI / 2 - 0.3;
      collar.scale.set(w, 1, 0.9);
      collar.position.set(0, 1.9, 0.03);
      this.spine.add(collar);
    }
    if (s.top === 'quarterzip' || s.top === 'cashmere') {
      this.spine.add(mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.3, 14), kit ? m(kit.secondary, 0.8) : topMat).translateY(1.8));
      this.spine.add(mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), m('#b8955a', 0.3, { metalness: 0.7 })).translateY(1.55).translateZ(0.4));
    }
    // the kit's letters, on the left of the chest
    if (kit) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.25), monoTex(kit.mono, kit.secondary));
      patch.position.set(0.2 * w, 1.5, frontZ(1.5) - 0.01);
      patch.rotation.y = 0.3;
      this.spine.add(patch);
    }
    // the tour polo: sponsor patches on the chest and both sleeves (made-up names)
    if (s.top === 'tourpolo') {
      const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), patchTex('CLAUDE', '#163b2c', '#e6cf9f'));
      chest.position.set(0.2 * w, 1.5, frontZ(1.5) - 0.01);
      chest.rotation.y = 0.3;
      this.spine.add(chest);
      const left = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), patchTex('BIRDIE', '#e2543d', '#ffffff'));
      left.position.set(-0.2 * w, 1.52, frontZ(1.52) - 0.01);
      left.rotation.y = -0.3;
      this.spine.add(left);
      const belly = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.13), patchTex('CCC TOUR', '#141414', '#d4af37'));
      belly.position.set(0, 1.18, frontZ(1.18) + 0.01);
      this.spine.add(belly);
    }
    if (s.top === 'cardigan' || s.top === 'blazer' || s.top === 'goldblazer' || s.top === 'tweed') {
      // shirt and tie showing at the open front, and lapels
      this.spine.add(mesh(new THREE.BoxGeometry(0.34, 0.75, 0.05), m('#f6f3ea', 0.6)).translateY(1.45).translateZ(frontZ(1.45)));
      if (s.top !== 'cardigan' && !s.bowtie) this.spine.add(mesh(new THREE.BoxGeometry(0.1, 0.6, 0.03), m(s.top === 'goldblazer' ? '#b8955a' : '#7a1f2b', 0.5)).translateY(1.4).translateZ(frontZ(1.4) + 0.02));
      const trim = s.top === 'goldblazer' ? m('#c9a24a', 0.3, { metalness: 0.6 }) : topMat;
      for (const side of [-1, 1]) {
        const lap = mesh(new THREE.BoxGeometry(0.14, 0.7, 0.04), trim);
        lap.position.set(0.17 * side, 1.45, frontZ(1.45) + 0.02);
        lap.rotation.z = 0.25 * side;
        this.spine.add(lap);
      }
      if (s.top === 'blazer' || s.top === 'goldblazer') {
        const badge = mesh(new THREE.CircleGeometry(0.08, 12), m('#b8955a', 0.3, { metalness: 0.6 }));
        badge.position.set(-0.3, 1.35, frontZ(1.35) + 0.03);
        this.spine.add(badge);
      }
    }
    // a gold chain round the neck, with a little club-head pendant
    if (s.chain) {
      const c = mesh(new THREE.TorusGeometry(0.25, 0.03, 8, 28), GOLD());
      c.rotation.x = Math.PI / 2 - 0.75;
      c.scale.set(w, 1, 1);
      c.position.set(0, 1.76, 0.12);
      this.spine.add(c);
      this.spine.add(mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), GOLD()).translateY(1.6).translateZ(frontZ(1.6) + 0.02));
    }
    if (s.bowtie) this.spine.add(mesh(new THREE.BoxGeometry(0.26, 0.09, 0.05), m('#163b2c', 0.5)).translateY(1.84).translateZ(frontZ(1.84) + 0.03));

    // head: a sculpted skull and face on a neck
    this.spine.add(this.head);
    this.head.position.y = 1.95;
    this.head.add(mesh(lathe(V(0, -0.25, -0.02), V(0, 0.3, -0.03), [[0, 0.21], [0.4, 0.175], [1, 0.17]], 14, 0.92), skin));
    this.head.add(mesh(headGeo(), skin));
    const eyeY = HEAD_Y + 0.07 * HEAD_R;
    const eyeX = 0.3 * HEAD_R;
    const brow = s.hair === 'bald' ? '#9a8a78' : s.hairColor === '#e8e6e0' || s.hairColor === '#9c9c98' ? '#8f8f8a' : s.hairColor;
    for (const side of [-1, 1]) {
      const ex = eyeX * side;
      const ez = faceZ(ex, eyeY);
      const eye = new THREE.Group();
      eye.position.set(ex, eyeY, ez - 0.024);
      eye.add(mesh(shared('eyeball', () => new THREE.SphereGeometry(0.052, 12, 8)), m('#f7f3ec', 0.35)));
      const iris = mesh(new THREE.CircleGeometry(0.03, 18), m(eyeOf(s), 0.3));
      iris.position.z = 0.0515;
      eye.add(iris);
      const pupil = mesh(new THREE.CircleGeometry(0.014, 14), m('#0c0a09', 0.2));
      pupil.position.z = 0.052;
      eye.add(pupil);
      const glint = mesh(new THREE.CircleGeometry(0.0055, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      glint.position.set(0.009, 0.01, 0.0525);
      eye.add(glint);
      // the lids: the upper one over the top of the eye, a softer lower one
      const lid = mesh(shared('lid', () => new THREE.SphereGeometry(0.057, 12, 5, 0, Math.PI * 2, 0, 0.95)), skin);
      lid.rotation.x = 0.12;
      eye.add(lid);
      const low = mesh(shared('lowlid', () => new THREE.SphereGeometry(0.055, 12, 4, 0, Math.PI * 2, 2.55, 0.6)), skin);
      low.rotation.x = -0.25;
      eye.add(low);
      this.head.add(eye);
      // the brow, a soft arch
      const by = eyeY + 0.07;
      const bz = faceZ(ex, by) + 0.008;
      const arch = new THREE.CatmullRomCurve3([V(ex - 0.065 * side, by - 0.008, bz - 0.012), V(ex - 0.005 * side, by + 0.012, bz + 0.004), V(ex + 0.06 * side, by - 0.004, bz - 0.022)]);
      this.head.add(mesh(new THREE.TubeGeometry(arch, 8, 0.0135, 6, false), m(brow, 0.9)));
      // the ears: a shell with a darker hollow
      const ear = mesh(new THREE.SphereGeometry(1, 14, 10), skin);
      ear.scale.set(0.032, 0.088, 0.062);
      ear.position.set(0.348 * side, HEAD_Y + 0.01, -0.03);
      ear.rotation.y = -0.35 * side;
      this.head.add(ear);
      const hollow = mesh(new THREE.SphereGeometry(1, 10, 8), m(shade(s.skin, -0.18), 0.7));
      hollow.scale.set(0.012, 0.05, 0.034);
      hollow.position.set(0.37 * side, HEAD_Y, -0.025);
      hollow.rotation.y = -0.35 * side;
      this.head.add(hollow);
    }
    // the nose: a bridge, a rounded tip and the wings either side
    const ny = HEAD_Y - 0.11 * HEAD_R;
    const nz = faceZ(0, ny);
    this.head.add(mesh(lathe(V(0, eyeY + 0.01, faceZ(0, eyeY) - 0.01), V(0, ny + 0.015, nz + 0.045), [[0, 0.026], [0.6, 0.03], [1, 0.034]], 10, 0.8), skin));
    this.head.add(mesh(joint(V(0, ny + 0.005, nz + 0.042), 0.033), skin));
    for (const side of [-1, 1]) this.head.add(mesh(joint(V(0.03 * side, ny - 0.006, nz + 0.018), 0.022), skin));
    // the mouth: upper and lower lips, a slight smile at the corners
    const my = HEAD_Y - 0.46 * HEAD_R;
    const mz = faceZ(0, my) + (s.face === 'beard' ? 0.03 : 0.002);
    const lip = (y: number, r: number, curve: number) =>
      mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.055, y + curve, mz - 0.018), V(0, y, mz + 0.004), V(0.055, y + curve, mz - 0.018)]), 10, r, 8, false), lipM);
    this.head.add(lip(my + 0.012, 0.014, 0.006));
    this.head.add(lip(my - 0.012, 0.017, 0.01));
    this.head.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.058, my + 0.008, mz - 0.016), V(0, my, mz + 0.006), V(0.058, my + 0.008, mz - 0.016)]), 10, 0.005, 5, false), m(shade(lipOf(s.skin), -0.35), 0.6)));
    this.addHair(s);
    this.addFaceHair(s);
    this.addHat(s);
    if (s.aviators) {
      const lens = m('#1d2a33', 0.05, { metalness: 0.6 });
      for (const side of [-1, 1]) {
        const l = mesh(new THREE.SphereGeometry(0.1, 12, 8), lens);
        l.scale.set(1.1, 0.85, 0.35);
        l.position.set(0.14 * side, 0.54, 0.42);
        this.head.add(l);
      }
      this.head.add(mesh(new THREE.BoxGeometry(0.42, 0.02, 0.02), GOLD()).translateY(0.6).translateZ(0.44));
    }
    if (s.monocle) {
      const mono = mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 16), m('#b8955a', 0.3, { metalness: 0.8 }));
      mono.position.set(-0.14, 0.55, 0.42);
      this.head.add(mono);
    }

    // arms and club live in the swing rig, pivoting at the chest
    this.spine.add(this.swing);
    this.swing.position.set(0, 1.45, 0.05);
    this.swing.add(this.plane);
    // the hands on the grip: the lead hand (the target side, +x) above the trail hand
    const grip = V(0, -2.05, 0.3);
    for (const side of [-1, 1]) {
      const lead = side > 0;
      const hand = grip.clone().add(V(0, lead ? -0.02 : -0.26, 0));
      const shoulder = V(0.6 * side * w, 0.12, 0);
      const wrist = hand.clone().add(V(0.05 * side, 0.08, -0.03));
      const elbow = shoulder.clone().lerp(wrist, 0.5).add(V(0.1 * side, 0, 0.07));
      this.plane.add(mesh(joint(shoulder, 0.19 * w, 0.85), topMat));
      // the arm under the sleeve: an upper arm with some shape to it, a forearm narrowing to the wrist
      this.plane.add(mesh(lathe(shoulder, elbow, [[0, 0.16 * tw], [0.35, 0.165 * tw], [0.8, 0.13 * tw], [1, 0.12 * tw]], 14, 0.9), skin));
      this.plane.add(mesh(joint(elbow, 0.118 * tw), skin));
      this.plane.add(mesh(lathe(elbow, wrist, [[0, 0.118 * tw], [0.3, 0.125 * tw], [0.8, 0.088], [1, 0.072]], 14, 0.82), skin));
      if (shortSleeve) {
        const hem = shoulder.clone().lerp(elbow, 0.58);
        this.plane.add(mesh(lathe(shoulder, hem, [[0, 0.205 * tw], [0.85, 0.185 * tw], [1, 0.18 * tw]], 16, 0.92), topMat));
      } else {
        const cuff = elbow.clone().lerp(wrist, 0.86);
        this.plane.add(mesh(lathe(shoulder, elbow, [[0, 0.205 * tw], [1, 0.165 * tw]], 16, 0.92), topMat));
        this.plane.add(mesh(joint(elbow, 0.165 * tw, 0.92), topMat));
        this.plane.add(mesh(lathe(elbow, cuff, [[0, 0.165 * tw], [0.85, 0.125], [1, 0.13]], 16, 0.88), topMat));
      }
      // the hand itself, fingers wrapped round the grip (the glove on the lead hand)
      const h = mesh(gripHand(side), s.glove && lead ? m('#f6f4ee', 0.65) : skin);
      h.position.copy(hand);
      this.plane.add(h);
      // the gold watch, on the lead wrist, its face turned out where it catches the light
      if (s.watch && lead) {
        const at = wrist.clone().lerp(elbow, 0.12);
        const axis = elbow.clone().sub(wrist).normalize();
        const band = mesh(new THREE.TorusGeometry(0.086, 0.022, 8, 18), GOLD());
        band.position.copy(at);
        band.quaternion.setFromUnitVectors(V(0, 0, 1), axis);
        this.plane.add(band);
        const outward = V(1, 0.15, 0.5).normalize();
        const face = new THREE.Group();
        face.position.copy(at).addScaledVector(outward, 0.09);
        face.quaternion.setFromUnitVectors(V(0, 1, 0), outward);
        face.add(mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 20), GOLD()));
        const dial = mesh(new THREE.CircleGeometry(0.044, 20), m('#f4efe2', 0.3));
        dial.rotation.x = -Math.PI / 2;
        dial.position.y = 0.0155;
        face.add(dial);
        const hands = mesh(new THREE.BoxGeometry(0.006, 0.002, 0.034), m('#1a1a1a', 0.4));
        hands.position.set(0, 0.017, -0.012);
        face.add(hands);
        this.plane.add(face);
      }
    }

    // bag at the side
    // the bag at the side, or for a Club Legend, their caddie standing by with it
    if (s.caddie) {
      const c = caddie(s);
      c.position.set(2.9, 0, -1.1);
      c.rotation.y = -0.3;
      c.name = 'bag';
      this.group.add(c);
    } else {
      const bag = buildBag(s.bag, !!s.crestBag, s.bagStyle, kitByKey(s.kit));
      bag.position.set(0.6, 0, -2.4);
      bag.name = 'bag';
      this.group.add(bag);
    }

    this.group.scale.setScalar(s.height);
    // a few draw calls per golfer, not a hundred: there can be dozens in the stands
    mergeStatic(this.group);
    this.group.traverse((o) => (o.castShadow = true));
    this.setPose('idle');
  }

  private addHair(s: GolferSpec) {
    if (s.hair === 'bald') return;
    const hm = hairMat(s.hairColor);
    // the hairline: high at the forehead, above the ears at the sides, low at the nape (longer hair, lower still)
    const nape = s.hair === 'long' ? -0.75 : -0.42;
    const line = (p: THREE.Vector3) => {
      const front = 0.5 - 0.12 * Math.abs(p.x);
      let hl = nape + (front - nape) * smoothT(-0.45, 0.55, p.z);
      // clear of the ears, with a short sideburn in front of them
      const ear = Math.abs(p.x) > 0.55 && p.z > -0.35 && p.z < 0.3;
      if (ear) hl = Math.max(hl, p.z > 0.12 ? -0.1 : 0.14);
      return smoothT(hl - 0.04, hl + 0.04, p.y);
    };
    const full = s.hair === 'curly' ? 1.05 : s.hair === 'short' ? 1.055 : 1.07;
    this.head.add(mesh(headLayer(`hair|${s.hair}`, full, line), hm));
    if (s.hair === 'side') {
      // a side parting: the hair swept up and over from one side
      this.head.add(mesh(headLayer('sweep', 1.12, (p) => line(p) * smoothT(0.3, 0.55, p.y) * smoothT(-0.3, 0.3, p.z) * smoothT(-0.5, 0.2, p.x)), hm));
    } else if (s.hair === 'curly') {
      const curl = shared('curl', () => new THREE.SphereGeometry(0.09, 7, 5));
      for (let i = 0; i < 56; i++) {
        // spread over the top of the head on a golden-angle spiral
        const t = i / 56;
        const yy = 1 - t * 1.25;
        const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
        const a = i * 2.39996;
        const dir = V(Math.cos(a) * rr, yy, Math.sin(a) * rr);
        const p = new THREE.Vector3();
        const sp = shapeOf(dir);
        if (line(sp) < 0.5) continue;
        p.copy(sp).multiplyScalar(HEAD_R * 1.05).add(V(0, HEAD_Y, 0));
        const c = mesh(curl, hm);
        c.position.copy(p);
        c.scale.setScalar(0.85 + ((i * 7) % 5) * 0.08);
        this.head.add(c);
      }
    } else if (s.hair === 'long') {
      // falling behind the shoulders
      const back = mesh(lathe(V(0, HEAD_Y + 0.05, -0.12), V(0, -0.55, -0.3), [[0, 0.33], [0.4, 0.34], [0.85, 0.3], [1, 0.2]], 18, 0.55), hm);
      this.head.add(back);
    } else if (s.hair === 'bun') {
      this.head.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), hm).translateY(HEAD_Y + 0.36).translateZ(-0.3));
    }
  }

  private addFaceHair(s: GolferSpec) {
    if (s.face === 'none') return;
    const hm = hairMat(s.hairColor);
    // the beard line: along the jaw, up in front of the ears, clear of the mouth and cheeks
    const beard = (p: THREE.Vector3) => smoothT(-0.05, -0.25, p.y + 0.2 * Math.max(0, p.z - 0.3)) * smoothT(-0.45, -0.15, p.z) * (Math.abs(p.x) > 0.5 && p.y > -0.1 ? smoothT(0.25, -0.05, p.y) : 1);
    if (s.face === 'beard') {
      this.head.add(mesh(headLayer('beard', 1.08, (p) => Math.max(beard(p), smoothT(-0.5, -0.65, p.y) * smoothT(-0.2, 0.1, p.z))), hm));
    } else if (s.face === 'stubble') {
      this.head.add(mesh(headLayer('stubble', 1.012, beard), new THREE.MeshStandardMaterial({ color: s.hairColor, transparent: true, opacity: 0.32, roughness: 1 })));
    }
    if (s.face === 'moustache' || s.face === 'beard') {
      const my = HEAD_Y - 0.36 * HEAD_R;
      const z = faceZ(0, my) + (s.face === 'beard' ? 0.035 : 0.012);
      for (const side of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([V(0, my + 0.008, z + 0.004), V(0.04 * side, my, z - 0.004), V(0.075 * side, my - 0.02, z - 0.03)]);
        this.head.add(mesh(new THREE.TubeGeometry(curve, 8, s.face === 'beard' ? 0.022 : 0.026, 8, false), hm));
      }
    }
  }

  private addHat(s: GolferSpec) {
    if (s.hat === 'none') return;
    const hm = m(s.hatColor, 0.8);
    if (s.hat === 'cap' || s.hat === 'visor' || s.hat === 'tourcap' || s.hat === 'goldvisor') {
      const cap = s.hat === 'cap' || s.hat === 'tourcap';
      if (cap) this.head.add(mesh(headLayer('cap', 1.13, (p) => smoothT(0.08, 0.16, p.y + 0.22 * Math.max(0, -p.z) - 0.1 * Math.max(0, p.z - 0.5))), hm));
      else {
        // the visor's band, round the head at the brow
        const band = mesh(new THREE.TorusGeometry(0.4, 0.05, 8, 24), s.hat === 'goldvisor' ? GOLD() : hm);
        band.rotation.x = Math.PI / 2 - 0.12;
        band.scale.set(0.93, 1, 1);
        band.position.set(0, HEAD_Y + 0.2, 0.0);
        this.head.add(band);
      }
      // the tour cap's gold button, and a little crest on the front
      if (s.hat === 'tourcap') {
        this.head.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), GOLD()).translateY(1.01));
        this.head.add(mesh(new THREE.CircleGeometry(0.09, 12), GOLD()).translateY(0.78).translateZ(0.44));
      }
      // the brim: curved down at the sides, the way a broken-in cap is
      const bg = new THREE.CylinderGeometry(0.3, 0.3, 0.035, 20, 1, false, -Math.PI / 2, Math.PI);
      const bp = bg.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) - 0.55 * bp.getX(i) ** 2 + 0.25 * bp.getZ(i) * 0.3);
      bg.computeVertexNormals();
      const brim = mesh(bg, s.hat === 'goldvisor' ? GOLD() : hm);
      brim.position.set(0, HEAD_Y + 0.17, faceZ(0, HEAD_Y + 0.17) - 0.07);
      brim.scale.set(1.15, 1, 1.2);
      this.head.add(brim);
    } else if (s.hat === 'flatcap') {
      const c = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, 1.2), s.hatColor === '#f4f1e8' ? patternTex('tweed', '#8a7a5a', '#00000044') : hm);
      c.position.set(0, 0.58, 0.06);
      c.scale.set(1, 0.65, 1.15);
      this.head.add(c);
    } else if (s.hat === 'cowboy') {
      // a tall pinched crown and a wide brim curling up at the sides
      const crown = mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.55, 16), hm);
      crown.position.y = 0.95;
      crown.scale.z = 0.85;
      this.head.add(crown);
      this.head.add(mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 18), m('#3a2a1c', 0.5)).translateY(0.74).rotateX(Math.PI / 2));
      // the brim: flat by the crown, curling up at the edges
      const profile = [new THREE.Vector2(0.4, 0), new THREE.Vector2(0.62, 0.0), new THREE.Vector2(0.78, 0.05), new THREE.Vector2(0.9, 0.17), new THREE.Vector2(0.9, 0.2), new THREE.Vector2(0.78, 0.09), new THREE.Vector2(0.62, 0.04), new THREE.Vector2(0.4, 0.04)];
      const brim = mesh(new THREE.LatheGeometry(profile, 28), hm);
      brim.position.y = 0.7;
      brim.scale.set(1, 1, 0.82);
      this.head.add(brim);
    } else {
      const mat = s.hat === 'printbucket' ? patternTex('hawaiian', s.hatColor, '#e2543d') : hm;
      this.head.add(mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.38, 16), mat).translateY(0.86));
      this.head.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.04, 20), mat).translateY(0.7));
    }
  }

  holdClub(id: ClubId | null) {
    if (this.clubId === id) return;
    if (this.club) this.plane.remove(this.club);
    this.club = null;
    this.clubId = id;
    if (!id) return;
    this.club = buildClub(id, id === 'putter' ? this.spec.putter : 'classic');
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
      // hands resting on the club in front, where they can be seen
      target.tilt = -0.2;
    } else if (p === 'clasp') {
      target.tilt = -0.16;
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
    this.group.traverse((o) => {
      const g = (o as THREE.Mesh).geometry;
      if (g) disposeGeo(g);
    });
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
