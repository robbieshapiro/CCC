// Another member's card: their golfer on the turntable, the card itself, and how they've been playing.
// Anyone can look at anyone; only your own card has the wardrobe.
import { periodName } from '../day';
import type { Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { crest } from '../brand';
import { FEATS } from '../feats';
import { courseFor } from '../golf3d/courses';
import { hostChip } from '../host';
import { board, crownFor, toParLabel } from '../standings';
import { GolferStage } from './locker';
import { scoreClass } from './home';
import { esc, header, render } from '../ui';

let closeMember: () => void = () => {};
export const leaveMember = () => {
  closeMember();
  closeMember = () => {};
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

// Reginald's view of the member, from the numbers.
function remark(name: string, wins: number, rank: number, played: number, rounds: number) {
  if (!rounds) return `${name} has yet to trouble the scorers. A member in good standing, if not in good form.`;
  if (wins >= 2) return `${name}. ${wins} titles. I polish the brass with their name on it more than I should like.`;
  if (played && rank === 1) return `${name} leads the board. Do not tell them; it only encourages them.`;
  if (wins === 1) return `A former champion, ${name}. They mention it. Often.`;
  if (!played) return `${name} has not been out lately. I am told it is a busy season for excuses.`;
  return `${name}, ${ordinal(rank)} on the board. Steady. Nobody ever wrote a song about steady.`;
}

export function member(snap: Snapshot, id: string) {
  leaveMember();
  const p = snap.players.find((x) => x.id === id);
  if (!p) {
    render(`${header(snap.groupName, 'clubhouse')}<main class="narrow"><h1>No such member</h1><p class="muted">They may have resigned. It happens.</p><a class="btn" href="#/clubhouse/members">Back to the members</a></main>`);
    return;
  }
  const order = [...snap.players].sort((a, b) => (a.joined ?? '').localeCompare(b.joined ?? ''));
  const number = String(order.findIndex((x) => x.id === p.id) + 1).padStart(4, '0');
  const since = p.joined ? new Date(p.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2026';
  const course = courseFor(snap.month);
  const row = board(snap).find((r) => r.playerId === p.id)!;
  const mine = snap.rounds.filter((r) => r.playerId === p.id);
  const avg = mine.length ? mine.reduce((a, r) => a + r.total - r.par, 0) / mine.length : null;
  const c = p.career ?? { rounds: mine.length, best: row.best ? row.toPar : null, avg };
  const fmt = (n: number | null | undefined) => (n == null ? '–' : toParLabel(Math.round(n * 10) / 10));
  const got = FEATS.filter((f) => p.feats.includes(f.id));

  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="narrow">
      <p><a class="link" href="#/clubhouse/members">‹ Members</a></p>
      ${hostChip(remark(p.name, p.wins, row.rank, row.best ? 1 : 0, c.rounds), p.wins ? 'pleased' : 'dry')}
      <section class="member-card">
        <div class="mc-top">${crest(46, 'mc')}<div><p class="eyebrow">Claude Country Club</p><p class="mc-kind">Full Member</p></div></div>
        <div class="mc-body">
          <div class="mc-portrait">${portrait(p.avatar, 120)}</div>
          <div>
            <h1>${esc(p.name)}${crownFor(snap, p.id)}</h1>
            <dl>
              <div><dt>Member No.</dt><dd>${number}</dd></div>
              <div><dt>Since</dt><dd>${since}</dd></div>
              <div><dt>Titles</dt><dd>${p.wins}</dd></div>
            </dl>
          </div>
        </div>
      </section>
      <section class="panel profile-stage"><div class="stage" id="stage"></div></section>
      <section class="panel stats">
        <h2>${periodName(snap.month)}</h2>
        <div class="stat-row">
          <div><b>${row.best ? ordinal(row.rank) : '–'}</b><small>On the board</small></div>
          <div><b>${row.best ? `${row.best.total}` : '–'}</b><small>Best round${row.best ? ` (${toParLabel(row.toPar)})` : ''}</small></div>
          <div><b>${mine.length}</b><small>${mine.length === 1 ? 'Round' : 'Rounds'}</small></div>
          <div><b>${fmt(avg)}</b><small>Average</small></div>
        </div>
        ${
          row.best
            ? `<div class="table-wrap"><table class="scorecard"><thead><tr><th>Best card</th>${course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}<th class="num">Tot</th></tr></thead>
          <tbody><tr class="par"><td>Par</td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td></tr>
          <tr><td>${esc(p.name)}</td>${row.best.holes.map((s, i) => `<td class="num"><span class="sc ${scoreClass(s, course.holes[i].par)}">${s}</span></td>`).join('')}<td class="num tot">${row.best.total}</td></tr></tbody></table></div>`
            : ''
        }
        <h2>Career</h2>
        <div class="stat-row">
          <div><b>${c.rounds}</b><small>${c.rounds === 1 ? 'Round' : 'Rounds'}</small></div>
          <div><b>${fmt(c.best)}</b><small>Best</small></div>
          <div><b>${fmt(c.avg)}</b><small>Average</small></div>
          <div><b>${p.wins}</b><small>${p.wins === 1 ? 'Title' : 'Titles'}</small></div>
        </div>
      </section>
      ${got.length ? `<h2>Trophy cabinet</h2><div class="shelf">${got.map((f) => `<div class="feat got" title="${f.how}"><span>${f.icon}</span><b>${f.name}</b><small>${f.how}</small></div>`).join('')}</div>` : ''}
    </main>`);

  let stage: GolferStage | null = null;
  try {
    stage = new GolferStage(document.getElementById('stage')!, specOf(p.avatar));
  } catch {
    document.getElementById('stage')!.innerHTML = portrait(p.avatar, 160);
  }
  closeMember = () => stage?.destroy();
}
