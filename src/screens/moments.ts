// The moments on a card (Nov 17): a birdie, an eagle, a long putt or a chip-in gets a pop in the middle of the screen,
// coloured by how good it was, with the money it paid and the crowd to match (as the Target Range does). An albatross
// or a hole in one gets the whole screen (bigMoment). The quiet coinPop stays for the small payments.
import { sfx } from '../fx/sound';
import { money } from '../purse';
import { esc } from '../ui';

// In the club's own colours (Nov 24, Robbie: the bright blue wasn't the brand): club green, gold and cream. A fairway
// or a green in regulation is the small one, lower down; a long putt or chip-in and a birdie the middle; an eagle
// the big gold one.
export type Tier = 'birdie' | 'eagle' | 'putt' | 'fir' | 'gir';
const COLOR: Record<Tier, string> = { birdie: '#2f7a4a', eagle: '#d4a73c', putt: '#b8955a', fir: '#2f7a4a', gir: '#2f7a4a' };

// title: what it was (Birdie); amount: what it paid (0: nothing to say); sub: the hole, or "rehearsal, not paid"
export function scorePop(host: HTMLElement, tier: Tier, title: string, amount: number, sub = '') {
  const p = document.createElement('div');
  p.className = `tr-pop moment ${tier}`;
  p.style.setProperty('--c', COLOR[tier]);
  p.innerHTML = `<b>${esc(title)}</b>${amount ? `<span>+${money(amount)}</span>` : ''}${sub ? `<small>${esc(sub)}</small>` : ''}`;
  host.appendChild(p);
  window.setTimeout(() => p.remove(), 2600);
  if (tier === 'fir' || tier === 'gir') return sfx('tick');
  sfx(tier === 'putt' ? 'clap' : 'cheer');
  if (tier === 'eagle') {
    window.setTimeout(() => sfx('cheer'), 500);
    navigator.vibrate?.([30, 40, 60]);
  }
}
