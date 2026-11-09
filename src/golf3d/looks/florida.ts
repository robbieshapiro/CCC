// Florida, Gulf coast: flat, bright and wet. Lakes everywhere with tannin-dark water, white sugar sand, sabal palms and
// live oaks hung with moss, gators on the banks and egrets in the shallows, and a pink and orange sunset.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Kit } from '../kits';
import { mat, mesh, palm } from '../props';
import { heightAt, inPoly } from '../terrain';
import type { Hole } from '../types';

// a live oak: a short thick trunk, a wide flat crown in lumps, and grey Spanish moss hanging off it
export function liveOak(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`oak:${seed}`);
  g.add(mesh(new THREE.CylinderGeometry(0.9, 1.4, 7, 8), mat('#5b4a3a')).translateY(3.5));
  const leaf = [mat('#3f6a33'), mat('#4a7a3a'), mat('#36602e')];
  const moss = mat('#a9ad9a');
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.next();
    const r = 4 + rng.next() * 6;
    const blob = mesh(new THREE.IcosahedronGeometry(4 + rng.next() * 2.5, 0), leaf[i % 3]);
    blob.scale.y = 0.55;
    blob.position.set(Math.cos(a) * r, 9 + rng.next() * 2.5, Math.sin(a) * r);
    g.add(blob);
    if (i % 2 === 0) {
      const strand = mesh(new THREE.ConeGeometry(0.7, 3.4, 5), moss, false);
      strand.rotation.x = Math.PI;
      strand.position.set(blob.position.x, blob.position.y - 3, blob.position.z);
      g.add(strand);
    }
  }
  g.scale.setScalar(scale);
  return g;
}

// an alligator sunning on a bank: a long low body, a snout, ridged back, a tail
export function gator() {
  const g = new THREE.Group();
  const skin = mat('#3d4630');
  const body = mesh(new THREE.CapsuleGeometry(0.8, 5, 4, 8), skin);
  body.rotation.z = Math.PI / 2;
  body.scale.set(1, 1, 0.55);
  body.position.y = 0.45;
  g.add(body);
  const snout = mesh(new THREE.BoxGeometry(2.4, 0.4, 0.8), skin);
  snout.position.set(4.1, 0.4, 0);
  g.add(snout);
  const tail = mesh(new THREE.ConeGeometry(0.6, 5, 6), skin);
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-5.4, 0.35, 0);
  g.add(tail);
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.3, 0.25, 0.9), mat('#2d3424')).translateX(-2 + i * 0.8).translateY(0.95));
  for (const s of [-1, 1]) for (const x of [-1.6, 1.8]) g.add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.6), skin).translateX(x).translateY(0.2).translateZ(s * 0.8));
  return g;
}

// a great egret standing in the shallows: white, long neck, yellow bill
export function egret() {
  const g = new THREE.Group();
  const white = mat('#f6f4ee');
  for (const s of [-0.25, 0.25]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), mat('#2a2a26')).translateY(1.2).translateZ(s));
  const body = mesh(new THREE.SphereGeometry(0.75, 8, 6), white);
  body.scale.set(1.4, 0.8, 0.8);
  body.position.y = 2.7;
  g.add(body);
  const neck = mesh(new THREE.CylinderGeometry(0.14, 0.18, 2, 6), white);
  neck.position.set(0.8, 3.6, 0);
  neck.rotation.z = -0.35;
  g.add(neck);
  g.add(mesh(new THREE.SphereGeometry(0.28, 6, 5), white).translateX(1.15).translateY(4.6));
  const bill = mesh(new THREE.ConeGeometry(0.09, 0.9, 5), mat('#e3b23c'));
  bill.rotation.z = -Math.PI / 2;
  bill.position.set(1.7, 4.6, 0);
  g.add(bill);
  return g;
}

// a mid-rise beach condo on the skyline: stucco, balconies, a terracotta roof
function condo(w: number, d: number, floors: number, seed: number) {
  const g = new THREE.Group();
  const tones = ['#f2e4cf', '#efd7c0', '#e9e1d2', '#f4dccb'];
  const hgt = floors * 10;
  g.add(mesh(new THREE.BoxGeometry(w, hgt, d), mat(tones[seed % tones.length])).translateY(hgt / 2));
  for (let f = 1; f < floors; f++) g.add(mesh(new THREE.BoxGeometry(w + 1.2, 0.6, d + 1.2), mat('#ffffff')).translateY(f * 10));
  const roof = mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 8, 4), mat('#b5603a'));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = d / w;
  roof.position.y = hgt + 4;
  g.add(roof);
  return g;
}

export const florida: Kit = {
  surface: { green: '#62b85a', fairway: '#7cc455', fringe: '#6cae4b', rough: '#5c963c', sand: '#f4ecd6', path: '#dcd4c0' },
  floor: '#5a8c3c',
  lake: '#4a9a98',
  light: { sky: '#f1d6c6', ground: '#5c7a3c', hemi: 1.35, sunColor: '#ffb07a', sun: 2.5, fog: '#f4cfb6', near: 520, far: 1800, env: 1 },
  skyColors: ['#4d64aa', '#e49fae', '#ffcd8a'],
  sun: { color: '#ffd9a0', at: [1200, 160, -1100], size: 55, glow: '#ff9a6a' },
  clouds: true,
  rail: true,
  post(_h, p) {
    if (p.look === 'sabal') return palm(0.85 + (p.h / 30) * 0.4, Math.round(p.x));
    if (p.look === 'oak') return liveOak(Math.max(0.8, p.h / 20), Math.round(p.x * 3 + p.y));
    return null;
  },
  decor(_h, d) {
    if (d.kind === 'gator') return gator();
    if (d.kind === 'egret') return egret();
    return null;
  },
  frame(h: Hole, root, _anim, floor) {
    const rng = makeRng(`florida:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // palms and oaks round the grounds, kept out of the lakes
    for (let i = 0; i < 70; i++) {
      const side = Math.floor(rng.next() * 4);
      const t = rng.next();
      const off = 12 + rng.next() * 70;
      const x = side === 0 ? x0 - off : side === 1 ? x1 + off : x0 - 60 + (x1 - x0 + 120) * t;
      const y = side === 2 ? y0 - off : side === 3 ? y1 + off : y0 - 60 + (y1 - y0 + 120) * t;
      if (h.water.some((w) => inPoly({ x, y }, w.poly))) continue;
      const tree = rng.next() < 0.6 ? palm(0.9 + rng.next() * 0.5, i) : liveOak(0.9 + rng.next() * 0.4, i);
      tree.position.set(x, Math.max(floor, heightAt(h, x, y)) - 0.2, -y);
      root.add(tree);
    }
    // condos along the far shore, low on the horizon
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.25 + (i / 7) * Math.PI * 0.5 + rng.next() * 0.08;
      const r = 900 + rng.next() * 300;
      const c = condo(60 + rng.next() * 40, 40, 6 + Math.floor(rng.next() * 8), i);
      c.position.set(cx + Math.cos(a) * r, floor, -(cy + Math.sin(a) * r));
      c.rotation.y = rng.next() * Math.PI;
      root.add(c);
    }
  },
};
