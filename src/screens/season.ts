// The Season: FedEx Cup style points from every week's Open finish, the year so far, as a Clubhouse tab. Banked points
// from closed weeks, with this week's place shown as projected until it closes. Each row shows the golfer's Open wins
// and career earnings, and opens their card (golfer.ts), whatever club they're in.
import { api } from '../api';
import type { Season, Snapshot } from '../api/types';
import { courseFor } from '../golf3d/courses';
import { SEASON_FLOOR, SEASON_POINTS, openName } from '../season';
import { money, placeLabel } from '../purse';
import { requireSession } from '../state';
import { esc } from '../ui';

export function seasonPane(snap: Snapshot) {
  return `
    <div class="ch-head"><h1 id="season-h">The ${snap.month.slice(0, 4)} Season</h1><p class="muted">Points from every course, like the FedEx Cup: the Highlands, the Caldera, then every week's Open. This week: ${esc(openName(courseFor(snap.month).name, snap.month))}. Tap anyone for their card.</p></div>
    <section class="season-card" id="season-board"><p class="muted">Loading the standings…</p></section>
    <section class="season-scale">
      <h2>How points work</h2>
      <p>Your best card of the week sets your place on the Open, across every club. The place earns points when the week closes on Saturday night; until then they show as projected and don't count in the standings. The Highlands and the Caldera count too, each ranked across every club.</p>
      <ol class="scale">${SEASON_POINTS.slice(0, 10)
        .map((p, i) => `<li><span>${placeLabel(i + 1, false)}</span><b>${p}</b></li>`)
        .join('')}</ol>
      <p class="fine">11th to 20th: ${SEASON_POINTS.slice(10).join(', ')}. Everyone else who posts a card that week: ${SEASON_FLOOR}. Ties share the points for the places they cover. Wins are Open wins. Earnings are career: every purse and club bonus.</p>
    </section>`;
}

export async function fillSeason() {
  const s: Season | null = await api.seasonStandings(requireSession()).catch(() => null);
  const el = document.getElementById('season-board');
  if (!el) return;
  if (!s) {
    el.innerHTML = '<p class="muted">The standings aren’t open yet. Check back soon.</p>';
    return;
  }
  const h = document.getElementById('season-h');
  if (h) h.textContent = `The ${s.year} Season`;
  if (!s.standings.length) {
    el.innerHTML = '<p class="muted">No points yet. The first card of the week starts the race.</p>';
    return;
  }
  // the standings are banked points only; this week's place shows as projected underneath
  const total = (r: Season['standings'][number]) => r.points;
  let place = 0;
  el.innerHTML = `<div class="table-wrap"><table class="season-table">
    <thead><tr><th></th><th>Member</th><th class="num wins">Wins</th><th class="num earn">Earnings</th><th class="num">Points</th></tr></thead>
    <tbody>${s.standings
      .map((r, i) => {
        if (i === 0 || total(r) !== total(s.standings[i - 1])) place = i + 1;
        const sub = [esc(r.club), r.events ? `${r.events} wk${r.events === 1 ? '' : 's'}` : '', r.top10s ? `${r.top10s} top 10${r.top10s === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
        const href = r.mine ? '#/locker' : `#/golfer/${r.playerId}`;
        // on a phone the wins and earnings columns fold into the line under the name
        const fold = [r.wins ? `${r.wins} ${r.wins === 1 ? 'win' : 'wins'}` : '', money(r.earnings ?? 0)].filter(Boolean).join(' · ');
        return `<tr class="${r.mine ? 'me' : ''}" data-href="${href}"><td class="pos">${place}</td><td class="nm"><a href="${href}"><b>${esc(r.name)}${r.mine ? ' <small class="you">you</small>' : ''}</b></a><small>${sub}</small><small class="ph">${fold}</small></td><td class="num wins">${r.wins || ''}</td><td class="num earn">${money(r.earnings ?? 0)}</td><td class="num pts"><b>${total(r).toLocaleString('en-US')}</b>${r.projected ? `<small>+${r.projected} this week</small>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;
  // the whole row opens the card, not just the name
  el.querySelectorAll<HTMLTableRowElement>('tr[data-href]').forEach((tr) => tr.addEventListener('click', () => (location.hash = tr.dataset.href!)));
}
