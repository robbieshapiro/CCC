import { api, setSession, useSupabase } from '../api';
import { crest } from '../brand';
import { hostChip, REGINALD } from '../host';
import { esc, navigate, render } from '../ui';

const masthead = () => `
  <div class="masthead">${crest(110, 'm')}<h1 class="title-big">CCC</h1><p class="eyebrow">Claude Country Club · Members only</p></div>`;

const pinField = (label: string, hint: string, focus = false) => `
  <label for="pin">${label} <input id="pin" name="pin" type="password" inputmode="numeric" pattern="\\d{4}" maxlength="4" autocomplete="off" required ${focus ? 'autofocus' : ''}>
    <small class="hint">${hint}</small></label>`;

// The front door: members sign in with their name and PIN; guests with an invitation enter its code.
export function landing() {
  render(`
    <main class="narrow">
      ${masthead()}
      ${hostChip(useSupabase ? REGINALD.welcome() : `${REGINALD.welcome()} You're in local mode, so it's just this device for now.`)}
      <form id="signin" class="member-form stack">
        <h2>Members</h2>
        <label for="name">Name <input id="name" name="name" maxlength="20" autocomplete="nickname" required></label>
        ${pinField('PIN', 'The four digits you chose when you joined.')}
        <p class="error" id="err" role="alert"></p>
        <button class="btn" type="submit">Sign in</button>
      </form>
      <form id="code" class="member-form code-form">
        <h2>Have an invitation?</h2>
        <p class="muted">Enter the code from your letter. You'll only need it once.</p>
        <label for="invite">Invitation code <input id="invite" name="invite" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="K7Q-4M2" required></label>
        <button class="btn ghost" type="submit">Continue</button>
        ${useSupabase ? '' : `<a class="link" href="#/join/demo">Or start the demo club</a>`}
      </form>
    </main>`);
  const signin = document.getElementById('signin') as HTMLFormElement;
  signin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(signin);
    const btn = signin.querySelector('button')!;
    btn.disabled = true;
    try {
      // someone in more than one club is signed in to all of them, starting with the first they joined
      const clubs = await api.myClubs(String(fd.get('name')), String(fd.get('pin')));
      if (!clubs.length) throw new Error('No member by that name and PIN. Check both and try again.');
      [...clubs.slice(1), clubs[0]].forEach(setSession);
      navigate('#/');
    } catch (err) {
      document.getElementById('err')!.innerHTML = esc((err as Error).message);
      btn.disabled = false;
    }
  });
  const form = document.getElementById('code') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = String(new FormData(form).get('invite')).trim().toLowerCase();
    if (code) navigate(`#/join/${encodeURIComponent(code)}`);
  });
}

// Joining with a code: pick your name and a PIN. The PIN is your password from then on; the code is spent.
export function join(code: string, name = '') {
  render(`
    <main class="narrow">
      ${masthead()}
      <form id="join" class="member-form stack">
        ${hostChip(REGINALD.invited())}
        <p class="code-chip">Invitation <b>${esc(code.toUpperCase())}</b></p>
        <label for="name">Your name <input id="name" name="name" maxlength="20" autocomplete="nickname" required ${name ? `value="${esc(name)}"` : 'autofocus'}></label>
        ${pinField('Choose a PIN', 'Any four digits. This is your password from now on: you sign in with your name and PIN, no code needed.', !!name)}
        <p class="error" id="err" role="alert"></p>
        <button class="btn" type="submit">Sign the book</button>
        <a class="link" href="#/">Already a member? Sign in</a>
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
      // the router sends new members on the tour and returning ones straight to the club
      navigate('#/');
    } catch (err) {
      document.getElementById('err')!.innerHTML = esc((err as Error).message);
      btn.disabled = false;
    }
  });
}
