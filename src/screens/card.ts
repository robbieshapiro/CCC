// Your Locker: your golfer, how your month is going and your trophies. Edit your look from here. (The club's
// members are in the Clubhouse.)
import { api, setSession } from '../api';
import type { Avatar, Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { FEATS } from '../feats';
import { board, myBest, toParLabel } from '../standings';
import { requireSession } from '../state';
import { GolferStage, lockerPanel } from './locker';
import { esc, header, navigate, render } from '../ui';

let closeCard: () => void = () => {};
export const leaveCard = () => {
  closeCard();
  closeCard = () => {};
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

export function card(snap: Snapshot) {
  leaveCard();
  const me = snap.players.find((p) => p.id === snap.me)!;
  const rows = board(snap);
  const mine = rows.find((r) => r.playerId === snap.me);
  const best = myBest(snap);
  const got = FEATS.filter((f) => me.feats.includes(f.id));
  const left = FEATS.filter((f) => !me.feats.includes(f.id));
  let spec = specOf(me.avatar);

  render(`
    ${header(snap.groupName, 'locker')}
    <main class="narrow locker-page">
      <section class="lk-hero">
        <div class="stage" id="stage"></div>
        <div class="lk-who">
          <h1>${esc(me.name)}</h1>
          <p class="muted">${me.host ? `Runs ${esc(snap.groupName)} · plays for ${esc(snap.homeName ?? 'their club')}` : esc(snap.groupName)}${me.wins ? ` · 🏆 ${me.wins}` : ''}</p>
          ${
            me.host
              ? ''
              : `<div class="lk-stats">
            <div><b>${best ? toParLabel(best.total - best.par) : '–'}</b><span>Best this month</span></div>
            <div><b>${mine?.best ? ordinal(mine.rank) : '–'}</b><span>In the club</span></div>
            <div><b>${mine?.rounds ?? 0}</b><span>Rounds</span></div>
          </div>`
          }
          <button class="btn ghost" id="edit-look">Edit your look</button>
        </div>
      </section>
      <section class="lk-edit" id="lk-edit" hidden><div id="panel"></div></section>
      <section class="lk-section">
        <h2>Trophies</h2>
        ${got.length ? `<div class="lk-trophies">${got.map((f) => `<span title="${esc(f.how)}"><i>${f.icon}</i>${esc(f.name)}</span>`).join('')}</div>` : '<p class="muted">None yet. Your first one is out there.</p>'}
        ${left.length ? `<details class="lk-more"><summary>${left.length} more to find</summary><ul>${left.map((f) => `<li><i>🔒</i><b>${esc(f.name)}</b><small>${esc(f.how)}</small></li>`).join('')}</ul></details>` : ''}
      </section>
      <p class="fine"><button class="link" id="logout">Sign out on this device</button></p>
    </main>`);

  let stage: GolferStage | null = null;
  try {
    stage = new GolferStage(document.getElementById('stage')!, spec);
  } catch {
    document.getElementById('stage')!.innerHTML = portrait(me.avatar, 160);
  }
  closeCard = () => stage?.destroy();
  let timer = 0;
  document.getElementById('panel')!.appendChild(
    lockerPanel(spec, me.wins, (next) => {
      spec = next;
      stage?.set(spec);
      clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const avatar: Avatar = { ...me.avatar, golfer: spec };
        await api.saveAvatar(requireSession(), avatar);
        me.avatar = avatar;
      }, 400);
    }),
  );
  const edit = document.getElementById('lk-edit')!;
  document.getElementById('edit-look')!.onclick = (e) => {
    edit.hidden = !edit.hidden;
    (e.currentTarget as HTMLButtonElement).textContent = edit.hidden ? 'Edit your look' : 'Done';
    if (!edit.hidden) edit.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.getElementById('logout')!.addEventListener('click', () => {
    setSession(null);
    navigate('#/');
  });
}
