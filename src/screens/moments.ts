// The moments on a card (Nov 17): a birdie, an eagle, a long putt or a chip-in gets a pop in the middle of the screen,
// coloured by how good it was, with the money it paid and the crowd to match (as the Target Range does). An albatross
// or a hole in one gets the whole screen (bigMoment). The quiet coinPop stays for the small payments.
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { esc } from '../ui';

export type Tier = 'birdie' | 'eagle' | 'putt' | 'streak';
const COLOR: Record<Tier, string> = { birdie: '#3fbf5a', eagle: '#f2b705', putt: '#3f8ff0', streak: '#ff7a18' };

// title: what it was (Birdie); amount: what it paid (0: nothing to say); sub: the hole, or "rehearsal, not paid"
export function scorePop(host: HTMLElement, tier: Tier, title: string, amount: number, sub = '') {
  const p = document.createElement('div');
  p.className = `tr-pop moment ${tier}`;
  p.style.setProperty('--c', COLOR[tier]);
  p.innerHTML = `<b>${esc(title)}</b>${amount ? `<span>+${money(amount)}</span>` : ''}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  host.appendChild(p);
  window.setTimeout(() => p.remove(), 2600);
  sfx(tier === 'putt' ? 'clap' : 'cheer');
  if (tier === 'eagle') {
    window.setTimeout(() => sfx('cheer'), 500);
    navigator.vibrate?.([30, 40, 60]);
  }
}
