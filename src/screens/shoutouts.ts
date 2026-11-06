// Kudos and chirps. Tap another member out on the course and their card comes up: today's scores, hole by hole, and
// a kudos or a chirp to send them (a ready-made line or your own, up to 80 characters). It waits on their home page
// until they clear it, or for a day at most. The Committee sees them all in Admin and can take any down.
import { api } from '../api';
import type { AdminShoutout, ShoutKind, Shoutout } from '../api/types';
import { sfx } from '../fx/sound';
import type { Ghost } from '../golf3d/engine';
import { scoreName } from '../golf3d/engine';
import type { Course } from '../golf3d/courses';
import { requireSession } from '../state';
import { esc } from '../ui';
import { scoreClass } from './home';

export const SHOUT_MAX = 80;
const ICON: Record<ShoutKind, string> = { kudos: '👏', chirp: '🐦' };

// ready-made lines, a couple of them about how their day went
function presets(g: Ghost, course: Course): Record<ShoutKind, string[]> {
  const played = course.holes.map((h, i) => ({ h, n: g.holes[i] })).filter((x) => x.n !== undefined && x.n !== null);
  const birdie = played.find((x) => x.n < x.h.par);
  const blow = played.find((x) => x.n >= x.h.par + 2);
  const short = (s: string) => s.replace(/^The /, '');
  return {
    kudos: [birdie ? `Lovely ${scoreName(birdie.n, birdie.h.par).toLowerCase()} on ${short(birdie.h.name)}` : 'Steady golf. Annoyingly steady.', 'Round well played', 'Pure strike out there'].map((x) => x.slice(0, SHOUT_MAX)),
    chirp: [blow ? `A ${blow.n} on ${short(blow.h.name)}? Bold.` : 'Saw that one. Brave.', 'Is that the swing or the warm-up?', 'The range is open till midnight.', 'Reginald has asked me to have a word.'].map((x) => x.slice(0, SHOUT_MAX)),
  };
}

// The card over the course: their round so far, and what to send. A rehearsal ghost (no id) sends nothing.
export function shoutSheet(host: HTMLElement, g: Ghost, course: Course, done: () => void = () => {}) {
  const sheet = document.createElement('div');
  sheet.className = 'summary shout-sheet';
  const lines = presets(g, course);
  const total = course.holes.reduce((a, _, i) => a + (g.holes[i] ?? 0), 0);
  const par = course.holes.reduce((a, h, i) => a + (g.holes[i] === undefined || g.holes[i] === null ? 0 : h.par), 0);
  const toPar = total - par;
  sheet.innerHTML = `
    <div class="summary-card shout-card" role="dialog" aria-label="${esc(g.name)}'s card">
      <button class="shout-x" data-close aria-label="Close">×</button>
      <p class="eyebrow">Out on ${esc(course.name)} today</p>
      <h2>${esc(g.name)} <small>${total ? `${total} · ${toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar}` : ''}</small></h2>
      <table class="scorecard"><thead><tr>${course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}</tr></thead>
        <tbody><tr class="par">${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}</tr>
        <tr>${course.holes.map((h, i) => (g.holes[i] === undefined || g.holes[i] === null ? '<td class="num">–</td>' : `<td class="num"><span class="sc ${scoreClass(g.holes[i], h.par)}">${g.holes[i]}</span></td>`)).join('')}</tr></tbody></table>
      <div class="shout-pick">
        <p class="shout-label">${ICON.kudos} Kudos</p>
        <div class="shout-chips">${lines.kudos.map((t) => `<button data-send="kudos" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <p class="shout-label">${ICON.chirp} Chirp</p>
        <div class="shout-chips">${lines.chirp.map((t) => `<button data-send="chirp" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <form class="shout-own" data-own>
          <input maxlength="${SHOUT_MAX}" placeholder="Or say your own (${SHOUT_MAX} characters)" aria-label="Your own line" />
          <div class="shout-own-go"><button class="btn small" type="submit" data-kind="kudos">${ICON.kudos} Send kudos</button><button class="btn small ghost" type="submit" data-kind="chirp">${ICON.chirp} Send chirp</button></div>
        </form>
      </div>
      <p class="shout-msg" role="status"></p>
    </div>`;
  host.appendChild(sheet);
  const msg = sheet.querySelector<HTMLElement>('.shout-msg')!;
  const close = () => {
    sheet.remove();
    done();
  };
  sheet.querySelector<HTMLButtonElement>('[data-close]')!.onclick = close;
  sheet.onclick = (e) => {
    if (e.target === sheet) close();
  };
  // keys typed here are for the box, not the course
  sheet.addEventListener('keydown', (e) => e.stopPropagation());
  let busy = false;
  const send = async (kind: ShoutKind, text: string) => {
    const body = text.replace(/\s+/g, ' ').trim();
    if (!body || busy) return;
    busy = true;
    msg.classList.remove('error');
    try {
      if (g.id) await api.sendShoutout(requireSession(), g.id, kind, body);
      sfx('pop');
      msg.textContent = g.id ? `Sent. ${g.name} sees it next time they open the club.` : 'Preview: this is how it sends. Nothing went to anyone.';
      sheet.querySelectorAll<HTMLButtonElement>('button[data-send], .shout-own button').forEach((b) => (b.disabled = true));
      window.setTimeout(close, 1600);
    } catch (e) {
      msg.textContent = (e as Error).message || "Couldn't send that one.";
      msg.classList.add('error');
      busy = false;
    }
  };
  sheet.querySelectorAll<HTMLButtonElement>('[data-send]').forEach((b) => (b.onclick = () => void send(b.dataset.send as ShoutKind, b.dataset.text ?? '')));
  const form = sheet.querySelector<HTMLFormElement>('[data-own]')!;
  form.onsubmit = (e) => {
    e.preventDefault();
    const kind = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.dataset.kind as ShoutKind | undefined;
    void send(kind ?? 'kudos', form.querySelector('input')!.value);
  };
}

// ---------- home: what's waiting for you ----------

export const shoutStrip = () => '<section class="notices shouts" id="shouts" hidden></section>';

const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });

export async function bindShoutouts() {
  const list = await api.myShoutouts(requireSession()).catch(() => [] as Shoutout[]);
  const box = document.getElementById('shouts');
  if (!box || !list.length) return;
  let show = list;
  const clear = (ids: number[]) => {
    show = show.filter((x) => !ids.includes(x.id));
    draw();
    void api.seenShoutouts(requireSession(), ids).catch(() => {});
  };
  const draw = () => {
    box.hidden = !show.length;
    if (!show.length) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML = `
      <article class="notice shout-note">
        <div>
          <p class="notice-from"><b>From the course</b><small>${show.length === 1 ? '1 new' : `${show.length} new`}${show.length > 1 ? ' · <button class="link" data-clear-all>Clear all</button>' : ''}</small></p>
          <ul class="shout-list">${show.map((x) => `<li><span class="shout-kind">${ICON[x.kind]}</span><span><b>${esc(x.from)}</b> ${x.kind === 'kudos' ? 'gave you kudos' : 'chirped you'}: “${esc(x.body)}” <small>${when(x.createdAt)}</small></span><button class="shout-one" data-clear="${x.id}" aria-label="Clear this one">×</button></li>`).join('')}</ul>
        </div>
      </article>`;
    box.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((b) => (b.onclick = () => clear([Number(b.dataset.clear)])));
    const all = box.querySelector<HTMLButtonElement>('[data-clear-all]');
    if (all) all.onclick = () => clear(show.map((x) => x.id));
  };
  draw();
}

// ---------- the Committee Room ----------

export const adminShoutSection = () => `<section class="adm-card" id="adm-shouts"><h2>Kudos and chirps</h2><div id="adm-shouts-list"><p class="muted">Loading…</p></div></section>`;

export async function loadAdminShouts() {
  const el = document.getElementById('adm-shouts-list');
  if (!el) return;
  const rows = await api.adminShoutouts(requireSession()).catch(() => null);
  if (!document.getElementById('adm-shouts-list')) return;
  if (!rows) {
    el.innerHTML = '<p class="muted">Shows up once the kudos and chirps SQL is applied.</p>';
    return;
  }
  const draw = (all: AdminShoutout[]) => {
    el.innerHTML = all.length
      ? `<ul class="adm-list">${all
          .map(
            (x) => `<li${x.removed ? ' class="gone"' : ''}><span>${ICON[x.kind]} <b>${esc(x.from)}</b> to <b>${esc(x.to)}</b>: “${esc(x.body)}”<small>${when(x.createdAt)}${x.seen ? ' · seen' : ''}${x.removed ? ' · taken down' : ''}</small></span>${x.removed ? '' : `<button class="link" data-down="${x.id}">Take down</button>`}</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">None in the last fortnight. Members tap each other out on the course to send them.</p>';
    el.querySelectorAll<HTMLButtonElement>('[data-down]').forEach((b) => {
      b.onclick = async () => {
        b.disabled = true;
        await api.removeShoutout(requireSession(), Number(b.dataset.down)).catch(() => {});
        draw(all.map((x) => (x.id === Number(b.dataset.down) ? { ...x, removed: true } : x)));
      };
    });
  };
  draw(rows);
}
