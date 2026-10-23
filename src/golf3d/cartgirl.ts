// Daisy and the beverage cart: drives up to the tee, steps off for a chat and your order, drives off.
import * as THREE from 'three';
import { sfx } from '../fx/sound';
import { DRINKS, type Drink } from './clubs';
import { orderLine, orderReply, script, type CartTalk, type Mood } from './daisy';
import { Hostess } from './hostess';
import * as props from './props';
import { w3 } from './scene';
import { heightAt } from './terrain';
import type { Hole, V2 } from './types';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class CartGirl {
  visited = false;
  private cart = props.cart();
  private daisy = new Hostess();
  private group = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private tee = new THREE.Vector3();
  private t = 0;
  private phase: 'idle' | 'in' | 'stop' | 'out' = 'idle';
  private talking = false;
  private pending: (() => void) | null = null;
  private fill = new THREE.PointLight('#fff1e2', 0, 26, 1.4);

  constructor(private scene: THREE.Scene, private hole: Hole, private onOrder: (d: Drink | null) => void) {
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
    scene.add(this.group, this.fill);
  }

  focus() {
    return this.group.position.clone();
  }

  // While you're chatting, a close-up of Daisy, framed above the card.
  closeUp(aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
    if (!this.talking) return null;
    const d = this.daisy.group.getWorldPosition(new THREE.Vector3());
    const toTee = this.tee.clone().sub(d).setY(0).normalize();
    const portrait = aspect < 1;
    const pos = d.clone().addScaledVector(toTee, portrait ? 6.6 : 8.5).add(new THREE.Vector3(0, 5.3, 0));
    const look = d.clone().add(new THREE.Vector3(0, portrait ? 3.7 : 4.4, 0));
    return { pos, look };
  }

  // Drive in beside the tee, step off, then talk in `card`.
  arrive(at: V2, aim: number, card: HTMLElement, talk: CartTalk) {
    const side = new THREE.Vector3(Math.cos(aim), 0, Math.sin(aim));
    const fwd = new THREE.Vector3(Math.sin(aim), 0, -Math.cos(aim));
    this.tee = w3(at.x, at.y, heightAt(this.hole, at.x, at.y));
    this.to.copy(this.tee).addScaledVector(side, 12).addScaledVector(fwd, 8);
    this.from.copy(this.to).addScaledVector(fwd, 90).addScaledVector(side, 30);
    this.group.position.copy(this.from);
    this.group.visible = true;
    this.phase = 'in';
    this.t = 0;
    sfx('hum');
    this.pending = () => this.chat(card, talk);
  }

  private chat(card: HTMLElement, talk: CartTalk) {
    this.stepOff();
    this.talking = true;
    const lines = script(talk);
    card.hidden = false;
    card.innerHTML = `
      <div class="cart-card">
        <div class="cart-head"><p class="eyebrow">The beverage cart</p><button class="link" data-skip-chat>Skip to drinks</button></div>
        <div class="cart-log" data-log aria-live="polite"></div>
        <div class="cart-replies" data-replies></div>
      </div>`;
    const log = card.querySelector('[data-log]') as HTMLElement;
    const replies = card.querySelector('[data-replies]') as HTMLElement;
    let step = 0;
    let gen = 0; // bumps on skip, so pending lines from the old thread don't land
    const say = (who: 'daisy' | 'you', text: string) => {
      // only the last few lines stay, so the card never covers her
      log.insertAdjacentHTML('beforeend', who === 'daisy' ? `<p class="msg daisy"><b>Daisy</b> ${esc(text)}</p>` : `<p class="msg you">${esc(text)}</p>`);
      while (log.children.length > 3) log.firstElementChild!.remove();
    };
    const mood = (m: Mood | undefined) => {
      this.daisy.setPose(m ?? 'idle');
      if (m && m !== 'idle') window.setTimeout(() => this.talking && this.daisy.setPose('idle'), 1600);
    };
    // Daisy "types" for a moment before each line
    const daisySays = (text: string, then: () => void, m?: Mood) => {
      const g = gen;
      replies.innerHTML = '';
      log.insertAdjacentHTML('beforeend', '<p class="msg daisy typing" data-typing><b>Daisy</b> <i>…</i></p>');
      window.setTimeout(() => {
        if (g !== gen) return;
        log.querySelector('[data-typing]')?.remove();
        say('daisy', text);
        mood(m);
        sfx('tick');
        then();
      }, 650);
    };
    const ask = () => {
      if (step >= lines.length) return menu();
      const ex = lines[step];
      daisySays(ex.daisy, () => {
        replies.innerHTML = ex.replies.map((r, i) => `<button class="reply" data-reply="${i}">${esc(r.you)}</button>`).join('');
        replies.querySelectorAll<HTMLButtonElement>('[data-reply]').forEach((b) => {
          b.onclick = () => {
            const r = ex.replies[Number(b.dataset.reply)];
            say('you', r.you);
            step++;
            daisySays(r.daisy, () => window.setTimeout(ask, 900), r.mood);
          };
        });
      }, step === 0 ? 'wave' : undefined);
    };
    const menu = () => {
      card.querySelector('[data-skip-chat]')?.remove();
      daisySays(orderLine(talk), () => {
        replies.innerHTML = `
          <div class="cart-drinks">${(Object.keys(DRINKS) as Drink[])
            .map((k) => `<button data-drink="${k}"><b>${DRINKS[k].name}</b><small>${DRINKS[k].blurb}</small></button>`)
            .join('')}</div>
          <button class="link" data-drink="none">No thanks, Daisy</button>`;
        replies.querySelectorAll<HTMLButtonElement>('[data-drink]').forEach((b) => {
          b.onclick = () => {
            const d = b.dataset.drink === 'none' ? null : (b.dataset.drink as Drink);
            say('you', d ? DRINKS[d].name : 'No thanks, Daisy.');
            daisySays(orderReply(d, talk), () =>
              window.setTimeout(() => {
                card.hidden = true;
                card.innerHTML = '';
                this.leave();
                this.onOrder(d);
              }, 1500),
            d ? 'laugh' : 'wave');
          };
        });
      });
    };
    (card.querySelector('[data-skip-chat]') as HTMLButtonElement).onclick = () => {
      gen++;
      log.innerHTML = '';
      menu();
    };
    ask();
  }

  // Off the cart on the side facing the tee, square to you.
  private stepOff() {
    this.group.updateMatrixWorld(true);
    const local = this.group.worldToLocal(this.tee.clone());
    const sx = local.x >= 0 ? 1 : -1;
    this.daisy.group.position.set(3.6 * sx, 0, 0.6);
    const d = this.daisy.group.getWorldPosition(new THREE.Vector3());
    const face = this.tee.clone().sub(d);
    this.daisy.group.rotation.y = Math.atan2(face.x, face.z) - this.group.rotation.y;
    // a soft fill from over your shoulder so her face isn't in shadow
    this.fill.position.copy(d).addScaledVector(face.setY(0).normalize(), 7).add(new THREE.Vector3(0, 7, 0));
    this.fill.intensity = 18;
  }

  private leave() {
    this.visited = true;
    this.talking = false;
    this.fill.intensity = 0;
    this.daisy.setPose('wave');
    this.daisy.group.position.set(3.4, 0, 1.5);
    this.daisy.group.rotation.y = 0.6;
    this.from.copy(this.group.position);
    this.to.copy(this.from).add(new THREE.Vector3(80, 0, 40));
    this.phase = 'out';
    this.t = 0;
  }

  update(dt: number) {
    this.daisy.update(dt);
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
        this.daisy.setPose('wave');
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
    this.daisy.dispose();
  }
}
