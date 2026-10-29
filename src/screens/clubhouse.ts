// The Clubhouse: everything off the course, as tabs. The bar (its games), your club's members, every club this
// month, how the game works, and a note to the Committee. Each tab has its own link (#/clubhouse/<tab>).
import { api } from '../api';
import type { ClubRow, Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { courseFor } from '../golf3d/courses';
import { hostChip } from '../host';
import { board, monthName, toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc, header, render } from '../ui';
import { barPane, fillBar } from './bar';

export type ClubhouseTab = 'bar' | 'members' | 'clubs' | 'how' | 'feedback';
const TABS: [ClubhouseTab, string][] = [
  ['bar', 'Bar'],
  ['members', 'Members'],
  ['clubs', 'Clubs'],
  ['how', 'How to play'],
  ['feedback', 'Feedback'],
];
export const isClubhouseTab = (t: string | undefined): t is ClubhouseTab => TABS.some(([id]) => id === t);

const topar = (n: number | null) => (n === null ? '–' : `<span class="${n < 0 ? 'under' : n > 0 ? 'over' : ''}">${toParLabel(n)}</span>`);

export function clubhouse(snap: Snapshot, tab: ClubhouseTab = 'bar') {
  const pane = { bar: barPane, members, clubs, how, feedback }[tab](snap);
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="clubhouse">
      <nav class="ch-tabs" aria-label="Clubhouse">${TABS.map(([id, label]) => `<a href="#/clubhouse/${id}" class="${id === tab ? 'on' : ''}" ${id === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <section class="ch-pane">${pane}</section>
    </main>`);
  document.querySelector('.ch-tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (tab === 'bar') void fillBar(snap);
  if (tab === 'clubs') void fillClubs();
  if (tab === 'feedback') bindFeedback();
}

// your club this month: best first, then everyone yet to play
function members(snap: Snapshot) {
  const rows = board(snap);
  const body = rows
    .map((r) => {
      const p = snap.players.find((x) => x.id === r.playerId)!;
      const me = p.id === snap.me;
      return `<tr class="${me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="${me ? '#/locker' : `#/member/${p.id}`}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${me ? ' <small>you</small>' : ''}</span></a></td>
        <td class="num topar">${r.best ? topar(r.toPar) : '–'}</td>
        <td class="num">${r.rounds}</td>
        <td class="num">${p.wins || ''}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="ch-head"><h1>${esc(snap.groupName)}</h1><p class="muted">${rows.length} ${rows.length === 1 ? 'member' : 'members'} · ${monthName(snap.month)}</p></div>
    ${rows.length ? `<div class="table-wrap"><table class="ch-table">
      <thead><tr><th></th><th>Member</th><th class="num">Best</th><th class="num">Rounds</th><th class="num" title="Monthly wins">🏆</th></tr></thead>
      <tbody>${body}</tbody></table></div>` : '<p class="muted">No members yet.</p>'}`;
}

// every club, this month: filled in once the server answers
function clubs(snap: Snapshot) {
  return `
    <div class="ch-head"><h1>The clubs</h1><p class="muted">${monthName(snap.month)} · ${esc(courseFor(snap.month).name)}</p></div>
    <div id="ch-clubs"><p class="muted">Loading…</p></div>`;
}

async function fillClubs() {
  const list = await api.clubList(requireSession()).catch(() => null as ClubRow[] | null);
  const el = document.getElementById('ch-clubs');
  if (!el) return;
  if (!list) {
    el.innerHTML = '<p class="muted">The clubs table isn’t open yet. Check back soon.</p>';
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table class="ch-table">
    <thead><tr><th>Club</th><th class="num">Members</th><th>Leader</th><th class="num">Best</th></tr></thead>
    <tbody>${list
      .map(
        (c) => `<tr class="${c.mine ? 'me' : ''}">
        <td><b>${esc(c.name)}</b>${c.mine ? ' <small>yours</small>' : ''}</td>
        <td class="num">${c.members}</td>
        <td>${c.leaders?.length ? esc(c.leaders.join(' & ')) : '<span class="muted">Nobody yet</span>'}</td>
        <td class="num topar">${topar(c.best)}</td>
      </tr>`,
      )
      .join('')}</tbody></table></div>`;
}

function how(snap: Snapshot) {
  const course = courseFor(snap.month);
  const rows: [string, string, string][] = [
    ['⛳', 'One course a month', `${esc(course.name)} this month. Play as often as you like. Your best round counts.`],
    ['🏆', 'Win the month', 'Lowest round in your club when the month closes goes on the plaque. Midnight ET, last day.'],
    ['🌍', 'The Open', 'Every club on one board. Same round, bigger field.'],
    ['🎯', 'Closest to the Pin', 'One shot, three tries, new every day.'],
    ['🎃', 'The bar', 'Haunted mini golf and the long drive. New boards every Monday.'],
    ['🏌️', 'Practice', 'The range, the short game, and next month’s course before it opens.'],
    ['🥤', 'The cart', 'Drinks from the cart change your next swings.'],
  ];
  const swing: [string, string, string][] = [
    ['👆', 'Aim', 'Drag left or right'],
    ['🟡', 'Power', 'Tap to swing, tap again on the gold line'],
    ['💥', 'Hit', 'Tap when the needle is in the gold'],
    ['🟢', 'Putt', 'Drag down, let go'],
  ];
  const list = (r: [string, string, string][]) => `<ul class="ch-how">${r.map(([i, b, t]) => `<li><i>${i}</i><b>${b}</b><span>${t}</span></li>`).join('')}</ul>`;
  return `
    <div class="ch-head"><h1>How it works</h1></div>
    ${list(rows)}
    <h2 class="ch-sub">The swing</h2>
    ${list(swing)}
    <p class="muted ch-tip">Tap <b>?</b> on the course any time to see this again.</p>`;
}

function feedback() {
  return `
    <div class="ch-head"><h1>Feedback</h1></div>
    <form class="ch-feedback" id="ch-fb">
      ${hostChip('The Committee welcomes your remarks. It may even read them.')}
      <textarea id="ch-fb-body" maxlength="2000" rows="6" required placeholder="What should we fix, add or change?" aria-label="Your feedback"></textarea>
      <p class="error" id="ch-fb-err" role="alert"></p>
      <button class="btn" type="submit">Send</button>
    </form>`;
}

function bindFeedback() {
  const form = document.getElementById('ch-fb') as HTMLFormElement;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = (document.getElementById('ch-fb-body') as HTMLTextAreaElement).value;
    const btn = form.querySelector('button')!;
    btn.disabled = true;
    try {
      await api.submitFeedback(requireSession(), body, 'From the clubhouse');
      form.innerHTML = `${hostChip('Received with thanks. I shall place it before the Committee personally.', 'pleased')}<a class="btn ghost" href="#/">Back to Play</a>`;
    } catch (err) {
      document.getElementById('ch-fb-err')!.textContent = (err as Error).message;
      btn.disabled = false;
    }
  };
}
