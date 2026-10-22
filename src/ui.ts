import { crest } from './brand';
import { soundOn } from './fx/sound';

export const APP_NAME = 'Claude Country Club';

export const app = () => document.getElementById('app')!;

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export function render(html: string) {
  app().innerHTML = html;
}

export function navigate(hash: string) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function muteButton(): string {
  const on = soundOn();
  return `<button class="mute" data-mute aria-pressed="${on}" aria-label="${on ? 'Sound on' : 'Sound off'}">${on ? '🔊' : '🔇'}</button>`;
}

export function header(groupName: string, active: 'month' | 'card'): string {
  return `
    <header class="top">
      <a class="brand" href="#/">${crest(30, 'h')}<span><b>Claude Country Club</b><small>${esc(groupName)}</small></span></a>
      <nav>
        <a href="#/" class="${active === 'month' ? 'on' : ''}">This Month</a>
        <a href="#/card" class="${active === 'card' ? 'on' : ''}">Member Card</a>
        ${muteButton()}
      </nav>
    </header>`;
}

