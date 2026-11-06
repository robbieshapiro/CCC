// Kudos and chirps. Tap another member out on the course and their card comes up: their headshot, club and standing,
// today's low and what they're wearing, and a kudos or a chirp to send them (with a line of your own if you like, up to
// 80 characters). It waits on their home page
// until they clear it, or for a day at most. The Committee sees them all in Admin and can take any down.
import { api } from '../api';
import type { AdminShoutout, Player, ShoutKind, Shoutout } from '../api/types';
import { portrait, specOf } from '../avatar';
import { kitByKey } from '../kits';
import { badgeFor, earningsOf, ITEMS, rankOf } from '../shop';
import { toParLabel } from '../standings';
import { sfx } from '../fx/sound';
import type { Ghost } from '../golf3d/engine';
import type { Course } from '../golf3d/courses';
import { requireSession } from '../state';
import { esc } from '../ui';

export const SHOUT_MAX = 80;
const ICON: Record<ShoutKind, string> = { kudos: '👏', chirp: '🐦' };

// what they're wearing worth a mention: the fall kit if they have it on, then the shop's pieces they wear, best first
function wearing(p: Player | undefined): string[] {
  if (!p) return [];
  const spec = specOf(p.avatar);
  const kit = spec.top === 'quarterzip' ? kitByKey(spec.kit) : undefined;
  const items = ITEMS.filter((i) => i.price > 0 && i.kind !== 'caddie' && i.worn(spec))
    .sort((x, y) => y.price - x.price)
    .map((i) => i.name);
  return [...(kit ? [`${kit.name} kit`] : []), ...items].slice(0, 4);
}

// Their card over the course: their headshot, club and standing, today's low, what they're wearing, and a line to send
// as kudos or a chirp. A rehearsal's sample member (no id) sends nothing.
export function shoutSheet(host: HTMLElement, g: Ghost, course: Course, p: Player | undefined, club: string, done: () => void = () => {}) {
  const sheet = document.createElement('div');
  sheet.className = 'summary shout-sheet';
  const played = course.holes.map((h, i) => ({ par: h.par, n: g.holes[i] })).filter((x) => x.n !== undefined && x.n !== null);
  const total = played.reduce((a, x) => a + x.n, 0);
  const toPar = total - played.reduce((a, x) => a + x.par, 0);
  const status = p ? (p.host ? 'Full Member' : rankOf(earningsOf(p), p.wins ?? 0).name) : 'Member';
  const kit = wearing(p);
  sheet.innerHTML = `
    <div class="summary-card shout-card" role="dialog" aria-label="${esc(g.name)}">
      <button class="shout-x" data-close aria-label="Close">×</button>
      <div class="shout-who">
        <span class="shout-face">${portrait(g.avatar, 84)}</span>
        <div>
          <h2>${esc(g.name)}${p ? badgeFor(p, 20) : ''}</h2>
          <p class="shout-meta">${esc(club)} · ${esc(status)}</p>
          ${played.length ? `<p class="shout-low">Today's low <b>${total}</b> <span>${toParLabel(toPar)}</span></p>` : ''}
        </div>
      </div>
      ${kit.length ? `<p class="shout-kit"><span>Wearing</span> ${kit.map(esc).join(' · ')}</p>` : ''}
      <form class="shout-own" data-own>
        <input maxlength="${SHOUT_MAX}" placeholder="Say something (optional)" aria-label="Your line" />
        <div class="shout-own-go"><button class="btn" type="submit" data-kind="kudos">${ICON.kudos} Kudos</button><button class="btn ghost" type="submit" data-kind="chirp">${ICON.chirp} Chirp</button></div>
      </form>
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
  const form = sheet.querySelector<HTMLFormElement>('[data-own]')!;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const kind = (((e as SubmitEvent).submitter as HTMLButtonElement | null)?.dataset.kind as ShoutKind | undefined) ?? 'kudos';
    // nothing typed: the kudos or the chirp on its own
    const body = form.querySelector('input')!.value.replace(/\s+/g, ' ').trim() || ICON[kind];
    if (busy) return;
    busy = true;
    msg.classList.remove('error');
    try {
      if (g.id) await api.sendShoutout(requireSession(), g.id, kind, body);
      sfx('pop');
      msg.textContent = g.id ? `Sent. ${g.name} sees it next time they open the club.` : 'Preview: this is how it sends. Nothing went to anyone.';
      form.querySelectorAll<HTMLButtonElement>('button').forEach((b) => (b.disabled = true));
      window.setTimeout(close, 1600);
    } catch (err) {
      msg.textContent = (err as Error).message || "Couldn't send that one.";
      msg.classList.add('error');
      busy = false;
    }
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
