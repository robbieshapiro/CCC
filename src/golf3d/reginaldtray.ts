// Reginald with the tray: now and then the club secretary walks out to the tee himself, a silver tray of drinks held
// before him, and offers what suits the hole (see menuFor in cartgirl.ts). The same deal as the cart: a drink, or
// "No thanks", and he goes back the way he came.
import * as THREE from 'three';
import { sfx } from '../fx/sound';
import type { Drink } from './clubs';
import { pour } from './drinks';
import { menuFor, menuLine, type Visitor } from './cartgirl';
import { Golfer, REGINALD_SPEC } from './golfer';
import { mat, mesh } from './props';
import { w3 } from './scene';
import { heightAt } from './terrain';
import type { Hole, V2 } from './types';

const LINES = [
  'I happened to be passing.',
  'Compliments of the Committee.',
  'One does like to see how the members are getting on.',
  'The cart was occupied. I thought I had better come myself.',
  'Do not tell the others.',
];

// the tray: a silver salver with three glasses on it, held at the hands
function tray(menu: Drink[], h: Hole) {
  const g = new THREE.Group();
  const silver = mat('#e3e6ea', { rough: 0.3, metal: 0.55 });
  const plate = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.06, 28), silver);
  g.add(plate);
  const rim = mesh(new THREE.TorusGeometry(0.95, 0.04, 6, 28), silver);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);
  menu.slice(0, 3).forEach((d, i) => {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const glass = mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.42, 12), new THREE.MeshStandardMaterial({ color: pour(d, h).colour, transparent: true, opacity: 0.85, roughness: 0.1 }));
    glass.position.set(Math.cos(a) * 0.5, 0.24, Math.sin(a) * 0.5);
    g.add(glass);
  });
  g.traverse((o) => (o.castShadow = true));
  return g;
}

export class ReginaldTray implements Visitor {
  visited = false;
  private reg = new Golfer(REGINALD_SPEC);
  private menu: Drink[];
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private tee = new THREE.Vector3();
  private t = 0;
  private phase: 'idle' | 'in' | 'stop' | 'out' = 'idle';
  private serving = false;
  private waved = false;
  private tray: THREE.Group;
  private fill = new THREE.PointLight('#fff1e2', 0, 26, 1.4);

  constructor(private scene: THREE.Scene, private hole: Hole, private onOrder: (d: Drink | null) => void) {
    this.menu = menuFor(hole, false);
    this.reg.holdClub(null);
    this.reg.showBag(false);
    this.reg.setPose('clasp');
    this.tray = tray(this.menu, hole);
    // in front of the clasped hands, at about the waist
    this.tray.position.set(0, 2.62, 1.0);
    this.reg.group.add(this.tray);
    this.reg.group.visible = false;
    scene.add(this.reg.group, this.fill);
  }

  focus() {
    return this.reg.group.position.clone();
  }

  closeUp(aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
    if (!this.serving) return null;
    const d = this.reg.group.position.clone();
    const toTee = this.tee.clone().sub(d).setY(0).normalize();
    const portrait = aspect < 1;
    const pos = d.clone().addScaledVector(toTee, portrait ? 6.6 : 8.5).add(new THREE.Vector3(0, 5.3, 0));
    const look = d.clone().add(new THREE.Vector3(0, portrait ? 3.7 : 4.4, 0));
    return { pos, look };
  }

  arrive(at: V2, aim: number, card: HTMLElement) {
    const side = new THREE.Vector3(Math.cos(aim), 0, Math.sin(aim));
    const fwd = new THREE.Vector3(Math.sin(aim), 0, -Math.cos(aim));
    this.tee = w3(at.x, at.y, heightAt(this.hole, at.x, at.y));
    // he stops a few paces off the tee, to the side, and walks out from behind the players
    this.to.copy(this.tee).addScaledVector(side, -7).addScaledVector(fwd, 3);
    this.from.copy(this.to).addScaledVector(fwd, -26).addScaledVector(side, -14);
    this.reg.group.position.copy(this.from);
    this.reg.group.visible = true;
    this.phase = 'in';
    this.t = 0;
    this.waved = false;
    const line = LINES[Math.floor(Math.random() * LINES.length)];
    card.hidden = false;
    card.innerHTML = `
      <div class="cart-card">
        <div class="cart-head"><p class="eyebrow">Reginald, with the tray</p><p class="cart-line">"${line} ${menuLine(this.hole)}"</p></div>
        <div class="cart-drinks">${this.menu
          .map((k) => `<button data-drink="${k}"><b>${pour(k, this.hole).name}</b><small>${pour(k, this.hole).blurb}</small></button>`)
          .join('')}</div>
        <button class="link" data-drink="none">No thanks</button>
      </div>`;
    card.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach((b) => {
      b.onclick = () => {
        if (this.waved) return;
        this.waved = true;
        const d = b.dataset.drink === 'none' ? null : (b.dataset.drink as Drink);
        card.hidden = true;
        card.innerHTML = '';
        sfx('tick');
        this.reg.setPose('wave');
        window.setTimeout(() => this.leave(), 900);
        this.onOrder(d);
      };
    });
  }

  private leave() {
    if (this.phase === 'out' || this.phase === 'idle') return;
    this.visited = true;
    this.serving = false;
    this.fill.intensity = 0;
    this.tray.visible = false;
    this.from.copy(this.reg.group.position);
    this.to.copy(this.from).addScaledVector(this.from.clone().sub(this.tee).setY(0).normalize(), 40);
    this.phase = 'out';
    this.t = 0;
  }

  update(dt: number) {
    this.reg.update(dt);
    if (this.phase === 'idle' || this.phase === 'stop') return;
    this.t += dt;
    const dur = this.phase === 'in' ? 2.6 : 3;
    const k = Math.min(1, this.t / dur);
    const e = this.phase === 'in' ? 1 - (1 - k) ** 2 : k * k;
    const p = this.from.clone().lerp(this.to, e);
    // a measured, upright walk: a slight bob in the step
    p.y = heightAt(this.hole, p.x, -p.z) + Math.abs(Math.sin(this.t * 7)) * 0.08 * (1 - (this.phase === 'in' ? e : 0));
    this.reg.group.position.copy(p);
    const dir = this.to.clone().sub(this.from);
    this.reg.group.rotation.y = Math.atan2(dir.x, dir.z);
    if (k >= 1) {
      if (this.phase === 'in') {
        this.phase = 'stop';
        // turn square to the player, tray out
        const face = this.tee.clone().sub(this.reg.group.position);
        this.reg.group.rotation.y = Math.atan2(face.x, face.z);
        this.serving = !this.waved;
        this.fill.position.copy(this.reg.group.position).addScaledVector(face.setY(0).normalize(), 7).add(new THREE.Vector3(0, 7, 0));
        this.fill.intensity = this.serving ? 18 : 0;
        if (this.waved) this.leave();
      } else {
        this.phase = 'idle';
        this.reg.group.visible = false;
      }
    }
  }

  dispose() {
    this.scene.remove(this.reg.group, this.fill);
    this.fill.dispose();
    this.reg.dispose();
  }
}
