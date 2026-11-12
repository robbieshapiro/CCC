// Nominate a friend. Members: a tile under the board on home, and Reginald's sheet with two boxes (their first name,
// their mobile). The Committee: a card on the Committee Room's Today tab, where Invite makes the personal invitation and
// opens a text to send from their own phone, and Decline clears it. Once decided, the number is wiped.
import { api } from '../api';
import type { AdminNominations, MyNomination, Nominated } from '../api/types';
import { hostChip } from '../host';
import { requireSession } from '../state';
import { esc } from '../ui';
import { ago } from './activity';
import { inviteLink } from './invite';

// ---------- members ----------

export function nominateTile() {
  return `<section class="nominate" id="nominate">
    <span class="nm-icon" aria-hidden="true">✉️</span>
    <span class="nm-text"><b>Know someone who'd love it here?</b><small id="nm-line">Put them up for membership. Reginald does the rest.</small></span>
    <button class="btn small" data-nominate>Nominate a friend</button>
  </section>`;
}

// the tile's second line: a friend who joined lately, or one still with the Committee
const line = (n: MyNomination | undefined) =>
  !n
    ? ''
    : n.status === 'joined'
      ? `${esc(n.name)} joined, thanks to you. Anyone else?`
      : `The Committee has ${esc(n.name)}'s name. Anyone else?`;

export async function bindNominateTile() {
  document.querySelectorAll<HTMLButtonElement>('[data-nominate]').forEach((b) => (b.onclick = () => openNominate()));
  const mine = await api.myNominations(requireSession()).catch(() => [] as MyNomination[]);
  // a join shows for two weeks; otherwise the latest still waiting
  const joined = mine.find((n) => n.status === 'joined' && Date.now() - Date.parse(n.at) < 14 * 86_400_000);
  const text = line(joined ?? mine.find((n) => n.status === 'waiting'));
  const el = document.getElementById('nm-line');
  if (el && text) el.innerHTML = text;
}

export function openNominate(host: HTMLElement = document.body) {
  const sheet = document.createElement('div');
  sheet.className = 'feedback-sheet';
  sheet.innerHTML = `
    <form class="feedback-card nominate-card" id="nm-form">
      ${hostChip('Put a friend up for membership? Splendid. Their first name and mobile, and I shall place them before the Committee.')}
      <label for="nm-name">Their first name <input id="nm-name" maxlength="20" required autocomplete="off" autocapitalize="words" placeholder="Sam" /></label>
      <label for="nm-phone">Their mobile <input id="nm-phone" type="tel" inputmode="tel" maxlength="20" required autocomplete="off" placeholder="(555) 123-4567" /></label>
      <p class="fine">If the Committee approves, they'll get a text with their invitation. The number is only for that.</p>
      <p class="error" id="nm-err" role="alert"></p>
      <div class="summary-actions"><button class="btn" type="submit">Send to Reginald</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
    </form>`;
  host.appendChild(sheet);
  const form = sheet.querySelector('form')!;
  const close = () => sheet.remove();
  (sheet.querySelector('[data-close]') as HTMLButtonElement).onclick = close;
  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  (sheet.querySelector('#nm-name') as HTMLInputElement).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (sheet.querySelector('#nm-name') as HTMLInputElement).value.trim();
    const phone = (sheet.querySelector('#nm-phone') as HTMLInputElement).value;
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await api.nominate(requireSession(), name, phone);
      form.innerHTML = `${hostChip(`Very good. ${esc(name)} is before the Committee. I'll let you know when they join.`, 'pleased')}
        <div class="summary-actions"><button class="btn" type="button" data-close>Done</button></div>`;
      (form.querySelector('[data-close]') as HTMLButtonElement).onclick = close;
      const el = document.getElementById('nm-line');
      if (el) el.innerHTML = line({ name, status: 'waiting', at: new Date().toISOString() });
    } catch (err) {
      (sheet.querySelector('#nm-err') as HTMLElement).textContent = (err as Error).message;
      btn.disabled = false;
    }
  });
}

// ---------- the Committee ----------

// +15551234567 as (555) 123-4567; anything else as stored
export const showPhone = (p: string) => (/^\+1\d{10}$/.test(p) ? `(${p.slice(2, 5)}) ${p.slice(5, 8)}-${p.slice(8)}` : p);

const message = (n: Nominated) =>
  `Hi ${n.name}, ${n.from ? `${n.from} put you up for` : "you've been put up for"} the CCC, our little online golf club. Here's your invitation: ${inviteLink(n.inviteId)}`;
// sms:<number>?&body= works on both iPhone and Android
const smsHref = (n: Nominated) => `sms:${n.phone}?&body=${encodeURIComponent(message(n))}`;

export function nominationsSection() {
  return `<section class="adm-card" id="adm-nominations" hidden><h2>Put up for membership <small id="adm-nom-count"></small></h2><div id="adm-nom-body"></div></section>`;
}

let data: AdminNominations | null = null;
let many = false;
let onCount: (n: number) => void = () => {};
// friends approved this visit: the text to send stays on screen (the number is gone from the server)
const made = new Map<number, Nominated>();
let who: (name: string, id?: string | null) => string = esc;

export async function loadNominations(o: { many: boolean; count: (n: number) => void; who: (name: string, id?: string | null) => string }) {
  many = o.many;
  onCount = o.count;
  who = o.who;
  data = await api.adminNominations(requireSession()).catch(() => null);
  drawNominations();
}

function drawNominations() {
  const card = document.getElementById('adm-nominations');
  const body = document.getElementById('adm-nom-body');
  if (!card || !body || !data) return;
  const d = data;
  onCount(d.pending.length);
  card.hidden = !d.pending.length && !d.joined.length && !made.size;
  document.getElementById('adm-nom-count')!.textContent = d.pending.length ? String(d.pending.length) : '';
  const chip = (club: string) => (many ? `<span class="adm-club">${esc(club)}</span>` : '');
  const sent = [...made.entries()].map(
    ([id, n]) => `<li class="fresh"><div><b>${esc(n.name)}</b> <small>invitation made</small><p>${esc(showPhone(n.phone))}</p></div>
      <span class="adm-acts"><a class="btn small" href="${esc(smsHref(n))}">💬 Text ${esc(n.name)}</a><button class="link" data-copy-text="${id}">Copy text</button></span></li>`,
  );
  const waiting = d.pending.map(
    (n) => `<li><div>${chip(n.club)}<b>${esc(n.name)}</b> <small>put up by ${n.from ? who(n.from, n.fromId) : 'a member'} · ${ago(n.createdAt)}</small><p>${esc(showPhone(n.phone))}</p></div>
      <span class="adm-acts"><button class="btn small" data-nom-yes="${n.id}">Invite</button><button class="link" data-nom-no="${n.id}" data-name="${esc(n.name)}">Decline</button></span></li>`,
  );
  const joined = d.joined.map((j) => `<li><div>${chip(j.club)}${who(j.name, j.id)} <small>joined ${ago(j.at)}, put up by ${j.from ? who(j.from, j.fromId) : 'a member'}</small></div></li>`);
  body.innerHTML = `
    ${sent.length || waiting.length ? `<ul class="adm-list">${sent.join('')}${waiting.join('')}</ul>` : ''}
    ${waiting.length ? '<p class="fine">Invite makes their invitation and a text to send from your phone. The number is wiped once you decide.</p>' : ''}
    ${joined.length ? `<h3 class="adm-sub">Joined lately</h3><ul class="adm-list">${joined.join('')}</ul>` : ''}`;
  body.querySelectorAll<HTMLButtonElement>('[data-nom-yes], [data-nom-no]').forEach(
    (b) =>
      (b.onclick = async () => {
        const id = Number(b.dataset.nomYes ?? b.dataset.nomNo);
        const yes = !!b.dataset.nomYes;
        b.disabled = true;
        try {
          const n = await api.decideNomination(requireSession(), id, yes);
          if (n) made.set(id, n);
          d.pending = d.pending.filter((x) => x.id !== id);
          drawNominations();
        } catch (x) {
          b.disabled = false;
          b.closest('li')?.insertAdjacentHTML('beforeend', `<p class="error">${esc((x as Error).message)}</p>`);
        }
      }),
  );
  body.querySelectorAll<HTMLButtonElement>('[data-copy-text]').forEach(
    (b) =>
      (b.onclick = async () => {
        const n = made.get(Number(b.dataset.copyText));
        if (!n) return;
        await navigator.clipboard.writeText(message(n)).then(
          () => (b.textContent = 'Copied'),
          () => (b.textContent = "Couldn't copy"),
        );
      }),
  );
}
