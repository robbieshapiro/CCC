// The ski resort in peak season: golf on the snow, which only works in a game. The fairway and green are cut and kept
// green under the lights; everything else is deep snow (it plays as thick rough). Snow-loaded firs, a chairlift running
// up the mountain, a timber lodge with smoke from the chimney, skiers on the runs beyond, and big peaks all round.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim, Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Hole } from '../types';

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

// skiers coming down a run beyond the grounds: a dot of colour with poles, gliding on a loop
function skier(color: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(0.5, 1.6, 3, 6), mat(color)).translateY(1.9));
  g.add(mesh(new THREE.SphereGeometry(0.4, 6, 5), mat('#f0c9a5')).translateY(3.4));
  for (const s of [-0.35, 0.35]) g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 4.5), mat('#1f2a44')).translateX(s));
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
  surface: { green: '#58a656', fairway: '#6aa953', fringe: '#5f9c4b', rough: '#eef2f6', sand: '#d8ccb4', path: '#c4c9cf', stone: '#a8adb3' },
  floor: '#e9eef3',
  lake: '#6f9fb8',
  light: { sky: '#dfe9f3', ground: '#c9d2da', hemi: 1.15, sunColor: '#fff4e2', sun: 2.6, fog: '#e6edf3', near: 600, far: 2300, env: 1.1 },
  skyColors: ['#1f5fae', '#7fb3e3', '#e1ecf5'],
  sun: { color: '#fffbe8', at: [-800, 900, 600], size: 40, glow: '#fff6d8' },
  clouds: true,
  rail: true,
  post(_h, p) {
    if (p.look === 'snowpine') return snowFir(Math.max(0.8, p.h / 18), Math.round(p.x * 3 + p.y));
    return null;
  },
  decor(_h, d, anim) {
    if (d.kind === 'lodge') return lodge(anim);
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
    // skiers on the run to the right, coming down and looping back up
    const run: THREE.Object3D[] = [];
    for (let i = 0; i < 5; i++) {
      const s = skier(['#d23b3b', '#2b6cd4', '#f2b134', '#2fa36b', '#8a3bd2'][i]);
      root.add(s);
      run.push(s);
    }
    anim.push((clock) =>
      run.forEach((s, i) => {
        const t = (clock * 0.02 + i / run.length) % 1;
        const y = y0 - 40 + (y1 - y0 + 80) * t;
        const x = x1 + 70 + Math.sin(t * 18 + i) * 14;
        s.position.set(x, Math.max(floor, heightAt(h, x, y)), -y);
        s.rotation.y = Math.cos(t * 18 + i) * 0.6;
      }),
    );
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
