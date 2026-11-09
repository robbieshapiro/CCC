// Links land, Ireland and the west of Scotland: rumpled dunes, marram and gold fescue, gorse in flower, dry-stone walls,
// a ruined castle on the headland, sheep grazing past the out-of-bounds, and a grey Atlantic under a moving sky.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Kit } from '../kits';
import { gorse } from '../lands';
import { mat, mesh } from '../props';
import { heightAt, inPoly } from '../terrain';
import type { Hole } from '../types';

// a ruined tower house: a square keep with a broken top, a gable end and a curtain wall running off it
export function ruin(seed = 0) {
  const g = new THREE.Group();
  const stone = [mat('#8d8a80'), mat('#7a776e'), mat('#9b978b')];
  g.add(mesh(new THREE.BoxGeometry(26, 44, 22), stone[0]).translateY(22));
  // the broken crown: a few teeth left on the parapet
  const rng = makeRng(`ruin:${seed}`);
  for (let i = 0; i < 7; i++) {
    const h = 3 + rng.next() * 9;
    g.add(mesh(new THREE.BoxGeometry(3.4, h, 3.4), stone[i % 3]).translateX(-11 + i * 3.7).translateY(44 + h / 2).translateZ(-9));
  }
  // dark window slits
  for (let y = 12; y < 40; y += 10) g.add(mesh(new THREE.BoxGeometry(1.2, 4, 0.3), mat('#1e1d1b'), false).translateY(y).translateZ(11.1));
  // the curtain wall, half fallen
  for (let i = 0; i < 6; i++) {
    const h = 14 - i * 1.8 - rng.next() * 3;
    g.add(mesh(new THREE.BoxGeometry(8, Math.max(2, h), 4), stone[(i + 1) % 3]).translateX(17 + i * 8).translateY(Math.max(2, h) / 2));
  }
  return g;
}

// a sheep: a fluffy white body, a black face and legs
export function sheep() {
  const g = new THREE.Group();
  const wool = mesh(new THREE.IcosahedronGeometry(1.4, 1), mat('#efece2'));
  wool.scale.set(1.4, 1, 1);
  wool.position.y = 1.9;
  g.add(wool);
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.8), mat('#1f1d1b')).translateX(1.9).translateY(2.1));
  for (const x of [-1, 1]) for (const z of [-0.5, 0.5]) g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.2, 4), mat('#1f1d1b')).translateX(x).translateY(0.6).translateZ(z));
  return g;
}

// a dry-stone wall: rough lumps along a line
export function stoneWall(len: number, seed = 0) {
  const g = new THREE.Group();
  const rng = makeRng(`wall:${seed}`);
  for (let x = -len / 2; x < len / 2; x += 2.2) {
    const b = mesh(new THREE.BoxGeometry(2.4, 1.6 + rng.next() * 0.8, 2), mat(rng.next() < 0.5 ? '#8f8b80' : '#7d796f'));
    b.position.set(x, 0.9, 0);
    b.rotation.y = (rng.next() - 0.5) * 0.2;
    g.add(b);
    const top = mesh(new THREE.BoxGeometry(2, 0.8, 1.6), mat('#9b978c'));
    top.position.set(x + 1, 2.1, 0);
    g.add(top);
  }
  return g;
}

export const linksland: Kit = {
  surface: { green: '#6aa957', fairway: '#89ad5e', fringe: '#7a9e52', rough: '#b8a964', sand: '#d6c494', path: '#bdb59b' },
  floor: '#9a9a62',
  lake: '#4d6670',
  light: { sky: '#cfd8dd', ground: '#7c7550', hemi: 1.45, sunColor: '#f4efe0', sun: 1.9, fog: '#cdd6d8', near: 380, far: 1500, env: 0.85 },
  skyColors: ['#6e8494', '#a9b8c1', '#dde1dc'],
  sun: { color: '#f3efe0', at: [-900, 520, 1100], size: 44, glow: '#e8eef0' },
  clouds: true,
  rail: true,
  post(_h, p) {
    if (p.look === 'gorse') return gorse(Math.max(0.6, p.r), Math.round(p.x + p.y * 3));
    return null;
  },
  decor(_h, d) {
    if (d.kind === 'ruin') return ruin(Math.round(d.x));
    if (d.kind === 'sheep') return sheep();
    if (d.kind === 'stonewall') return stoneWall(d.scale ?? 60, Math.round(d.x + d.y));
    return null;
  },
  frame(h: Hole, root, _anim, floor) {
    const rng = makeRng(`linksland:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    // dunes with marram on top all round, kept out of the sea
    for (let i = 0; i < 30; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side > 0 ? x1 + 20 + rng.next() * 110 : x0 - 20 - rng.next() * 110;
      const y = y0 + rng.next() * (y1 - y0 + 240) - 120;
      if (h.water.some((w) => w.look === 'sea' && inPoly({ x, y }, w.poly))) continue;
      const r = 24 + rng.next() * 34;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#a8a466'));
      dune.scale.y = 0.35 + rng.next() * 0.3;
      dune.position.set(x, Math.max(floor, heightAt(h, x, y)) - 3, -y);
      dune.receiveShadow = true;
      root.add(dune);
      if (rng.next() < 0.5) {
        const gz = gorse(1.4 + rng.next(), i);
        gz.position.set(x + (rng.next() - 0.5) * r, dune.position.y + r * dune.scale.y * 0.8, -y);
        root.add(gz);
      }
    }
    // the Atlantic beyond everything, grey and wide
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: '#5a7480', roughness: 0.15, metalness: 0.2 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = floor - 3;
    root.add(sea);
  },
};
