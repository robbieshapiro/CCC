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
        ${hostChip(useSupabase ? 'This club is by invitation. Ask a member for the link.' : `${REGINALD.welcome()} You're in local mode, so it's just this device for now.`)}
        ${useSupabase ? '' : `<a class="btn" href="#/join/demo">Enter the club</a>`}
      </section>
    </main>`);
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
