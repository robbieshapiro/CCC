// Your Locker: your golfer, how your week and Season are going, and your Trophy Room shelf. Edit your look from here,
// or see your card as other members see it. (The club's members are in the Clubhouse.)
import { span } from '../day';
import { badgeFor, balanceOf, earningsOf } from '../shop';
import { money } from '../purse';
import { api, setSession } from '../api';
import type { Avatar, Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { board, myBest, toParLabel } from '../standings';
import { requireSession } from '../state';
import { GolferStage, lockerPanel } from './locker';
import { shelfHtml } from './trophyroom';
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
  let spec = specOf(me.avatar);

  render(`
    ${header(snap.groupName, 'locker')}
    <main class="narrow locker-page">
      <section class="lk-hero">
        <div class="stage" id="stage"></div>
        <div class="lk-who">
          <h1>${esc(me.name)}${badgeFor(me, 26)}</h1>
          <p class="muted">${me.host ? `Runs ${esc(snap.groupName)} · plays for ${esc(snap.homeName ?? 'their club')}` : esc(snap.groupName)}${me.wins ? ` · 🏆 ${me.wins}` : ''}</p>
          ${
            me.host
              ? ''
              : `<div class="lk-stats">
            <div><b>${best ? toParLabel(best.total - best.par) : '–'}</b><span>Best this ${span(snap.month)}</span></div>
            <div><b>${mine?.best ? ordinal(mine.rank) : '–'}</b><span>In the club</span></div>
            <div id="lk-season"><b>–</b><span>Season</span></div>
            <div><b>${money(earningsOf(me))}</b><span>Career earnings</span></div>
          </div>`
          }
          ${me.host ? '' : `<a class="btn lk-shop" href="#/clubhouse/shop"><span>🛍️ Pro Shop</span><b>${money(balanceOf(me))} to spend</b></a>`}
          <div class="lk-acts"><button class="btn ghost" id="edit-look">Edit your look</button><a class="btn ghost" href="#/golfer/${snap.me}/view">Your card</a></div>
        </div>
      </section>
      <section class="lk-edit" id="lk-edit" hidden><div id="panel"></div></section>
      <section class="lk-section" id="lk-shelf"><h2>Trophy shelf</h2><p class="muted">Loading…</p></section>
      <p class="fine"><button class="link" id="logout">Sign out on this device</button></p>
    </main>`);

  // the Trophy Room's shelf, and where you stand in the Season (banked points, as the standings count)
  void api.trophyProgress(requireSession()).then((tp) => {
    const el = document.getElementById('lk-shelf');
    if (el) el.innerHTML = `${tp ? shelfHtml(tp) : '<h2>Trophy shelf</h2><p class="muted">Not open yet.</p>'}<a class="link lk-room" href="#/clubhouse/trophies">Open the Trophy Room ›</a>`;
  }).catch(() => {});
  if (!me.host)
    void api.seasonStandings(requireSession()).then((s) => {
      const el = document.getElementById('lk-season');
      const rows = s?.standings ?? [];
      const at = rows.findIndex((r) => r.mine);
      if (!el || at < 0) return;
      const place = rows.filter((r) => r.points > rows[at].points).length + 1;
      el.innerHTML = `<b>${ordinal(place)}</b><span>Season · ${rows[at].points.toLocaleString('en-US')} pts</span>`;
      el.onclick = () => navigate('#/clubhouse/season');
    }).catch(() => {});
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
    }, me.host ? undefined : (me.owned ?? [])),
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
