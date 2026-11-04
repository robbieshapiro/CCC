// Your Locker: your golfer, how your week is going and your trophies. Edit your look from here. (The club's
// members are in the Clubhouse.)
import { span } from '../day';
import { api, setSession } from '../api';
import type { Avatar, Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { FEATS } from '../feats';
import { board, myBest, toParLabel } from '../standings';
import { requireSession } from '../state';
import { GolferStage, lockerPanel } from './locker';
import { esc, header, navigate, render } from '../ui';
import { badgeSvg, bagOf, FEATURES, GEAR, LEVELS, levelName, rankOf, statsOf, XP, type Rank } from '../rank';

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
          <h1>${esc(me.name)}${me.host ? '' : badgeSvg(rankOf(statsOf(me)), 28)}</h1>
          <p class="muted">${me.host ? `Runs ${esc(snap.groupName)} · plays for ${esc(snap.homeName ?? 'their club')}` : esc(snap.groupName)}${me.wins ? ` · 🏆 ${me.wins}` : ''}</p>
          ${
            me.host
              ? ''
              : `<div class="lk-stats">
            <div><b>${best ? toParLabel(best.total - best.par) : '–'}</b><span>Best this ${span(snap.month)}</span></div>
            <div><b>${mine?.best ? ordinal(mine.rank) : '–'}</b><span>In the club</span></div>
            <div><b>${mine?.rounds ?? 0}</b><span>Rounds</span></div>
          </div>`
          }
          <button class="btn ghost" id="edit-look">Edit your look</button>
        </div>
      </section>
      <section class="lk-edit" id="lk-edit" hidden><div id="panel"></div></section>
      ${me.host ? '' : rankSection(rankOf(statsOf(me)), me.wins)}
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

// Your rank: the badge, the XP bar, what the next rank asks for, your bag, and the whole ladder with what each step opens
function rankSection(r: Rank, wins: number) {
  const from = LEVELS[r.level].xp;
  const pct = r.next ? Math.max(0, Math.min(100, ((r.xp - from) / Math.max(1, r.next.xp - from)) * 100)) : 100;
  const bag = bagOf(r.level, wins);
  const opens = (l: number) =>
    [...GEAR.filter((g) => g.level === l && g.level > 0).map((g) => g.name), ...FEATURES.filter((f) => f.level === l).map((f) => `${f.name}${f.soon ? ' (soon)' : ''}`)].join(' · ');
  const how: [string, number][] = [
    ['Finish a round', XP.round], ['First round of a week', XP.week], ['Break par', XP.underPar], ['Birdie', XP.birdie], ['Eagle', XP.eagle], ['Hole in one', XP.ace],
    ['Find a secret route', XP.secret], ['Daily Shot (a day)', XP.daily], ['Practice session', XP.practice], ['Bar game', XP.bar], ['Hole sent to the Committee', XP.design], ['Win a week', XP.win],
  ];
  return `<section class="lk-section lk-rank">
      <h2>Your rank</h2>
      <div class="lk-rank-head">${badgeSvg(r, 64)}<div><b>${esc(r.name)}${r.prestige ? ` · Prestige ${r.prestige}` : ''}</b><span>${r.xp.toLocaleString()} XP${r.next ? (r.blocked ? ` · XP banked for ${esc(r.next.name)}: finish the list` : ` · ${Math.max(0, r.next.xp - r.xp).toLocaleString()} to ${esc(r.next.name)}`) : ''}</span></div></div>
      <div class="rw-bar"><i style="width:${pct}%"></i></div>
      ${r.next?.reqs.length ? `<ul class="rw-reqs">${r.next.reqs.map((q) => `<li class="${q.met ? 'met' : ''}"><i>${q.met ? '✓' : '○'}</i>${esc(q.label)}<small>${q.have}</small></li>`).join('')}</ul>` : ''}
      <p class="rw-bag">In your bag: ${[bag.putter, bag.ball, bag.irons, bag.driver].map((g) => `<b title="${esc(g.what)}">${esc(g.name)}</b>`).join(' · ')}</p>
      <details class="lk-more"><summary>The ladder and what it unlocks</summary>
        <ol class="ladder">${LEVELS.map((l, i) => {
          const o = opens(i);
          return `<li class="${i < r.level ? 'done' : i === r.level ? 'now' : 'locked'}">${badgeSvg({ family: l.family, tier: l.tier, prestige: 0, name: levelName(i) }, 28)}<b>${esc(levelName(i))}</b><small>${l.xp.toLocaleString()} XP</small>${o ? `<em>${esc(o)}</em>` : ''}</li>`;
        }).join('')}</ol>
      </details>
      <details class="lk-more"><summary>How to earn XP</summary><ul class="xp-how">${how.map(([k, v]) => `<li><span>${k}</span><b>+${v}</b></li>`).join('')}</ul></details>
    </section>`;
}

