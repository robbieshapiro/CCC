// The Committee Room's Bar tab: switch each bar game on or off for members (the Committee can always play a closed
// one, to try it), and see the last 7 days at Mo's tables. bar_settings, admin_bar and set_bar_game in schema.sql.
import { api } from '../api';
import { money } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';
import { tell } from '../dialog';

const GAMES: [string, string, string][] = [
  ['daily', '🎯', 'Closest to the Pin'],
  ['midway', '🎡', 'The Midway'],
  ['blackjack', '🃏', 'Blackjack'],
  ['popashot', '🏀', 'Pop-a-Shot'],
  ['billiards', '🎱', '8-Ball'],
  ['drive', '🚀', 'Long drive'],
  ['members', '🏗️', "Members' Course"],
];
const CASINO = new Set(['blackjack', 'popashot', 'billiards']);

export function barSection() {
  return `<section class="adm-card" id="adm-bar"><h2>The bar</h2><p class="muted">Switch a game off and members don't see it at the bar (Mo's tables also turn them away from a saved link). You can still play it, to try it.</p><div id="adm-bar-body"><p class="muted">Loading…</p></div></section>`;
}

export async function loadBar() {
  const body = document.getElementById('adm-bar-body');
  if (!body) return;
  const d = await api.adminBar(requireSession()).catch(() => null);
  if (!document.getElementById('adm-bar-body')) return;
  if (!d) {
    body.innerHTML = '<p class="muted">The bar settings aren’t set up yet.</p>';
    return;
  }
  const week = new Map(d.week.map((w) => [w.game, w]));
  const line = (g: string) => {
    if (!CASINO.has(g)) return '';
    const w = week.get(g);
    if (!w) return '<small>No bets this week</small>';
    return `<small>${w.bets} ${w.bets === 1 ? 'bet' : 'bets'} from ${w.players} ${w.players === 1 ? 'member' : 'members'} this week · ${money(w.staked)} staked · Mo ${w.houseNet >= 0 ? `up ${money(w.houseNet)}` : `down ${money(-w.houseNet)}`}</small>`;
  };
  body.innerHTML = `<ul class="adm-bar-list">${GAMES.map(([g, icon, name]) => {
    const open = d.settings[g] !== false;
    return `<li><i>${icon}</i><div><b>${esc(name)}</b>${line(g)}</div><button class="adm-switch ${open ? 'on' : ''}" data-bar-game="${g}" aria-pressed="${open}" aria-label="${esc(name)} open to members"></button></li>`;
  }).join('')}</ul>`;
  body.querySelectorAll<HTMLButtonElement>('[data-bar-game]').forEach(
    (b) =>
      (b.onclick = async () => {
        const open = !b.classList.contains('on');
        b.disabled = true;
        try {
          await api.setBarGame(requireSession(), b.dataset.barGame!, open);
          b.classList.toggle('on', open);
          b.setAttribute('aria-pressed', String(open));
        } catch (e) {
          void tell("That didn't work", `<p>${esc((e as Error).message)}</p>`);
        } finally {
          b.disabled = false;
        }
      }),
  );
}
