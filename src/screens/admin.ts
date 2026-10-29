// The admin tab: every club the admin runs on one page. At the top, what's waiting on you (feedback) and the things
// you can go do (notice, invite, preview, new club); then activity, every member, and member management (invites
// nobody has opened yet, with revoke).
import { api, getSession, listSessions } from '../api';
import type { AdminOverview, AdminWindow, DailyDay, Design, Notice, Session, Snapshot } from '../api/types';
import { GAME_TZ } from '../day';
import { courseById, upcoming } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { store } from '../storage';
import { buildHole, tidy } from '../designer/spec';
import { planCanvas } from '../designer/plan';
import { testHole } from './round';
import { esc, header, navigate, render } from '../ui';
import { ago } from './activity';
import { bindClubMaker, clubMaker } from './clubs';
import { inviteLink } from './invite';

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
  const next = upcoming(snap.month)[0];
  render(`
    ${header(snap.groupName, 'admin')}
    <main class="admin-page">
      <div class="admin-top">
        <div><p class="eyebrow">Committee only</p><h1>The Committee Room</h1></div>
        <div class="seg" role="tablist" id="adm-window">${WINDOWS.map((w) => `<button role="tab" data-window="${w.id}">${w.label}</button>`).join('')}</div>
      </div>
      <section class="adm-card adm-do">
        <h2>To do</h2>
        <div id="adm-todo"><p class="muted">Loading…</p></div>
        <div class="adm-actions">
          <button class="btn" data-tool="notice">📣 Post a notice</button>
          <button class="btn" data-tool="invite">✉️ Invite someone</button>
          ${next ? `<a class="btn ghost" href="#/preview/${next.id}">⛳ Preview ${esc(next.name.replace(/ Course$/, ''))}</a>` : ''}
          <button class="btn ghost" data-tool="club">🏌️ Start a club</button>
        </div>
        <div class="adm-tool" data-panel="notice" hidden>${noticeTool()}</div>
        <div class="adm-tool" data-panel="invite" hidden>${inviteTool()}</div>
        <div class="adm-tool" data-panel="club" hidden>${clubMaker(true)}</div>
      </section>
      <section class="adm-card" id="adm-holes" hidden></section>
      <div id="adm-body"><p class="muted">Loading every club…</p></div>
    </main>`);
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
    b.onclick = () => {
      const open = document.querySelector<HTMLElement>(`[data-panel="${b.dataset.tool}"]`)!;
      const was = !open.hidden;
      document.querySelectorAll<HTMLElement>('[data-panel]').forEach((x) => (x.hidden = true));
      document.querySelectorAll('[data-tool]').forEach((x) => x.classList.remove('on'));
      open.hidden = was;
      b.classList.toggle('on', !was);
      if (!was) open.querySelector<HTMLElement>('textarea, input')?.focus();
    };
  });
  bindClubMaker();
  bindNoticeTool();
  bindInviteTool();
  void load();
  void loadHoles(snap);
}

// Members' holes from the Design Desk: the ones waiting for a decision (play it, approve, or not), and the ones
// already on the Members' Course (which can come off)
async function loadHoles(snap: Snapshot) {
  const el = document.getElementById('adm-holes');
  if (!el) return;
  const list = await api.designQueue(requireSession()).catch(() => [] as Design[]);
  el.hidden = !list.length;
  if (!list.length) return;
  const waiting = list.filter((d) => d.status === 'submitted');
  const live = list.filter((d) => d.status === 'approved');
  const row = (d: Design) => {
    const spec = tidy(d.spec);
    return `<li data-design="${d.id}"><div class="adm-hole-plan"></div><div><b>${esc(spec.name)}</b> <small>by ${esc(d.by ?? '?')}${d.club ? ` · ${esc(d.club)}` : ''} · par ${d.par ?? 3}</small>
      <p>${esc(d.prompt)}</p>
      <div class="adm-chips"><button data-hole-play>Play it</button>${d.status === 'submitted' ? '<button data-hole-ok class="on">Approve</button><button data-hole-no>Not this one</button>' : '<button data-hole-no>Take it off</button>'}</div></div></li>`;
  };
  el.innerHTML = `<div class="adm-head"><h2>Members' holes ${waiting.length ? `<span class="adm-count">${waiting.length}</span>` : ''}</h2></div>
    ${waiting.length ? `<ul class="adm-list adm-holes">${waiting.map(row).join('')}</ul>` : '<p class="muted">Nothing waiting.</p>'}
    ${live.length ? `<p class="adm-sub">On the Members' Course</p><ul class="adm-list adm-holes">${live.map(row).join('')}</ul>` : ''}`;
  for (const d of list) {
    const li = el.querySelector<HTMLElement>(`[data-design="${d.id}"]`)!;
    const { hole } = buildHole(d.spec, `review-${d.id}`);
    li.querySelector('.adm-hole-plan')!.appendChild(planCanvas(hole, 96));
    li.querySelector<HTMLButtonElement>('[data-hole-play]')!.onclick = () => testHole(snap, { ...hole, par: d.par ?? 3 }, () => navigate('#/admin'));
    li.querySelector<HTMLButtonElement>('[data-hole-ok]')?.addEventListener('click', async () => {
      await api.reviewDesign(requireSession(), d.id, true);
      void loadHoles(snap);
    });
    li.querySelector<HTMLButtonElement>('[data-hole-no]')!.onclick = async () => {
      await api.reviewDesign(requireSession(), d.id, false);
      void loadHoles(snap);
    };
  }
}

// The clubs this device can act for: the admin's signed-in clubs. Notices and invites go out through each one.
const clubs = () => listSessions();
const sessionFor = (club: string) => clubs().find((c) => c.groupName === club);
const clubPicker = (name: string, multi: boolean) => {
  const all = clubs();
  if (all.length < 2) return '';
  const on = getSession()?.groupId;
  return `<div class="adm-chips adm-pick" role="group" aria-label="Which club"><small>${multi ? 'Post to' : 'Club'}</small>${all
    .map((c) => `<label><input type="${multi ? 'checkbox' : 'radio'}" name="${name}" value="${esc(c.groupId)}" ${multi || c.groupId === on ? 'checked' : ''}><span>${esc(c.groupName)}</span></label>`)
    .join('')}</div>`;
};
const picked = (form: HTMLFormElement, name: string): Session[] => {
  const all = clubs();
  if (all.length < 2) return all.filter((c) => c.groupId === getSession()?.groupId);
  const ids = new FormData(form).getAll(name).map(String);
  return all.filter((c) => ids.includes(c.groupId));
};

// Post a notice to one club or all of them at once; live notices underneath, each with Take down.
function noticeTool() {
  return `
    <form id="adm-notice" class="stack">
      <p class="muted">Shows at the top of every member's home page until you take it down.</p>
      <textarea id="adm-notice-body" maxlength="1000" rows="3" required placeholder="The Highlands closes Sunday. Get your rounds in."></textarea>
      ${clubPicker('notice-club', true)}
      <div class="notice-sign" role="radiogroup" aria-label="Sign it as">
        <label><input type="radio" name="sign" value="reginald" checked> Reginald</label>
        <label><input type="radio" name="sign" value="me"> Me</label>
      </div>
      <p class="error" id="adm-notice-err" role="alert"></p>
      <button class="btn" type="submit">Post notice</button>
    </form>
    <ul class="adm-list" id="adm-notices"></ul>`;
}

function bindNoticeTool() {
  const form = document.getElementById('adm-notice') as HTMLFormElement | null;
  const list = document.getElementById('adm-notices');
  if (!form || !list) return;
  const many = clubs().length > 1;
  const drawLive = async () => {
    const live = (await Promise.all(clubs().map(async (c) => (await api.listNotices(c).catch(() => [] as Notice[])).map((n) => ({ n, c }))))).flat();
    list.innerHTML = live.length
      ? live
          .map(({ n, c }) => `<li><div>${chip(c.groupName, many)}<small>${n.asReginald ? 'As Reginald' : 'As you'} · ${ago(n.createdAt)}</small><p>${esc(n.body)}</p></div><button class="btn small ghost" data-down="${n.id}" data-club="${esc(c.groupId)}">Take down</button></li>`)
          .join('')
      : '';
    list.querySelectorAll<HTMLButtonElement>('[data-down]').forEach((b) => {
      b.onclick = async () => {
        const c = clubs().find((x) => x.groupId === b.dataset.club);
        if (!c) return;
        b.disabled = true;
        await api.takeDownNotice(c, Number(b.dataset.down)).catch(() => (b.disabled = false));
        void drawLive();
      };
    });
  };
  void drawLive();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const body = document.getElementById('adm-notice-body') as HTMLTextAreaElement;
    const err = document.getElementById('adm-notice-err')!;
    const to = picked(form, 'notice-club');
    err.textContent = to.length ? '' : 'Pick at least one club.';
    if (!to.length) return;
    try {
      const asReginald = new FormData(form).get('sign') === 'reginald';
      for (const c of to) await api.postNotice(c, body.value, asReginald);
      body.value = '';
      void drawLive();
    } catch (x) {
      err.textContent = (x as Error).message;
    }
  };
}

// Invite someone to a club: the link to send comes up straight away.
function inviteTool() {
  return `
    <form id="adm-invite" class="stack">
      <p class="muted">A private link with a code that works once, for that person only.</p>
      ${clubPicker('invite-club', false)}
      <div class="invite-form"><input id="adm-invite-name" maxlength="20" placeholder="Their first name" autocomplete="off" aria-label="Their first name" required /><button class="btn" type="submit">Make invitation</button></div>
      <p class="error" id="adm-invite-err" role="alert"></p>
    </form>
    <div id="adm-invite-made"></div>`;
}

function bindInviteTool() {
  const form = document.getElementById('adm-invite') as HTMLFormElement | null;
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById('adm-invite-name') as HTMLInputElement;
    const err = document.getElementById('adm-invite-err')!;
    const [club] = picked(form, 'invite-club');
    if (!club) return;
    err.textContent = '';
    try {
      const made = await api.createInvite(club, input.value);
      input.value = '';
      document.getElementById('adm-invite-made')!.innerHTML = `<ul class="adm-list"><li><div><b>${esc(made.name)}</b> <small>${esc(club.groupName)} · code ${esc(made.code)}</small></div><button class="btn small" data-send="${esc(made.id)}">${canShare() ? 'Share link' : 'Copy link'}</button></li></ul>`;
      bindSend(document.getElementById('adm-invite-made')!);
      void load();
    } catch (x) {
      err.textContent = (x as Error).message;
    }
  };
}

// phones get the share sheet, desktops copy the link
const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;
function bindSend(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-send]').forEach((b) => {
    b.onclick = async () => {
      const url = inviteLink(b.dataset.send!);
      try {
        if (canShare()) await navigator.share({ title: 'Claude Country Club', text: "You've been put up for membership.", url });
        else {
          await navigator.clipboard.writeText(url);
          b.textContent = 'Copied';
        }
      } catch {
        window.prompt('Copy this link', url);
      }
    };
  });
}

let state: {
  data: AdminOverview | null;
  daily: DailyDay[] | null;
  window: AdminWindow;
  sort: SortKey;
  desc: boolean;
  club: string;
} = {
  data: null,
  daily: null,
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
  const [data, daily] = await Promise.all([api.adminOverview(requireSession(), state.window).catch(() => null), api.dailyAdmin(requireSession()).catch(() => null)]);
  state.daily = daily;
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
  const todo = document.getElementById('adm-todo');
  if (todo) {
    todo.innerHTML = d.feedback.length
      ? `<ul class="adm-list">${d.feedback
          .map(
            (f) =>
              `<li><div>${chip(f.club, many)}<b>${esc(f.from ?? 'A member')}</b> <small>${ago(f.createdAt)}${f.context ? ` · ${esc(f.context)}` : ''}</small><p>${esc(f.body)}</p></div><button class="btn small" data-done="${f.id}">✓ Done</button></li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">Nothing waiting on you. No new feedback.</p>';
    todo.querySelectorAll<HTMLButtonElement>('[data-done]').forEach(
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
  }
  body.innerHTML = `
    <section class="adm-card">
      <h2>Activity</h2>
      <div class="adm-stats">
        ${stat(sum('members'), 'Members', `${d.clubs.reduce((a, c) => a + c.newMembers, 0)} new`)}
        ${stat(sum('active'), 'Active', win === 'all time' ? 'ever' : `last ${win}`.replace('last month', 'this month'))}
        ${stat(sum('rounds'), 'Rounds', 'posted')}
        ${stat(sum('practice'), 'Practice', 'sessions')}
      </div>
      ${
        many
          ? `<div class="table-wrap"><table class="practice-table adm-clubs"><thead><tr><th>Club</th><th class="num">Members</th><th class="num">Active</th><th class="num">New</th><th class="num">Rounds</th><th class="num">Practice</th></tr></thead><tbody>${d.clubs
              .map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.members}</td><td class="num">${c.active}</td><td class="num">${c.newMembers}</td><td class="num">${c.rounds}</td><td class="num">${c.practice}</td></tr>`)
              .join('')}</tbody></table></div>`
          : ''
      }
      ${dailyBars(state.daily)}
      <h3 class="adm-sub">Latest</h3>
      ${feed(d, many)}
    </section>
    <section class="adm-card">
      <div class="adm-head"><h2>Members</h2>${many ? `<div class="adm-chips">${['', ...d.clubs.map((c) => c.name)].map((c) => `<button data-club="${esc(c)}" class="${state.club === c ? 'on' : ''}">${c ? esc(c) : 'All'}</button>`).join('')}</div>` : ''}</div>
      ${memberTable(d.members)}
      <p class="fine">Days: days in the window they opened the club, played or practised. Best: their best round to par in the window.</p>
    </section>
    <section class="adm-card">
      <h2>Member management</h2>
      <h3 class="adm-sub">Invited, not joined yet${d.invites.length ? ` · ${d.invites.length}` : ''}</h3>
      ${pending(d, many)}
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
  bindSend(body);
  body.querySelectorAll<HTMLButtonElement>('[data-revoke]').forEach(
    (b) =>
      (b.onclick = async () => {
        const c = sessionFor(b.dataset.club!);
        if (!c || !confirm(`Revoke the invitation for ${b.dataset.name}? The link stops working.`)) return;
        b.disabled = true;
        try {
          await api.deleteInvite(c, b.dataset.revoke!);
          state.data!.invites = state.data!.invites.filter((i) => i.id !== b.dataset.revoke);
          draw();
        } catch (x) {
          b.disabled = false;
          alert((x as Error).message);
        }
      }),
  );
}

const stat = (n: number, label: string, sub: string) => `<div class="adm-stat"><b>${n}</b><span>${label}</span><small>${esc(sub)}</small></div>`;
const chip = (club: string, many: boolean) => (many ? `<span class="adm-club">${esc(club)}</span>` : '');

// invitations nobody has opened yet, oldest at the bottom: copy the link again, or revoke it
function pending(d: AdminOverview, many: boolean) {
  if (!d.invites.length) return '<p class="muted">Everyone you invited has joined.</p>';
  return `<ul class="adm-list">${d.invites
    .map((i) => {
      const can = !!sessionFor(i.club);
      return `<li><div>${chip(i.club, many)}<b>${esc(i.name)}</b> <small>invited ${ago(i.createdAt)} · code ${esc(i.code)}</small></div><span class="adm-acts"><button class="btn small ghost" data-send="${esc(i.id)}">${canShare() ? 'Share' : 'Copy link'}</button><button class="link" data-revoke="${esc(i.id)}" data-club="${esc(i.club)}" data-name="${esc(i.name)}" ${can ? '' : 'disabled title="Open this club on this device once to manage it"'}>Revoke</button></span></li>`;
    })
    .join('')}</ul>`;
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

// Daily Shot players a day for the last week, oldest on the left
function dailyBars(days: DailyDay[] | null) {
  if (!days) return '';
  const top = Math.max(1, ...days.map((d) => d.players));
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
  return `<h3 class="adm-sub">Closest to the Pin · players a day</h3><div class="adm-bars">${[...days]
    .reverse()
    .map((d) => `<div title="${d.day}: ${d.players} players, ${d.tries} tries"><b style="height:${Math.round((d.players / top) * 100)}%"></b><span>${d.players}</span><small>${day(d.day)}</small></div>`)
    .join('')}</div>`;
}
