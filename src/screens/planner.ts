// Admin > Course: the course planner. A lane of weeks (this one locked, the next eight open) and a shelf of every
// course as a tile: its art, holes, par and yardage, the CCC Rating and Slope, members' real results, and quick links.
// Drag a course onto a week to put it on (drag it back to the shelf, or tap the week's ×, to clear it). On a phone,
// tap a course and then a week. Saves through course_schedule, as the old week pickers did.
import { api } from '../api';
import type { CoursePlanner, Snapshot } from '../api/types';
import { tell } from '../dialog';
import { nextStart, periodName } from '../day';
import { courseFor, scheduleOf, tourCourses, type Course } from '../golf3d/courses';
import { ratingOf } from '../golf3d/ratings';
import { SCALE } from '../golf3d/clubs';
import { toParLabel } from '../standings';
import { refresh, requireSession } from '../state';
import { esc, navigate } from '../ui';

const WEEKS = 8;
const short = (c: Course) => c.name.replace(/ Course$/, '');
// each course's look: its colours and an emoji, from its holes' theme
const ART: Record<string, { from: string; to: string; ink: string; emoji: string }> = {
  volcanic: { from: '#3a0f0a', to: '#c4361b', ink: '#ffd2a6', emoji: '🌋' },
  coastal: { from: '#0b3a5a', to: '#e0894a', ink: '#ffe9c9', emoji: '🌊' },
  autumn: { from: '#2a3d1c', to: '#c86a1e', ink: '#ffe3b8', emoji: '🍁' },
  chicago: { from: '#101a33', to: '#4a6aa8', ink: '#dfe8ff', emoji: '🏙️' },
  carnival: { from: '#3a1446', to: '#e8792a', ink: '#ffe6c2', emoji: '🎡' },
  desert: { from: '#5a2e14', to: '#e2a14a', ink: '#fff0d6', emoji: '🌵' },
  links: { from: '#1f3a2c', to: '#7fa36a', ink: '#eef6e4', emoji: '⛰️' },
};
const artOf = (c: Course) => ART[c.holes[0]?.theme ?? ''] ?? ART.links;
const yards = (c: Course) => c.holes.reduce((a, h) => a + (h.yards ?? Math.round((Math.hypot(h.cup.x - h.tee.x, h.cup.y - h.tee.y) * SCALE) / 3)), 0);

let info: CoursePlanner = { approved: {}, results: {} };

function tile(c: Course, opts: { small?: boolean; week?: string } = {}) {
  const a = artOf(c);
  const r = ratingOf(c);
  const res = info.results[c.id];
  const approved = !!info.approved[c.id];
  const chips = [
    c.draft ? (approved ? '<i class="pl-chip ok">Approved</i>' : '<i class="pl-chip draft">Draft</i>') : '<i class="pl-chip">Released</i>',
    res ? `<i class="pl-chip">Played ${res.weeks.map((w) => periodName(w).replace(/^Week of /, '')).join(', ')}</i>` : '<i class="pl-chip new">Never played</i>',
  ].join('');
  return `<article class="pl-tile${opts.small ? ' small' : ''}" data-course="${c.id}" ${opts.week ? `data-from-week="${opts.week}"` : ''} style="--from:${a.from};--to:${a.to};--ink:${a.ink}">
    <div class="pl-art"><span class="pl-emoji" aria-hidden="true">${a.emoji}</span><b>${esc(short(c))}</b><small>${c.holes.length} holes · par ${c.par} · ${yards(c).toLocaleString('en-US')} yd</small></div>
    ${
      opts.small
        ? ''
        : `<div class="pl-body">
      <div class="pl-chips">${chips}</div>
      <dl class="pl-stats">
        <div><dt>CCC Rating</dt><dd>${r ? r.rating.toFixed(1) : '–'}</dd></div>
        <div><dt>Slope</dt><dd>${r ? r.slope : '–'}</dd></div>
        <div><dt>Members</dt><dd>${res ? toParLabel(res.avg) : '–'}</dd></div>
      </dl>
      <p class="pl-line">${
        res ? `${res.rounds} rounds from ${res.members} ${res.members === 1 ? 'member' : 'members'} · best ${toParLabel(res.best)}${res.bestBy ? ` by ${esc(res.bestBy)}` : ''}` : 'No member rounds yet'
      }${r?.hardest ? ` · hardest for the robot: ${esc(r.hardest)}` : ''}</p>
      <p class="pl-holes">${c.holes.map((h, i) => `<span>${i + 1} ${esc(h.name)} <em>${h.par}</em></span>`).join('')}</p>
      <div class="pl-acts">
        <a href="#/preview/${c.id}">▶ Preview</a>
        <a href="#/practice/${c.id}">Practice</a>
        ${c.id.startsWith('room-') ? `<a href="#/room/${c.id.slice(5)}">🛰️ Edit</a>` : ''}
        ${c.draft ? `<button data-approve="${c.id}">${approved ? 'Un-approve' : '✓ Approve'}</button>` : ''}
      </div>
      ${r ? `<small class="pl-fine">Robot rated ${esc(r.at)}</small>` : ''}
    </div>`
    }
  </article>`;
}

export function plannerSection() {
  return `<section class="adm-card pl" id="pl"><h2>Plan the weeks</h2>
    <p class="muted">Pick each week's course from its list. With a mouse you can also drag a course from the shelf onto a week. It takes effect for everyone at once.</p>
    <div id="pl-body"><p class="muted">Loading…</p></div></section>`;
}

function draw(snap: Snapshot) {
  const body = document.getElementById('pl-body');
  if (!body) return;
  const picks = scheduleOf();
  const now = courseFor(snap.month);
  const weeks: string[] = [];
  let p = snap.month;
  for (let i = 0; i < WEEKS; i++) weeks.push((p = nextStart(p)));
  const all = tourCourses();
  body.innerHTML = `
    <ol class="pl-lane">
      <li class="pl-week now"><header><b>${esc(periodName(snap.month).replace(/^Week of /, ''))}</b><small>Playing now</small></header>${tile(now, { small: true })}</li>
      ${weeks
        .map((w) => {
          const c = picks[w] ? all.find((x) => x.id === picks[w]) : null;
          const carries = courseFor(w, false);
          return `<li class="pl-week${c ? ' set' : ''}" data-week="${w}"><header><b>${esc(periodName(w).replace(/^Week of /, ''))}</b>${c ? `<button class="pl-x" data-clear="${w}" aria-label="Clear this week">×</button>` : '<small>Carries on</small>'}</header>
            <select class="pl-pick" data-week-pick="${w}" aria-label="Course for this week"><option value="">${c ? 'Carry on (clear the pick)' : `Carries on: ${esc(short(carries))}`}</option>${all
              .map((x) => `<option value="${x.id}" ${c?.id === x.id ? 'selected' : ''}>${esc(short(x))}${x.draft ? ' (draft)' : ''}</option>`)
              .join('')}</select>${
            c ? tile(c, { small: true, week: w }) : `<div class="pl-empty">${esc(short(carries))}<br><small>carries on</small></div>`
          }</li>`;
        })
        .join('')}
    </ol>
    <h3 class="pl-shelf-h">The shelf</h3>
    <div class="pl-shelf" id="pl-shelf">${all.map((c) => tile(c)).join('')}</div>`;
  bind(snap);
}

async function place(snap: Snapshot, week: string, course: string | null) {
  try {
    await api.setCourseSchedule(requireSession(), week, course);
    await refresh();
  } catch (e) {
    void tell("That didn't save", `<p>${esc((e as Error).message)}</p>`);
  }
  draw(snap);
}

function bind(snap: Snapshot) {
  const body = document.getElementById('pl-body')!;
  body.querySelectorAll<HTMLButtonElement>('[data-clear]').forEach((b) => (b.onclick = (e) => (e.stopPropagation(), void place(snap, b.dataset.clear!, null))));
  body.querySelectorAll<HTMLButtonElement>('[data-approve]').forEach(
    (b) =>
      (b.onclick = async (e) => {
        e.stopPropagation();
        const id = b.dataset.approve!;
        await api.setCourseApproved(requireSession(), id, !info.approved[id]).catch(() => {});
        info = await api.coursePlanner(requireSession());
        draw(snap);
      }),
  );
  // each week's list: works on any device
  body.querySelectorAll<HTMLSelectElement>('[data-week-pick]').forEach((sel) => (sel.onchange = () => void place(snap, sel.dataset.weekPick!, sel.value || null)));
  // with a mouse, a tile can also be dragged onto a week (a finger scrolls the page instead)
  body.querySelectorAll<HTMLElement>('.pl-tile[data-course]').forEach((t) => {
    if (t.closest('.pl-week.now')) return;
    t.onpointerdown = (e) => {
      if (e.pointerType !== 'mouse' || (e.target as HTMLElement).closest('a, button, select')) return;
      const startX = e.clientX, startY = e.clientY;
      let ghost: HTMLElement | null = null;
      const move = (m: PointerEvent) => {
        if (!ghost && Math.hypot(m.clientX - startX, m.clientY - startY) < 8) return;
        if (!ghost) {
          ghost = t.cloneNode(true) as HTMLElement;
          ghost.classList.add('pl-ghost');
          ghost.style.width = `${Math.min(220, t.getBoundingClientRect().width)}px`;
          document.body.appendChild(ghost);
        }
        m.preventDefault();
        ghost.style.left = `${m.clientX}px`;
        ghost.style.top = `${m.clientY}px`;
        body.querySelectorAll('.pl-week.over').forEach((x) => x.classList.remove('over'));
        ghost.hidden = true;
        document.elementFromPoint(m.clientX, m.clientY)?.closest('.pl-week[data-week]')?.classList.add('over');
        ghost.hidden = false;
      };
      const up = (u: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        body.querySelectorAll('.pl-week.over').forEach((x) => x.classList.remove('over'));
        if (!ghost) return;
        ghost.remove();
        const target = document.elementFromPoint(u.clientX, u.clientY);
        const week = target?.closest<HTMLElement>('.pl-week[data-week]')?.dataset.week;
        if (week) void place(snap, week, t.dataset.course!);
        else if (t.dataset.fromWeek && target?.closest('#pl-shelf')) void place(snap, t.dataset.fromWeek, null);
      };
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
    };
  });
}

export async function bindPlanner(snap: Snapshot) {
  info = await api.coursePlanner(requireSession()).catch(() => ({ approved: {}, results: {} }));
  draw(snap);
  void navigate;
}
