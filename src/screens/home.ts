import { localApi, useSupabase } from '../api';
import type { Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { crest } from '../brand';
import { featById } from '../feats';
import { courseFor, drafts } from '../golf3d/courses';
import { hostChip, REGINALD, type Mood } from '../host';
import { bindFeedbackPanel, feedbackPanel, openFeedback } from './feedback';
import { bindInviteMaker, inviteMaker } from './invite';
import { bindNotices, noticeComposer, noticesStrip } from './notices';
import { board, monthName, myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { esc, header, render } from '../ui';

export function scoreClass(strokes: number, par: number) {
  if (strokes === 1) return 'ace';
  const d = strokes - par;
  return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
}

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function home(snap: Snapshot) {
  const player = (id: string) => snap.players.find((p) => p.id === id);
  const course = courseFor(snap.month);
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const mine = myBest(snap);
  const me = rows.find((r) => r.playerId === snap.me)!;

  let line = REGINALD.course(course.name, course.par);
  let mood: Mood = 'dry';
  if (!played.length) line = `${line} ${REGINALD.nobody(snap.today)}`;
  else if (!mine) line = REGINALD.notYet(played.length);
  else if (played[0].playerId === snap.me) {
    line = REGINALD.leading(toParLabel(me.toPar), snap.today);
    mood = 'pleased';
  } else {
    const top = played[0];
    line = played.length > 2 ? REGINALD.others(player(top.playerId)!.name, toParLabel(top.toPar)) : REGINALD.behind(player(top.playerId)!.name, toParLabel(top.toPar), me.toPar - top.toPar);
  }

  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const p = player(r.playerId)!;
      const cells = course.holes.map((h, i) => `<td class="num"><span class="sc ${r.best ? scoreClass(r.best.holes[i], h.par) : ''}">${r.best ? r.best.holes[i] : ''}</span></td>`).join('');
      const feats = p.feats.map((f) => featById(f)?.icon ?? '').join('');
      return `<tr class="${r.playerId === snap.me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="#/member/${p.id}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${feats ? ` <small>${feats}</small>` : ''}<em>${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · ${when(r.last!)}` : 'yet to play'}</em></span></a></td>
        ${cells}
        <td class="num tot">${r.best ? r.best.total : ''}</td>
        <td class="num topar ${r.best ? (r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : '') : ''}">${r.best ? toParLabel(r.toPar) : '–'}</td>
      </tr>`;
    })
    .join('');

  const plaque = snap.champions.length
    ? snap.champions
        .slice(0, 6)
        .map((c) => `<li><span>${monthName(c.month)}</span><b>${c.playerIds.map((id) => `<a href="#/member/${id}">${esc(player(id)?.name ?? '?')}</a>`).join(' & ')}</b><em>${toParLabel(c.total - c.par)}</em></li>`)
        .join('')
    : `<li class="empty">The first name goes up when ${monthName(snap.month).split(' ')[0]} closes.</li>`;

  // whatever was full screen before (the tour, a round) has let go of the page by now
  document.body.classList.remove('court-open');
  render(`
    ${header(snap.groupName, 'month')}
    <main>
      ${noticesStrip()}
      ${hostChip(line, mood)}
      <section class="course-card">
        <div class="course-crest">${crest(78, 'cc')}</div>
        <div class="course-body">
          <p class="eyebrow">${monthName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${esc(course.tagline)}</p>
          <ol class="hole-list">${course.holes.map((h, i) => `<li><span>${i + 1}</span><b>${esc(h.name)}</b><em>Par ${h.par}</em></li>`).join('')}</ol>
          <div class="course-cta">
            <a class="btn" href="#/round">${mine ? 'Play another round' : 'Play a round'}</a>
            <span class="muted">${mine ? `Your best: <b>${mine.total}</b> (${toParLabel(mine.total - mine.par)})` : `Par ${course.par} · best round of the month counts`}</span>
          </div>
        </div>
      </section>
      <section class="board">
        <div class="board-head"><h2>The Board</h2><span>${monthName(snap.month)} · best round counts</span></div>
        <div class="table-wrap"><table class="scorecard">
          <thead><tr><th></th><th>Member</th>${head}<th class="num">Tot</th><th class="num">±</th></tr></thead>
          <tbody>
            <tr class="par"><td></td><td>Par</td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td><td></td></tr>
            ${body}
          </tbody>
        </table></div>
      </section>
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      ${noticeComposer(!!snap.admin)}
      ${previewPanel(!!snap.admin)}
      ${inviteMaker(!!snap.admin)}
      ${feedbackPanel(!!snap.admin)}
      <p class="fine feedback-link"><button class="link" id="send-feedback">Leave feedback</button></p>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  void bindInviteMaker();
  void bindFeedbackPanel();
  void bindNotices();
  document.getElementById('send-feedback')!.onclick = () => openFeedback('From the clubhouse');
  document.getElementById('demo')?.addEventListener('click', async () => {
    localApi.seedDemo(requireSession());
    home(await refresh());
  });
}

// For the admin only: courses being built, before they're on the calendar. Preview rounds aren't posted.
function previewPanel(admin: boolean) {
  const list = drafts();
  if (!admin || !list.length) return '';
  return `
    <section class="panel invite-maker">
      <div><h2>Preview the next course</h2><p class="muted">Only you can see this. Preview rounds are not posted to the board.</p></div>
      ${list.map((c) => `<a class="btn" href="#/preview/${c.id}">Play ${esc(c.name)}</a><p class="fine">${esc(c.tagline)}</p>`).join('')}
    </section>`;
}
