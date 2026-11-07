// The club's own dialogs, in place of the browser's confirm, alert and prompt (which show the site's address, like
// "ccc.vercel.app says", in a plain grey box). One sheet on a dimmed page: a title, a line or two, and the buttons.
import { esc } from './ui';

export type AskOpts = {
  title: string;
  body?: string; // HTML, already escaped by the caller
  ok?: string;
  cancel?: string;
  danger?: boolean; // the ok button in red, for something that can't be undone
};

let open: (() => void) | null = null;

function sheet(inner: string, onKey: (e: KeyboardEvent) => void): HTMLElement {
  open?.();
  const back = document.createElement('div');
  back.className = 'dlg-back';
  back.innerHTML = `<div class="dlg" role="dialog" aria-modal="true">${inner}</div>`;
  document.body.appendChild(back);
  const key = (e: KeyboardEvent) => {
    e.stopPropagation();
    onKey(e);
  };
  window.addEventListener('keydown', key, true);
  open = () => {
    window.removeEventListener('keydown', key, true);
    back.remove();
    open = null;
  };
  requestAnimationFrame(() => back.classList.add('in'));
  return back;
}

// Yes or no. Resolves true for the ok button, false for cancel, Escape or a tap outside.
export function ask(o: AskOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (v: boolean) => {
      open?.();
      resolve(v);
    };
    const back = sheet(
      `<h2>${esc(o.title)}</h2>${o.body ? `<div class="dlg-body">${o.body}</div>` : ''}
      <div class="dlg-btns"><button class="btn ghost" data-no>${esc(o.cancel ?? 'Cancel')}</button><button class="btn${o.danger ? ' danger' : ''}" data-yes>${esc(o.ok ?? 'OK')}</button></div>`,
      (e) => {
        if (e.key === 'Escape') done(false);
        if (e.key === 'Enter') done(true);
      },
    );
    back.onclick = (e) => e.target === back && done(false);
    back.querySelector<HTMLButtonElement>('[data-no]')!.onclick = () => done(false);
    const yes = back.querySelector<HTMLButtonElement>('[data-yes]')!;
    yes.onclick = () => done(true);
    yes.focus();
  });
}

// A message with one button.
export function tell(title: string, body?: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      open?.();
      resolve();
    };
    const back = sheet(
      `<h2>${esc(title)}</h2>${body ? `<div class="dlg-body">${body}</div>` : ''}<div class="dlg-btns"><button class="btn" data-yes>OK</button></div>`,
      (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') done();
      },
    );
    back.onclick = (e) => e.target === back && done();
    const yes = back.querySelector<HTMLButtonElement>('[data-yes]')!;
    yes.onclick = done;
    yes.focus();
  });
}

// Text to copy by hand, when the clipboard isn't available: shown selected, with a Copy button that tries again.
export function copyBox(title: string, text: string): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      open?.();
      resolve();
    };
    const back = sheet(
      `<h2>${esc(title)}</h2><textarea class="dlg-copy" readonly rows="${Math.min(8, text.split('\n').length + 1)}">${esc(text)}</textarea>
      <div class="dlg-btns"><button class="btn ghost" data-no>Close</button><button class="btn" data-yes>Copy</button></div>`,
      (e) => e.key === 'Escape' && done(),
    );
    const box = back.querySelector<HTMLTextAreaElement>('textarea')!;
    box.focus();
    box.select();
    back.onclick = (e) => e.target === back && done();
    back.querySelector<HTMLButtonElement>('[data-no]')!.onclick = done;
    const yes = back.querySelector<HTMLButtonElement>('[data-yes]')!;
    yes.onclick = async () => {
      box.select();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        document.execCommand?.('copy');
      }
      yes.textContent = 'Copied';
      setTimeout(done, 700);
    };
  });
}
