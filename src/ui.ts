import { getSession, listSessions } from './api';
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

// The club's name under the crest. Someone in more than one club (the admin) can switch clubs from it.
function clubName(groupName: string) {
  const clubs = listSessions();
  if (clubs.length < 2) return `<small>${esc(groupName)}</small>`;
  const on = getSession()?.groupId;
  return `<select class="club-switch" data-club-switch aria-label="Switch club">${clubs
    .map((c) => `<option value="${esc(c.groupId)}" ${c.groupId === on ? 'selected' : ''}>${esc(c.groupName)}</option>`)
    .join('')}</select>`;
}

export function header(groupName: string, active: 'month' | 'card' | 'lockers'): string {
  return `
    <header class="top">
      <div class="brand"><a href="#/">${crest(30, 'h')}</a><span><a href="#/"><b>Claude Country Club</b></a>${clubName(groupName)}</span></div>
      <nav>
        <a href="#/" class="${active === 'month' ? 'on' : ''}">This Month</a>
        <a href="#/lockers" class="${active === 'lockers' ? 'on' : ''}">Locker Room</a>
        <a href="#/card" class="${active === 'card' ? 'on' : ''}">Member Card</a>
        ${muteButton()}
      </nav>
    </header>`;
}

