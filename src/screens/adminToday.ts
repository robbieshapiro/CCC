// The Committee Room's Overview, built around today: how many are in, who (each person once, with where their card
// stands), and the live feed, refreshed every minute while the page is open. Everything else sits under "More numbers".
import { api } from '../api';
import type { AdminToday, AdminTodayEvent, AdminTodayPerson } from '../api/types';
import { GAME_TZ } from '../day';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc } from '../ui';

export const todaySections = () => `<section class="adm-today" id="adm-today"><p class="muted">Loading today…</p></section>
  <section class="adm-card adm-live" id="adm-live"><h2>Live feed <small>today</small></h2><p class="muted">Loading…</p></section>`;

let data: AdminToday | null = null;
let weekAgo: number | null = null;
let timer = 0;

// the same day last week, from the headline numbers when they arrive
export function setWeekAgo(n: number) {
  weekAgo = n;
  draw();
}

export async function loadToday() {
  data = await api.adminToday(requireSession()).catch(() => data);
  draw();
  window.clearInterval(timer);
  timer = window.setInterval(() => {
    // stop once the Committee Room is gone
    if (!document.getElementById('adm-today')) return window.clearInterval(timer);
    if (document.visibilityState === 'visible') void api.adminToday(requireSession()).then((d) => ((data = d), draw())).catch(() => {});
  }, 60_000);
}

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('en-US', { timeZone: GAME_TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', '') : '');

function status(p: AdminTodayPerson) {
  const extras = [p.practice ? `practised${p.practice > 1 ? ` ×${p.practice}` : ''}` : '', p.daily ? `Daily Shot${p.dailyFt === 0 ? ' holed!' : p.dailyFt !== null ? ` ${p.dailyFt} ft` : ''}` : ''].filter(Boolean);
  const main =
    p.card === 'in'
      ? `<span class="tw-card in">✅ Card in, ${toParLabel(p.toPar ?? 0)}</span>`
      : p.card === 'going'
        ? `<span class="tw-card going">⛳ On the course, hole ${p.hole}</span>`
        : extras.length
          ? ''
          : '<span class="tw-card look">👀 Looked in</span>';
  return [main, ...extras.map(esc)].filter(Boolean).join(' · ');
}

function line(e: AdminTodayEvent) {
  if (e.kind === 'round') return `posted <b>${e.total} (${toParLabel((e.total ?? 0) - (e.par ?? 0))})</b> on today's card`;
  if (e.kind === 'start') return `teed off on today's card`;
  if (e.kind === 'practice') {
    const what = { course: 'practised the course', range: 'hit the range', shortgame: 'worked the short game', caldera: 'practised the preview' }[e.what ?? ''] ?? 'practised';
    return `${what}${e.n ? ` · ${e.n} shots` : ''}`;
  }
  if (e.kind === 'daily') return e.ft === 0 ? 'holed the Daily Shot!' : `took the Daily Shot${e.ft !== null ? `, best ${e.ft} ft` : ''}${e.n && e.n > 1 ? ` (${e.n} tries)` : ''}`;
  if (e.kind === 'playoff') return `played the playoff in ${e.total ?? '?'}${e.ft !== null ? `, ${e.ft} ft from the pin` : ''}`;
  if (e.kind === 'join') return e.what === 'guest' ? `joined ${esc(e.club)} as a guest` : 'joined the club';
  return `sent feedback: “${esc(e.what ?? '')}”`;
}
const ICON: Record<AdminTodayEvent['kind'], string> = { round: '✅', start: '⛳', practice: '🎯', daily: '📍', playoff: '🏆', join: '👋', feedback: '✉️' };

function draw() {
  const top = document.getElementById('adm-today');
  const live = document.getElementById('adm-live');
  if (!top || !live) return;
  const d = data;
  if (!d) {
    top.innerHTML = `<p class="muted">Today shows up once its SQL has been run in Supabase.</p>`;
    live.innerHTML = '<h2>Live feed</h2><p class="muted">Nothing yet.</p>';
    return;
  }
  const many = new Set(d.people.map((p) => p.club)).size > 1;
  const looked = d.in - d.cardsIn - d.onCourse;
  const change = weekAgo === null ? '' : `<em class="${d.in > weekAgo ? 'up' : d.in < weekAgo ? 'down' : ''}">${d.in > weekAgo ? '▲' : d.in < weekAgo ? '▼' : '='} ${weekAgo} this day last week</em>`;
  top.innerHTML = `
    <div class="tw-hero"><b>${d.in}</b><div><span>in today</span><small>${d.cardsIn} ${d.cardsIn === 1 ? 'card' : 'cards'} in · ${d.onCourse} on the course · ${looked} just looked in or practised</small>${change}</div></div>
    <h2 class="tw-head">Who's in today</h2>
    ${
      d.people.length
        ? `<ul class="tw-who">${d.people
            .map((p) => `<li><div><b>${esc(p.name)}</b>${many ? `<span class="adm-club">${esc(p.club)}</span>` : ''}<small>${status(p)}</small></div><time>${time(p.last)}</time></li>`)
            .join('')}</ul>`
        : '<p class="muted">Nobody yet today.</p>'
    }`;
  live.innerHTML = `<h2>Live feed <small>today · updates every minute</small></h2>${
    d.feed.length
      ? `<div class="adm-feed-box"><ul class="adm-feed">${d.feed
          .map((e) => `<li><span class="adm-ico">${ICON[e.kind]}</span><div>${many ? `<span class="adm-club">${esc(e.club)}</span>` : ''}<b>${esc(e.name)}</b> ${line(e)}<small>${time(e.at)}</small></div></li>`)
          .join('')}</ul></div>`
      : '<p class="muted">Nothing yet today.</p>'
  }`;
}
