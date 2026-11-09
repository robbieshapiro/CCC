// The city: a hole laid through downtown on a crisp autumn afternoon. Glass and stone towers stand in play (their sides
// are walls, their roofs lose a ball), a green river with its bridges, an elevated train on its trestle, streetlights,
// and an old ballpark with ivy on its outfield wall beside the green. The skyline beyond, and the lake.
import * as THREE from 'three';
import { makeRng } from '../../seed';
import type { Kit } from '../kits';
import { mat, mesh } from '../props';
import type { Decor, Hole, Roof, V2, Wall } from '../types';

const GLASS = ['#a9c0d2', '#b6c9d8', '#9fb6c9', '#c0d0dc'];
const STONE = ['#e0d2b8', '#d4c3a6', '#c9bba4', '#eadcc2', '#b08a70'];

// windows: a tall box in rows of glass and stone bands
function tower(w: number, d: number, hgt: number, seed: number) {
  const g = new THREE.Group();
  const rng = makeRng(`tower:${seed}`);
  const glassy = rng.next() < 0.55;
  const skin = mat(glassy ? GLASS[seed % GLASS.length] : STONE[seed % STONE.length], { rough: glassy ? 0.45 : 0.85, metal: glassy ? 0.08 : 0, emissive: glassy ? '#4f5d6a' : '#4f463c' });
  g.add(mesh(new THREE.BoxGeometry(w, hgt, d), skin).translateY(hgt / 2));
  // floor bands
  const band = mat(glassy ? '#d9e2e8' : '#7d6b58');
  for (let y = 12; y < hgt - 4; y += glassy ? 24 : 12) g.add(mesh(new THREE.BoxGeometry(w + 0.4, 0.9, d + 0.4), band, false).translateY(y));
  // a setback crown on the tall ones, and a mast on the tallest
  if (hgt > 220) {
    const cw = w * 0.7;
    const cd = d * 0.7;
    g.add(mesh(new THREE.BoxGeometry(cw, 40, cd), skin).translateY(hgt + 20));
    if (rng.next() < 0.5) g.add(mesh(new THREE.CylinderGeometry(0.6, 0.9, 60, 6), mat('#2a2a2a', { metal: 0.6 })).translateY(hgt + 70));
  }
  // a street-level storefront
  g.add(mesh(new THREE.BoxGeometry(w + 0.6, 14, d + 0.6), mat('#5a5652', { rough: 0.5 })).translateY(7));
  return g;
}

// the old ballpark: a brick grandstand curve and the ivy-covered outfield wall facing the course, light towers
function ballpark() {
  const g = new THREE.Group();
  const ivy = mat('#3f6b2e');
  const brick = mat('#8a3b2a');
  // the outfield wall: a gentle arc 220 ft across, ivy on the field side
  for (let i = 0; i < 22; i++) {
    const a = -0.6 + (i / 21) * 1.2;
    const seg = new THREE.Group();
    seg.add(mesh(new THREE.BoxGeometry(11, 11, 1.4), brick).translateY(5.5));
    seg.add(mesh(new THREE.BoxGeometry(11, 10, 0.3), ivy).translateY(5.5).translateZ(0.85));
    seg.position.set(Math.sin(a) * 110, 0, -Math.cos(a) * 110 + 110);
    seg.rotation.y = -a;
    g.add(seg);
  }
  // the bleachers behind it, rising away, and a scoreboard in the middle
  for (let i = 0; i < 18; i++) {
    const a = -0.55 + (i / 17) * 1.1;
    const b = mesh(new THREE.BoxGeometry(12, 26, 22), mat('#3f5d4a'));
    b.position.set(Math.sin(a) * 125, 13, -Math.cos(a) * 125 + 110 - 10);
    b.rotation.y = -a;
    g.add(b);
  }
  const board = mesh(new THREE.BoxGeometry(46, 24, 4), mat('#21503a'));
  board.position.set(0, 38, -26);
  g.add(board);
  g.add(mesh(new THREE.BoxGeometry(40, 3, 4.4), mat('#f2efe4')).translateY(46).translateZ(-26));
  // the light towers
  for (const x of [-90, 90]) {
    g.add(mesh(new THREE.CylinderGeometry(0.9, 1.3, 70, 6), mat('#5a5a5a', { metal: 0.5 })).translateX(x).translateY(35).translateZ(-30));
    g.add(mesh(new THREE.BoxGeometry(16, 8, 2), mat('#e9e6d6', { emissive: '#fff4d0' })).translateX(x).translateY(72).translateZ(-30));
  }
  return g;
}

// the elevated train: steel trestle legs and a deck, with a two-car train parked over the street
function elTrack(len: number) {
  const g = new THREE.Group();
  const steel = mat('#4a4f52', { metal: 0.5, rough: 0.5 });
  g.add(mesh(new THREE.BoxGeometry(len, 2, 14), steel).translateY(26));
  for (let x = -len / 2; x <= len / 2; x += 30) for (const z of [-6, 6]) g.add(mesh(new THREE.BoxGeometry(1.2, 26, 1.2), steel).translateX(x).translateY(13).translateZ(z));
  for (let i = 0; i < 2; i++) {
    const car = mesh(new THREE.BoxGeometry(48, 11, 9.5), mat('#c0c4c8', { metal: 0.6, rough: 0.35 }));
    car.position.set(-30 + i * 50, 32.5, 0);
    g.add(car);
    g.add(mesh(new THREE.BoxGeometry(46, 2, 9.7), mat('#a33a34')).translateX(-30 + i * 50).translateY(30));
  }
  return g;
}

function streetlight() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.18, 0.25, 16, 6), mat('#2b2b2b', { metal: 0.5 })).translateY(8));
  const arm = mesh(new THREE.BoxGeometry(4, 0.3, 0.3), mat('#2b2b2b'));
  arm.position.set(2, 16, 0);
  g.add(arm);
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.6, 0.8), mat('#f4e9c8', { emissive: '#ffe9b0' })).translateX(3.8).translateY(15.7));
  return g;
}

// A building in play: its four sides are walls (hidden; the tower is drawn by the decor) and its roof loses a ball.
// Returns the walls, the roof and the decor to draw it, for a hole file to spread into its lists.
export function building(x: number, y: number, w: number, d: number, hgt: number, seed: number): { walls: Wall[]; roof: Roof; decor: Decor } {
  const c: V2[] = [
    { x: x - w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y - d / 2 },
    { x: x + w / 2, y: y + d / 2 },
    { x: x - w / 2, y: y + d / 2 },
  ];
  return {
    walls: c.map((a, i) => ({ a, b: c[(i + 1) % 4], h: hgt, look: 'hidden' as const })),
    roof: { poly: c, h: hgt - 0.5, top: hgt },
    decor: { kind: 'tower', x, y, size: [w, d, hgt], scale: seed },
  };
}

export const city: Kit = {
  surface: { green: '#5ead57', fairway: '#6fae4e', fringe: '#64a248', rough: '#4f8a3b', sand: '#e6dcc0', path: '#8f8f8c', stone: '#9a9a96' },
  floor: '#6f6f6c', // the street
  lake: '#3f6f5f',
  light: { sky: '#d8e4ee', ground: '#5d5d58', hemi: 1.25, sunColor: '#ffe2bc', sun: 2.6, fog: '#d9dee2', near: 700, far: 2600, env: 1.2 },
  skyColors: ['#3f74b5', '#9cc2e2', '#e8e1d2'],
  sun: { color: '#fff1d0', at: [-900, 600, 900], size: 42 },
  clouds: true,
  post(_h, p) {
    if (p.look === 'streetlight') {
      const s = streetlight();
      s.userData.solid = true;
      return s;
    }
    return null;
  },
  decor(_h, d) {
    if (d.kind === 'tower' && d.size) {
      const t = tower(d.size[0], d.size[1], d.size[2], d.scale ?? 0);
      t.userData.solid = true;
      return t;
    }
    if (d.kind === 'ballpark') return ballpark();
    if (d.kind === 'el') return elTrack(d.scale ?? 240);
    return null;
  },
  frame(h: Hole, root, _anim, floor) {
    const rng = makeRng(`city:${h.id}`);
    const { x0, y0, x1, y1 } = h.bounds;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    // blocks of towers all round the course, taller further out, leaving the lake open to the east
    for (let ring = 0; ring < 3; ring++)
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + rng.next() * 0.1;
        if (Math.cos(a) > 0.75) continue; // the lakefront
        const rx = (x1 - x0) / 2 + 90 + ring * 140 + rng.next() * 50;
        const ry = (y1 - y0) / 2 + 90 + ring * 140 + rng.next() * 50;
        const hgt = 120 + ring * 120 + rng.next() * (ring === 2 ? 600 : 220);
        const t = tower(50 + rng.next() * 50, 50 + rng.next() * 50, hgt, i + ring * 30);
        t.position.set(cx + Math.cos(a) * rx, floor, -(cy + Math.sin(a) * ry));
        t.rotation.y = Math.round(rng.next()) * 0.04;
        root.add(t);
      }
    // the lake to the east, out to the horizon
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(3000, 4000), new THREE.MeshStandardMaterial({ color: '#4f86a4', roughness: 0.1, metalness: 0.2 }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(x1 + 1700, floor + 0.2, -cy);
    root.add(lake);
    // streetlights along the edges of the grounds
    for (let y = y0; y <= y1; y += 60)
      for (const x of [x0 - 6, x1 + 6]) {
        const s = streetlight();
        s.position.set(x, floor, -y);
        root.add(s);
      }
  },
};
