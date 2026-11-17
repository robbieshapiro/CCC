// The Committee Room's Metrics charts: players per day (in the strip at the top of Metrics) and week over week.
import { api } from '../api';
import type { AdminKpis } from '../api/types';
import { periodName } from '../day';
import { requireSession } from '../state';
import { esc } from '../ui';
import { setNeeds } from './admin';

export const chartSections = () => `<section class="adm-card adm-charts" id="adm-charts" hidden></section>`;

let kpis: AdminKpis | null = null;

export async function loadKpis() {
  kpis = await api.adminKpis(requireSession()).catch(() => kpis);
  if (kpis) drawCharts(kpis);
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function drawCharts(k: AdminKpis) {
  const el = document.getElementById('adm-charts');
  if (!el) return;
  el.innerHTML = weeks(k);
  el.hidden = !el.innerHTML;
  // players per day sits open in the Pulse
  const day = document.getElementById('jv-pulse-chart');
  if (day) {
    day.hidden = false;
    day.innerHTML = perDay(k);
  }
  setNeeds('unplayed', k.neverPlayed14.length);
}

// the last 14 days: who played a round, and who only came in, stacked
function perDay(k: AdminKpis) {
  const top = Math.max(1, ...k.days.map((d) => d.visited));
  const bars = k.days
    .map((d) => {
      const wd = new Date(`${d.day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
      return `<div class="bar" title="${d.day}: ${d.played} played, ${d.visited} in"><i class="b-in" style="height:${pct(d.visited - d.played, top)}%"></i><i class="b-played" style="height:${pct(d.played, top)}%"></i><span>${wd}</span></div>`;
    })
    .join('');
  return `<h3 class="adm-sub">Players per day <small>the last 14 days</small></h3>
    <div class="bars">${bars}</div>
    <p class="trend-key"><i class="k-played"></i> played a round <i class="k-in"></i> came in, didn't play</p>`;
}

// every week so far: players and rounds, and how many of the week before's players came back
function weeks(k: AdminKpis) {
  if (!k.weeks.length) return '';
  const rows = k.weeks
    .slice(-8)
    .reverse()
    .map((w) => `<tr><td>${esc(periodName(w.period))}</td><td class="num">${w.players}</td><td class="num">${w.rounds}</td><td class="num">${w.players ? Math.round((w.rounds / w.players) * 10) / 10 : 0}</td><td class="num">${w.before ? `${pct(w.back, w.before)}%` : '–'}</td></tr>`)
    .join('');
  return `<h3 class="adm-sub">Week over week</h3>
    <div class="table-wrap"><table class="practice-table"><thead><tr><th></th><th class="num">Players</th><th class="num">Rounds</th><th class="num">Per player</th><th class="num">Came back</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
