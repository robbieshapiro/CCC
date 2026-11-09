// Red rock canyon country: banded sandstone, hoodoos and buttes, a slot of a canyon with a green river at the bottom,
// juniper and sage on the rims, and a hard blue sky with the late sun turning the rock to fire.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Hole } from '../types';

const BANDS = ['#b4532f', '#c4673a', '#a84a2b', '#d4885a', '#9c4127', '#c87048'];

// a hoodoo: a stack of eroded drums, narrower in the middle, a harder cap on top
export function hoodoo(hgt: number, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`hoodoo:${seed}`);
  const n = Math.max(3, Math.round(hgt / 7));
  let y = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const r = 3.4 * (1 - 0.45 * Math.sin(t * Math.PI)) * (0.85 + rng.next() * 0.3);
    const step = hgt / n;
    const drum = mesh(new THREE.CylinderGeometry(r * 0.95, r, step, 9), mat(BANDS[(i + seed) % BANDS.length]));
    drum.position.y = y + step / 2;
    drum.rotation.y = rng.next();
    g.add(drum);
    y += step;
  }
  const cap = mesh(new THREE.CylinderGeometry(4.2, 3.2, 2.2, 9), mat('#8a6a52'));
  cap.position.y = y + 1;
  g.add(cap);
  return g;
}

// a butte on the skyline: a flat-topped block in bands, steep sides, scree at its foot
function butte(hgt: number, w: number, seed: number) {
  const g = new THREE.Group();
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const r = w * (1 - t * 0.35);
    const ring = mesh(new THREE.CylinderGeometry(r * 0.93, r, hgt / layers, 7 + (seed % 3)), mat(BANDS[(i + seed) % BANDS.length]), false);
    ring.position.y = (hgt / layers) * (i + 0.5);
    g.add(ring);
  }
  const scree = mesh(new THREE.ConeGeometry(w * 1.5, hgt * 0.35, 9), mat('#b8714a'), false);
  scree.position.y = hgt * 0.17;
  g.add(scree);
  return g;
}

// a natural arch: two legs and a lintel, for the skyline or the edge of a hole
export function arch(span: number, hgt: number) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(5, 8, hgt, 8), mat(BANDS[s > 0 ? 0 : 2]));
    leg.position.set((s * span) / 2, hgt / 2, 0);
    g.add(leg);
  }
  const top = mesh(new THREE.TorusGeometry(span / 2, 6, 6, 14, Math.PI), mat(BANDS[1]));
  top.position.y = hgt;
  g.add(top);
  return g;
}

// a juniper: twisted, low and dark
function juniper(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`juniper:${seed}`);
  const trunk = mesh(new THREE.CylinderGeometry(0.35, 0.6, 4, 6), mat('#6a5341'));
  trunk.rotation.z = (rng.next() - 0.5) * 0.5;
  trunk.position.y = 2;
  g.add(trunk);
  for (let i = 0; i < 4; i++) {
    const b = mesh(new THREE.IcosahedronGeometry(1.8 + rng.next(), 0), mat(i % 2 ? '#4e5f3c' : '#5b6b45'));
    b.position.set((rng.next() - 0.5) * 3, 4 + rng.next() * 1.5, (rng.next() - 0.5) * 3);
    g.add(b);
  }
  g.scale.setScalar(scale);
  return g;
}

export const canyon: Kit = {
  surface: { green: '#5daa55', fairway: '#73ad4e', fringe: '#649c46', rough: '#b98c5c', sand: '#e2b98c', path: '#c98f62', rock: '#b4532f' },
  floor: '#b8704a',
  lake: '#4f8a7a',
  light: { sky: '#e8d6c4', ground: '#9b5a38', hemi: 1.2, sunColor: '#ffc28a', sun: 3.0, fog: '#ecc9a8', near: 700, far: 2400, env: 0.95 },
  skyColors: ['#2c6fc0', '#8dbbe4', '#f2cfa2'],
  sun: { color: '#fff0cc', at: [-1300, 380, 400], size: 46, glow: '#ffbf7a' },
  clouds: false,
  rail: true,
  post(_h, p) {
    if (p.look === 'hoodoo') {
      const o = hoodoo(p.h, Math.round(p.x + p.y));
      o.userData.solid = true;
      return o;
    }
    if (p.look === 'cactus') return juniper(Math.max(0.8, p.h / 8), Math.round(p.x * 3 + p.y));
    return null;
  },
  decor(_h, d) {
    if (d.kind === 'arch') return arch(d.scale ?? 60, (d.scale ?? 60) * 0.8);
    if (d.kind === 'juniper') return juniper(d.scale ?? 1, Math.round(d.x + d.y));
    return null;
  },
  frame(h: Hole, root, _anim, floor) {
    const rng = makeRng(`canyon:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // junipers on the rims just past the grounds
    for (let i = 0; i < 40; i++) {
      const side = Math.floor(rng.next() * 4);
      const t = rng.next();
      const off = 10 + rng.next() * 60;
      const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 40 + (x1 - x0 + 80) * t;
      const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 40 + (y1 - y0 + 80) * t;
      const j = juniper(0.9 + rng.next() * 0.6, i);
      j.position.set(x, Math.max(floor, heightAt(h, x, y)), -y);
      root.add(j);
    }
    // buttes and hoodoo fields all round, and one big arch on the skyline
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rng.next() * 0.3;
      const r = 700 + rng.next() * 700;
      const b = butte(120 + rng.next() * 220, 90 + rng.next() * 120, i);
      b.position.set(cx + Math.cos(a) * r, floor - 6, -(cy + Math.sin(a) * r));
      root.add(b);
    }
    for (let i = 0; i < 24; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = Math.max(x1 - x0, y1 - y0) / 2 + 90 + rng.next() * 260;
      const ho = hoodoo(30 + rng.next() * 50, i);
      ho.position.set(cx + Math.cos(a) * r, floor, -(cy + Math.sin(a) * r));
      root.add(ho);
    }
    const big = arch(240, 190);
    big.position.set(cx - 700, floor, -(cy + 1100));
    root.add(big);
  },
};
