import { api, listSessions, localApi, switchClub, useSupabase } from '../api';
import type { Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { featById } from '../feats';
import { courseFor, nextCourse, type Course } from '../golf3d/courses';
import { CALDERA_START, GAME_TZ, periodClosesAt, periodName, span } from '../day';
import { REGINALD, reginaldSvg, type Mood } from '../host';
import { bindOpen } from './open';
import { askReginald } from '../reginald';
import { bindDaily, dailyCard } from './daily';
import { bindNotices, noticesStrip } from './notices';
import { board, crownFor, myBest, toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';

export function scoreClass(strokes: number, par: number) {
  if (strokes === 1) return 'ace';
  const d = strokes - par;
  return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
}

// Last round's date on the club's (Eastern) calendar, e.g. "Oct 24".
const lastPlayed = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });

// The first time a member opens the app in a new period: the last one's champion, and the new course open to play.
// Gone once they tap Play or Later.
export const SEEN_PERIOD = 'ccc-seen-period';
// (from the Caldera challenge on: the months before it just open on the home page as they always did)
export const newPeriod = (snap: Snapshot) => snap.month >= CALDERA_START && store.get(SEEN_PERIOD) !== snap.month;

function newsCard(snap: Snapshot, course: Course) {
  if (!newPeriod(snap)) return '';
  const last = snap.champions[0];
  const names = last ? last.playerIds.map((id) => snap.players.find((p) => p.id === id)?.name ?? 'a former member') : [];
  const crowned = last ? `<p>${esc(periodName(last.month))} has closed. <b>${names.map(esc).join(' & ')}</b> ${names.length > 1 ? 'share' : 'takes'} the title at <b>${toParLabel(last.total - last.par)}</b>.</p>` : '';
  return `<section class="news${course.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}" id="news">
    <p class="eyebrow">Now open · ${esc(periodName(snap.month))}</p>
    <h2>${esc(course.name)}</h2>
    <p class="muted">${course.holes.length} holes · par ${course.par} · ${esc(course.tagline)}</p>
    ${crowned}
    <div class="news-actions"><a class="btn big" href="#/round" data-seen>Play it now</a><button class="btn ghost" data-seen>Later</button></div>
  </section>`;
}

// A thin strip along the top while the Caldera drops early: the night October closes, then through the challenge.
function scheduleBanner(snap: Snapshot) {
  const text =
    snap.month === '2026-10' && snap.today === '2026-10-29'
      ? '🌋 Early drop: October closes at midnight. The Caldera opens Fri 12am ET, 3 holes, to Sat Nov 7.'
      : snap.month === CALDERA_START
        ? '🌋 The Caldera dropped early: 3 holes, to Sat Nov 7. Weekly courses start Sun Nov 8.'
        : '';
  return text ? `<p class="banner">${text}</p>` : '';
}

// The honours for the period that last closed, filled in once the server answers: champion, the Open, runner-up,
// most rounds, aces, the steadiest average and the honest card.
function honoursPane(snap: Snapshot) {
  return snap.champions[0] ? `<section class="honours" id="honours" hidden></section>` : '';
}

async function bindHonours(snap: Snapshot) {
  const last = snap.champions[0];
  const el = document.getElementById('honours');
  if (!last || !el) return;
  const session = requireSession();
  const [h, opens] = await Promise.all([
    api.periodHonors(session, last.month).catch(() => null),
    api.openChampions(session).catch(() => []),
  ]);
  if (!h || !document.getElementById('honours')) return; // no SQL yet, or left the page
  const names = (xs: string[]) => xs.map(esc).join(' & ');
  const open = opens.find((o) => o.month === last.month);
  const per = span(last.month);
  const rows: [string, string, string][] = [
    ['🏆', 'Champion', h.champions.length ? `${names(h.champions.map((c) => c.name))} · ${toParLabel(h.champions[0].toPar)}` : ''],
    ['🌍', 'The Open', open ? `${names(open.names)} · ${toParLabel(open.total - open.par)}` : ''],
    ['🥈', 'Runner-up', h.runnersUp.length ? `${names(h.runnersUp.map((c) => c.name))} · ${toParLabel(h.runnersUp[0].toPar)}` : ''],
    ['🔁', 'Iron Man', h.mostRounds ? `${names(h.mostRounds.names)} · ${h.mostRounds.count} rounds` : ''],
    ['⛳', `Ace of the ${per}`, h.aces.length ? h.aces.map((a) => `${esc(a.name)}${a.count > 1 ? ` ×${a.count}` : ''}`).join(' & ') : ''],
    ['📊', 'Steadiest hand', h.lowestAverage ? `${names(h.lowestAverage.names)} · ${toParLabel(h.lowestAverage.avg!)} average` : ''],
    ['🫡', 'The Honest Card', h.highestScore ? `${names(h.highestScore.names)} · ${toParLabel(h.highestScore.toPar!)}, posted all the same` : ''],
  ];
  el.innerHTML = `<div class="board-head"><h2>${esc(periodName(last.month))} honours</h2><span>Your club</span></div>
    <ul>${rows.filter((r) => r[2]).map(([i, t, v]) => `<li><i>${i}</i><b>${t}</b><span>${v}</span></li>`).join('')}</ul>`;
  el.hidden = false;
}

export function home(snap: Snapshot) {
  const player = (id: string) => snap.players.find((p) => p.id === id);
  const course = courseFor(snap.month);
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const mine = myBest(snap);
  const me = rows.find((r) => r.playerId === snap.me)!; // absent when you only run this club
  const host = !!snap.players.find((p) => p.id === snap.me)?.host;

  let line = REGINALD.course(course.name, course.holes.length, course.par, span(snap.month));
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

  if (host) line = REGINALD.host(snap.groupName, snap.homeName ?? 'your club');

  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const p = player(r.playerId)!;
      const cells = course.holes.map((h, i) => `<td class="num"><span class="sc ${r.best ? scoreClass(r.best.holes[i], h.par) : ''}">${r.best ? r.best.holes[i] : ''}</span></td>`).join('');
      const feats = p.feats.map((f) => featById(f)?.icon ?? '').join('');
      return `<tr class="${r.playerId === snap.me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="#/member/${p.id}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${crownFor(snap, p.id)}${feats ? ` <small>${feats}</small>` : ''}<em>${r.rounds ? `${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · last ${lastPlayed(r.last!)}` : 'yet to play'}</em></span></a></td>
        ${cells}
        <td class="num tot">${r.best ? r.best.total : ''}</td>
        <td class="num topar ${r.best ? (r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : '') : ''}">${r.best ? toParLabel(r.toPar) : '–'}</td>
      </tr>`;
    })
    .join('');

  const plaque = snap.champions.length
    ? snap.champions
        .slice(0, 6)
        .map((c) => `<li><span>${periodName(c.month)}</span><b>${c.playerIds.map((id) => `<a href="#/member/${id}">${esc(player(id)?.name ?? '?')}</a>`).join(' & ')}</b><em>${toParLabel(c.total - c.par)}</em></li>`)
        .join('')
    : `<li class="empty">The first name goes up when the ${span(snap.month)} closes.</li>`;

  // whatever was full screen before (the tour, a round) has let go of the page by now
  document.body.classList.remove('court-open');
  render(`
    ${header(snap.groupName, 'play')}
    <main>
      ${scheduleBanner(snap)}
      ${newsCard(snap, course)}
      ${noticesStrip()}
      <section class="play-hero${course.holes[0]?.theme === 'volcanic' ? ' volcanic' : ''}">
        <div class="play-reg"><span class="host-face big">${reginaldSvg(mood, 72)}</span><p id="reg-line"><b>Reginald</b> ${line}</p></div>
        <div class="play-main">
          <p class="eyebrow">${periodName(snap.month)}</p>
          <h1>${esc(course.name)}</h1>
          <p class="muted">${course.holes.length} holes · par ${course.par}${mine ? ` · your best <b>${toParLabel(mine.total - mine.par)}</b>` : ''}</p>
          <a class="btn big" href="#/round" ${host ? 'data-play-home' : ''}>${mine ? 'Play again' : 'Play'}</a>
        </div>
      </section>
      <div class="tiles">
        ${dailyCard()}
        <a class="tile" href="#/clubhouse/bar"><i>🎃</i><b>The bar</b><span>Mini golf · long drive</span></a>
        <a class="tile" href="#/facility"><i>🏌️</i><b>Practice</b><span>Range and short game</span></a>
        ${previewTile(snap.month)}
      </div>
      ${honoursPane(snap)}
      <section class="board">
        ${countdown(snap.month, course)}
        <div class="board-head"><h2>The Board</h2><span>${periodName(snap.month)} · best round counts</span></div>
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
      <section class="plaque">
        <h2>Past Champions</h2>
        <ol>${plaque}</ol>
      </section>
      ${!useSupabase && snap.players.length < 2 ? `<p class="fine">Local mode. <button class="link" id="demo">Add Sean, Danny and PJ</button> to see a full board.</p>` : ''}
    </main>`);

  tickCountdown();
  void bindOpen(snap, line, host);
  // today's line, written for you by Reginald (Claude): it takes over from the scripted one when it arrives
  if (!host)
    void askReginald('daily', course, snap.today).then((text) => {
      const say = document.querySelector<HTMLElement>('#reg-line');
      if (!text || !say) return;
      say.dataset.ai = '1';
      say.classList.add('reg-fresh');
      say.innerHTML = `<b>Reginald</b> ${esc(text)}`;
    });
  void bindNotices();
  void bindDaily(snap.today, snap.crown);
  void bindHonours(snap);
  document.querySelectorAll<HTMLElement>('[data-seen]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set(SEEN_PERIOD, snap.month);
      document.getElementById('news')?.remove();
    }),
  );
  // in a club you only run, play from your own club: that's where it counts
  document.querySelector<HTMLAnchorElement>('[data-play-home]')?.addEventListener('click', (e) => {
    if (!snap.homeGroupId || !listSessions().some((x) => x.groupId === snap.homeGroupId)) return;
    e.preventDefault();
    switchClub(snap.homeGroupId);
    location.hash = '#/round';
  });
  document.getElementById('demo')?.addEventListener('click', async () => {
    localApi.seedDemo(requireSession());
    home(await refresh());
  });
}

// The period's clock: how long until the board closes and the champion goes up.
function countdown(month: string, course: Course) {
  const ends = periodClosesAt(month);
  const day = new Date(ends.getTime() - 1).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
  return `<div class="countdown" data-countdown="${ends.getTime()}">
    <span>${esc(course.name.replace(/ Course$/, ''))} closes in</span><b data-left>…</b>
    <small>This ${span(month)}'s champion is crowned at midnight ET, ${day}.</small>
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
        const note = el.querySelector('small');
        if (note) note.textContent = el.dataset.done ?? 'The champion is being crowned.';
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
function previewTile(month: string) {
  const next = nextCourse(month);
  if (!next) return '';
  const starts = periodClosesAt(month);
  return `<a class="tile" href="#/practice/${next.id}"><i>${next.holes[0]?.theme === 'autumn' ? '🍁' : next.holes[0]?.theme === 'volcanic' ? '🌋' : '⛳'}</i><b>${esc(shortName(next))} preview</b><span data-countdown="${starts.getTime()}" data-done="Open now">Opens in <em data-left>…</em></span></a>`;
}

