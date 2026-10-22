import { api, setSession, useSupabase } from '../api';
import { crest } from '../brand';
import { hostChip, REGINALD } from '../host';
import { esc, navigate, render } from '../ui';

const masthead = () => `
  <div class="masthead">${crest(110, 'm')}<h1 class="title-big">Claude Country Club</h1><p class="eyebrow">Members only</p></div>`;

export function landing() {
  render(`
    <main class="narrow">
      ${masthead()}
      <section class="member-form">
        <p class="lede">A private mini golf club for a few friends. A new course every month, as many rounds as you like. Your best one counts.</p>
        ${hostChip(useSupabase ? "Members only. If you've been put up for membership, enter the invite code." : `${REGINALD.welcome()} You're in local mode, so it's just this device for now.`)}
        <form id="code" class="code-form">
          <label for="invite">Invite code <input id="invite" name="invite" autocapitalize="none" autocorrect="off" autocomplete="off" spellcheck="false" required></label>
          <button class="btn" type="submit">Continue</button>
        </form>
        ${useSupabase ? '' : `<a class="link" href="#/join/demo">Or enter the demo club</a>`}
      </section>
    </main>`);
  const form = document.getElementById('code') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = String(new FormData(form).get('invite')).trim().toLowerCase();
    if (code) navigate(`#/join/${encodeURIComponent(code)}`);
  });
}

export function join(code: string) {
  render(`
    <main class="narrow">
      ${masthead()}
      <form id="join" class="member-form stack">
        ${hostChip(REGINALD.invited())}
        <label for="name">Name <input id="name" name="name" maxlength="20" autocomplete="nickname" required autofocus></label>
        <label for="pin">PIN <input id="pin" name="pin" inputmode="numeric" pattern="\\d{4}" maxlength="4" required></label>
        <p class="error" id="err" role="alert"></p>
        <button class="btn" type="submit">Sign the book</button>
        <a class="link" href="#/">Wrong code? Go back</a>
      </form>
    </main>`);
  const form = document.getElementById('join') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    try {
      const s = await api.join(code, String(fd.get('name')), String(fd.get('pin')));
      setSession(s);
      navigate('#/welcome');
    } catch (err) {
      document.getElementById('err')!.innerHTML = esc((err as Error).message);
      btn.disabled = false;
    }
  });
}
