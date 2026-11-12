// The Committee Room, built around the game maker's job: designing, testing and scheduling a course each week.
// Courses is home (src/screens/adminHome.ts: Jarvis's briefing, this week's course and how it's playing, then every
// course week by week, each one opening to review, play, test and plan). Then three small rooms: Members (what's
// waiting on you, the people, invites, who's in, the numbers), Bar and Tools. Each has its own address
// (#/admin, #/admin/members, #/admin/course/<id>), so Back works. Every member name opens their card.
import { api, getSession, listSessions } from '../api';
import type { AdminOverview, AdminWindow, DailyDay, Design, Notice, Session, Snapshot, TrendDay } from '../api/types';
import { GAME_TZ } from '../day';
import { courseById } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { buildHole, tidy } from '../designer/hole';
import { isHole } from '../designer/desk';
import { planCanvas } from '../designer/plan';
import { testHole } from './round';
import { esc, golferHref, header, navigate, render } from '../ui';
import { ago } from './activity';
import { bindClubMaker, clubMaker } from './clubs';
import { inviteLink } from './invite';
import { chartSections, kpiSections, loadKpis } from './adminKpis';
import { ask, copyBox, tell } from '../dialog';
import { homeSections, loadHome, showCourse } from './adminHome';
import { loadToday, todaySections } from './adminToday';
import { loadNominations, nominationsSection } from './nominate';
import { bindNudge, nudgeSection } from './adminNudge';
import { barSection, loadBar } from './adminBar';

// Members and History always cover the last 7 days: with a course a week, that's the week (all-time numbers are on
// each golfer's card)
const WINDOW: AdminWindow = 'week';

type Members = AdminOverview['members'];
type SortKey = 'lastSeen' | 'name' | 'club' | 'days' | 'rounds' | 'best' | 'practice' | 'allRounds' | 'allBest';
// the last 7 days, then all time (all: true), under a heading each
const COLUMNS: { key: SortKey; label: string; num?: boolean; all?: boolean }[] = [
  { key: 'name', label: 'Member' },
  { key: 'club', label: 'Club' },
  { key: 'days', label: 'Days', num: true },
  { key: 'rounds', label: 'Rds', num: true },
  { key: 'best', label: 'Best', num: true },
  { key: 'practice', label: 'Prac', num: true },
  { key: 'allRounds', label: 'Rds', num: true, all: true },
  { key: 'allBest', label: 'Best', num: true, all: true },
];

export function admin(snap: Snapshot, arg?: string, extra?: string) {
  const tab: Tab = arg === 'members' || arg === 'bar' || arg === 'tools' ? arg : 'courses';
  const course = arg === 'course' && extra ? extra : undefined;
  // moving about inside the Committee Room keeps the page (and its numbers): only the view changes
  const shell = document.getElementById('adm-shell');
  if (shell && shell.dataset.group === requireSession().groupId) {
    showTab(tab);
    if (tab === 'courses') showCourse(course ?? null);
    return;
  }
  render(`
    ${header(snap.groupName, 'admin')}
    <main class="admin-page" id="adm-shell" data-group="${esc(requireSession().groupId)}">
      <nav class="adm-tabs" id="adm-tabs" role="tablist">${TABS.map((t) => `<button role="tab" data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
      <div class="adm-pane" data-pane="courses">
        ${homeSections(`
          ${todaySections()}
          <details class="adm-more">
            <summary>More numbers <small>purse, AI calls, players per day, week over week</small></summary>
            ${kpiSections()}
            ${chartSections()}
            <section class="adm-card adm-trend" id="adm-trend"><p class="muted">Loading…</p></section>
            <section class="adm-card" id="adm-daily-bars" hidden></section>
          </details>`)}
      </div>
      <div class="adm-pane" data-pane="members" hidden>
        ${nudgeSection(snap)}
        <section class="adm-card" id="adm-feedback-card" hidden>
          <h2>Feedback</h2>
          <div id="adm-todo"></div>
        </section>
        ${nominationsSection()}
        <section class="adm-card" id="adm-holes" hidden></section>
      </div>
      <div class="adm-pane" data-pane="bar" hidden>
        ${barSection()}
      </div>
      <div class="adm-pane" data-pane="tools" hidden>
        <section class="adm-card adm-do">
          <h2>Tools</h2>
          <div class="adm-actions">
            <button class="btn" data-tool="notice">📣 Post a notice</button>
            <button class="btn" data-tool="invite">✉️ Invite someone</button>
            <button class="btn ghost" data-tool="club">🏌️ Start a club</button>
            <a class="btn ghost" href="#/invite/preview">👀 Preview a new member's welcome</a>
            <a class="btn ghost" href="#/room">🛰️ The Design Room</a>
          </div>
          <div class="adm-tool" data-panel="notice" hidden>${noticeTool()}</div>
          <div class="adm-tool" data-panel="invite" hidden>${inviteTool()}</div>
          <div class="adm-tool" data-panel="club" hidden>${clubMaker(true)}</div>
        </section>
      </div>
      <div id="adm-body" hidden></div>
    </main>`);
  bindTabs(tab);
  void loadHome(snap, course);
  bindNudge(snap);
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
  void loadToday();
  void loadBar();
  void load();
  void loadHoles(snap);
  void loadTrend();
  void loadKpis();
}

// Members' golf holes from the Design Desk: the ones waiting for a decision (play it, approve, or not), and the ones
// already on the Members' Course (which can come off)
async function loadHoles(snap: Snapshot) {
  const el = document.getElementById('adm-holes');
  if (!el) return;
  const list = (await api.designQueue(requireSession()).catch(() => [] as Design[])).filter(isHole);
  el.hidden = !list.length;
  const waiting = list.filter((d) => d.status === 'submitted');
  setNeeds('holes', waiting.length);
  if (!list.length) return;
  const live = list.filter((d) => d.status === 'approved');
  const row = (d: Design) => {
    const spec = tidy(d.spec);
    return `<li data-design="${d.id}"><div class="adm-hole-plan"></div><div><b>${esc(spec.name)}</b> <small>by ${esc(d.by ?? '?')}${d.club ? ` · ${esc(d.club)}` : ''} · par ${spec.par}, ${spec.yards} yd · ${esc(spec.look)}</small>
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
    li.querySelector<HTMLButtonElement>('[data-hole-play]')!.onclick = () => testHole(snap, hole, () => navigate('#/admin'));
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
        void copyBox('Copy this link', url);
      }
    };
  });
}

let state: {
  data: AdminOverview | null;
  daily: DailyDay[] | null;
  sort: SortKey;
  ever: Map<string, { rounds: number; best: number | null }>;
  desc: boolean;
  club: string;
} = {
  data: null,
  daily: null,
  sort: 'lastSeen',
  ever: new Map(),
  desc: true,
  club: '',
};

// Weekly Players at the top: members who posted a round in the last 7 days, the change on a week ago, and the trend
// day by day since launch. Refreshes every minute while you're here.
let trend: TrendDay[] | null = null;
let trendTimer = 0;

async function loadTrend() {
  window.clearTimeout(trendTimer);
  const el = document.getElementById('adm-trend');
  if (!el) return;
  trend = await api.adminTrend(requireSession()).catch(() => trend);
  if (!document.getElementById('adm-trend')) return; // left the page
  drawTrend();
  trendTimer = window.setTimeout(() => {
    void loadTrend();
    void loadKpis();
  }, 60_000);
}

function drawTrend() {
  const el = document.getElementById('adm-trend');
  if (!el) return;
  if (!trend?.length) {
    el.innerHTML = `<p class="muted">Weekly Players shows up once its SQL has been run in Supabase.</p>`;
    return;
  }
  const now = trend[trend.length - 1];
  const before = trend.length > 7 ? trend[trend.length - 8] : null;
  const change = before ? now.players - before.players : null;
  const pct = now.members ? Math.round((now.players / now.members) * 100) : 0;
  const days = trend;
  const W = 600;
  const H = 150;
  const top = Math.max(1, ...days.map((d) => d.members));
  const x = (i: number) => (days.length > 1 ? (i / (days.length - 1)) * W : W / 2);
  const y = (v: number) => H - (v / top) * (H - 8);
  const line = (k: 'players' | 'members') => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const ticks = days.length > 2 ? [days[0], days[Math.floor((days.length - 1) / 2)], days[days.length - 1]] : days;
  const band = W / days.length;
  el.innerHTML = `<div class="trend-head">
      <div><p class="eyebrow">Weekly Players</p><p class="trend-big">${now.players}<span> of ${now.members} members · ${pct}%</span></p></div>
      ${change === null ? '' : `<p class="trend-change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}">${change > 0 ? '▲' : change < 0 ? '▼' : '='} ${change > 0 ? '+' : ''}${change} on last week</p>`}
    </div>
    <svg class="trend-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Weekly Players by day">
      <path class="trend-members" d="${line('members')}" vector-effect="non-scaling-stroke" />
      <path class="trend-area" d="${line('players')} L${x(days.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z" />
      <path class="trend-line" d="${line('players')}" vector-effect="non-scaling-stroke" />
      ${days.map((d, i) => `<rect x="${(x(i) - band / 2).toFixed(1)}" y="0" width="${band.toFixed(1)}" height="${H}" fill="transparent"><title>${label(d.day)}: ${d.players} of ${d.members} played that week</title></rect>`).join('')}
    </svg>
    <div class="trend-axis">${ticks.map((d) => `<span>${label(d.day)}</span>`).join('')}</div>
    <p class="trend-key"><i class="k-players"></i> played a round in the 7 days to that day <i class="k-members"></i> members</p>`;
}

async function load() {
  const body = document.getElementById('adm-body');
  if (!body) return;
  body.classList.add('loading');
  const [data, daily, ever] = await Promise.all([
    api.adminOverview(requireSession(), WINDOW).catch(() => null),
    api.dailyAdmin(requireSession()).catch(() => null),
    // all time, for the table's All time columns
    api.adminOverview(requireSession(), 'all').catch(() => null),
  ]);
  state.ever = new Map((ever?.members ?? []).map((m) => [m.id ?? m.name, { rounds: m.rounds, best: m.best }]));
  // friends members have put up: waiting on you, and the ones who joined lately
  void loadNominations({ many: (data?.clubs.length ?? 0) > 1, who: nameLink, count: (n) => setNeeds('nominations', n) });
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
  // each person once across the clubs (the server's totals); added up from the clubs only if they're missing
  const sum = (k: 'members' | 'active' | 'rounds' | 'practice' | 'newMembers') => d.totals?.[k] ?? d.clubs.reduce((a, c) => a + c[k], 0);
  const guests = d.clubs.reduce((a, c) => a + (c.guests ?? 0), 0);
  const many = d.clubs.length > 1;
  const todo = document.getElementById('adm-todo');
  const todoCard = document.getElementById('adm-feedback-card');
  if (todoCard) todoCard.hidden = !d.feedback.length;
  if (todo) {
    todo.innerHTML = d.feedback.length
      ? `<ul class="adm-list">${d.feedback
          .map(
            (f) =>
              `<li><div>${chip(f.club, many)}<b>${f.from ? nameLink(f.from, d.members.find((m) => m.name === f.from)?.id) : 'A member'}</b> <small>${ago(f.createdAt)}${f.context ? ` · ${esc(f.context)}` : ''}</small><p>${esc(f.body)}</p></div><button class="btn small" data-done="${f.id}">✓ Done</button></li>`,
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
    <section class="adm-card" data-goes="members">
      <div class="adm-head"><h2>Members</h2>${many ? `<div class="adm-chips">${['', ...d.clubs.map((c) => c.name)].map((c) => `<button data-club="${esc(c)}" class="${state.club === c ? 'on' : ''}">${c ? esc(c) : 'All'}</button>`).join('')}</div>` : ''}</div>
      <p class="adm-sum">${sum('members')} members · ${sum('active')} active in the last 7 days · ${sum('rounds')} rounds · ${sum('practice')} practice sessions${sum('newMembers') ? ` · ${sum('newMembers')} new` : ''}</p>
      ${memberTable(d.members, many)}
      <p class="fine">Under each name, when they were last in. Days: days they opened the club, played or practised. Rds: rounds posted. Best: best round to par. Prac: practice sessions. Tap a name for their card.</p>
    </section>
    <section class="adm-card" data-goes="members" id="adm-invites" ${d.invites.length ? '' : 'hidden'}>
      <h2>Invited, not joined yet <small>${d.invites.length}</small></h2>
      ${pending(d, many)}
    </section>
    <section class="adm-card" data-goes="members">
      <h2>History</h2>
      <p class="adm-sum">${d.feed.length >= 1000 ? 'The latest 1,000' : `${d.feed.length} ${d.feed.length === 1 ? 'event' : 'events'}`} in the last 7 days</p>
      ${feed(d, many)}
    </section>`;
  // the Pulse on the Courses home: every club side by side over the last 7 days, and the total
  const pulse = document.getElementById('adm-pulse-clubs');
  if (pulse) {
    const tot = (k: 'members' | 'active' | 'newMembers' | 'rounds' | 'practice' | 'guests') => d.clubs.reduce((a, c) => a + (c[k] ?? 0), 0);
    const pctOf = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
    pulse.innerHTML = `<div class="table-wrap"><table class="practice-table adm-clubs"><thead><tr><th>Club <small>last 7 days</small></th><th class="num">Members</th>${guests ? '<th class="num">Guests</th>' : ''}<th class="num">Active</th><th class="num">New</th><th class="num">Rounds</th><th class="num">Per active</th><th class="num">Practice</th></tr></thead><tbody>${d.clubs
      .map((c) => `<tr><td>${esc(c.name)}</td><td class="num">${c.members}</td>${guests ? `<td class="num">${c.guests ?? 0}</td>` : ''}<td class="num">${c.active} <small>${pctOf(c.active, c.members)}</small></td><td class="num">${c.newMembers}</td><td class="num">${c.rounds}</td><td class="num">${c.active ? Math.round((c.rounds / c.active) * 10) / 10 : '–'}</td><td class="num">${c.practice}</td></tr>`)
      .join('')}${
      many
        ? `<tr class="adm-total"><td><b>Every club</b></td><td class="num"><b>${tot('members')}</b></td>${guests ? `<td class="num">${tot('guests')}</td>` : ''}<td class="num"><b>${tot('active')}</b> <small>${pctOf(tot('active'), tot('members'))}</small></td><td class="num">${tot('newMembers')}</td><td class="num"><b>${tot('rounds')}</b></td><td class="num">${tot('active') ? Math.round((tot('rounds') / tot('active')) * 10) / 10 : '–'}</td><td class="num">${tot('practice')}</td></tr>`
        : ''
    }</tbody></table></div>`;
  }
  const bars = document.getElementById('adm-daily-bars');
  if (bars) {
    bars.innerHTML = dailyBars(state.daily);
    bars.hidden = !state.daily;
  }
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
        if (!c || !(await ask({ title: 'Revoke this invitation?', body: `<p>The link for ${esc(b.dataset.name ?? '')} stops working.</p>`, ok: 'Revoke', danger: true }))) return;
        b.disabled = true;
        try {
          await api.deleteInvite(c, b.dataset.revoke!);
          state.data!.invites = state.data!.invites.filter((i) => i.id !== b.dataset.revoke);
          draw();
        } catch (x) {
          b.disabled = false;
          void tell("That didn't work", `<p>${esc((x as Error).message)}</p>`);
        }
      }),
  );
  arrange(body);
  needs.feedback = d.feedback.length;
  needs.invites = d.invites.length;
  drawNeeds();
}

// ---------- the layout: tabs, with Overview (what needs you, then the numbers) first ----------

const TABS = [
  { id: 'courses', label: 'Courses' },
  { id: 'members', label: 'Members' },
  { id: 'bar', label: 'Bar' },
  { id: 'tools', label: 'Tools' },
] as const;
type Tab = (typeof TABS)[number]['id'];
function showTab(t: Tab, scrollTo?: string) {
  document.querySelectorAll<HTMLElement>('.adm-pane').forEach((p) => (p.hidden = p.dataset.pane !== t));
  document.querySelectorAll<HTMLButtonElement>('#adm-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t)));
  if (scrollTo) document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// each tab has its own address, so the phone's Back button walks back through them
const tabHash = (t: Tab, scrollTo?: string) => {
  if (t === 'courses') navigate('#/admin');
  else navigate(`#/admin/${t}`);
  if (scrollTo) setTimeout(() => document.getElementById(scrollTo)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
};

function bindTabs(t: Tab) {
  document.querySelectorAll<HTMLButtonElement>('#adm-tabs [data-tab]').forEach((b) => (b.onclick = () => tabHash(b.dataset.tab as Tab)));
  showTab(t);
  drawNeeds();
}

// the sections draw() renders go to their tabs (replacing the last lot)
function arrange(body: HTMLElement) {
  document.querySelectorAll('[data-moved]').forEach((x) => x.remove());
  for (const el of [...body.querySelectorAll<HTMLElement>('[data-goes]')]) {
    el.dataset.moved = '1';
    document.querySelector(`.adm-pane[data-pane="${el.dataset.goes}"]`)?.appendChild(el);
  }
}

// "Waiting on you": only what's really yours to do. Feedback nobody has answered, next week with no course picked,
// and a new course that isn't on a week yet. Each a tap to where it's dealt with.
const needs = { feedback: 0, nominations: 0, holes: 0, invites: 0, unplayed: 0, nopick: 0, unplaced: 0 };
export const setNeeds = (k: keyof typeof needs, n: number) => ((needs[k] = n), drawNeeds());
function drawNeeds() {
  const tab = document.querySelector<HTMLButtonElement>('#adm-tabs [data-tab="members"]');
  if (tab) tab.innerHTML = `Members${needs.feedback ? ` <span class="adm-badge">${needs.feedback}</span>` : ''}`;
  const home = document.getElementById('adm-needs');
  if (!home) return;
  const items: [number, string, () => void][] = [
    [needs.feedback, needs.feedback === 1 ? 'piece of feedback to answer' : 'pieces of feedback to answer', () => tabHash('members', 'adm-feedback-card')],
    [needs.nopick, 'Next week has no course picked', () => document.getElementById('jv-coming')?.scrollIntoView({ behavior: 'smooth', block: 'start' })],
    [needs.unplaced, needs.unplaced === 1 ? 'new course not on a week' : 'new courses not on a week', () => document.getElementById('jv-benchh')?.scrollIntoView({ behavior: 'smooth', block: 'start' })],
  ];
  const live = items.filter(([n]) => n > 0);
  home.hidden = !live.length;
  home.innerHTML = live.length ? `<span class="adm-needs-label">Waiting on you</span>${live.map(([n, label], i) => `<button data-need="${i}">${label.startsWith('Next week') ? '' : `<b>${n}</b> `}${label}</button>`).join('')}` : '';
  home.querySelectorAll<HTMLButtonElement>('[data-need]').forEach((x) => (x.onclick = live[Number(x.dataset.need)][2]));
}

// a member's name, as a link to their card when the server sent who they are
export const nameLink = (name: string, id?: string | null) => (id ? `<a class="adm-who" href="${golferHref(id)}">${esc(name)}</a>` : esc(name));
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

function memberTable(all: Members, many: boolean) {
  // one club: no Club column
  const cols = COLUMNS.filter((c) => many || c.key !== 'club');
  const rows = all.filter((m) => !state.club || m.club === state.club || m.guestAt?.includes(state.club));
  if (!rows.length) return '<p class="muted">No members yet.</p>';
  const ever = (m: Members[number]) => state.ever.get(m.id ?? m.name);
  const val = (m: Members[number]) => {
    if (state.sort === 'allRounds') return ever(m)?.rounds ?? 0;
    if (state.sort === 'allBest') return ever(m)?.best ?? null;
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
  const lead = cols.filter((c) => !c.num).length;
  return `<div class="table-wrap"><table class="practice-table adm-members"><thead>
    <tr class="group"><th colspan="${lead}"></th><th colspan="4" class="num">Last 7 days</th><th colspan="2" class="num all">All time</th></tr>
    <tr>${cols.map((c) => `<th data-sort="${c.key}" class="${c.num ? 'num' : ''}${c.key === 'allRounds' ? ' all' : ''}">${c.label}${arrow(c.key)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (m) =>
          `<tr class="${m.days ? '' : 'quiet'}"><td><b>${nameLink(m.name, m.id)}</b><small class="adm-last">${ago(m.lastSeen)}</small></td>${many ? `<td><small>${esc(m.club)}${m.guestAt?.length ? `<br><span class="muted">guest at ${esc(m.guestAt.join(', '))}</span>` : ''}</small></td>` : ''}<td class="num">${m.days}</td><td class="num">${m.rounds}</td><td class="num">${m.best === null ? '–' : toParLabel(m.best)}</td><td class="num">${m.practice}</td><td class="num all">${ever(m)?.rounds ?? '–'}</td><td class="num">${ever(m)?.best == null ? '–' : toParLabel(ever(m)!.best!)}</td></tr>`,
      )
      .join('')}</tbody></table></div>`;
}

const PRACTICE: Record<string, string> = {
  range: 'hit the range',
  shortgame: 'worked the short game',
  caldera: 'practised next week’s course',
};

function feed(d: AdminOverview, many: boolean) {
  if (!d.feed.length) return '<p class="muted">Nothing yet.</p>';
  const line = (e: AdminOverview['feed'][number]) => {
    if (e.kind === 'round') return `posted ${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))}) on ${esc(courseById(e.course ?? '')?.name ?? e.course ?? 'a course')}`;
    if (e.kind === 'classic') return `played ${esc(courseById(e.course ?? '')?.name ?? e.course ?? 'a classic course')}, ${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))}), for the course record`;
    if (e.kind === 'practice') return `${PRACTICE[e.what ?? ''] ?? 'practised'}${e.shots ? ` · ${e.shots} shots` : ''}`;
    if (e.kind === 'quit') return `started a round on ${esc(courseById(e.course ?? '')?.name ?? e.course ?? 'a course')} but didn't finish${e.shots ? ` (stopped on hole ${e.shots})` : ''}`;
    if (e.kind === 'join') return e.what === 'guest' ? 'joined as a guest' : 'joined the club';
    return `sent feedback: “${esc(e.what ?? '')}”`;
  };
  const icon = { round: '⛳', quit: '🚪', practice: '🎯', join: '👋', feedback: '✉️', classic: '🏛️' };
  // everything in the window, newest first, under a heading for each day, in a box that scrolls on its own
  const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: GAME_TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const today = day(new Date().toISOString());
  const yesterday = day(new Date(Date.now() - 86_400_000).toISOString());
  const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: GAME_TZ, hour: 'numeric', minute: '2-digit' });
  let last = '';
  const rows = d.feed
    .map((e) => {
      const dd = day(e.at);
      const head = dd !== last ? `<li class="adm-day">${dd === today ? 'Today' : dd === yesterday ? 'Yesterday' : dd}</li>` : '';
      last = dd;
      return `${head}<li><span class="adm-ico">${icon[e.kind]}</span><div>${chip(e.club, many)}<b>${nameLink(e.name, e.id)}</b> ${line(e)}<small>${time(e.at)}</small></div></li>`;
    })
    .join('');
  return `<div class="adm-feed-box"><ul class="adm-feed">${rows}</ul></div>`;
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
