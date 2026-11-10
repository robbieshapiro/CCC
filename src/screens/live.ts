// Home, live: who's out on the course right now and today's cards, from every club, and the Open as a simple list
// (place, name, club, cards, money, to par) with a tag on anyone still out. Each section shows only once there's
// something in it. Refreshed every 30 seconds while home is open; the hole-by-hole scorecards stay a tap away.
import { api } from '../api';
import type { FieldRow, OpenRow, Snapshot } from '../api/types';
import { portrait } from '../avatar';
import type { Course } from '../golf3d/courses';
import { money, openPurse } from '../purse';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';

// the sections home puts in place; they stay hidden until there's someone in them
export const liveNow = () => `<section class="lv-panel" id="live-now" hidden></section>`;
export const liveCards = () => `<section class="lv-panel" id="live-cards" hidden></section>`;

type Tab = 'open' | 'club';
let field: FieldRow[] | null = null;
let practised: { playerId: string; name: string; club: string; mine: boolean }[] | null = null;
let open: OpenRow[] | null = null;
let tab: Tab = 'open';
let detail = false;
let seen: Set<string> | null = null; // the cards already shown, so a new one can slide in
let timer = 0;
let ctx: { snap: Snapshot; course: Course } | null = null;

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};
const parTo = (course: Course, n: number) => course.holes.slice(0, n).reduce((a, h) => a + h.par, 0);
const toParOf = (course: Course, holes: number[]) => holes.reduce((a, b) => a + b, 0) - parTo(course, holes.length);
const sq = (s: number, par: number) => (s <= par - 1 ? 'b' : s === par ? 'p' : s === par + 1 ? 'o' : 'd');

export async function bindLive(snap: Snapshot, course: Course) {
  ctx = { snap, course };
  draw(); // what we had, at once, so a redraw of home doesn't flash empty
  await fetchLive();
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    if (!document.getElementById('board-list')) return window.clearInterval(timer);
    if (document.visibilityState === 'visible') void fetchLive();
  }, 30_000);
}

async function fetchLive() {
  if (!ctx) return;
  const s = requireSession();
  const [f, o, pr] = await Promise.all([api.courseField(s, ctx.course.id).catch(() => field), api.openBoard(s).catch(() => open), api.coursePractice(s).catch(() => practised)]);
  field = f;
  open = o;
  practised = pr;
  draw();
}

function draw() {
  if (!ctx) return;
  const { snap, course } = ctx;
  const tag = (r: { club: string }) => (r.club !== snap.groupName ? `<span class="lv-club">${esc(r.club)}</span>` : '');
  const who = (r: FieldRow) => `<a class="lv-who" href="${golferHref(r.playerId, r.mine)}">${r.mine ? 'You' : esc(r.name)}</a>`;

  // out on the course: a card started today and not yet in
  const going = (field ?? []).filter((r) => r.going);
  const now = document.getElementById('live-now');
  if (now) {
    now.hidden = !going.length;
    now.innerHTML = going.length
      ? `<h3><span class="lv-dot"></span>On the course now <small>${going.length} out</small></h3>
        <div class="lv-now">${going
          .map((r) => {
            const n = r.holes.length;
            return `<div class="lv-golfer"><span class="lv-av">${portrait(r.avatar, 36)}</span><div><b>${who(r)}${tag(r)}</b><span>On hole ${Math.min(n + 1, course.holes.length)} of ${course.holes.length}</span>
              <span class="lv-holes">${course.holes.map((_, i) => `<i class="${i < n ? 'done' : i === n ? 'now' : ''}"></i>`).join('')}</span></div><em>${n ? toParLabel(toParOf(course, r.holes)) : '–'}</em></div>`;
          })
          .join('')}</div>`
      : '';
  }
  // the line in the Play banner: who else is out there
  const out = document.getElementById('who-out');
  if (out) {
    const names = going.filter((r) => !r.mine).map((r) => r.name);
    out.hidden = !names.length;
    const list = names.length > 3 ? `${names.slice(0, 3).join(', ')} and ${names.length - 3} more` : names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0] ?? '';
    out.innerHTML = names.length ? `<span class="lv-dot"></span>${esc(list)} ${names.length > 1 ? 'are' : 'is'} out on the course` : '';
  }

  // today's cards (each person's better card, also while they're out on their second), newest first, and under them a
  // quiet line of who practised the course today
  const done = (field ?? [])
    .flatMap((r) => (!r.going ? [r] : r.best?.length ? [{ ...r, going: false, holes: r.best, at: r.bestAt ?? r.at }] : []))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const prac = practised ?? [];
  const cards = document.getElementById('live-cards');
  if (cards) {
    cards.hidden = !done.length && !prac.length;
    const before = seen;
    seen = new Set(done.map((r) => r.playerId));
    const names = prac.slice(0, 8).map((r) => `<a class="lv-who${r.mine ? ' me' : ''}" href="${golferHref(r.playerId, r.mine)}">${r.mine ? 'You' : esc(r.name)}</a>`).join(' · ');
    const practice = prac.length ? `<p class="lv-practice"><b>⛳ Practised today</b> ${names}${prac.length > 8 ? ` · +${prac.length - 8} more` : ''}</p>` : '';
    cards.innerHTML = !done.length
      ? practice
      : `<h3>Today's cards <small>${done.length} in today</small></h3>
        <div class="lv-cards">${done
          .map((r) => {
            const t = toParOf(course, r.holes);
            return `<div class="lv-card${r.mine ? ' me' : ''}${before && !before.has(r.playerId) ? ' new' : ''}"><span class="lv-tp ${t < 0 ? 'under' : t > 0 ? 'over' : ''}">${toParLabel(t)}</span><b>${who(r)}${tag(r)}</b><small>${r.holes.reduce((a, b) => a + b, 0)} · ${ago(r.at)}${(r.cards ?? 1) > 1 ? ' · better of 2' : ''}</small>
              <span class="lv-sq">${r.holes.map((s, i) => `<i class="${sq(s, course.holes[i]?.par ?? 4)}"></i>`).join('')}</span></div>`;
          })
          .join('')}</div>${practice}`;
  }

  drawBoard();
}

// the Open as a list; "My club" is the same list cut to the people with a seat in this club, ranked among themselves
function drawBoard() {
  const el = document.getElementById('board-list');
  if (!el || !ctx) return;
  const tabs = document.getElementById('board-tabs');
  const more = document.getElementById('board-more');
  const openPane = document.getElementById('board-open');
  const clubPane = document.getElementById('board-club');
  // the Open couldn't load: the club's own scorecard is all there is
  if (!open) {
    el.hidden = true;
    if (tabs) tabs.hidden = true;
    if (more) more.hidden = true;
    if (clubPane) clubPane.hidden = false;
    return;
  }
  const all = [...open].sort((a, b) => a.total - a.par - (b.total - b.par) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const pay = openPurse(all).pay;
  const rows = tab === 'open' ? all : all.filter((r) => r.mine || r.localId);
  const out = new Set((field ?? []).filter((r) => r.going).map((r) => r.playerId));
  const shown = rows.slice(0, tab === 'open' ? 10 : 30);
  let place = 0;
  el.hidden = false;
  el.innerHTML = shown.length
    ? `<table class="lv-board"><tbody>${shown
        .map((r, i) => {
          const tp = r.total - r.par;
          if (i === 0 || tp !== shown[i - 1].total - shown[i - 1].par) place = i + 1;
          const tied = rows.filter((x) => x.total - x.par === tp).length > 1;
          const won = pay.get(r.playerId)?.payout;
          const link = golferHref(r.playerId, r.mine);
          const name = `<b>${esc(r.name)}</b><small>${tab === 'open' ? `${esc(r.club)} · ` : ''}${r.rounds} ${r.rounds === 1 ? 'card' : 'cards'}${out.has(r.playerId) ? ' · <span class="lv-on">on the course</span>' : ''}</small>`;
          return `<tr class="${r.mine ? 'me ' : ''}${place === 1 ? 'lead' : ''}"><td class="pos">${tied ? 'T' : ''}${place}</td><td class="nm">${link ? `<a href="${link}">${name}</a>` : name}</td><td class="pay">${won ? money(won) : ''}</td><td class="tp">${toParLabel(tp)}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : `<p class="muted lv-empty">${tab === 'open' ? 'Nobody has posted a card yet, in any club. The first one leads the Open.' : 'Nobody from this club has posted a card yet.'}</p>`;
  if (tabs) {
    tabs.hidden = false;
    tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
      b.onclick = () => {
        tab = b.dataset.tab as Tab;
        drawBoard();
      };
    });
  }
  // hole by hole: the scorecard for whichever tab is showing
  if (openPane) openPane.hidden = !detail || tab !== 'open';
  if (clubPane) clubPane.hidden = !detail || tab !== 'club';
  if (more) {
    more.hidden = false;
    more.textContent = detail ? 'Hide the scorecard' : 'See hole by hole';
    more.onclick = () => {
      detail = !detail;
      drawBoard();
      window.dispatchEvent(new Event('resize')); // the club scorecard sets its frozen columns once it's on show
    };
  }
}
