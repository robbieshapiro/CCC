// The beverage cart: drives up to the tee, one of the crew steps off with the drinks, drives off. Who's on the cart
// is luck of the draw (see CREW in hostess.ts). No chat: the drinks, or no thanks. Late in a long round the tray has
// Fireball on it too.
import * as THREE from 'three';
import { sfx } from '../fx/sound';
import { DRINKS, type Drink } from './clubs';
import { CREW, Hostess } from './hostess';
import * as props from './props';
import { w3 } from './scene';
import { heightAt } from './terrain';
import type { Hole, V2 } from './types';

export class CartGirl {
  visited = false;
  private cart = props.cart();
  private crew: Hostess;
  private name: string;
  private menu: Drink[];
  private group = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private tee = new THREE.Vector3();
  private t = 0;
  private phase: 'idle' | 'in' | 'stop' | 'out' = 'idle';
  private serving = false;
  private pending: (() => void) | null = null;
  private waved = false; // sent on with a "no thanks" before the cart had stopped
  private fill = new THREE.PointLight('#fff1e2', 0, 26, 1.4);

  // shots: the late visit, with Fireball on the tray as well
  constructor(private scene: THREE.Scene, private hole: Hole, private onOrder: (d: Drink | null) => void, shots = false) {
    const look = CREW[Math.floor(Math.random() * CREW.length)];
    this.name = look.name;
    this.crew = new Hostess(look);
    this.menu = shots ? ['fireball', 'lager', 'palmer'] : ['palmer', 'lager', 'water'];
    this.crew.setPose('idle');
    this.group.add(this.cart, this.crew.group);
    this.crew.group.position.set(3.4, 0, 1.5);
    this.crew.group.rotation.y = 0.6;
    // what's on the tray
    const tray = shots ? ['#c4361b', '#c98a3a', '#e8c86a'] : ['#c98a3a', '#e8c86a', '#bfe3ec'];
    tray.forEach((color, i) => {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 10), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.85, roughness: 0.1 }));
      g.position.set(-0.4 + i * 0.8, 2.75, 2.8);
      this.cart.add(g);
    });
    this.group.visible = false;
    scene.add(this.group, this.fill);
  }

  focus() {
    return this.group.position.clone();
  }

  // While the drinks are on offer, a close-up of whoever's serving, framed above the card.
  closeUp(aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
    if (!this.serving) return null;
    const d = this.crew.group.getWorldPosition(new THREE.Vector3());
    const toTee = this.tee.clone().sub(d).setY(0).normalize();
    const portrait = aspect < 1;
    const pos = d.clone().addScaledVector(toTee, portrait ? 6.6 : 8.5).add(new THREE.Vector3(0, 5.3, 0));
    const look = d.clone().add(new THREE.Vector3(0, portrait ? 3.7 : 4.4, 0));
    return { pos, look };
  }

  // Drive in beside the tee, step off, offer the drinks in `card`.
  arrive(at: V2, aim: number, card: HTMLElement) {
    const side = new THREE.Vector3(Math.cos(aim), 0, Math.sin(aim));
    const fwd = new THREE.Vector3(Math.sin(aim), 0, -Math.cos(aim));
    this.tee = w3(at.x, at.y, heightAt(this.hole, at.x, at.y));
    this.to.copy(this.tee).addScaledVector(side, 12).addScaledVector(fwd, 8);
    this.from.copy(this.to).addScaledVector(fwd, 90).addScaledVector(side, 30);
    this.group.position.copy(this.from);
    this.group.visible = true;
    this.phase = 'in';
    this.t = 0;
    this.waved = false;
    sfx('hum');
    // the drinks are there from the start: pick one, or wave the cart on
    card.hidden = false;
    card.innerHTML = `
      <div class="cart-card">
        <div class="cart-head"><p class="eyebrow">The beverage cart · ${this.name}</p></div>
        <div class="cart-drinks">${this.menu
          .map((k) => `<button data-drink="${k}"><b>${DRINKS[k].name}</b><small>${DRINKS[k].blurb}</small></button>`)
          .join('')}</div>
        <button class="link" data-drink="none">No thanks</button>
      </div>`;
    card.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach((b) => {
      b.onclick = () => {
        if (this.waved) return;
        this.waved = true;
        this.pending = null;
        const d = b.dataset.drink === 'none' ? null : (b.dataset.drink as Drink);
        card.hidden = true;
        card.innerHTML = '';
        sfx('tick');
        this.crew.setPose(d ? 'laugh' : 'wave');
        // a moment to hand it over, then off
        window.setTimeout(() => this.leave(), d && this.phase === 'stop' ? 900 : 0);
        this.onOrder(d);
      };
    });
    this.pending = () => this.stepOff();
  }

  // Off the cart on the side facing the tee, square to you.
  private stepOff() {
    if (this.waved) return;
    this.serving = true;
    this.group.updateMatrixWorld(true);
    const local = this.group.worldToLocal(this.tee.clone());
    const sx = local.x >= 0 ? 1 : -1;
    this.crew.group.position.set(3.6 * sx, 0, 0.6);
    const d = this.crew.group.getWorldPosition(new THREE.Vector3());
    const face = this.tee.clone().sub(d);
    this.crew.group.rotation.y = Math.atan2(face.x, face.z) - this.group.rotation.y;
    // a soft fill from over your shoulder so the face isn't in shadow
    this.fill.position.copy(d).addScaledVector(face.setY(0).normalize(), 7).add(new THREE.Vector3(0, 7, 0));
    this.fill.intensity = 18;
    this.crew.setPose('wave');
  }

  private leave() {
    this.visited = true;
    this.serving = false;
    this.fill.intensity = 0;
    this.crew.setPose('wave');
    this.crew.group.position.set(3.4, 0, 1.5);
    this.crew.group.rotation.y = 0.6;
    this.from.copy(this.group.position);
    this.to.copy(this.from).add(new THREE.Vector3(80, 0, 40));
    this.phase = 'out';
    this.t = 0;
  }

  update(dt: number) {
    this.crew.update(dt);
    if (this.phase === 'idle' || this.phase === 'stop') return;
    this.t += dt;
    const k = Math.min(1, this.t / (this.phase === 'in' ? 2.4 : 3));
    const e = this.phase === 'in' ? 1 - (1 - k) ** 3 : k * k;
    const p = this.from.clone().lerp(this.to, e);
    p.y = heightAt(this.hole, p.x, -p.z);
    const dir = this.to.clone().sub(this.from);
    this.group.position.copy(p);
    // the cart's nose is -z
    this.group.rotation.y = Math.atan2(-dir.x, -dir.z);
    if (k >= 1) {
      if (this.phase === 'in') {
        this.phase = 'stop';
        const go = this.pending;
        this.pending = null;
        if (go) window.setTimeout(go, 350);
      } else {
        this.phase = 'idle';
        this.group.visible = false;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group, this.fill);
    this.fill.dispose();
    this.crew.dispose();
  }
}
