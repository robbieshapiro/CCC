// Daisy and the beverage cart: drives up to the tee, offers a drink, drives off.
import * as THREE from 'three';
import { sfx } from '../fx/sound';
import { DRINKS, type Drink } from './clubs';
import { DEFAULT_SPEC, Golfer } from './golfer';
import * as props from './props';
import { w3 } from './scene';
import { heightAt } from './terrain';
import type { Hole, V2 } from './types';

const LINES = [
  "Afternoon! Something to take the edge off before this one? Reginald's watching, so I'd keep it civilised.",
  'Back again. Hydration, or courage? I carry both.',
];

export class CartGirl {
  visited = false;
  private cart = props.cart();
  private daisy = new Golfer({
    ...DEFAULT_SPEC,
    skin: '#eac09a',
    hair: 'long',
    hairColor: '#b78a52',
    top: 'uniform',
    topColor: '#163b2c',
    accent: '#b8955a',
    bottoms: 'skirt',
    bottomsColor: '#f4f1e8',
    hat: 'visor',
    hatColor: '#f4f1e8',
    glove: false,
    height: 0.95,
  });
  private group = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 0;
  private phase: 'idle' | 'in' | 'stop' | 'out' = 'idle';

  constructor(private scene: THREE.Scene, private hole: Hole, private onOrder: (d: Drink | null) => void) {
    this.daisy.showBag(false);
    this.daisy.setPose('idle');
    this.group.add(this.cart, this.daisy.group);
    this.daisy.group.position.set(3.4, 0, 1.5);
    this.daisy.group.rotation.y = 0.6;
    // a little tray of drinks on the back
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.6, 10), new THREE.MeshStandardMaterial({ color: ['#c98a3a', '#e8c86a', '#bfe3ec'][i], transparent: true, opacity: 0.85, roughness: 0.1 }));
      g.position.set(-0.8 + i * 0.8, 2.75, 2.8);
      this.cart.add(g);
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  focus() {
    return this.group.position.clone();
  }

  // Drive in beside the tee, then show the menu in `card`.
  arrive(at: V2, aim: number, card: HTMLElement) {
    const side = new THREE.Vector3(Math.cos(aim), 0, Math.sin(aim));
    const fwd = new THREE.Vector3(Math.sin(aim), 0, -Math.cos(aim));
    const tee = w3(at.x, at.y, 0);
    this.to.copy(tee).addScaledVector(side, 12).addScaledVector(fwd, 8);
    this.from.copy(this.to).addScaledVector(fwd, 90).addScaledVector(side, 30);
    this.group.position.copy(this.from);
    this.group.visible = true;
    this.phase = 'in';
    this.t = 0;
    sfx('hum');
    const line = LINES[(this.hole.id.length + at.x) % 2 ? 1 : 0];
    window.setTimeout(() => {
      card.hidden = false;
      card.innerHTML = `
        <div class="cart-card">
          <p class="eyebrow">The beverage cart</p>
          <p><b>Daisy</b> ${line}</p>
          <div class="cart-drinks">${(Object.keys(DRINKS) as Drink[])
            .map((k) => `<button data-drink="${k}"><b>${DRINKS[k].name}</b><small>${DRINKS[k].blurb}</small></button>`)
            .join('')}</div>
          <button class="link" data-drink="none">No thanks, Daisy</button>
        </div>`;
      card.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach((b) => {
        b.onclick = () => {
          card.hidden = true;
          card.innerHTML = '';
          const d = b.dataset.drink === 'none' ? null : (b.dataset.drink as Drink);
          this.leave();
          this.onOrder(d);
        };
      });
    }, 2600);
  }

  private leave() {
    this.visited = true;
    this.daisy.setPose('wave');
    this.from.copy(this.group.position);
    this.to.copy(this.from).add(new THREE.Vector3(80, 0, 40));
    this.phase = 'out';
    this.t = 0;
  }

  update(dt: number, _active: () => boolean) {
    this.daisy.update(dt);
    if (this.phase === 'idle') return;
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
        this.daisy.setPose('wave');
        window.setTimeout(() => this.phase === 'stop' && this.daisy.setPose('idle'), 1800);
      } else if (this.phase === 'out') {
        this.phase = 'idle';
        this.group.visible = false;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group);
    this.daisy.dispose();
  }
}
