// The Prize Counter at the Midway (Eli's game): buy power-ups with your club money, see your locker, and on a Midway
// tee pick one to use on the hole. Prices and the locker limit are checked on the server too (buy_powerup).
import { api } from '../api';
import type { PowerupState } from '../api/types';
import type { Hole } from '../golf3d/types';
import { LOCKER_MAX, powerOf, POWERS } from '../powerups';
import { money } from '../purse';
import { balanceOf } from '../shop';
import { refresh, requireSession } from '../state';
import { esc } from '../ui';

const sheet = (html: string) => {
  const s = document.createElement('div');
  s.className = 'practice-notes prize-sheet';
  s.innerHTML = `<div class="notes-card"><div class="notes-body">${html}</div></div>`;
  document.body.appendChild(s);
  window.addEventListener('hashchange', () => s.remove(), { once: true });
  return s;
};

// the counter: your bank, your locker, and what's for sale
export async function openPrizeCounter() {
  const s = sheet('<p class="muted">Opening the counter…</p>');
  const draw = async (note = '') => {
    const [snap, st] = await Promise.all([refresh(), api.powerupState(requireSession()).catch((): PowerupState => ({ locker: [] }))]);
    const me = snap.players.find((p) => p.id === snap.me);
    const bank = me ? balanceOf(me) : 0;
    const full = st.locker.length >= LOCKER_MAX;
    s.querySelector('.notes-body')!.innerHTML = `
      <p class="eyebrow">The Midway · Prize Counter</p>
      <h2>Power-ups</h2>
      <p class="prize-bank"><b>${money(bank)}</b> to spend · locker ${st.locker.length} of ${LOCKER_MAX}${st.locker.length ? `: ${st.locker.map((l) => powerOf(l.kind)?.icon ?? '').join(' ')}` : ''}</p>
      ${note ? `<p class="prize-note">${esc(note)}</p>` : ''}
      <ul class="prize-list">${POWERS.map(
        (p) => `<li><i>${p.icon}</i><div><b>${p.name}</b><span>${p.does}</span></div>
          <button class="btn small${bank < p.price || full ? ' ghost' : ''}" data-buy="${p.kind}" ${bank < p.price || full ? 'disabled' : ''}>${money(p.price)}</button></li>`,
      ).join('')}</ul>
      <p class="fine">Use one on a Midway tee, one a hole, on the day's counting round. Curses for your friends, the Pickpocket and the Prenup are on their way.</p>
      <div class="notes-foot"><button class="btn ghost" data-close>Done</button></div>`;
    s.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => s.remove();
    s.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          try {
            await api.buyPowerup(requireSession(), b.dataset.buy!);
            await draw(`${powerOf(b.dataset.buy!)?.name} is in your locker.`);
          } catch (err) {
            await draw((err as Error).message);
          }
        }),
    );
  };
  await draw();
}

// on a Midway tee: use one from the locker on this hole, or tee it up without. Only what helps on this hole is offered
// (the Express Lane only where there's a lane).
export function pickPower(locker: PowerupState['locker'], hole: Hole): Promise<{ id: number; kind: string } | null> {
  const usable = locker.filter((l) => l.kind !== 'express' || !!hole.express);
  if (!usable.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    const s = sheet(`
      <p class="eyebrow">${esc(hole.name)} · your locker</p>
      <h2>Use a power-up here?</h2>
      <ul class="prize-list">${usable
        .map((l) => {
          const p = powerOf(l.kind);
          return p ? `<li><i>${p.icon}</i><div><b>${p.name}</b><span>${p.line}</span></div><button class="btn small" data-use="${l.id}">Use</button></li>` : '';
        })
        .join('')}</ul>
      <div class="notes-foot"><button class="btn ghost" data-skip-power>Tee it up without</button></div>`);
    const done = (v: { id: number; kind: string } | null) => {
      s.remove();
      resolve(v);
    };
    s.querySelector<HTMLButtonElement>('[data-skip-power]')!.onclick = () => done(null);
    s.querySelectorAll<HTMLButtonElement>('[data-use]').forEach((b) => (b.onclick = () => done(usable.find((l) => l.id === Number(b.dataset.use)) ?? null)));
  });
}
