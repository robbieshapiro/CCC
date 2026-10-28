// Club notices: the admin posts news to every member, signed as Reginald or as themselves.
// Members see live notices at the top of the home page and can dismiss each one on their device.
import { api } from '../api';
import type { Notice } from '../api/types';
import { reginaldSvg } from '../host';
import { requireSession } from '../state';
import { store } from '../storage';
import { esc } from '../ui';

const SEEN = 'ccc-notices-dismissed';
const dismissed = (): number[] => {
  try {
    return JSON.parse(store.get(SEEN) || '[]');
  } catch {
    return [];
  }
};
const dismiss = (id: number) => store.set(SEEN, JSON.stringify([...new Set([...dismissed(), id])].slice(-50)));

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });

// Placeholders the home page fills in once the notices load.
export function noticesStrip() {
  return '<section class="notices" id="notices" hidden></section>';
}

export function noticeComposer(admin: boolean) {
  if (!admin) return '';
  return `
    <section class="panel admin notice-composer">
      <div><h2>Post a notice</h2><p class="muted">Shows at the top of every member's home page until you take it down.</p></div>
      <form id="notice-form" class="stack">
        <textarea id="notice-body" maxlength="1000" rows="3" required placeholder="The Highlands closes Sunday. Get your rounds in."></textarea>
        <div class="notice-sign" role="radiogroup" aria-label="Sign it as">
          <label><input type="radio" name="sign" value="reginald" checked> Reginald</label>
          <label><input type="radio" name="sign" value="me"> Me</label>
        </div>
        <p class="error" id="notice-err" role="alert"></p>
        <button class="btn" type="submit">Post notice</button>
      </form>
      <ul class="notice-live" id="notice-live"></ul>
    </section>`;
}

export async function bindNotices() {
  const s = requireSession();
  const first = await api.listNotices(s).catch(() => [] as Notice[]);
  // look the page up after the wait, so we wire whatever is on screen now: the strip on the home page, the
  // composer in the Committee Room
  const box = document.getElementById('notices');
  const live = document.getElementById('notice-live');
  if (!box && !live) return;
  const draw = (all: Notice[]) => {
    const seen = dismissed();
    const show = all.filter((n) => !seen.includes(n.id));
    if (box) {
      box.hidden = !show.length;
      box.innerHTML = show
        .map(
          (n) => `<article class="notice">
            ${n.asReginald ? `<span class="host-face">${reginaldSvg('dry', 46)}</span>` : ''}
            <div><p class="notice-from"><b>${n.asReginald ? 'Reginald' : esc(n.author ?? 'The Committee')}</b><small>${day(n.createdAt)}</small></p>
            <p class="notice-body">${esc(n.body)}</p></div>
            <button class="notice-x" data-dismiss="${n.id}" aria-label="Dismiss">×</button>
          </article>`,
        )
        .join('');
      box.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach((b) => {
        b.onclick = () => {
          dismiss(Number(b.dataset.dismiss));
          draw(all);
        };
      });
    }
    if (live)
      live.innerHTML = all
        .map((n) => `<li><span>${esc(n.body)}<small>${n.asReginald ? 'As Reginald' : 'As you'} · ${day(n.createdAt)}</small></span><button class="link" data-down="${n.id}">Take down</button></li>`)
        .join('');
    live?.querySelectorAll<HTMLButtonElement>('[data-down]').forEach((b) => {
      b.onclick = async () => {
        await api.takeDownNotice(s, Number(b.dataset.down));
        draw(await api.listNotices(s));
      };
    });
  };
  draw(first);

  const form = document.getElementById('notice-form') as HTMLFormElement | null;
  if (!form || form.dataset.bound) return;
  form.dataset.bound = '1';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = document.getElementById('notice-body') as HTMLTextAreaElement;
    const err = document.getElementById('notice-err')!;
    err.textContent = '';
    try {
      await api.postNotice(s, body.value, new FormData(form).get('sign') === 'reginald');
      body.value = '';
      draw(await api.listNotices(s));
    } catch (x) {
      err.textContent = (x as Error).message;
    }
  });
}
