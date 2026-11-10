// The Prize Counter at the Midway (Eli's game): buy power-ups with your club money, send curses, pick a pocket, and
// read the week's news. On a Midway tee, pick one from your locker to use on the hole. At the start of the day's
// counting round, the curses waiting for you land (and Pass It On can send one elsewhere). The rules are kept on the
// server too (buy_powerup, send_curse, pick_pocket, land_curses, pass_curse).
import { api } from '../api';
import type { LandedCurse, PowerupState, Snapshot } from '../api/types';
import type { Hole } from '../golf3d/types';
import { CURSES_A_WEEK, LOCKER_MAX, newsLine, powerOf, POWERS, type Power } from '../powerups';
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

// the members you can aim at: everyone in this club but you
const targets = (snap: Snapshot) => snap.players.filter((p) => p.id !== snap.me && !p.host).sort((a, b) => a.name.localeCompare(b.name));
const memberSelect = (snap: Snapshot, id: string) =>
  `<select class="prize-who" data-who="${id}" aria-label="Which member"><option value="">Pick a member…</option>${targets(snap)
    .map((p) => `<option value="${p.id}">${esc(p.name)}</option>`)
    .join('')}</select>`;

// the counter: your bank and locker, the week's news, then what's for sale (yours, the Pickpocket, curses)
export async function openPrizeCounter() {
  const s = sheet('<p class="muted">Opening the counter…</p>');
  const draw = async (note = '') => {
    const [snap, st] = await Promise.all([refresh(), api.powerupState(requireSession()).catch((): PowerupState => ({ locker: [] }))]);
    const me = snap.players.find((p) => p.id === snap.me);
    const bank = me ? balanceOf(me) : 0;
    const full = st.locker.length >= LOCKER_MAX;
    const sent = st.sentThisWeek ?? 0;
    const row = (p: Power, action: string) => `<li><i>${p.icon}</i><div><b>${p.name}</b><span>${p.does}</span>${action.includes('<select') ? action : ''}</div>${action.includes('<select') ? '' : action}</li>`;
    const buy = (p: Power) => {
      const off = bank < p.price || full;
      return `<button class="btn small${off ? ' ghost' : ''}" data-buy="${p.kind}" ${off ? 'disabled' : ''}>${money(p.price)}</button>`;
    };
    const aim = (p: Power, verb: string) => {
      const off = bank < p.price || (p.group === 'curse' && sent >= CURSES_A_WEEK) || (p.group === 'steal' && full);
      return `<div class="prize-aim">${memberSelect(snap, p.kind)}<button class="btn small${off ? ' ghost' : ''}" data-aim="${p.kind}" ${off ? 'disabled' : ''}>${verb} · ${money(p.price)}</button></div>`;
    };
    const news = (st.news ?? []).map(newsLine).filter(Boolean);
    s.querySelector('.notes-body')!.innerHTML = `
      <p class="eyebrow">The Midway · Prize Counter</p>
      <h2>Power-ups</h2>
      <p class="prize-bank"><b>${money(bank)}</b> to spend · locker ${st.locker.length} of ${LOCKER_MAX}${st.locker.length ? `: ${st.locker.map((l) => powerOf(l.kind)?.icon ?? '').join(' ')}` : ''}</p>
      ${st.waiting ? `<p class="prize-warn">${st.waiting === 1 ? 'A curse is' : `${st.waiting} curses are`} waiting for your next Midway round. Who sent what is a surprise.</p>` : ''}
      ${note ? `<p class="prize-note">${esc(note)}</p>` : ''}
      ${news.length ? `<details class="prize-news"><summary>This week at the Midway</summary><ul>${news.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></details>` : ''}
      <h3>For you</h3>
      <ul class="prize-list">${POWERS.filter((p) => p.group === 'mine').map((p) => row(p, buy(p))).join('')}</ul>
      <h3>For a friend</h3>
      <ul class="prize-list">${POWERS.filter((p) => p.group === 'steal').map((p) => row(p, aim(p, 'Pick'))).join('')}</ul>
      <p class="fine">Curses land on their next counting Midway round, one hole each. ${CURSES_A_WEEK} a week from you (${Math.max(0, CURSES_A_WEEK - sent)} left), two waiting on anyone at once. A Prenup stops one, and you've still paid.</p>
      <ul class="prize-list">${POWERS.filter((p) => p.group === 'curse').map((p) => row(p, aim(p, 'Send'))).join('')}</ul>
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
    s.querySelectorAll<HTMLButtonElement>('[data-aim]').forEach(
      (b) =>
        (b.onclick = async () => {
          const kind = b.dataset.aim!;
          const sel = s.querySelector<HTMLSelectElement>(`[data-who="${kind}"]`);
          const who = sel?.value;
          if (!who) return void (sel?.focus(), sel?.classList.add('need'));
          const name = sel!.selectedOptions[0]?.textContent ?? 'them';
          const p = powerOf(kind)!;
          b.disabled = true;
          try {
            if (kind === 'pickpocket') {
              const got = await api.pickPocket(requireSession(), who);
              await draw(got === 'blocked' ? `${name}'s Prenup caught your hand. The Pickpocket is spent.` : `You picked ${name}'s pocket: ${powerOf(got)?.name ?? got} is yours.`);
            } else {
              const r = await api.sendCurse(requireSession(), kind, who);
              await draw(r === 'blocked' ? `${name}'s Prenup stopped your ${p.name}. Paid all the same.` : `${p.name} is waiting for ${name}'s next round.`);
            }
          } catch (err) {
            await draw((err as Error).message);
          }
        }),
    );
  };
  await draw();
}

// At the start of the day's counting Midway round: the curses waiting for you land. Each takes a hole, in order (the
// Bouncer takes your power-ups for the round). With a Pass It On in your locker, you can send one on instead.
export async function landCurses(snap: Snapshot): Promise<LandedCurse[]> {
  let landed = await api.landCurses(requireSession()).catch(() => [] as LandedCurse[]);
  if (!landed.length) return [];
  let st = await api.powerupState(requireSession()).catch((): PowerupState => ({ locker: [] }));
  return new Promise((resolve) => {
    const s = sheet('');
    const draw = (note = '') => {
      const canPass = st.locker.some((l) => l.kind === 'passon');
      s.querySelector('.notes-body')!.innerHTML = `
        <p class="eyebrow">The Midway · before you tee off</p>
        <h2>${landed.length ? 'You’ve been cursed' : 'Passed on'}</h2>
        ${note ? `<p class="prize-note">${esc(note)}</p>` : ''}
        <ul class="prize-list">${landed
          .map((c, i) => {
            const p = powerOf(c.kind);
            const where = c.kind === 'bouncer' ? 'this round' : `hole ${Math.min(i + 1, 3)}`;
            return `<li><i>${p?.icon ?? '❓'}</i><div><b>${esc(p?.name ?? c.kind)}</b><span>From ${esc(c.from ?? 'someone')}${c.via ? `, passed on by ${esc(c.via)}` : ''} · ${where}. ${p?.line ?? ''}</span>
              ${canPass ? `<div class="prize-aim">${memberSelect(snap, String(c.id))}<button class="btn small" data-pass="${c.id}">Pass it on</button></div>` : ''}</div></li>`;
          })
          .join('')}</ul>
        <p class="fine">Reginald would like it known he had nothing to do with this.</p>
        <div class="notes-foot"><button class="btn" data-go>${landed.length ? 'Fine. Tee off' : 'Tee off'}</button></div>`;
      s.querySelector<HTMLButtonElement>('[data-go]')!.onclick = () => {
        s.remove();
        resolve(landed);
      };
      s.querySelectorAll<HTMLButtonElement>('[data-pass]').forEach(
        (b) =>
          (b.onclick = async () => {
            const id = Number(b.dataset.pass);
            const sel = s.querySelector<HTMLSelectElement>(`[data-who="${id}"]`);
            if (!sel?.value) return void (sel?.focus(), sel?.classList.add('need'));
            const name = sel.selectedOptions[0]?.textContent ?? 'them';
            b.disabled = true;
            try {
              const r = await api.passCurse(requireSession(), id, sel.value);
              landed = landed.filter((c) => c.id !== id);
              st = await api.powerupState(requireSession()).catch(() => st);
              draw(r === 'blocked' ? `Passed to ${name}, and their Prenup stopped it. Gone either way.` : `Passed on to ${name}. It waits for their next round.`);
            } catch (err) {
              draw((err as Error).message);
            }
          }),
      );
    };
    draw();
  });
}

// on a Midway tee: use one from the locker on this hole, or tee it up without. Only what helps on this hole is offered
// (the Express Lane only where there's a lane; the Prenup and Pass It On work by themselves).
export function pickPower(locker: PowerupState['locker'], hole: Hole): Promise<{ id: number; kind: string } | null> {
  const usable = locker.filter((l) => l.kind === 'magnet' || (l.kind === 'express' && !!hole.express));
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
