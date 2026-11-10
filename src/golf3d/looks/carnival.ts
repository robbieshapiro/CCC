// The Midway, out the back of the Nineteenth Hole: a county-fair carnival on a summer evening. Striped big tops, rows
// of game booths with their awnings, candy-striped poles strung with bulbs, the Ferris wheel turning, and a dusky
// orange sky. Eli's game (the power-ups come in later): three short holes and a weekly board on the bar wall.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Anim, Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Hole } from '../types';
import { ferrisWheel } from './chicago';

const STRIPES: [string, string][] = [
  ['#d8342c', '#f6efe2'],
  ['#2a5fb8', '#f6efe2'],
  ['#e8a321', '#7a2d8c'],
  ['#2f9a5a', '#f6efe2'],
];

// a striped canvas cone: alternating coloured gores round it
function stripedCone(r: number, h: number, pair: [string, string], gores = 12) {
  const g = new THREE.Group();
  for (let i = 0; i < gores; i++) {
    const seg = mesh(new THREE.ConeGeometry(r, h, 1, 1, true, (i / gores) * Math.PI * 2, (Math.PI * 2) / gores), mat(pair[i % 2], { rough: 0.8 }));
    (seg.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    g.add(seg);
  }
  return g;
}

// a big top: a striped drum wall, a striped peaked roof, a pennant on the king pole
export function bigTop(r: number, seed: number) {
  const g = new THREE.Group();
  const pair = STRIPES[Math.abs(Math.round(seed)) % STRIPES.length];
  const wall = 10;
  for (let i = 0; i < 16; i++) {
    const seg = mesh(new THREE.CylinderGeometry(r, r, wall, 1, 1, true, (i / 16) * Math.PI * 2, (Math.PI * 2) / 16), mat(pair[i % 2], { rough: 0.85 }));
    (seg.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    seg.position.y = wall / 2;
    g.add(seg);
  }
  const roof = stripedCone(r * 1.08, r * 0.7, pair, 16);
  roof.position.y = wall + r * 0.35;
  g.add(roof);
  g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 8, 5), mat('#ccc6b8')).translateY(wall + r * 0.7 + 3));
  const flag = mesh(new THREE.ConeGeometry(1.2, 3.6, 3), mat('#f2c230', { emissive: '#7a5a10' }));
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(1.8, wall + r * 0.7 + 6, 0);
  g.add(flag);
  return g;
}

// a game booth: a counter, a back wall of prizes, a scalloped striped awning
export function booth(w: number, seed: number) {
  const g = new THREE.Group();
  const pair = STRIPES[Math.abs(Math.round(seed)) % STRIPES.length];
  const d = 8;
  g.add(mesh(new THREE.BoxGeometry(w, 4, d), mat('#8a5a34')).translateY(2));
  g.add(mesh(new THREE.BoxGeometry(w, 12, 1), mat('#f3e6cf')).translateY(6).translateZ(-d / 2));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.6, 12, 0.6), mat('#ffffff')).translateX((s * w) / 2).translateY(6).translateZ(d / 2));
  // the prizes: rows of little coloured bears
  const rng = makeRng(`booth:${seed}`);
  const toys = ['#e4524a', '#f2c230', '#5aa0e6', '#9a64d6', '#56b56a', '#f08ab0'];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < Math.floor(w / 3); i++)
      g.add(mesh(new THREE.SphereGeometry(0.8, 6, 5), mat(toys[Math.floor(rng.next() * toys.length)])).translateX(-w / 2 + 1.6 + i * 3).translateY(7 + row * 3).translateZ(-d / 2 + 1));
  // the awning, stripe by stripe, sloping out over the counter
  const n = Math.max(4, Math.round(w / 2.5));
  for (let i = 0; i < n; i++) {
    const s = mesh(new THREE.BoxGeometry(w / n, 0.3, d + 2), mat(pair[i % 2]));
    s.position.set(-w / 2 + (i + 0.5) * (w / n), 12.5, 0.5);
    s.rotation.x = -0.18;
    g.add(s);
    const scallop = mesh(new THREE.ConeGeometry((w / n) * 0.5, 1.4, 6), mat(pair[i % 2]));
    scallop.rotation.x = Math.PI;
    scallop.position.set(-w / 2 + (i + 0.5) * (w / n), 11.4, d / 2 + 1.4);
    g.add(scallop);
  }
  return g;
}

// a candy-striped pole with a cluster of bulbs on top; the bulbs glow and chase
export function bulbPole(anim: Anim, seed: number) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 2, 6), mat(i % 2 ? '#ffffff' : '#d8342c')).translateY(1 + i * 2));
  const bulbs: THREE.MeshStandardMaterial[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = new THREE.MeshStandardMaterial({ color: '#ffe9a8', emissive: '#ffcf5a', emissiveIntensity: 1 });
    bulbs.push(m);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 6, 5), m).translateX(Math.cos(a) * 1.3).translateY(16.4).translateZ(Math.sin(a) * 1.3));
  }
  anim.push((clock) => bulbs.forEach((m, i) => (m.emissiveIntensity = 0.4 + 0.9 * Math.max(0, Math.sin(clock * 3 + i + seed)))));
  return g;
}

export const carnival: Kit = {
  surface: { green: '#5fb05a', fairway: '#6fb54e', fringe: '#62a446', rough: '#57893a', sand: '#efd9a8', path: '#c9b48e', stone: '#b9b2a4', wood: '#8a6a48' },
  floor: '#5c8a3a',
  lake: '#3f86b8',
  light: { sky: '#f4c9a6', ground: '#5c6a38', hemi: 1.3, sunColor: '#ffb87a', sun: 2.2, fog: '#e9b99a', near: 500, far: 1800, env: 0.9 },
  skyColors: ['#3a3f86', '#c86a8a', '#ffb56a'],
  sun: { color: '#ffcf8a', at: [-1100, 140, -900], size: 60, glow: '#ff8a5a' },
  clouds: true,
  rail: true,
  post(_h, p, anim) {
    if (p.look === 'post') return bulbPole(anim, Math.round(p.x + p.y));
    return null;
  },
  decor(_h, d, anim) {
    if (d.kind === 'bigtop') return bigTop(d.scale ?? 30, Math.round(d.x * 7 + d.y));
    if (d.kind === 'booth') return booth(d.scale ?? 16, Math.round(d.x * 3 + d.y));
    if (d.kind === 'ferris') return ferrisWheel(anim);
    return null;
  },
  frame(h: Hole, root, anim, floor) {
    // a ring of tents, booths and bulb poles beyond the grounds, the fair going on all round
    const rng = makeRng(`carnival:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    for (let i = 0; i < 26; i++) {
      const side = Math.floor(rng.next() * 4);
      const t = rng.next();
      const off = 30 + rng.next() * 90;
      const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 40 + (x1 - x0 + 80) * t;
      const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 40 + (y1 - y0 + 80) * t;
      const k = rng.next();
      const o = k < 0.3 ? bigTop(18 + rng.next() * 16, i) : k < 0.75 ? booth(12 + rng.next() * 8, i) : bulbPole(anim, i);
      o.position.set(x, Math.max(floor, heightAt(h, x, y)) - 0.1, -y);
      o.rotation.y = rng.next() * Math.PI * 2;
      root.add(o);
    }
  },
};
