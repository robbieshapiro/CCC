// The Clubhouse: everything off the course, as tabs. Your club's members and standings (the default), the bar (its
// games), Reginald's weekly Chronicle, every club this month, how the game works, and a note to the Committee. Each tab has its own link
// (#/clubhouse/<tab>; an older Chronicle is #/clubhouse/chronicle/<week>).
import { periodName, span } from '../day';
import { api } from '../api';
import type { Chronicle, ClubRow, Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { courseFor } from '../golf3d/courses';
import { hostChip } from '../host';
import { board, crownFor, toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc, header, render } from '../ui';
import { barPane, fillBar } from './bar';

export type ClubhouseTab = 'bar' | 'chronicle' | 'members' | 'clubs' | 'how' | 'feedback';
const TABS: [ClubhouseTab, string][] = [
  ['members', 'Members'],
  ['bar', 'Bar'],
  ['chronicle', 'Chronicle'],
  ['clubs', 'Clubs'],
  ['how', 'How to play'],
  ['feedback', 'Feedback'],
];
export const isClubhouseTab = (t: string | undefined): t is ClubhouseTab => TABS.some(([id]) => id === t);

const topar = (n: number | null) => (n === null ? '–' : `<span class="${n < 0 ? 'under' : n > 0 ? 'over' : ''}">${toParLabel(n)}</span>`);

export function clubhouse(snap: Snapshot, tab: ClubhouseTab = 'members', week?: string) {
  const pane = { bar: barPane, chronicle: chroniclePane, members, clubs, how, feedback }[tab](snap);
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="clubhouse">
      <nav class="ch-tabs" aria-label="Clubhouse">${TABS.map(([id, label]) => `<a href="#/clubhouse/${id}" class="${id === tab ? 'on' : ''}" ${id === tab ? 'aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
      <section class="ch-pane">${pane}</section>
    </main>`);
  document.querySelector('.ch-tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  if (tab === 'bar') void fillBar(snap);
  if (tab === 'clubs') void fillClubs();
  if (tab === 'chronicle') void fillChronicle(snap, week);
  if (tab === 'feedback') bindFeedback();
}

// your club: this period's best first, then everyone yet to play this period (most rounds all time first), with
// everyone's all-time rounds, best, average and titles alongside
function members(snap: Snapshot) {
  const career = (id: string) => snap.players.find((x) => x.id === id)?.career ?? { rounds: 0, best: null, avg: null };
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const yet = rows.filter((r) => !r.best).sort((a, b) => career(b.playerId).rounds - career(a.playerId).rounds);
  const body = [...played, ...yet]
    .map((r) => {
      const p = snap.players.find((x) => x.id === r.playerId)!;
      const me = p.id === snap.me;
      const c = career(p.id);
      return `<tr class="${me ? 'me' : ''}">
        <td class="rank">${r.best ? r.rank : ''}</td>
        <td class="who"><a href="${me ? '#/locker' : `#/member/${p.id}`}">${portrait(p.avatar, 34)}<span>${esc(p.name)}${crownFor(snap, p.id)}${me ? ' <small>you</small>' : ''}</span></a></td>
        <td class="num topar">${r.best ? topar(r.toPar) : '–'}</td>
        <td class="num">${r.rounds}</td>
        <td class="num all">${c.rounds}</td>
        <td class="num topar">${topar(c.best)}</td>
        <td class="num avg">${c.avg === null ? '–' : toParLabel(Math.round(c.avg * 10) / 10)}</td>
        <td class="num">${p.wins || ''}</td>
      </tr>`;
    })
    .join('');
  const per = span(snap.month) === 'week' ? 'This week' : 'This month';
  return `
    <div class="ch-head"><h1>${esc(snap.groupName)}</h1><p class="muted">${rows.length} ${rows.length === 1 ? 'member' : 'members'} · ${periodName(snap.month)}</p></div>
    ${rows.length ? `<div class="table-wrap"><table class="ch-table ch-members">
      <thead>
        <tr class="group"><th colspan="2"></th><th colspan="2" class="num">${per}</th><th colspan="2" class="num all">All time</th><th class="avg"></th><th></th></tr>
        <tr><th></th><th>Member</th><th class="num">Best</th><th class="num">Rds</th><th class="num all">Rds</th><th class="num">Best</th><th class="num avg">Avg</th><th class="num" title="Titles">🏆</th></tr>
      </thead>
      <tbody>${body}</tbody></table></div>` : '<p class="muted">No members yet.</p>'}`;
}

// The Clubhouse Chronicle: Reginald's letter to the club, written by Claude (api/chronicle.ts) when the Committee asks
function chroniclePane() {
  return `<div id="ch-chronicle"><p class="muted">Fetching the paper…</p></div>`;
}

const weekLabel = (week: string) => new Date(`${week}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

async function fillChronicle(snap: Snapshot, week?: string) {
  const list = await api.chronicles(requireSession()).catch(() => [] as Chronicle[]);
  const el = document.getElementById('ch-chronicle');
  if (!el) return;
  const ed = (week && list.find((c) => c.week === week)) || list[0];
  const writeNow = snap.admin ? `<button class="btn ghost" id="ch-write">Write this week's Chronicle</button><p class="error" id="ch-write-err"></p>` : '';
  if (!ed) {
    el.innerHTML = `<div class="chron-empty">${hostChip('The first Chronicle goes out when the Committee gives the word. I shall be brief. I am never brief.')}${writeNow}</div>`;
  } else {
    const b = ed.body;
    el.innerHTML = `
      <article class="chron">
        <header><p class="chron-mast">The Clubhouse Chronicle</p><p class="chron-date">${esc(snap.groupName)} · Week of ${weekLabel(ed.week)}</p></header>
        <h1>${esc(b.headline)}</h1>
        <p class="chron-dek">${esc(b.dek)}</p>
        ${b.items.map((i) => `<section><h2>${esc(i.title)}</h2><p>${esc(i.body)}</p></section>`).join('')}
        ${hostChip(esc(b.signoff))}
      </article>
      ${list.length > 1 ? `<nav class="chron-back"><h2>Back issues</h2>${list.map((c) => `<a href="#/clubhouse/chronicle/${c.week}" class="${c === ed ? 'on' : ''}">${weekLabel(c.week)} · ${esc(c.body.headline)}</a>`).join('')}</nav>` : ''}`;
    if (snap.admin && list[0].week !== thisSunday()) el.insertAdjacentHTML('beforeend', writeNow);
  }
  const btn = document.getElementById('ch-write') as HTMLButtonElement | null;
  if (btn)
    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = 'Reginald is writing…';
      const res = await fetch('/api/chronicle', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: requireSession().token, course: (({ name, tagline, holes, par }) => ({ name, tagline, holes: holes.length, par }))(courseFor(snap.month)) }) })
        .then((r) => r.json() as Promise<{ edition: unknown; why?: string }>)
        .catch(() => ({ edition: null, why: 'unavailable' }));
      if (res.edition) return fillChronicle(snap);
      btn.disabled = false;
      btn.textContent = "Write this week's Chronicle";
      document.getElementById('ch-write-err')!.textContent = res.why === 'not configured' ? 'Add ANTHROPIC_API_KEY in Vercel first.' : "Couldn't write it just now.";
    };
}

// Sunday of this week, Eastern: editions are kept a week at a time, Sunday to Saturday
function thisSunday() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  et.setDate(et.getDate() - et.getDay());
  return `${et.getFullYear()}-${String(et.getMonth() + 1).padStart(2, '0')}-${String(et.getDate()).padStart(2, '0')}`;
}

// every club, this period: filled in once the server answers
function clubs(snap: Snapshot) {
  return `
    <div class="ch-head"><h1>The clubs</h1><p class="muted">${periodName(snap.month)} · ${esc(courseFor(snap.month).name)}</p></div>
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
  const per = span(snap.month);
  const rows: [string, string, string][] = [
    ['⛳', `One course a ${per}`, `${esc(course.name)} this ${per}. Play as often as you like. Your best round counts.`],
    ['🏆', `Win the ${per}`, `Lowest round in your club when the ${per} closes goes on the plaque. Midnight ET, ${per === 'week' ? 'Saturday night' : 'last day'}.`],
    ['🌍', 'The Open', 'Every club on one board. Same round, bigger field.'],
    ['🎯', 'Closest to the Pin', 'One shot, three tries, new every day.'],
    ['🍺', 'The bar', "The long drive and the Members' Course. New boards every Monday."],
    ['🏌️', 'Practice', `The range, the short game, and next ${per}’s course before it opens.`],
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
