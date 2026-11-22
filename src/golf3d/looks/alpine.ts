// The ski resort in peak season: golf on the snow, which only works in a game. The fairway and green are cut and kept
// green under the lights; everything else is deep snow (it plays as thick rough). Snow-loaded firs, a chairlift running
// up the mountain, a timber lodge with smoke from the chimney, skiers on the runs beyond, and big peaks all round.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim, Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Hole } from '../types';
import { mountainLife } from './mountainlife';
import { causeway } from './irish';

// a fir with snow on its boughs
export function snowFir(scale = 1, seed = 0) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.6, 3, 6), mat('#4b3626')).translateY(1.5));
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const r = 5.2 - i * 1.1;
    const y = 3 + i * 3.4;
    g.add(mesh(new THREE.ConeGeometry(r, 5, 8), mat(i % 2 ? '#20402d' : '#264a33')).translateY(y + 2.5));
    const snow = mesh(new THREE.ConeGeometry(r * 0.82, 1.6, 8), mat('#f4f7fa', { rough: 0.7 }));
    snow.position.y = y + 4.1;
    g.add(snow);
  }
  g.rotation.y = seed;
  g.scale.setScalar(scale);
  return g;
}

// the lodge: a log base, a steep snowy roof, glowing windows and a stone chimney with smoke
function lodge(anim: Anim) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(70, 22, 40), mat('#7a5232')).translateY(11));
  const roof = mesh(new THREE.CylinderGeometry(0.1, 30, 22, 4, 1), mat('#f2f5f8', { rough: 0.7 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.7, 1, 1);
  roof.position.y = 33;
  g.add(roof);
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(6, 6, 0.4), mat('#ffd98a', { emissive: '#ffb84a' }), false).translateX(-28 + i * 11).translateY(10).translateZ(20.3));
  const chimney = mesh(new THREE.BoxGeometry(6, 36, 6), mat('#8a8580'));
  chimney.position.set(22, 22, -6);
  g.add(chimney);
  const smoke = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + i * 1.4, 0), new THREE.MeshBasicMaterial({ color: '#e9ecef', transparent: true, opacity: 0.55, depthWrite: false }));
    puff.position.set(22 + i * 2, 42 + i * 6, -6);
    smoke.add(puff);
  }
  g.add(smoke);
  anim.push((clock) => smoke.children.forEach((c, i) => (c.position.x = 22 + i * 2 + Math.sin(clock * 0.4 + i) * 2)));
  return g;
}

// a chairlift: towers up the slope, a cable, chairs going round
function chairlift(h: Hole, from: { x: number; y: number }, to: { x: number; y: number }, floor: number, anim: Anim) {
  const g = new THREE.Group();
  const steel = mat('#5a6168', { metal: 0.5 });
  const n = 7;
  const tops: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = Math.max(floor, heightAt(h, x, y));
    const tw = mesh(new THREE.CylinderGeometry(0.6, 0.9, 30, 6), steel);
    tw.position.set(x, z + 15, -y);
    g.add(tw);
    const arm = mesh(new THREE.BoxGeometry(14, 0.8, 0.8), steel);
    arm.position.set(x, z + 30, -y);
    g.add(arm);
    tops.push(new THREE.Vector3(x, z + 29, -y));
  }
  const chairs: THREE.Object3D[] = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    c.add(mesh(new THREE.BoxGeometry(5, 0.6, 2.2), mat('#b8382f')));
    c.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 5, 4), steel).translateY(2.5));
    // riders on the way up, on about half the chairs, skis dangling
    if (i % 2 === 0) {
      for (const x of i % 4 ? [-1.2] : [-1.2, 1.2]) {
        c.add(mesh(new THREE.CapsuleGeometry(0.45, 1.2, 3, 6), mat(['#d23b3b', '#2b6cd4', '#f2b134', '#2fa36b'][(i / 2 + (x > 0 ? 1 : 0)) % 4])).translateX(x).translateY(1.4));
        c.add(mesh(new THREE.SphereGeometry(0.38, 6, 5), mat('#f0c9a5')).translateX(x).translateY(2.7));
        c.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 4.2), mat('#1f2a44')).translateX(x).translateY(-1.4).translateZ(0.6));
      }
    }
    g.add(c);
    chairs.push(c);
  }
  const along = (t: number) => {
    const s = t * n;
    const i = Math.min(n - 1, Math.floor(s));
    return tops[i].clone().lerp(tops[i + 1], s - i);
  };
  anim.push((clock) =>
    chairs.forEach((c, i) => {
      const t = (clock * 0.01 + i / chairs.length) % 1;
      const up = i % 2 === 0;
      const p = along(up ? t : 1 - t);
      c.position.set(p.x + (up ? -6 : 6), p.y - 5, p.z);
    }),
  );
  return g;
}

// skiers coming down a run beyond the grounds: a dot of colour with poles, gliding on a loop. board: a snowboarder,
// side-on on one wide board
function skier(color: string, board = false) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CapsuleGeometry(0.5, 1.6, 3, 6), mat(color));
  body.position.y = 1.9;
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.4, 6, 5), mat('#f0c9a5')).translateY(3.4));
  g.add(mesh(new THREE.SphereGeometry(0.44, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(board ? '#1f2a44' : '#f2f2f2')).translateY(3.55));
  if (board) {
    body.rotation.x = 0.25;
    g.add(mesh(new THREE.BoxGeometry(1.1, 0.1, 5), mat('#e8453c')).translateY(0.1));
  } else {
    for (const s of [-0.35, 0.35]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 4.5), mat('#1f2a44')).translateX(s));
    for (const s of [-0.8, 0.8]) {
      const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), mat('#9aa3ad'), false);
      pole.position.set(s, 1.5, 0.6);
      pole.rotation.x = -0.35;
      g.add(pole);
    }
  }
  return g;
}

// a trail sign on the tee: the run's rating (a green circle, a blue square, a black diamond or two) on a white board
// on a post, the way the runs are marked on the mountain
export function trailSign(rating: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 6), mat('#6b4a2e')).translateY(3.5));
  const board = mesh(new THREE.BoxGeometry(4.4, 3.2, 0.25), mat('#f7f7f2'));
  board.position.y = 6.4;
  g.add(board);
  const mark = (shape: THREE.BufferGeometry, color: string, x: number) => {
    for (const z of [0.14, -0.14]) {
      const m = mesh(shape, mat(color), false);
      m.position.set(x, 6.4, z);
      if (z < 0) m.rotation.y = Math.PI;
      g.add(m);
    }
  };
  if (rating === 'green') mark(new THREE.CircleGeometry(1.1, 20), '#1f9a4a', 0);
  else if (rating === 'blue') mark(new THREE.PlaneGeometry(1.9, 1.9), '#1f5fc4', 0);
  else {
    const diamond = new THREE.PlaneGeometry(1.4, 1.4);
    diamond.rotateZ(Math.PI / 4);
    if (rating === 'double') {
      mark(diamond, '#111111', -1.05);
      mark(diamond.clone(), '#111111', 1.05);
    } else mark(diamond, '#111111', 0);
  }
  return g;
}

// the ski patrol hut: a little red cabin with a white cross, a sled stood against the wall
function patrolHut() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(14, 9, 10), mat('#b8302a')).translateY(4.5));
  const roof = mesh(new THREE.CylinderGeometry(0.1, 9.5, 5, 4, 1), mat('#f2f5f8', { rough: 0.7 }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.1, 1, 0.8);
  roof.position.y = 11.5;
  g.add(roof);
  g.add(mesh(new THREE.BoxGeometry(4, 1.2, 0.2), mat('#ffffff'), false).translateY(6).translateZ(5.1));
  g.add(mesh(new THREE.BoxGeometry(1.2, 4, 0.2), mat('#ffffff'), false).translateY(6).translateZ(5.1));
  const sled = mesh(new THREE.BoxGeometry(2.4, 0.4, 7), mat('#e8792b'));
  sled.position.set(8, 3.4, 2);
  sled.rotation.x = 1.2;
  g.add(sled);
  return g;
}

// a snowcat grooming a run: a red cab on wide tracks, a blade in front and the tiller behind
function snowcat() {
  const g = new THREE.Group();
  for (const z of [-2.6, 2.6]) g.add(mesh(new THREE.BoxGeometry(10, 2.4, 2.2), mat('#2a2d31')).translateY(1.2).translateZ(z));
  g.add(mesh(new THREE.BoxGeometry(7, 3.6, 5.4), mat('#c8302c')).translateY(4));
  g.add(mesh(new THREE.BoxGeometry(3.6, 2, 4.8), mat('#9fd0e6', { rough: 0.2 }), false).translateX(1.4).translateY(6.6));
  g.add(mesh(new THREE.BoxGeometry(1, 2.6, 8.4), mat('#e6e9ec')).translateX(6.2).translateY(1.6));
  g.add(mesh(new THREE.CylinderGeometry(1, 1, 7.6, 8), mat('#5a6168')).rotateX(Math.PI / 2).translateX(-6).translateY(1));
  return g;
}

// The après-ski deck (Nov 22): a timber sun deck off the side of a run, with a picnic table, a fire pit, a keg and a
// bar under a little roof. Tapped from the fairway, Reginald brings the tray (see the engine's apres spot).
export function apresDeck(anim: Anim) {
  const g = new THREE.Group();
  const wood = mat('#8a5a33');
  g.add(mesh(new THREE.BoxGeometry(22, 1, 16), wood).translateY(0.5));
  for (const x of [-10, 10]) for (const z of [-7, 7]) g.add(mesh(new THREE.BoxGeometry(0.8, 4, 0.8), mat('#5e3d22')).translateX(x).translateY(2.5).translateZ(z));
  // the rail round three sides
  g.add(mesh(new THREE.BoxGeometry(22, 0.4, 0.4), wood).translateY(4).translateZ(-7.8));
  for (const x of [-10.8, 10.8]) g.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 16), wood).translateX(x).translateY(4));
  // the bar, under a snowy roof, with stools
  g.add(mesh(new THREE.BoxGeometry(10, 3.6, 2.4), mat('#6b4a2e')).translateX(-4).translateY(2.8).translateZ(-5));
  const roof = mesh(new THREE.BoxGeometry(12, 0.8, 5), mat('#f2f5f8', { rough: 0.7 }));
  roof.position.set(-4, 8.6, -5);
  g.add(roof);
  for (const x of [-9, 1]) g.add(mesh(new THREE.BoxGeometry(0.5, 7.4, 0.5), mat('#5e3d22')).translateX(x).translateY(4.7).translateZ(-5.8));
  g.add(mesh(new THREE.BoxGeometry(9, 1.2, 0.3), mat('#e8453c'), false).translateX(-4).translateY(7.6).translateZ(-2.5));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.4, 8), mat('#2a2d31')).translateX(-7.5 + i * 3.4).translateY(2.2).translateZ(-2.6));
  // a keg on ice
  g.add(mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 12), mat('#b9c1c8', { metal: 0.6, rough: 0.3 })).translateX(4).translateY(2.2).translateZ(-5));
  // a picnic table with mugs
  g.add(mesh(new THREE.BoxGeometry(7, 0.4, 2.6), wood).translateX(4).translateY(3.4).translateZ(3));
  for (const z of [1, 5]) g.add(mesh(new THREE.BoxGeometry(7, 0.3, 1), wood).translateX(4).translateY(2.2).translateZ(z));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 8), mat('#e8c86a', { rough: 0.3 })).translateX(2 + i * 2).translateY(4).translateZ(3));
  // the fire pit, flickering
  g.add(mesh(new THREE.CylinderGeometry(2, 2.2, 1.2, 12), mat('#6e737a')).translateX(-5).translateY(1.6).translateZ(4));
  const fire = mesh(new THREE.ConeGeometry(1.2, 2.6, 7), mat('#ff8a2a', { emissive: '#ff6a1a' }), false);
  fire.position.set(-5, 3.4, 4);
  g.add(fire);
  anim.push((clock) => fire.scale.set(1, 0.8 + Math.sin(clock * 9) * 0.15 + Math.sin(clock * 13) * 0.08, 1));
  // skis stood in the snow by the steps, and a pair of Adirondack chairs facing the run
  for (let i = 0; i < 4; i++) {
    const ski = mesh(new THREE.BoxGeometry(0.3, 6, 0.1), mat(['#e8453c', '#1f5fc4', '#f2b134', '#2fa36b'][i]));
    ski.position.set(12 + i * 0.6, 3, 6);
    ski.rotation.z = (i - 1.5) * 0.06;
    g.add(ski);
  }
  return g;
}

// a snowman: three balls of snow, coal eyes, a carrot nose, a red scarf and stick arms
function snowman() {
  const g = new THREE.Group();
  const snow = mat('#f6f9fc', { rough: 0.8 });
  g.add(mesh(new THREE.SphereGeometry(2.4, 10, 8), snow).translateY(2.1));
  g.add(mesh(new THREE.SphereGeometry(1.7, 10, 8), snow).translateY(5.4));
  g.add(mesh(new THREE.SphereGeometry(1.2, 10, 8), snow).translateY(7.9));
  g.add(mesh(new THREE.TorusGeometry(1.15, 0.3, 6, 12), mat('#c8302c')).rotateX(Math.PI / 2).translateZ(-6.8));
  const nose = mesh(new THREE.ConeGeometry(0.22, 1.3, 6), mat('#e8792b'), false);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 7.9, 1.7);
  g.add(nose);
  for (const s of [-0.4, 0.4]) g.add(mesh(new THREE.SphereGeometry(0.14, 5, 4), mat('#1a1a1a'), false).translateX(s).translateY(8.3).translateZ(1.05));
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.4, 4), mat('#5a3d26'), false);
    arm.rotation.z = s * 1.0;
    arm.position.set(s * 2.9, 6.2, 0);
    g.add(arm);
  }
  return g;
}

function peak(hgt: number, r: number, seed: number) {
  const g = new THREE.Group();
  const rock = mesh(new THREE.ConeGeometry(r, hgt, 7 + (seed % 3)), mat('#6e737a'), false);
  rock.position.y = hgt / 2;
  g.add(rock);
  const cap = mesh(new THREE.ConeGeometry(r * 0.55, hgt * 0.55, 7 + (seed % 3)), mat('#f5f8fb', { rough: 0.6 }), false);
  cap.position.y = hgt - hgt * 0.275 + 1;
  g.add(cap);
  g.rotation.y = seed;
  return g;
}

export const alpine: Kit = {
  surface: { green: '#58a656', fairway: '#6aa953', fringe: '#5f9c4b', rough: '#eef2f6', sand: '#d8ccb4', path: '#c4c9cf', stone: '#cfe7f2', rock: '#7d8388' },
  floor: '#e9eef3',
  lake: '#6f9fb8',
  light: { sky: '#dfe9f3', ground: '#c9d2da', hemi: 1.15, sunColor: '#fff4e2', sun: 2.6, fog: '#e6edf3', near: 600, far: 2300, env: 1.1 },
  skyColors: ['#1f5fae', '#7fb3e3', '#e1ecf5'],
  sun: { color: '#fffbe8', at: [-800, 900, 600], size: 40, glow: '#fff6d8' },
  clouds: true,
  rail: true,
  // a light snow, always falling (Nov 22)
  drift: { colors: ['#ffffff', '#f2f6fb', '#e6eef7'], size: 0.45, fall: 3.2, count: 260 },
  post(_h, p) {
    if (p.look === 'snowpine') return snowFir(Math.max(0.8, p.h / 18), Math.round(p.x * 3 + p.y));
    return null;
  },
  decor(_h, d, anim) {
    if (d.kind === 'lodge') return lodge(anim);
    if (d.kind === 'snowman') return snowman();
    if (d.kind === 'trailsign') return trailSign(d.label ?? 'green');
    if (d.kind === 'patrolhut') return patrolHut();
    if (d.kind === 'apresdeck') return apresDeck(anim);
    // the ice bridge out to the berg: the causeway's shape, in blue ice
    if (d.kind === 'causeway') {
      const c = causeway(d.size?.[0] ?? 40, d.size?.[1] ?? 4, d.size?.[2] ?? 12);
      c.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.color) {
          const dark = m.color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.2;
          (o as THREE.Mesh).material = m.clone();
          ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(dark ? '#4a7f99' : '#cfe7f2');
        }
      });
      return c;
    }
    return null;
  },
  frame(h: Hole, root, anim, floor) {
    const rng = makeRng(`alpine:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // firs thick round the grounds
    for (let i = 0; i < 90; i++) {
      const side = Math.floor(rng.next() * 4);
      const t = rng.next();
      const off = 10 + rng.next() * 80;
      const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 60 + (x1 - x0 + 120) * t;
      const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 60 + (y1 - y0 + 120) * t;
      const f = snowFir(0.9 + rng.next() * 0.7, i);
      f.position.set(x, Math.max(floor, heightAt(h, x, y)) - 0.3, -y);
      root.add(f);
    }
    // the chairlift up the left of the hole, from the bottom to past the top
    root.add(chairlift(h, { x: x0 - 40, y: y1 + 40 }, { x: x0 - 40, y: y0 - 60 }, floor, anim));
    // skiers and boarders on the runs either side, and across the bottom past the green: not a crowd, but always
    // someone coming down (Nov 22)
    const kit = ['#d23b3b', '#2b6cd4', '#f2b134', '#2fa36b', '#8a3bd2', '#ff7a2a', '#e94f9b', '#20b2aa', '#f2f2f2', '#1f2a44'];
    const runs: { x: (t: number, i: number) => number; y: (t: number) => number; n: number; speed: number; swing: number }[] = [
      { x: (t, i) => x1 + 70 + Math.sin(t * 18 + i) * 14, y: (t) => y0 - 40 + (y1 - y0 + 80) * t, n: 4, speed: 0.02, swing: 18 },
      { x: (t, i) => x0 - 95 + Math.sin(t * 14 + i * 2) * 18, y: (t) => y0 - 40 + (y1 - y0 + 80) * t, n: 3, speed: 0.017, swing: 14 },
      { x: (t, i) => x1 + 150 + Math.sin(t * 10 + i) * 22, y: (t) => y1 + 40 - (y1 - y0 + 80) * t, n: 3, speed: 0.014, swing: 10 },
    ];
    const riders: { s: THREE.Object3D; run: number; i: number }[] = [];
    runs.forEach((r, k) => {
      for (let i = 0; i < r.n; i++) {
        const s = skier(kit[(k * 4 + i) % kit.length], (k + i) % 3 === 2);
        root.add(s);
        riders.push({ s, run: k, i });
      }
    });
    anim.push((clock) =>
      riders.forEach(({ s, run, i }) => {
        const r = runs[run];
        const t = (clock * r.speed + i / r.n + run * 0.13) % 1;
        const x = r.x(t, i);
        const y = r.y(t);
        s.position.set(x, Math.max(floor, heightAt(h, x, y)), -y);
        s.rotation.y = Math.cos(t * r.swing + i) * 0.6;
      }),
    );
    // a snowcat grooming the far run, slowly up and back
    const cat = snowcat();
    root.add(cat);
    anim.push((clock) => {
      const t = (clock * 0.006) % 2;
      const k = t < 1 ? t : 2 - t;
      const y = y0 + (y1 - y0) * k;
      const x = x1 + 230;
      cat.position.set(x, Math.max(floor, heightAt(h, x, y)), -y);
      cat.rotation.y = t < 1 ? -Math.PI / 2 : Math.PI / 2;
    });
    // the mountain's animals, out of play
    root.add(mountainLife(h, floor, anim));
    // the mountains all round, the big one behind the tee
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng.next() * 0.25;
      const r = 900 + rng.next() * 600;
      const pk = peak(320 + rng.next() * 420, 260 + rng.next() * 200, i);
      pk.position.set(cx + Math.cos(a) * r, floor - 20, -(cy + Math.sin(a) * r));
      root.add(pk);
    }
  },
};
