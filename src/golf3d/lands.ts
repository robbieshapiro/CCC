// Two more kinds of country for the members' holes: links by the sea (dunes, marram grass, gorse, a grey sea and an
// overcast sky) and desert (red rock mesas, saguaro cacti, sand). The sky and light for each are in engine.ts;
// scene.ts calls in here for the props and for what lies beyond the course.
import * as THREE from 'three';
import { makeRng } from '../seed';
import { mat, mesh } from './props';
import { heightAt, inPoly } from './terrain';
import type { Hole, Post, Surface } from './types';

export const LINKS_SURFACE: Partial<Record<Surface, string>> = {
  green: '#6fae5a',
  fairway: '#8fb262',
  fringe: '#7da04f',
  rough: '#b3a96a', // fescue, gone gold
  sand: '#d8c89a',
  path: '#cfc3a3',
};
export const DESERT_SURFACE: Partial<Record<Surface, string>> = {
  green: '#5fae58',
  fairway: '#6aab4c',
  fringe: '#5c9a45',
  rough: '#d2b07a', // the waste: sand and scrub
  sand: '#e8d3a2',
  path: '#c9a06a',
  rock: '#a5583a',
};
export const LANDS_FLOOR: Record<string, string> = { links: '#a99d62', desert: '#c9a46e' };

// a saguaro: a ribbed trunk and two arms that turn up
export function cactus(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const skin = mat(seed % 2 ? '#4f7a3a' : '#5a8441');
  const trunkH = 7 * scale;
  g.add(mesh(new THREE.CylinderGeometry(0.55 * scale, 0.65 * scale, trunkH, 8), skin).translateY(trunkH / 2));
  g.add(mesh(new THREE.SphereGeometry(0.55 * scale, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), skin).translateY(trunkH));
  const rng = makeRng(`cactus:${seed}`);
  for (const side of [-1, 1]) {
    if (rng.next() < 0.25) continue;
    const at = trunkH * (0.35 + rng.next() * 0.25);
    const out = mesh(new THREE.CylinderGeometry(0.38 * scale, 0.38 * scale, 1.6 * scale, 7), skin);
    out.rotation.z = (side * Math.PI) / 2;
    out.position.set(side * 0.9 * scale, at, 0);
    g.add(out);
    const upH = (2 + rng.next() * 2) * scale;
    const up = mesh(new THREE.CylinderGeometry(0.36 * scale, 0.4 * scale, upH, 7), skin);
    up.position.set(side * 1.6 * scale, at + upH / 2, 0);
    g.add(up);
    g.add(mesh(new THREE.SphereGeometry(0.36 * scale, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), skin).translateX(side * 1.6 * scale).translateY(at + upH));
  }
  g.rotation.y = seed;
  return g;
}

// gorse: a low, round, prickly bush with yellow flowers
export function gorse(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`gorse:${seed}`);
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.IcosahedronGeometry((1 + rng.next() * 0.6) * scale, 0), mat(i % 2 ? '#3e5a2c' : '#4a6a33'));
    b.position.set((rng.next() - 0.5) * 2 * scale, 0.7 * scale, (rng.next() - 0.5) * 2 * scale);
    g.add(b);
  }
  const flowers = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(Array.from({ length: 60 }, () => (rng.next() - 0.5) * 3.2 * scale).map((v, i) => (i % 3 === 1 ? Math.abs(v) * 0.6 + 0.6 * scale : v)), 3)),
    new THREE.PointsMaterial({ color: '#f2c94c', size: 0.35 }),
  );
  g.add(flowers);
  return g;
}

// a flat-topped mesa of banded red rock, far off, outside the fog
function mesa(width: number, height: number, seed: number) {
  const g = new THREE.Group();
  const bands = ['#b0603c', '#c27448', '#9c5236'];
  const sides = 6 + (seed % 3);
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(width * (0.92 - i * 0.04), width * (1 - i * 0.04), height / 3, sides), new THREE.MeshBasicMaterial({ color: bands[i % 3], fog: false }));
    m.position.y = height / 6 + (i * height) / 3;
    m.rotation.y = seed;
    g.add(m);
  }
  return g;
}

export function landsPost(h: Hole, p: Post): THREE.Object3D | null {
  if (p.look !== 'cactus' && p.look !== 'gorse') return null;
  const o = p.look === 'cactus' ? cactus(Math.max(0.6, p.h / 9), Math.round(p.x * 7 + p.y)) : gorse(Math.max(0.6, p.r), Math.round(p.x + p.y * 3));
  o.position.set(p.x, heightAt(h, p.x, p.y) - 0.1, -p.y);
  return o;
}

// Beyond the course. Links: the sea, a few sand dunes with marram on top. Desert: scattered cacti and mesas on the
// skyline.
export function landsFrame(h: Hole, root: THREE.Group, floor: number) {
  const rng = makeRng(`lands:${h.id}`);
  const { x0, y0, x1, y1 } = h.bounds;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  if (h.theme === 'links') {
    for (let i = 0; i < 22; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side > 0 ? x1 + 20 + rng.next() * 90 : x0 - 20 - rng.next() * 90;
      const y = y0 + rng.next() * (y1 - y0 + 200) - 100;
      const r = 22 + rng.next() * 30;
      // not out in the sea
      if (h.water.some((w) => w.look === 'sea' && inPoly({ x, y }, w.poly))) continue;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#d9c99c'));
      dune.scale.y = 0.35 + rng.next() * 0.25;
      dune.position.set(x, floor - 2, -y);
      dune.receiveShadow = true;
      root.add(dune);
      const grass = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat('#9a9a58'));
      grass.scale.y = dune.scale.y * 0.9;
      grass.position.set(x, floor - 1, -y);
      root.add(grass);
    }
    return;
  }
  if (h.theme === 'desert') {
    for (let i = 0; i < 40; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.max(x1 - x0, y1 - y0) / 2 + 20 + rng.next() * 160;
      const c = cactus(0.8 + rng.next() * 0.7, i);
      c.position.set(cx + Math.cos(a) * r, floor, -(cy + Math.sin(a) * r));
      root.add(c);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rng.next() * 0.4;
      const r = 1000 + rng.next() * 500;
      const m = mesa(90 + rng.next() * 160, 90 + rng.next() * 140, i);
      m.position.set(cx + Math.cos(a) * r, floor - 10, -(cy + Math.sin(a) * r));
      root.add(m);
    }
  }
}
