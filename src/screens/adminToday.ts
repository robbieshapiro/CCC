// The Committee Room's Overview, built around today: how many are in, who (each person once, with where their card
// stands), and the live feed. It's meant to feel live: refreshed every 30 seconds while the page is open, a blinking dot
// on anyone out on the course, new events sliding in lit up, times that count up ("4m ago"), and a feed that drifts
// slowly down on its own (flick it back to the top and a moment later it drifts down again). Every name opens that
// member's card. Everything else sits under "Numbers".
import { api } from '../api';
import type { AdminToday, AdminTodayEvent, AdminTodayPerson } from '../api/types';
import { GAME_TZ } from '../day';
import { courseById } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';

export const todaySections = () => `<section class="adm-today" id="adm-today"><p class="muted">Loading today…</p></section>
  <section class="adm-card adm-live" id="adm-live"><h2><span class="live-pill"><i></i>Live</span> Today's feed <small id="live-sub"></small></h2><div class="adm-feed-box live-box" id="live-box"><p class="muted">Loading…</p></div></section>`;

let data: AdminToday | null = null;
let weekAgo: number | null = null;
let timer = 0;
let ticker = 0;
let seen: Set<string> | null = null; // the feed as last drawn, so what's new can light up
let lastIn: number | null = null;
let fetchedAt = 0;

// the same day last week, from the headline numbers when they arrive
export function setWeekAgo(n: number) {
  weekAgo = n;
  draw();
}

async function fetchToday() {
  data = await api.adminToday(requireSession()).catch(() => data);
  fetchedAt = Date.now();
  draw();
}

export async function loadToday() {
  seen = null;
  lastIn = null;
  await fetchToday();
  window.clearInterval(timer);
  window.clearInterval(ticker);
  timer = window.setInterval(() => {
    // stop once the Committee Room is gone
    if (!document.getElementById('adm-today')) return window.clearInterval(timer);
    if (document.visibilityState === 'visible') void fetchToday();
  }, 30_000);
  // the times count up, and "updated" with them, between refreshes
  ticker = window.setInterval(() => {
    if (!document.getElementById('adm-live')) return window.clearInterval(ticker);
    document.querySelectorAll<HTMLElement>('[data-ago]').forEach((el) => (el.textContent = ago(el.dataset.ago!)));
    const sub = document.getElementById('live-sub');
    if (sub && fetchedAt) sub.textContent = `updated ${ago(new Date(fetchedAt).toISOString())}`;
  }, 5_000);
  drift();
}

const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m ago`;
};
const who = (name: string, id?: string) => (id ? `<a class="adm-who" href="${golferHref(id)}">${esc(name)}</a>` : esc(name));
const key = (e: AdminTodayEvent) => `${e.at}|${e.kind}|${e.name}`;
// someone teed off in the last few minutes and hasn't posted: likely still out there
const fresh = (iso: string | null, mins: number) => !!iso && Date.now() - Date.parse(iso) < mins * 60_000;

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: GAME_TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '') : '');

function status(p: AdminTodayPerson) {
  const extras = [p.practice ? `practised${p.practice > 1 ? ` ×${p.practice}` : ''}` : '', p.daily ? `Daily Shot${p.dailyFt === 0 ? ' holed!' : p.dailyFt !== null ? ` ${p.dailyFt} ft` : ''}` : ''].filter(Boolean);
  const main =
    p.card === 'in'
      ? `<span class="tw-card in">✅ ${(p.cards ?? 1) > 1 ? `Both cards in, best ${toParLabel(p.toPar ?? 0)}` : `Card in, ${toParLabel(p.toPar ?? 0)}`}</span>`
      : p.card === 'going'
        ? `<span class="tw-card going">⛳ ${p.cards ? `Card ${p.cards + 1}, ` : 'On the course, '}hole ${p.hole}${p.cards ? ` (card 1: ${toParLabel(p.toPar ?? 0)})` : ''}</span>`
        : extras.length
          ? ''
          : '<span class="tw-card look">👀 Looked in</span>';
  return [main, ...extras.map(esc)].filter(Boolean).join(' · ');
}

function line(e: AdminTodayEvent) {
  if (e.kind === 'round') return `posted <b>${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))})</b> on today's card`;
  if (e.kind === 'start') return `teed off on today's card`;
  if (e.kind === 'practice') {
    const what = { course: 'practised the course', range: 'hit the range', shortgame: 'worked the short game', caldera: 'practised next week’s course' }[e.what ?? ''] ?? 'practised';
    return `${what}${e.n ? ` · ${e.n} shots` : ''}`;
  }
  if (e.kind === 'classic') return `played ${esc(courseById(e.what ?? '')?.name ?? e.what ?? 'a classic course')}, <b>${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))})</b>, for the course record`;
  if (e.kind === 'daily') return e.ft === 0 ? 'holed the Daily Shot!' : `took the Daily Shot${e.ft !== null ? `, best ${e.ft} ft` : ''}${e.n && e.n > 1 ? ` (${e.n} tries)` : ''}`;
  if (e.kind === 'playoff') return `played the playoff in ${e.total ?? '?'}${e.ft !== null ? `, ${e.ft} ft from the pin` : ''}`;
  if (e.kind === 'join') return e.what === 'guest' ? `joined ${esc(e.club)} as a guest` : 'joined the club';
  return `sent feedback: “${esc(e.what ?? '')}”`;
}
const ICON: Record<AdminTodayEvent['kind'], string> = { round: '✅', start: '⛳', practice: '🎯', daily: '📍', playoff: '🏆', join: '👋', feedback: '✉️', classic: '🏛️' };

function draw() {
  const top = document.getElementById('adm-today');
  const box = document.getElementById('live-box');
  const sub = document.getElementById('live-sub');
  if (!top || !box) return;
  const d = data;
  if (!d) {
    top.innerHTML = `<p class="muted">Today shows up once its SQL has been run in Supabase.</p>`;
    box.innerHTML = '<p class="muted">Nothing yet.</p>';
    return;
  }
  const many = new Set(d.people.map((p) => p.club)).size > 1;
  const looked = d.in - d.cardsIn - d.onCourse;
  const change = weekAgo === null ? '' : `<em class="${d.in > weekAgo ? 'up' : d.in < weekAgo ? 'down' : ''}">${d.in > weekAgo ? '▲' : d.in < weekAgo ? '▼' : '='} ${weekAgo} this day last week</em>`;
  const bumped = lastIn !== null && d.in !== lastIn;
  lastIn = d.in;
  // out on the course first, then the most recent
  const people = [...d.people].sort((a, b) => Number(b.card === 'going') - Number(a.card === 'going'));
  top.innerHTML = `
    <div class="tw-hero"><b class="${bumped ? 'bump' : ''}">${d.in}</b><div><span>in today</span><small>${d.cardsIn} ${d.cardsIn === 1 ? 'card' : 'cards'} in · <span class="tw-live">${d.onCourse ? '<i class="dot"></i>' : ''}${d.onCourse} on the course</span> · ${looked} just looked in or practised</small>${change}</div></div>
    <h2 class="tw-head">Who's in today</h2>
    ${
      people.length
        ? `<ul class="tw-who">${people
            .map(
              (p) =>
                `<li class="${p.card === 'going' ? 'going' : ''}"><div><b>${p.card === 'going' ? '<i class="dot"></i>' : fresh(p.last, 10) ? '<i class="dot soft"></i>' : ''}${who(p.name, p.id)}</b>${many ? `<span class="adm-club">${esc(p.club)}</span>` : ''}<small>${status(p)}</small></div><time${p.last ? ` data-ago="${p.last}"` : ''}>${p.last ? ago(p.last) : ''}</time></li>`,
            )
            .join('')}</ul>`
        : '<p class="muted">Nobody yet today.</p>'
    }`;
  if (sub) sub.textContent = 'updated just now';
  const before = seen;
  seen = new Set(d.feed.map(key));
  const kept = box.scrollTop;
  box.innerHTML = d.feed.length
    ? `<ul class="adm-feed live-feed">${d.feed
        .map((e) => {
          const isNew = before !== null && !before.has(key(e));
          return `<li class="k-${e.kind}${isNew ? ' new' : ''}"><span class="adm-ico">${ICON[e.kind]}</span><div>${many ? `<span class="adm-club">${esc(e.club)}</span>` : ''}<b>${who(e.name, e.id)}</b> ${line(e)}<small>${time(e.at)} · <span data-ago="${e.at}">${ago(e.at)}</span></small></div></li>`;
        })
        .join('')}</ul>`
    : '<p class="muted">Nothing yet today. It fills in as members come in.</p>';
  // something new: back to the top to show it; otherwise stay where the drift had got to
  box.scrollTop = before && d.feed.some((e) => !before.has(key(e))) ? 0 : kept;
}

// The feed drifts slowly down on its own, about 12 pixels a second, and rests at the bottom. Scroll it yourself (say,
// flick it back to the top) and it waits a couple of seconds after you let go, then drifts down again from wherever you
// left it. Something new arriving puts it back at the top to start over. It doesn't move at all for anyone who prefers
// reduced motion.
let drifting = 0;
function drift() {
  window.cancelAnimationFrame(drifting);
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  let pausedUntil = 0;
  let pos = -1;
  let last = 0;
  const hold = (ms: number) => (pausedUntil = Math.max(pausedUntil, performance.now() + ms));
  const box0 = document.getElementById('live-box');
  if (box0) {
    // a finger on it, or a wheel: wait while they're at it, then a beat after
    for (const ev of ['pointerdown', 'touchstart', 'wheel']) box0.addEventListener(ev, () => hold(2_500), { passive: true });
    box0.addEventListener('mouseenter', () => hold(60_000));
    box0.addEventListener('mouseleave', () => (pausedUntil = performance.now() + 1_500));
  }
  const step = (t: number) => {
    const box = document.getElementById('live-box');
    if (!box) return;
    drifting = window.requestAnimationFrame(step);
    const dt = last ? Math.min(100, t - last) : 0;
    last = t;
    const room = box.scrollHeight - box.clientHeight;
    // moved by someone else (their own scroll, momentum, or a refresh): hold a beat, then carry on from there
    if (pos >= 0 && Math.abs(box.scrollTop - pos) > 2) {
      pos = box.scrollTop;
      return hold(2_000);
    }
    if (room < 8 || t < pausedUntil || document.visibilityState !== 'visible') return (pos = box.scrollTop);
    if (pos < 0) pos = box.scrollTop;
    if (pos >= room) return (pos = box.scrollTop); // rest at the bottom
    pos = Math.min(room, pos + dt * 0.012);
    box.scrollTop = pos;
  };
  drifting = window.requestAnimationFrame(step);
}
