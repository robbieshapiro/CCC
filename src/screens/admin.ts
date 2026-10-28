// The admin tab: every club the admin runs on one page. Headline numbers, an inbox (open feedback and unused
// invites), every member, what's happened lately, and below that the tools for the club you're signed into.
import { api } from '../api';
import type { AdminOverview, AdminWindow, Snapshot } from '../api/types';
import { GAME_TZ } from '../day';
import { courseById, upcoming } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { store } from '../storage';
import { esc, header, render } from '../ui';
import { ago } from './activity';
import { bindClubMaker, clubMaker } from './clubs';
import { bindFeedbackPanel, feedbackPanel } from './feedback';
import { bindInviteMaker, inviteMaker } from './invite';
import { bindNotices, noticeComposer } from './notices';
import { bindPracticeLog, practiceLogPanel } from './practice';

const WINDOWS: { id: AdminWindow; label: string }[] = [
  { id: 'week', label: '7 days' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All time' },
];
const WINDOW_KEY = 'ccc-admin-window';

type Members = AdminOverview['members'];
type SortKey = 'lastSeen' | 'name' | 'club' | 'days' | 'rounds' | 'best' | 'practice' | 'lockers';
const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Member' },
  { key: 'club', label: 'Club' },
  { key: 'lastSeen', label: 'Last in' },
  { key: 'days', label: 'Days', num: true },
  { key: 'rounds', label: 'Rounds', num: true },
  { key: 'best', label: 'Best', num: true },
  { key: 'practice', label: 'Practice', num: true },
  { key: 'lockers', label: 'Lockers', num: true },
];

export function admin(snap: Snapshot) {
  render(`
    ${header(snap.groupName, 'admin')}
    <main class="admin-page">
      <div class="admin-top">
        <div><p class="eyebrow">Committee only</p><h1>The Committee Room</h1></div>
        <div class="seg" role="tablist" id="adm-window">${WINDOWS.map((w) => `<button role="tab" data-window="${w.id}">${w.label}</button>`).join('')}</div>
      </div>
      <div id="adm-body"><p class="muted">Loading every club…</p></div>
      <h2 class="adm-tools-head">Club tools · ${esc(snap.groupName)}</h2>
      <p class="fine">These work on the club you're signed into. Switch clubs from the name under the crest.</p>
      ${noticeComposer(true)}
      ${previewPanel(snap.month)}
      ${inviteMaker(true)}
      ${practiceLogPanel(true)}
      ${feedbackPanel(true)}
      ${clubMaker(true)}
    </main>`);
  void bindInviteMaker();
  void bindFeedbackPanel();
  void bindPracticeLog();
  bindClubMaker();
  void bindNotices();
  void load();
}

// every hole of the courses still to come; preview rounds aren't posted
function previewPanel(month: string) {
  const list = upcoming(month);
  if (!list.length) return '';
  return `
    <section class="panel admin invite-maker">
      <div><h2>Preview the next course</h2><p class="muted">Only you can see this. Every hole, and preview rounds are not posted to the board.</p></div>
      ${list.map((c) => `<a class="btn" href="#/preview/${c.id}">Play all ${c.holes.length} holes of ${esc(c.name)}</a><p class="fine">${esc(c.tagline)}</p>`).join('')}
    </section>`;
}

let state: {
  data: AdminOverview | null;
  window: AdminWindow;
  sort: SortKey;
  desc: boolean;
  club: string;
} = {
  data: null,
  window: 'week',
  sort: 'lastSeen',
  desc: true,
  club: '',
};

async function load() {
  const saved = store.get(WINDOW_KEY) as AdminWindow | null;
  state = {
    ...state,
    window: saved && WINDOWS.some((w) => w.id === saved) ? saved : state.window,
  };
  const seg = document.getElementById('adm-window');
  seg?.querySelectorAll<HTMLButtonElement>('[data-window]').forEach((b) => {
    b.classList.toggle('on', b.dataset.window === state.window);
    b.onclick = () => {
      store.set(WINDOW_KEY, b.dataset.window!);
      void load();
    };
  });
  const body = document.getElementById('adm-body');
  if (!body) return;
  body.classList.add('loading');
  const data = await api.adminOverview(requireSession(), state.window).catch(() => null);
  if (!document.getElementById('adm-body')) return; // left the page
  body.classList.remove('loading');
  if (!data) {
    body.innerHTML = `<p class="muted">Couldn't load the Committee Room. If its SQL hasn't been run in Supabase yet, run it and this fills in.</p>`;
    return;
  }
  state.data = data;
  draw();
}

function draw() {
  const body = document.getElementById('adm-body');
  const d = state.data;
  if (!body || !d) return;
  const sum = (k: 'members' | 'active' | 'rounds' | 'practice') => d.clubs.reduce((a, c) => a + c[k], 0);
  const many = d.clubs.length > 1;
  const win = WINDOWS.find((w) => w.id === state.window)!.label.toLowerCase();
  body.innerHTML = `
    <section class="adm-stats">
      ${stat(sum('members'), 'Members', `${d.clubs.reduce((a, c) => a + c.newMembers, 0)} new`)}
      ${stat(sum('active'), 'Active', win === 'all time' ? 'ever' : `last ${win}`.replace('last month', 'this month'))}
      ${stat(sum('rounds'), 'Rounds', 'posted')}
      ${stat(sum('practice'), 'Practice', 'sessions')}
    </section>
    ${
      many
        ? `<div class="table-wrap"><table class="practice-table adm-clubs"><thead><tr><th>Club</th><th class="num">Members</th><th class="num">Active</th><th class="num">New</th><th class="num">Rounds</th><th class="num">Practice</th></tr></thead><tbody>${d.clubs
            .map(
              (c) =>
                `<tr><td>${esc(c.name)}</td><td class="num">${c.members}</td><td class="num">${c.active}</td><td class="num">${c.newMembers}</td><td class="num">${c.rounds}</td><td class="num">${c.practice}</td></tr>`,
            )
            .join('')}</tbody></table></div>`
        : ''
    }
    <section class="adm-card">
      <h2>Inbox ${d.feedback.length + d.invites.length ? `<span class="adm-count">${d.feedback.length + d.invites.length}</span>` : ''}</h2>
      ${inbox(d, many)}
    </section>
    <section class="adm-card">
      <div class="adm-head"><h2>Members</h2>${many ? `<div class="adm-chips">${['', ...d.clubs.map((c) => c.name)].map((c) => `<button data-club="${esc(c)}" class="${state.club === c ? 'on' : ''}">${c ? esc(c) : 'All'}</button>`).join('')}</div>` : ''}</div>
      ${memberTable(d.members)}
      <p class="fine">Days: days in the window they opened the club, played or practised. Best: their best round to par in the window.</p>
    </section>
    <section class="adm-card">
      <h2>Recent activity</h2>
      ${feed(d, many)}
    </section>`;
  body.querySelectorAll<HTMLButtonElement>('[data-club]').forEach((b) => (b.onclick = () => ((state.club = b.dataset.club!), draw())));
  body.querySelectorAll<HTMLElement>('[data-sort]').forEach(
    (th) =>
      (th.onclick = () => {
        const k = th.dataset.sort as SortKey;
        state.desc = state.sort === k ? !state.desc : k !== 'name' && k !== 'club' && k !== 'best';
        state.sort = k;
        draw();
      }),
  );
  body.querySelectorAll<HTMLButtonElement>('[data-done]').forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        await api.adminFeedbackDone(requireSession(), Number(b.dataset.done), true).catch(() => (b.disabled = false));
        if (b.disabled) {
          state.data!.feedback = state.data!.feedback.filter((f) => f.id !== Number(b.dataset.done));
          draw();
        }
      }),
  );
  body.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(
    (b) =>
      (b.onclick = async () => {
        const url = `${location.origin}${location.pathname}#/invite/${b.dataset.copy}`;
        try {
          await navigator.clipboard.writeText(url);
          b.textContent = 'Copied';
        } catch {
          window.prompt('Copy the invite link', url);
        }
      }),
  );
}

const stat = (n: number, label: string, sub: string) => `<div class="adm-stat"><b>${n}</b><span>${label}</span><small>${esc(sub)}</small></div>`;
const chip = (club: string, many: boolean) => (many ? `<span class="adm-club">${esc(club)}</span>` : '');

function inbox(d: AdminOverview, many: boolean) {
  if (!d.feedback.length && !d.invites.length) return '<p class="muted">Inbox zero.</p>';
  return `<ul class="adm-list">
    ${d.feedback
      .map(
        (f) =>
          `<li><div>${chip(f.club, many)}<b>${esc(f.from ?? 'A member')}</b> <small>${ago(f.createdAt)}${f.context ? ` · ${esc(f.context)}` : ''}</small><p>${esc(f.body)}</p></div><button class="btn small" data-done="${f.id}">✓ Done</button></li>`,
      )
      .join('')}
    ${d.invites
      .map(
        (i) =>
          `<li><div>${chip(i.club, many)}<b>${esc(i.name)}</b> <small>invited ${ago(i.createdAt)}, not joined yet · code ${esc(i.code)}</small></div><button class="btn small ghost" data-copy="${esc(i.id)}">Copy link</button></li>`,
      )
      .join('')}
  </ul>`;
}

function memberTable(all: Members) {
  const rows = all.filter((m) => !state.club || m.club === state.club);
  if (!rows.length) return '<p class="muted">No members yet.</p>';
  const val = (m: Members[number]) => {
    const v = m[state.sort];
    return v === null ? null : v;
  };
  rows.sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === null && y === null) return a.name.localeCompare(b.name);
    if (x === null) return 1; // never-seen and no-round members sink, whichever way
    if (y === null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return state.desc ? -c : c;
  });
  const arrow = (k: SortKey) => (state.sort === k ? (state.desc ? ' ↓' : ' ↑') : '');
  return `<div class="table-wrap"><table class="practice-table adm-members"><thead><tr>${COLUMNS.map((c) => `<th data-sort="${c.key}" class="${c.num ? 'num' : ''}">${c.label}${arrow(c.key)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (m) =>
          `<tr class="${m.days ? '' : 'quiet'}"><td><b>${esc(m.name)}</b></td><td><small>${esc(m.club)}</small></td><td><small>${ago(m.lastSeen)}</small></td><td class="num">${m.days}</td><td class="num">${m.rounds}</td><td class="num">${m.best === null ? '–' : toParLabel(m.best)}</td><td class="num">${m.practice}</td><td class="num">${m.lockers}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
}

// today's events get the time; older ones the day
const when = (iso: string) => {
  const a = ago(iso);
  return a === 'today'
    ? new Date(iso).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: GAME_TZ,
      })
    : a;
};

const PRACTICE: Record<string, string> = {
  range: 'hit the range',
  shortgame: 'worked the short game',
  caldera: 'practised the Caldera',
};

function feed(d: AdminOverview, many: boolean) {
  if (!d.feed.length) return '<p class="muted">Nothing yet.</p>';
  const line = (e: AdminOverview['feed'][number]) => {
    if (e.kind === 'round') return `posted ${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))}) on ${esc(courseById(e.course ?? '')?.name ?? e.course ?? 'a course')}`;
    if (e.kind === 'practice') return `${PRACTICE[e.what ?? ''] ?? 'practised'}${e.shots ? ` · ${e.shots} shots` : ''}`;
    if (e.kind === 'join') return 'joined the club';
    return `sent feedback: “${esc(e.what ?? '')}”`;
  };
  const icon = { round: '⛳', practice: '🎯', join: '👋', feedback: '✉️' };
  return `<ul class="adm-feed">${d.feed.map((e) => `<li><span class="adm-ico">${icon[e.kind]}</span><div>${chip(e.club, many)}<b>${esc(e.name)}</b> ${line(e)}<small>${when(e.at)}</small></div></li>`).join('')}</ul>`;
}
