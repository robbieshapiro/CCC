// The new-member welcome: up the drive, Reginald in the foyer, the locker room, your locker, then your tee time.
// One renderer; the three sets sit far apart in one scene and the camera travels between them.
import * as THREE from 'three';
import { api, localApi, useSupabase } from '../api';
import type { Avatar, Snapshot } from '../api/types';
import { specOf } from '../avatar';
import { sfx } from '../fx/sound';
import { courseFor } from '../golf3d/courses';
import { DEFAULT_SPEC, Golfer, type GolferSpec } from '../golf3d/golfer';
import * as props from '../golf3d/props';
import { refresh, requireSession } from '../state';
import { esc, navigate, render } from '../ui';
import { lockerPanel } from '../screens/locker';
import { crest } from '../brand';

const REGINALD_SPEC: GolferSpec = {
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

type Shot = { pos: THREE.Vector3; look: THREE.Vector3 };

let stop: (() => void) | null = null;
export function closeWelcome() {
  stop?.();
  stop = null;
  document.body.classList.remove('court-open');
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const mat = (color: string, rough = 0.8, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const box = (w: number, h: number, d: number, m: THREE.Material) => {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};

function plate(text: string, w = 256, h = 64, font = '600 30px Georgia, serif', bg = '#b8955a', fg = '#1d2420') {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, w, h);
  x.fillStyle = fg;
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: bg === '#b8955a' ? 0.5 : 0 });
}

// ---------- the three sets ----------

function arrival(scene: THREE.Scene) {
  const g = new THREE.Group();
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat('#4c8a3f', 1));
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  g.add(lawn);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(20, 420), mat('#d5c49c', 1));
  drive.rotation.x = -Math.PI / 2;
  drive.position.set(0, 0.05, -150);
  drive.receiveShadow = true;
  g.add(drive);
  for (let z = 40; z > -330; z -= 26)
    for (const side of [-1, 1]) {
      const t = props.cypress(1 + ((z * side) % 3) * 0.05);
      t.position.set(side * 18, 0, z);
      g.add(t);
    }
  for (let i = 0; i < 24; i++) {
    const t = props.oak(1 + (i % 4) * 0.15);
    t.position.set((i % 2 ? 1 : -1) * (60 + (i * 37) % 140), 0, -40 - i * 16);
    g.add(t);
  }
  // the gates
  const stone = mat('#e3dac6', 0.7);
  for (const side of [-1, 1]) {
    const pillar = box(4, 14, 4, stone);
    pillar.position.set(side * 13, 7, -20);
    g.add(pillar);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), mat('#b8955a', 0.3, { metalness: 0.7 }));
    ball.position.set(side * 13, 15.6, -20);
    g.add(ball);
    for (let i = 0; i < 9; i++) {
      const bar = box(0.3, 11, 0.3, mat('#1b1d1c', 0.4, { metalness: 0.6 }));
      bar.position.set(side * (1 + i * 1.2), 5.5 + Math.sin((i / 9) * Math.PI) * 1.2, -20);
      bar.rotation.y = side * 0;
      g.add(bar);
    }
  }
  const sign = box(14, 3, 0.4, [mat('#1b1d1c'), mat('#1b1d1c'), mat('#1b1d1c'), mat('#1b1d1c'), plate("C  C  C", 512, 96, '600 54px Georgia, serif', '#163b2c', '#e6cf9f'), mat('#1b1d1c')] as unknown as THREE.Material);
  sign.position.set(0, 13.5, -20);
  g.add(sign);
  const house = props.clubhouse(160);
  house.rotation.y = -Math.PI / 2;
  house.position.set(0, 0, -340);
  g.add(house);
  const flag = props.flagpole();
  flag.position.set(-30, 0, -300);
  g.add(flag);
  scene.add(g);
  return g;
}

export function room(scene: THREE.Scene, ox: number, floor: THREE.Material, wall: THREE.Material) {
  const g = new THREE.Group();
  g.position.x = ox;
  const f = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), floor);
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  g.add(f);
  for (const [x, z, ry, w] of [
    [0, -20, 0, 60],
    [-30, 0, Math.PI / 2, 40],
    [30, 0, -Math.PI / 2, 40],
  ] as const) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 20), wall);
    p.position.set(x, 10, z);
    p.rotation.y = ry;
    p.receiveShadow = true;
    g.add(p);
    const rail = box(w, 0.4, 0.3, mat('#5a3a22', 0.5));
    rail.position.set(x, 4, z);
    rail.rotation.y = ry;
    g.add(rail);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat('#efe6d2', 1));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 20;
  g.add(ceil);
  const light = new THREE.PointLight('#ffd9a0', 120, 70, 1.6);
  light.position.set(0, 16, 0);
  light.castShadow = true;
  g.add(light);
  scene.add(g);
  return g;
}

export function checker() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      x.fillStyle = (i + j) % 2 ? '#1d1d1b' : '#efe9dc';
      x.fillRect(i * 32, j * 32, 32, 32);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.25, metalness: 0.05 });
}

export function panelling() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const x = c.getContext('2d')!;
  x.fillStyle = '#6b4428';
  x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 4; i++) {
    x.strokeStyle = '#4a2d19';
    x.lineWidth = 6;
    x.strokeRect(i * 64 + 8, 10, 48, 108);
    x.strokeStyle = '#8a5a36';
    x.lineWidth = 2;
    x.strokeRect(i * 64 + 14, 16, 36, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(5, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

function foyer(scene: THREE.Scene) {
  const g = room(scene, 1000, checker(), panelling());
  const desk = box(14, 4, 4, mat('#5a3a22', 0.4));
  desk.position.set(0, 2, -8);
  g.add(desk);
  const top = box(14.6, 0.4, 4.6, mat('#2a1d14', 0.3));
  top.position.set(0, 4.2, -8);
  g.add(top);
  const book = box(2.4, 0.3, 1.8, mat('#7a1f2b', 0.6));
  book.position.set(3, 4.55, -7.4);
  g.add(book);
  const lamp = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.2, 16, 1, true), mat('#1f4a37', 0.5, { side: THREE.DoubleSide, emissive: '#3a2a10' }));
  lamp.position.set(-4.5, 6, -8);
  g.add(lamp);
  // the crest above the desk, framed in gold
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 300;
  const img = new Image();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  img.onload = () => {
    const x = c.getContext('2d')!;
    x.fillStyle = '#f3ecdc';
    x.fillRect(0, 0, 256, 300);
    x.drawImage(img, 28, 20, 200, 236);
    tex.needsUpdate = true;
  };
  img.src = `data:image/svg+xml,${encodeURIComponent(crest(200, 'fy').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
  const frame = box(8.4, 9.6, 0.4, mat('#b8955a', 0.3, { metalness: 0.7 }));
  frame.position.set(0, 13, -19.7);
  g.add(frame);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 8.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  pic.position.set(0, 13, -19.45);
  g.add(pic);
  // chandelier
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mat('#fff3c9', 0.3, { emissive: '#f0c96a', emissiveIntensity: 1.4 }));
    b.position.set(Math.cos(a) * 2.4, 17, Math.sin(a) * 2.4);
    g.add(b);
  }
  const reg = new Golfer(REGINALD_SPEC);
  reg.showBag(false);
  reg.setPose('clasp');
  reg.group.position.set(5.5, 0, -4.5);
  reg.group.rotation.y = -0.35;
  g.add(reg.group);
  return { g, reg };
}

// A row of lockers: every member's name on a brass plate. On the tour the newest member's plate starts
// blank and is engraved when Reginald shows them to it.
export function lockerRoom(scene: THREE.Scene, names: string[], blankLast = true) {
  const g = room(scene, 2000, mat('#7a5a3a', 0.5), panelling());
  const lockers: { x: number; name: string }[] = [];
  let newPlate: THREE.Mesh | null = null;
  const n = Math.max(6, names.length + 2);
  const step = 52 / n;
  for (let i = 0; i < n; i++) {
    const x = -26 + step * (i + 0.5);
    const body = box(step - 0.4, 12, 3, mat('#4a2d19', 0.5));
    body.position.set(x, 6, -18.4);
    g.add(body);
    const door = box(step - 1.4, 10.6, 0.2, mat('#6b4428', 0.45));
    door.position.set(x, 6.4, -16.8);
    g.add(door);
    for (let k = 0; k < 4; k++) {
      const vent = box(step - 3, 0.15, 0.1, mat('#3a2414'));
      vent.position.set(x, 10.2 - k * 0.5, -16.65);
      g.add(vent);
    }
    const name = names[i] ?? '';
    const blank = !name || (blankLast && i === names.length - 1);
    const nm = box(step - 2.2, 0.9, 0.12, blank ? mat('#b8955a', 0.3, { metalness: 0.6 }) : plate(name.toUpperCase(), 256, 64, '700 28px Georgia, serif'));
    nm.position.set(x, 11.3, -16.6);
    g.add(nm);
    if (i === names.length - 1) newPlate = nm;
    lockers.push({ x, name });
  }
  const bench = box(30, 1.2, 3, mat('#6b4428', 0.4));
  bench.position.set(0, 2, -6);
  g.add(bench);
  for (const x of [-12, 0, 12]) {
    const leg = box(0.6, 1.6, 2, mat('#2a1d14'));
    leg.position.set(x, 0.8, -6);
    g.add(leg);
  }
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), mat('#163b2c', 1));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.03, -4);
  g.add(rug);
  const engrave = () => {
    if (newPlate) newPlate.material = plate(names[names.length - 1].toUpperCase(), 256, 64, '700 28px Georgia, serif');
  };
  return { g, lockers, engrave };
}

// ---------- the flow ----------

const teeTime = () => {
  const d = new Date(Date.now() + 10 * 60_000);
  const m = Math.ceil(d.getMinutes() / 6) * 6;
  d.setMinutes(m, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
};

export async function welcome(snap0: Snapshot) {
  closeWelcome();
  let snap = snap0;
  if (!useSupabase && snap.players.length < 2) {
    localApi.seedDemo(requireSession());
    snap = await refresh();
  }
  const me = snap.players.find((p) => p.id === snap.me)!;
  // everyone already in the club, oldest first; the room fits about nine
  const others = snap.players.filter((p) => p.id !== snap.me).slice(0, 9);
  const course = courseFor(snap.month);
  let spec = specOf(me.avatar);

  render(`<div class="g3 intro" id="intro"><div class="intro-ui">
      <div class="intro-title" data-title></div>
      <div class="intro-dialog" data-dialog hidden></div>
      <div class="intro-builder" data-builder hidden></div>
      <div class="intro-card" data-card hidden></div>
      <button class="g3-pill intro-skip" data-skipall>Skip the tour</button>
    </div></div>`);
  document.body.classList.add('court-open');
  const host = document.getElementById('intro')!;
  const ui = host.querySelector('.intro-ui') as HTMLElement;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    return finishTour(true);
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.insertBefore(renderer.domElement, ui);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.3, 3000);
  // golden hour outside, warm lamps inside
  scene.background = new THREE.Color('#f2c98f');
  scene.fog = new THREE.Fog('#f0cfa0', 120, 700);
  scene.add(new THREE.HemisphereLight('#ffe6c0', '#4a5a30', 1.4));
  const sun = new THREE.DirectionalLight('#ffc98a', 2.4);
  sun.position.set(-120, 90, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, far: 600 });
  scene.add(sun);
  arrival(scene);
  const { reg } = foyer(scene);
  const { lockers, engrave } = lockerRoom(scene, [...others.map((p) => p.name), me.name]);
  const actors: Golfer[] = [reg];
  // the members stand at their lockers
  others.forEach((p, i) => {
    const gl = new Golfer(specOf(p.avatar));
    gl.holdClub(i % 2 ? 'driver' : 'putter');
    gl.setPose('idle');
    gl.group.position.set(2000 + lockers[i].x, 0, -12);
    gl.group.rotation.y = 0.15 * (i % 2 ? 1 : -1);
    scene.add(gl.group);
    actors.push(gl);
  });
  const mine = lockers[others.length];
  let you = new Golfer(spec);
  you.holdClub('driver');
  you.group.position.set(2000 + mine.x, 0, -11);
  scene.add(you.group);
  actors.push(you);

  // camera travel
  let from: Shot = { pos: v(0, 9, 140), look: v(0, 8, 0) };
  let to: Shot = from;
  let t = 1;
  let dur = 1;
  const go = (s: Shot, seconds: number) => {
    from = { pos: camera.position.clone(), look: curLook.clone() };
    to = s;
    t = 0;
    dur = seconds;
  };
  const curLook = from.look.clone();
  camera.position.copy(from.pos);
  // jump straight to a new set
  const cut = (s: Shot) => {
    camera.position.copy(s.pos);
    curLook.copy(s.look);
    from = to = s;
    t = 1;
  };

  let raf = 0;
  let last = performance.now();
  const resize = () => {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 62 : 48;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t = Math.min(1, t + dt / dur);
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    camera.position.lerpVectors(from.pos, to.pos, e);
    curLook.lerpVectors(from.look, to.look, e);
    camera.lookAt(curLook);
    actors.forEach((a) => a.update(dt));
    renderer.render(scene, camera);
  };
  loop();
  stop = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    actors.forEach((a) => a.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };

  const q = (s: string) => ui.querySelector(s) as HTMLElement;
  // one line of dialogue; resolves on tap
  const say = (who: string, text: string) =>
    new Promise<void>((res) => {
      const d = q('[data-dialog]');
      d.hidden = false;
      d.innerHTML = `<b>${esc(who)}</b><p></p><small>Tap to continue ▸</small>`;
      const p = d.querySelector('p')!;
      let i = 0;
      const type = window.setInterval(() => {
        i += 2;
        p.textContent = text.slice(0, i);
        if (i >= text.length) clearInterval(type);
      }, 18);
      const next = (e: Event) => {
        e.preventDefault();
        if (i < text.length) {
          i = text.length;
          p.textContent = text;
          return;
        }
        clearInterval(type);
        host.removeEventListener('pointerdown', next);
        d.hidden = true;
        sfx('tick');
        res();
      };
      window.setTimeout(() => host.addEventListener('pointerdown', next), 250);
    });
  const title = (eyebrow: string, text: string) => {
    q('[data-title]').innerHTML = eyebrow ? `<p class="eyebrow">${eyebrow}</p><h1>${text}</h1>` : '';
  };
  const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

  let skipped = false;
  q('[data-skipall]').onclick = (e) => {
    e.stopPropagation();
    skipped = true;
    finishTour(false);
  };
  async function finishTour(toRound: boolean) {
    const avatar: Avatar = { ...me.avatar, golfer: spec, onboarded: true };
    try {
      await api.saveAvatar(requireSession(), avatar);
    } catch {
      /* the tour can be retaken from the Member Card */
    }
    closeWelcome();
    navigate(toRound ? '#/round' : '#/');
  }

  // 1. Arrival
  sfx('whoosh');
  title('Members only', 'Welcome to the CCC');
  go({ pos: v(0, 7, -2), look: v(0, 9, -120) }, 6);
  await wait(4200);
  if (skipped) return;
  await say('Reginald', `Ah, ${me.name}. The new member, I presume. Do come in, and mind the gravel. It was raked this morning, and I shall know.`);
  if (skipped) return;
  title('', '');

  // 2. The foyer
  cut({ pos: v(1000, 8, 18), look: v(1002, 6, -8) });
  go({ pos: v(1002.5, 6.5, 7), look: v(1004.5, 5.2, -5) }, 2);
  reg.setPose('wave');
  await wait(1200);
  reg.setPose('clasp');
  const rules = [
    'Reginald, Club Steward. Forty years, man and boy. I keep the place running and I keep the score, which, between ourselves, amounts to the same thing.',
    `Now then. A new course opens every month. This month it is ${course.name}: three holes, par ${course.par}. Frightfully good fun, provided one keeps it out of the water.`,
    'Play it as often as you please. Your lowest round of the month goes up on the board, and the lowest of the lot takes the Monthly Championship. Engraved, naturally.',
    'Full rounds only, mind. Wander off at the turn and it never happened. I have a long memory and a short temper for that sort of thing.',
    'You carry a driver, an iron, a wedge and a putter. Swing the driver flat out and the needle goes positively feral. Tap it in the gold, there\'s a good sort.',
    'Win a month and the pro shop opens its doors. Gear is earned here, not bought. We are not animals.',
    "Daisy runs the beverage cart. Her Arnold Palmer is said to steady the hands. Her conversation, rather less so.",
    "And some members claim to have found the odd shortcut. I couldn't possibly comment. Come along, the locker room awaits.",
  ];
  for (const line of rules) {
    await say('Reginald', line);
    if (skipped) return;
  }

  // 3. The locker room: meet the members
  // a slow walk along the row first, so you see every member's locker
  const row0 = 2000 + lockers[0].x;
  const rowN = 2000 + lockers[lockers.length - 1].x;
  cut({ pos: v(row0 + 2, 7.5, 6), look: v(row0, 6, -16) });
  go({ pos: v(rowN - 2, 7.5, 6), look: v(rowN, 6, -16) }, 2.4);
  await wait(2400);
  go({ pos: v(2000, 8, 12), look: v(2000, 5, -14) }, 1.6);
  const names = others.map((p) => p.name);
  const roll = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  await say(
    'Reginald',
    names.length
      ? `The members' lockers. ${roll}. A finer collection of handicaps you will not find in the county. You'll meet them on the course.`
      : "The locker room. Rather quiet at present. You'll be among the founders, which I'm told is an honour.",
  );
  if (skipped) return;
  // 4. Your locker: build your golfer
  const mx = 2000 + mine.x;
  go({ pos: v(mx + 1, 6.2, 3), look: v(mx, 4.6, -11) }, 1.6);
  await wait(1200);
  await say('Reginald', 'And this one, I believe, is yours.');
  if (skipped) return;
  engrave();
  sfx('clank');
  await wait(700);
  await say('Reginald', 'There. Your name, in brass. The pro shop has left a few things. Do dress for the occasion; we have standards here, however faded.');
  if (skipped) return;
  const b = q('[data-builder]');
  b.hidden = false;
  // frame the golfer clear of the builder panel
  const portrait = host.clientWidth < host.clientHeight;
  go(portrait ? { pos: v(mx, 7.5, 6), look: v(mx, 2.2, -11) } : { pos: v(mx + 7.5, 6, 6), look: v(mx + 6.5, 4.4, -11) }, 1.2);
  b.innerHTML = `<div class="intro-builder-head"><h2>Suit up</h2><button class="btn" data-done>Ready</button></div>`;
  b.appendChild(
    lockerPanel(spec, me.wins, (next) => {
      spec = next;
      scene.remove(you.group);
      actors.splice(actors.indexOf(you), 1);
      you.dispose();
      you = new Golfer(spec);
      you.holdClub('driver');
      you.group.position.set(mx, 0, -11);
      scene.add(you.group);
      actors.push(you);
    }),
  );
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  await new Promise<void>((res) => ((b.querySelector('[data-done]') as HTMLButtonElement).onclick = () => res()));
  b.hidden = true;
  you.setPose('cheer');
  sfx('cheer');
  await wait(900);

  // 5. Tee time
  const c = q('[data-card]');
  c.hidden = false;
  c.innerHTML = `
    <div class="tee-card">
      ${crest(64, 'tt')}
      <p class="eyebrow">Tee time</p>
      <h1>${esc(me.name)}, ${teeTime()}</h1>
      <p>${esc(course.name)} · Hole 1, ${esc(course.holes[0].name)}</p>
      <div class="summary-actions"><button class="btn" data-tee>Head to the first tee</button><button class="btn ghost" data-later>Later</button></div>
    </div>`;
  c.addEventListener('pointerdown', (e) => e.stopPropagation());
  (c.querySelector('[data-tee]') as HTMLButtonElement).onclick = () => finishTour(true);
  (c.querySelector('[data-later]') as HTMLButtonElement).onclick = () => finishTour(false);
}
