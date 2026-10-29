import { localApi, useSupabase } from '../api';
import type { Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { crest } from '../brand';
import { featById } from '../feats';
import { courseFor, nextCourse, type Course } from '../golf3d/courses';
import { GAME_TZ, monthClosesAt } from '../day';
import { hostChip, REGINALD, type Mood } from '../host';
import { openFeedback } from './feedback';
import { facilityPanel } from './practice';
import { bindOpen } from './open';
import { bindDaily, dailyCard } from './daily';
import { bindNotices, noticesStrip } from './notices';
import { board, monthName, myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { esc, header, render } from '../ui';

export function scoreClass(strokes: number, par: number) {
  if (strokes === 1) return 'ace';
  const d = strokes - par;
  return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
}

// Last round's date on the club's (Eastern) calendar, e.g. "Oct 24".
const lastPlayed = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });

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
        <td class="who"><a href="#/member/${p.id}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${feats ? ` <small>${feats}</small>` : ''}<em>${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · last ${lastPlayed(r.last!)}` : 'yet to play'}</em></span></a></td>
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
      ${launchHero(snap.month)}
      ${dailyCard()}
      ${hostChip(line, mood, 'reg-line')}
      <section class="course-card${nextCourse(snap.month) ? ' secondary' : ''}${course.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}">
        <div class="course-crest">${crest(78, 'cc')}</div>
        <div class="course-body">
          <p class="eyebrow">${monthName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${esc(course.tagline)}</p>
          <ol class="hole-list">${course.holes.map((h, i) => `<li><span>${i + 1}</span><b>${esc(h.name)}</b><em>Par ${h.par}</em></li>`).join('')}</ol>
          <div class="course-cta">
            <a class="btn" href="#/round">${mine ? 'Play another round' : `Play ${esc(shortName(course))}`}</a>
            <span class="muted">${mine ? `Your best: <b>${mine.total}</b> (${toParLabel(mine.total - mine.par)})` : `Par ${course.par} · best round of the month counts`}</span>
          </div>
        </div>
      </section>
      <section class="board">
        ${countdown(snap.month, course)}
        <div class="board-head"><h2>The Board</h2><span>${monthName(snap.month)} · best round counts</span></div>
        <div class="board-tabs" id="board-tabs" role="tablist" hidden>
          <button role="tab" data-tab="open">Open</button><span aria-hidden="true">·</span><button role="tab" data-tab="club">My club</button>
        </div>
        <div id="board-open" hidden></div>
        <div id="board-club"><div class="table-wrap"><table class="scorecard">
          <thead><tr><th></th><th>Member</th>${head}<th class="num">Tot</th><th class="num">±</th></tr></thead>
          <tbody>
            <tr class="par"><td></td><td>Par</td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td><td></td></tr>
            ${body}
          </tbody>
        </table></div></div>
      </section>
      ${facilityPanel()}
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      <p class="fine feedback-link"><button class="link" id="send-feedback">Leave feedback</button></p>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  tickCountdown();
  void bindOpen(snap, line);
  void bindNotices();
  void bindDaily(snap.today);
  document.getElementById('send-feedback')!.onclick = () => openFeedback('From the clubhouse');
  document.getElementById('demo')?.addEventListener('click', async () => {
    localApi.seedDemo(requireSession());
    home(await refresh());
  });
}

// The month's clock: how long until the board closes and the champion goes up.
function countdown(month: string, course: Course) {
  const ends = monthClosesAt(month);
  const day = new Date(ends.getTime() - 1).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `<div class="countdown" data-countdown="${ends.getTime()}">
    <span>${esc(course.name.replace(/ Course$/, ''))} closes in</span><b data-left>…</b>
    <small>${monthName(month).split(' ')[0]}'s champion is crowned at midnight ET, ${day}.</small>
  </div>`;
}

// One clock for the page, however often the home page redraws: it finds the countdown each second.
let clock = 0;
function tickCountdown() {
  const draw = () => {
    const els = document.querySelectorAll<HTMLElement>('[data-countdown]');
    if (!els.length) {
      window.clearInterval(clock);
      clock = 0;
      return;
    }
    for (const el of els) {
      const left = Number(el.dataset.countdown) - Date.now();
      const out = el.querySelector('[data-left]')!;
      el.classList.toggle('final', left < 3_600_000);
      if (left <= 0) {
        out.textContent = el.dataset.done ? '' : 'Closed';
        el.querySelector('small')!.textContent = el.dataset.done ?? 'The champion is being crowned.';
        continue;
      }
      const s = Math.floor(left / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      out.textContent = `${d ? `${d}d ` : ''}${h}h ${String(m).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
    }
  };
  draw();
  if (!clock) clock = window.setInterval(draw, 1000);
}

const shortName = (c: Course) => c.name.replace(/ Course$/, '');

// The headline at the top of the home page: the next course's Open, counting down to its first day, with its practice
// preview as the main button. Volcanic courses get the red glow.
function launchHero(month: string) {
  const next = nextCourse(month);
  if (!next) return '';
  const n = Math.min(next.previewHoles ?? next.holes.length, next.holes.length);
  const starts = monthClosesAt(month);
  const day = starts.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric' });
  return `
    <section class="launch-hero${next.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}">
      <p class="eyebrow">Opens ${esc(day)} · ${next.holes.length} holes · par ${next.par}</p>
      <h1>${esc(shortName(next))} Open</h1>
      <div class="hero-clock" data-countdown="${starts.getTime()}" data-done="It's open. Tee off.">
        <span>Begins in</span><b data-left>…</b><small></small>
      </div>
      <p class="hero-tag">${esc(next.tagline)}</p>
      <div class="hero-cta">
        <a class="btn lava" href="#/practice/${next.id}">Play the preview</a>
        <span>Try ${n} holes now. Counts from ${esc(day)}.</span>
      </div>
    </section>`;
}

