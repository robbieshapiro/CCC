// The Committee's control centre in a course preview: change the conditions, pour any drink, call the cart, and move
// the ball about, all while playing. Nothing here is on a member's card; it only shows in the Committee's preview.
import type { Course3D, Visit } from '../golf3d/engine';
import { DRINKS, type Drink } from '../golf3d/clubs';
import { pour } from '../golf3d/drinks';
import { forceNight, hasNight } from '../golf3d/kits';
import { store } from '../storage';
import { esc } from '../ui';

const NIGHT_KEY = 'ccc-preview-night'; // 'day' | 'night' | '' (by the clock)
const DIRS: [string, string, number][] = [
  ['↖', 'Helping, from the right', -Math.PI / 4],
  ['↑', 'Behind you', 0],
  ['↗', 'Helping, from the left', Math.PI / 4],
  ['←', 'Right to left', -Math.PI / 2],
  ['→', 'Left to right', Math.PI / 2],
  ['↙', 'Against, from the right', (-3 * Math.PI) / 4],
  ['↓', 'In your face', Math.PI],
  ['↘', 'Against, from the left', (3 * Math.PI) / 4],
];
const near = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 0.3;

// what the preview remembers between visits: day or night
export function restoreNight() {
  const v = store.get(NIGHT_KEY);
  forceNight(v === 'night' ? true : v === 'day' ? false : null);
}
export function setNight(v: 'day' | 'night' | '') {
  if (v) store.set(NIGHT_KEY, v);
  else store.remove(NIGHT_KEY);
  restoreNight();
}
// leaving the preview: members' rounds follow the clock
export const releaseNight = () => forceNight(null);

// `restart(visit)`: start the hole in play again (with the cart, the late cart or Reginald coming, if asked)
export function bindPreviewControls(game: Course3D, host: HTMLElement, restart: (visit?: Visit) => void) {
  game.setControls(() => {
    const st = game.labState();
    const h = st.hole;
    const night = store.get(NIGHT_KEY) ?? '';
    const wind = game.lab.wind ?? null;
    const mph = wind?.mph ?? st.wind?.mph ?? 0;
    const toward = wind?.toward ?? st.wind?.toward ?? 0;
    const pins = h.pins?.length ? h.pins : [h.cup];
    const sheet = document.createElement('div');
    sheet.className = 'g3-holes pc-sheet';
    const seg = (name: string, opts: [string, string, boolean, boolean?][]) =>
      `<div class="pc-seg" data-seg="${name}">${opts.map(([v, label, on, off]) => `<button data-v="${v}" class="${on ? 'on' : ''}" ${off ? 'disabled' : ''}>${label}</button>`).join('')}</div>`;
    sheet.innerHTML = `
      <div class="g3-holes-card admin pc-card">
        <header><small>Preview controls</small><b>${esc(h.name)}</b><button class="pc-x" data-close aria-label="Close">✕</button></header>

        <section>
          <h3>Conditions <em>restarts the hole</em></h3>
          <label>Time of day</label>
          ${seg('night', [['day', '☀️ Day', night === 'day', !hasNight(h)], ['night', '🌙 Night', night === 'night', !hasNight(h)], ['', 'By the clock', night === '']])}
          ${hasNight(h) ? '' : '<p class="pc-note">This course has no night look yet.</p>'}
          <label>Wind <output data-mph>${mph} mph</output>${wind ? '' : ' <i>(today&rsquo;s)</i>'}</label>
          <input type="range" min="0" max="30" step="1" value="${mph}" data-pc-wind aria-label="Wind speed" />
          <div class="pc-dirs" data-dirs>${DIRS.map(([a, t, v]) => `<button data-toward="${v}" title="${t}" class="${near(toward, v) ? 'on' : ''}">${a}</button>`).join('')}</div>
          <label>Pin</label>
          ${seg('pin', [['', "Today's", game.lab.pin == null], ...pins.map((_, i): [string, string, boolean] => [String(i), String(i + 1), game.lab.pin === i])])}
          <button class="pc-go" data-apply>Apply and restart the hole</button>
        </section>

        <section>
          <h3>Drinks <em>poured now</em></h3>
          <div class="pc-drinks">${(Object.keys(DRINKS) as Drink[])
            .map((k) => `<button data-pour="${k}" class="${st.drink === k ? 'on' : ''}"><b>${esc(pour(k, h).name)}</b><span>${esc(DRINKS[k].job)}</span><i>${esc(DRINKS[k].cost)} · ${DRINKS[k].swings === 1 ? '1 swing' : 'this hole'}</i></button>`)
            .join('')}</div>
          <div class="pc-row"><button data-pour="">Empty the glass</button></div>
          <label>Send someone out <em>restarts the hole</em></label>
          <div class="pc-row"><button data-visit="drinks">🛺 The cart</button><button data-visit="shots">🥃 The late cart</button><button data-visit="reginald">🎩 Reginald's tray</button></div>
        </section>

        <section>
          <h3>Move about</h3>
          <div class="pc-row">
            <button data-retake ${st.canRetake ? '' : 'disabled'}>↩︎ Take that shot again</button>
            <button data-drop ${st.canAct ? '' : 'disabled'}>📍 Drop the ball on the map</button>
            <button data-tee>⛳ Back to the tee</button>
          </div>
          <p class="pc-note">The Holes button jumps to any hole.</p>
        </section>
      </div>`;
    host.appendChild(sheet);
    const close = () => sheet.remove();
    const q = <T extends HTMLElement>(s: string) => sheet.querySelector(s) as T;
    sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
    sheet.onclick = (e) => e.target === sheet && close();
    q('[data-close]').onclick = close;

    // the picks, applied together
    let pickNight = night as 'day' | 'night' | '';
    let pickMph = mph;
    let pickToward = toward;
    let pickPin: number | null = game.lab.pin ?? null;
    let windTouched = !!wind;
    const one = (root: HTMLElement, b: HTMLElement) => root.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    q('[data-seg="night"]').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b || b.disabled) return;
      pickNight = b.dataset.v as typeof pickNight;
      one(q('[data-seg="night"]'), b);
    };
    q('[data-seg="pin"]').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      pickPin = b.dataset.v === '' ? null : Number(b.dataset.v);
      one(q('[data-seg="pin"]'), b);
    };
    q<HTMLInputElement>('[data-pc-wind]').oninput = (e) => {
      pickMph = Number((e.target as HTMLInputElement).value);
      windTouched = true;
      q('[data-mph]').textContent = `${pickMph} mph`;
    };
    q('[data-dirs]').onclick = (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      pickToward = Number(b.dataset.toward);
      windTouched = true;
      one(q('[data-dirs]'), b);
    };
    q('[data-apply]').onclick = () => {
      setNight(pickNight);
      game.lab = { wind: windTouched ? { mph: pickMph, toward: pickToward } : null, pin: pickPin };
      close();
      restart();
    };
    sheet.querySelectorAll<HTMLButtonElement>('[data-pour]').forEach(
      (b) =>
        (b.onclick = () => {
          game.pourNow((b.dataset.pour || null) as Drink | null);
          close();
        }),
    );
    sheet.querySelectorAll<HTMLButtonElement>('[data-visit]').forEach(
      (b) =>
        (b.onclick = () => {
          close();
          restart(b.dataset.visit as Visit);
        }),
    );
    q('[data-retake]').onclick = () => (close(), game.retake());
    q('[data-drop]').onclick = () => (close(), game.dropOnMap());
    q('[data-tee]').onclick = () => (close(), restart());
  });
}
