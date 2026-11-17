// The Target Range's venue (Nov 17): a target-golf arena at night. You hit from the top deck of a long three-storey
// building of bays, under its roof, lit along every floor; the field in front is bright artificial turf, closed in by
// tall netting on poles down both sides and across the far end, with banks of floodlights on the poles. The sky is
// black, so it plays like an indoor venue. (The deck itself is the hole's raised ground; this draws the building round
// it.)
import * as THREE from 'three';
import type { Kit } from '../kits';
import { mat, mesh } from '../props';
import { heightAt } from '../terrain';
import type { Hole } from '../types';

// hole units to the world (as scene.ts's w3, kept here so the looks don't import the scene)
const w3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

// the building's footprint behind the tee, and its floors (heights above the field)
export const DECK = 14; // the top deck, where you hit from (about 30 ft up)
const B = { x0: -150, x1: 150, y0: -74, y1: 3 }; // its front flush with the tee deck's edge
const FLOORS = [0, DECK / 2, DECK];
const ROOF = DECK + 22;
const FIELD = { x: 140, y1: 430 };

function building(h: Hole, root: THREE.Group, base: number) {
  const w = B.x1 - B.x0;
  const d = B.y1 - B.y0;
  const cx = (B.x0 + B.x1) / 2;
  const cy = (B.y0 + B.y1) / 2;
  const concrete = mat('#3a3d44', { rough: 0.8 });
  const glow = mat('#7fe0ff', { emissive: '#7fe0ff' });
  const warm = mat('#ffe2a8', { emissive: '#ffd890' });
  // each floor a slab, its front edge lit
  for (const f of FLOORS) {
    const slab = mesh(new THREE.BoxGeometry(w, 1, d), concrete);
    slab.position.copy(w3(cx, cy, base + f - 0.55));
    root.add(slab);
    const strip = mesh(new THREE.BoxGeometry(w, 0.35, 0.35), glow, false);
    strip.position.copy(w3(cx, B.y1 + 0.2, base + f - 0.3));
    root.add(strip);
  }
  // the roof over the top deck, with rows of light panels under it
  const roof = mesh(new THREE.BoxGeometry(w + 6, 1.4, d + 10), concrete);
  roof.position.copy(w3(cx, cy + 4, base + ROOF));
  root.add(roof);
  for (let x = B.x0 + 10; x < B.x1; x += 20) {
    for (const y of [B.y1 - 4, B.y1 - 18, B.y1 - 32]) {
      const p = mesh(new THREE.BoxGeometry(8, 0.2, 3), warm, false);
      p.position.copy(w3(x, y, base + ROOF - 0.8));
      root.add(p);
    }
  }
  const lip = mesh(new THREE.BoxGeometry(w + 6, 0.5, 0.5), glow, false);
  lip.position.copy(w3(cx, B.y1 + 9, base + ROOF - 0.6));
  root.add(lip);
  // columns along the front, the back wall, and the bays' dividers on the top deck
  for (let x = B.x0; x <= B.x1; x += 30) {
    if (Math.abs(x) < 30) continue; // nothing in front of your own bay
    const c = mesh(new THREE.BoxGeometry(1.4, ROOF, 1.4), concrete);
    c.position.copy(w3(x, B.y1 - 1, base + ROOF / 2));
    root.add(c);
  }
  const back = mesh(new THREE.BoxGeometry(w, ROOF + 2, 1), mat('#1c1f26'));
  back.position.copy(w3(cx, B.y0, base + ROOF / 2));
  root.add(back);
  // every floor lit inside, warm along the back wall, so the bays glow from the field
  for (const f of FLOORS) {
    const lit = mesh(new THREE.BoxGeometry(w, 3.6, 0.3), mat("#ffcf8a", { emissive: "#c08a3c" }), false);
    lit.position.copy(w3(cx, B.y0 + 0.8, base + f + 2.6));
    root.add(lit);
  }
  for (let x = B.x0 + 15; x < B.x1; x += 15) {
    if (Math.abs(x) < 20) continue; // your own bay is open
    const wall = mesh(new THREE.BoxGeometry(0.4, 4, 10), mat('#2a2e36'));
    wall.position.copy(w3(x, B.y1 - 5, base + DECK + 2));
    root.add(wall);
  }
  // a glass rail along the front of the decks below (the top deck's front is where the tees are)
  const glass = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.18, depthWrite: false });
  for (const f of FLOORS.slice(0, -1)) {
    const rail = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), glass);
    rail.position.copy(w3(cx, B.y1 + 0.3, base + f + 1.1));
    root.add(rail);
  }
  void h;
}

function enclosure(h: Hole, root: THREE.Group) {
  const pole = mat('#23262c', { metal: 0.5, rough: 0.5 });
  const lamp = mat('#ffffff', { emissive: '#f4f7ff' });
  const net = new THREE.MeshBasicMaterial({ color: 0x0c1410, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const H = 70;
  // down both sides
  for (const side of [-1, 1]) {
    const x = side * FIELD.x;
    for (let y = 0; y <= FIELD.y1; y += 50) {
      const g = heightAt(h, x, y);
      const p = mesh(new THREE.CylinderGeometry(0.7, 0.9, H, 8), pole);
      p.position.copy(w3(x, y, g + H / 2));
      root.add(p);
      // a bank of floodlights on every other pole, turned in over the field
      if ((y / 50) % 2 === 0) {
        const bank = new THREE.Group();
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const l = mesh(new THREE.BoxGeometry(2.2, 1.6, 0.6), lamp, false);
          l.position.set((i - 1) * 2.6, j * 2, 0);
          bank.add(l);
        }
        bank.position.copy(w3(x - side * 1.5, y, g + H - 2));
        bank.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        bank.rotateX(0.5);
        root.add(bank);
      }
    }
    const g = heightAt(h, x, FIELD.y1 / 2);
    const side_ = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.y1, H), net);
    side_.position.copy(w3(x, FIELD.y1 / 2, g + H / 2));
    side_.rotation.y = Math.PI / 2;
    root.add(side_);
  }
  // across the far end
  const g = heightAt(h, 0, FIELD.y1);
  const end = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.x * 2, H), net);
  end.position.copy(w3(0, FIELD.y1, g + H / 2));
  root.add(end);
  for (let x = -FIELD.x; x <= FIELD.x; x += 56) {
    const p = mesh(new THREE.CylinderGeometry(0.7, 0.9, H, 8), pole);
    p.position.copy(w3(x, FIELD.y1, g + H / 2));
    root.add(p);
  }
}

export const arena: Kit = {
  // bright artificial turf, a little blue in it under the lights
  surface: { green: '#4fc25a', fairway: '#3faa4c', fringe: '#38994a', rough: '#2f8840', stone: '#4a4e57', sand: '#d8cdb2' },
  floor: '#15191f',
  light: { sky: '#cfdcff', ground: '#1f3326', hemi: 1.35, sunColor: '#f4f7ff', sun: 1.7, fog: '#05070c', near: 700, far: 1800, env: 0.5 },
  skyColors: ['#020308', '#060912', '#0f1626'],
  clouds: false,
  rail: true,
  frame(h, root) {
    building(h, root, heightAt(h, 0, -6) - DECK);
    enclosure(h, root);
  },
};
