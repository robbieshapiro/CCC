import { api, setSession } from '../api';
import type { Avatar, Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { crest } from '../brand';
import { FEATS } from '../feats';
import { hostChip, REGINALD } from '../host';
import { requireSession } from '../state';
import { GolferStage, lockerPanel } from './locker';
import { esc, header, navigate, render } from '../ui';

let closeCard: () => void = () => {};
export const leaveCard = () => {
  closeCard();
  closeCard = () => {};
};

export function card(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me)!;
  const order = [...snap.players].sort((a, b) => (a.joined ?? '').localeCompare(b.joined ?? ''));
  const number = String(order.findIndex((p) => p.id === me.id) + 1).padStart(4, '0');
  const since = me.joined ? new Date(me.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2026';
  let spec = specOf(me.avatar);

  render(`
    ${header(snap.groupName, 'card')}
    <main class="narrow">
      ${hostChip(REGINALD.card(me.wins), me.wins ? 'pleased' : 'dry')}
      <section class="member-card">
        <div class="mc-top">${crest(46, 'mc')}<div><p class="eyebrow">Claude Country Club</p><p class="mc-kind">Full Member</p></div></div>
        <div class="mc-body">
          <div class="mc-portrait" id="mc-face">${portrait(me.avatar, 120)}</div>
          <div>
            <h1>${esc(me.name)}</h1>
            <dl>
              <div><dt>Member No.</dt><dd>${number}</dd></div>
              <div><dt>Since</dt><dd>${since}</dd></div>
              <div><dt>Titles</dt><dd>${me.wins}</dd></div>
            </dl>
          </div>
        </div>
      </section>
      <section class="panel locker-wrap">
        <div class="card-head"><h2>Your locker</h2><a class="link" href="#/welcome">Revisit the locker room</a></div>
        <div class="locker-grid"><div class="stage" id="stage"></div><div id="panel"></div></div>
      </section>
      <h2>Trophy cabinet</h2>
      <div class="shelf">${FEATS.map((f) => {
        const got = me.feats.includes(f.id);
        return `<div class="feat ${got ? 'got' : ''}" title="${f.how}"><span>${got ? f.icon : '🔒'}</span><b>${f.name}</b><small>${f.how}</small></div>`;
      }).join('')}</div>
      <p><button class="link" id="logout">Sign out on this device</button></p>
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
        document.getElementById('mc-face')!.innerHTML = portrait(avatar, 120);
      }, 400);
    }),
  );
  document.getElementById('logout')!.addEventListener('click', () => {
    setSession(null);
    navigate('#/');
  });
}
