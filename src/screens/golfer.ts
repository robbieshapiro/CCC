// Any golfer's card, from any club (#/golfer/<id>, from a row of the Season standings): their golfer on the turntable,
// the card itself (home club, rank, Open wins, titles, career earnings), their season week by week with each week's
// best card, their career numbers, and their trophy cabinet. The data comes from golfer_card, across all their seats.
import { api } from '../api';
import type { GolferCard, Snapshot } from '../api/types';
import { portrait, specOf } from '../avatar';
import { crest } from '../brand';
import { FEATS } from '../feats';
import { courseById } from '../golf3d/courses';
import { money, placeLabel } from '../purse';
import { badgeSvg, rankOf } from '../shop';
import { seasonEventName } from '../season';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { GolferStage } from './locker';
import { scoreClass } from './home';
import { esc, header, render } from '../ui';

let closeGolfer: () => void = () => {};
export const leaveGolfer = () => {
  closeGolfer();
  closeGolfer = () => {};
};

const fmt = (n: number | null | undefined) => (n == null ? '–' : toParLabel(Math.round(n * 10) / 10));

export async function golfer(snap: Snapshot, id: string) {
  leaveGolfer();
  const back = `<p><a class="link" href="#/clubhouse/season">‹ Season</a></p>`;
  render(`${header(snap.groupName, 'clubhouse')}<main class="narrow">${back}<p class="muted">Loading their card…</p></main>`);
  const g: GolferCard | null = await api.golferCard(requireSession(), id).catch(() => null);
  if (location.hash !== `#/golfer/${id}`) return; // they moved on while it loaded
  if (!g) {
    render(`${header(snap.groupName, 'clubhouse')}<main class="narrow">${back}<h1>No such golfer</h1><p class="muted">They may have resigned. It happens.</p></main>`);
    return;
  }
  const since = g.joined ? new Date(g.joined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '2026';
  const openWins = g.weeks.filter((w) => w.banked && w.place === 1).length;
  const points = g.weeks.filter((w) => w.banked).reduce((a, w) => a + w.points, 0); // banked only, as the standings count
  const rank = rankOf(g.earnings, g.titles);
  const clubs = g.clubs?.length ? g.clubs : [g.club];
  const got = FEATS.filter((f) => g.feats.includes(f.id));

  const week = (w: GolferCard['weeks'][number]) => {
    const course = courseById(w.course);
    const pars = course?.holes.map((h) => h.par);
    const card =
      pars && pars.length === w.holes.length
        ? `<div class="table-wrap"><table class="scorecard"><thead><tr><th>Best card</th>${pars.map((_, i) => `<th class="num">${i + 1}</th>`).join('')}<th class="num">Tot</th></tr></thead>
          <tbody><tr class="par"><td>Par</td>${pars.map((p) => `<td class="num">${p}</td>`).join('')}<td class="num">${w.par}</td></tr>
          <tr><td>${esc(g.name)}</td>${w.holes.map((s, i) => `<td class="num"><span class="sc ${scoreClass(s, pars[i])}">${s}</span></td>`).join('')}<td class="num tot">${w.total}</td></tr></tbody></table></div>`
        : '';
    return `<div class="gc-week">
      <p class="gc-week-head"><b>${esc(seasonEventName(course?.name ?? w.course, w.week))}</b><span>${placeLabel(w.place, w.tied)} of ${w.field} · ${toParLabel(w.toPar)} · ${w.points} pts${w.banked ? '' : ' so far'}</span></p>
      ${card}
    </div>`;
  };

  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="narrow">
      ${back}
      <section class="member-card">
        <div class="mc-top">${crest(46, 'mc')}<div><p class="eyebrow">Claude Country Club</p><p class="mc-kind">${rank.name}</p></div></div>
        <div class="mc-body">
          <div class="mc-portrait">${portrait(g.avatar, 120)}</div>
          <div>
            <h1>${esc(g.name)}${badgeSvg(rank.id, 26)}</h1>
            <dl>
              <div><dt>${clubs.length > 1 ? 'Clubs' : 'Club'}</dt><dd>${clubs.map(esc).join(' & ')}</dd></div>
              <div><dt>Since</dt><dd>${since}</dd></div>
              <div><dt>Open wins</dt><dd>${openWins}</dd></div>
              <div><dt>Club titles</dt><dd>${g.titles}</dd></div>
              <div><dt>Career earnings</dt><dd>${money(g.earnings)}${g.top10s ? ` · ${g.top10s} top ${g.top10s === 1 ? '10' : '10s'}` : ''}</dd></div>
            </dl>
          </div>
        </div>
      </section>
      <section class="panel profile-stage"><div class="stage" id="stage"></div></section>
      <section class="panel stats">
        <h2>The Season</h2>
        <div class="stat-row">
          <div><b>${points.toLocaleString('en-US')}</b><small>Points</small></div>
          <div><b>${g.weeks.length}</b><small>${g.weeks.length === 1 ? 'Week' : 'Weeks'}</small></div>
          <div><b>${openWins}</b><small>${openWins === 1 ? 'Win' : 'Wins'}</small></div>
          <div><b>${g.weeks.filter((w) => w.banked && w.place <= 10).length}</b><small>Top 10s</small></div>
        </div>
        ${g.weeks.length ? g.weeks.map(week).join('') : '<p class="muted">No Open cards yet this season.</p>'}
        <h2>Career</h2>
        <div class="stat-row">
          <div><b>${g.career.rounds}</b><small>${g.career.rounds === 1 ? 'Round' : 'Rounds'}</small></div>
          <div><b>${fmt(g.career.best)}</b><small>Best</small></div>
          <div><b>${fmt(g.career.avg)}</b><small>Average</small></div>
          <div><b>${money(g.earnings)}</b><small>Earnings</small></div>
        </div>
      </section>
      ${got.length ? `<h2>Trophy cabinet</h2><div class="shelf">${got.map((f) => `<div class="feat got" title="${f.how}"><span>${f.icon}</span><b>${f.name}</b><small>${f.how}</small></div>`).join('')}</div>` : ''}
    </main>`);

  let stage: GolferStage | null = null;
  try {
    stage = new GolferStage(document.getElementById('stage')!, specOf(g.avatar));
  } catch {
    document.getElementById('stage')!.innerHTML = portrait(g.avatar, 160);
  }
  closeGolfer = () => stage?.destroy();
}
