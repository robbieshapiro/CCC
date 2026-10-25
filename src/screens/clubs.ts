// For the admin: start another club. It's a world of its own (members, board, champions, committee panels)
// that no other club can see. They join it as its admin and land in it, ready to put up its first members.
import { api, setSession } from '../api';
import { requireSession } from '../state';
import { navigate } from '../ui';

export function clubMaker(admin: boolean) {
  if (!admin) return '';
  return `
    <section class="panel admin invite-maker">
      <div><h2>Start a new club</h2><p class="muted">A separate club for another group of friends: its own members, board and champions. Nobody here can see it, and nobody there can see this one. Switch between your clubs from the name under the crest.</p></div>
      <form id="club-form" class="invite-form">
        <input id="club-name" maxlength="40" placeholder="Club name" autocomplete="off" aria-label="Club name" required />
        <button class="btn" type="submit">Start club</button>
      </form>
      <p class="error" id="club-err" role="alert"></p>
    </section>`;
}

export function bindClubMaker() {
  const form = document.getElementById('club-form') as HTMLFormElement | null;
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = (document.getElementById('club-name') as HTMLInputElement).value.trim();
    if (!name || !confirm(`Start a new club called "${name}"? You'll be its admin and move into it now.`)) return;
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    try {
      setSession(await api.createClub(requireSession(), name));
      navigate('#/');
    } catch (x) {
      document.getElementById('club-err')!.textContent = (x as Error).message;
      btn.disabled = false;
    }
  };
}
