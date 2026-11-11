// A tip at the top of home for the rest of the week of Nov 8: put the club on your phone's Home Screen. Phones and
// iPads only, never once it's already opened from the Home Screen, and gone for good once you close it.
import { store } from '../storage';

const UNTIL = Date.parse('2026-11-15T05:00:00Z'); // midnight ET, Saturday Nov 14
const KEY = 'ccc-homescreen-tip';

const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const touch = () => matchMedia('(pointer: coarse)').matches;

export function homeScreenTip() {
  if (Date.now() >= UNTIL || installed() || !touch() || store.get(KEY)) return '';
  return `<aside class="hs-tip" id="hs-tip">
    <span class="hs-icon" aria-hidden="true">📲</span>
    <p><b>Put the club on your Home Screen</b>Tap the share icon at the very top of your browser, then <em>View More</em>, then <em>Add to Home Screen</em>.</p>
    <button class="hs-x" data-hs-close aria-label="Close the tip">✕</button>
  </aside>`;
}

export function bindHomeScreenTip() {
  document.querySelector<HTMLButtonElement>('[data-hs-close]')?.addEventListener('click', () => {
    store.set(KEY, '1');
    document.getElementById('hs-tip')?.remove();
  });
}
