// The Season: FedEx Cup style points from every week's Open finish, the year so far. Banked points from closed weeks,
// with this week's place shown as projected until it closes. Linked from the Open on home.
import { api } from '../api';
import type { Season, Snapshot } from '../api/types';
import { courseFor } from '../golf3d/courses';
import { SEASON_FLOOR, SEASON_POINTS, openName } from '../season';
import { placeLabel } from '../purse';
import { requireSession } from '../state';
import { esc, header, render } from '../ui';

export async function season(snap: Snapshot) {
  render(`${header(snap.groupName, 'play')}
    <main class="season-page">
      <a class="link season-back" href="#/">‹ Back to the club</a>
      <p class="eyebrow">The Season</p>
      <h1 id="season-h">The ${snap.month.slice(0, 4)} Season</h1>
      <p class="muted season-sub">Points from every week's Open, like the FedEx Cup. This week: ${esc(openName(courseFor(snap.month).name, snap.month))}.</p>
      <section class="adm-card season-card" id="season-board"><p class="muted">Loading the standings…</p></section>
      <section class="season-scale">
        <h2>How points work</h2>
        <p>Your best card of the week sets your place on the Open, across every club. The place earns points when the week closes on Saturday night; until then they show as projected.</p>
        <ol class="scale">${SEASON_POINTS.slice(0, 10)
          .map((p, i) => `<li><span>${placeLabel(i + 1, false)}</span><b>${p}</b></li>`)
          .join('')}</ol>
        <p class="fine">11th to 20th: ${SEASON_POINTS.slice(10).join(', ')}. Everyone else who posts a card that week: ${SEASON_FLOOR}. Ties share the points for the places they cover. At the end of the year, a Wrapped of everyone's season.</p>
      </section>
    </main>`);
  const s: Season | null = await api.seasonStandings(requireSession()).catch(() => null);
  const el = document.getElementById('season-board');
  if (!el) return;
  if (!s) {
    el.innerHTML = '<p class="muted">The standings show up once their SQL has been run in Supabase.</p>';
    return;
  }
  const h = document.getElementById('season-h');
  if (h) h.textContent = `The ${s.year} Season`;
  if (!s.standings.length) {
    el.innerHTML = '<p class="muted">No points yet. The first card of the week starts the race.</p>';
    return;
  }
  const total = (r: Season['standings'][number]) => r.points + r.projected;
  let place = 0;
  el.innerHTML = `<div class="table-wrap"><table class="season-table">
    <thead><tr><th></th><th>Member</th><th class="num">Wks</th><th class="num">Wins</th><th class="num">Points</th></tr></thead>
    <tbody>${s.standings
      .map((r, i) => {
        if (i === 0 || total(r) !== total(s.standings[i - 1])) place = i + 1;
        return `<tr class="${r.mine ? 'me' : ''}"><td class="pos">${place}</td><td class="nm"><b>${esc(r.name)}</b><small>${esc(r.club)}${r.top10s ? ` · ${r.top10s} top 10${r.top10s === 1 ? '' : 's'}` : ''}</small></td><td class="num">${r.events}</td><td class="num">${r.wins}</td><td class="num pts"><b>${total(r).toLocaleString('en-US')}</b>${r.projected ? `<small>${r.points ? `${r.points} + ` : ''}${r.projected} this week</small>` : ''}</td></tr>`;
      })
      .join('')}</tbody></table></div>`;
}
