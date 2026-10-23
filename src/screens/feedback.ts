// Notes to the Committee: any member can send one (after a round, or from the clubhouse); only the admin
// reads them, in a panel on their home page.
import { api } from '../api';
import type { Feedback } from '../api/types';
import { hostChip } from '../host';
import { requireSession } from '../state';
import { esc } from '../ui';

// A plain text box and a Submit button, over whatever is on screen. `context` says where it was sent from.
export function openFeedback(context: string, host: HTMLElement = document.body) {
  const sheet = document.createElement('div');
  sheet.className = 'feedback-sheet';
  sheet.innerHTML = `
    <form class="feedback-card" id="fb-form">
      ${hostChip("The Committee welcomes your remarks. It may even read them.")}
      <label for="fb-body">Your feedback <textarea id="fb-body" maxlength="2000" rows="6" required placeholder="What should we fix, add or change?"></textarea></label>
      <p class="error" id="fb-err" role="alert"></p>
      <div class="summary-actions"><button class="btn" type="submit">Submit</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
    </form>`;
  host.appendChild(sheet);
  const form = sheet.querySelector('form')!;
  const close = () => sheet.remove();
  (sheet.querySelector('[data-close]') as HTMLButtonElement).onclick = close;
  sheet.addEventListener('pointerdown', (e) => e.stopPropagation());
  (sheet.querySelector('#fb-body') as HTMLTextAreaElement).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = (sheet.querySelector('#fb-body') as HTMLTextAreaElement).value;
    const btn = form.querySelector('button[type=submit]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      await api.submitFeedback(requireSession(), body, context);
      form.innerHTML = `${hostChip('Received with thanks. I shall place it before the Committee personally.', 'pleased')}
        <div class="summary-actions"><button class="btn" type="button" data-close>Done</button></div>`;
      (form.querySelector('[data-close]') as HTMLButtonElement).onclick = close;
    } catch (err) {
      (sheet.querySelector('#fb-err') as HTMLElement).textContent = (err as Error).message;
      btn.disabled = false;
    }
  });
}

// The admin's inbox on the home page.
export function feedbackPanel(admin: boolean) {
  if (!admin) return '';
  return `<section class="panel feedback-panel"><div class="board-head"><h2>Member feedback</h2><span id="fb-count"></span></div><ul class="feedback-list" id="fb-list"><li class="muted">Loading…</li></ul></section>`;
}

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

export async function bindFeedbackPanel() {
  const list = document.getElementById('fb-list');
  if (!list) return;
  const s = requireSession();
  const draw = (items: Feedback[]) => {
    const open = items.filter((f) => !f.done).length;
    document.getElementById('fb-count')!.textContent = items.length ? `${open} open` : '';
    list.innerHTML = items.length
      ? items
          .map(
            (f) => `<li class="${f.done ? 'done' : ''}">
              <div><b>${esc(f.from ?? 'A former member')}</b><small>${when(f.createdAt)}${f.context ? ` · ${esc(f.context)}` : ''}</small></div>
              <p>${esc(f.body)}</p>
              <button class="link" data-fb="${f.id}" data-done="${f.done ? '0' : '1'}">${f.done ? 'Reopen' : 'Mark done'}</button>
            </li>`,
          )
          .join('')
      : '<li class="muted">Nothing yet. The members are, for once, content.</li>';
    list.querySelectorAll<HTMLButtonElement>('[data-fb]').forEach((b) => {
      b.onclick = async () => {
        await api.setFeedbackDone(s, Number(b.dataset.fb), b.dataset.done === '1');
        draw(await api.listFeedback(s));
      };
    });
  };
  draw(await api.listFeedback(s).catch(() => []));
}
