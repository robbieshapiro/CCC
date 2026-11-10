// The Open: one board across every club, this month's best round per person. It sits beside the club's own
// board as a tab, and is the one members see first. Clubs aren't shown; only members of your own club link
// through to a card.
import { api } from '../api';
import type { OpenChampion, OpenRow, Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { GAME_TZ, openPurseOn, periodName } from '../day';
import { money, openPurse } from '../purse';
import { courseFor } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc, golferHref } from '../ui';
import { scoreClass } from './home';

const lastPlayed = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: GAME_TZ });

// ranks shared on a tie, as on the club board
function ranked(rows: OpenRow[]) {
  let rank = 0;
  return rows.map((r, i) => {
    const toPar = r.total - r.par;
    if (i === 0 || rows[i - 1].total - rows[i - 1].par !== toPar) rank = i + 1;
    return { ...r, toPar, rank };
  });
}

function table(snap: Snapshot, rows: ReturnType<typeof ranked>, pay?: ReturnType<typeof openPurse>['pay']) {
  const course = courseFor(snap.month);
  if (!rows.length) return `<p class="muted open-empty">Nobody has posted a round yet, in any club.</p>`;
  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const crowned = snap.crown && snap.crown.name === r.name && snap.crown.club === r.club ? ` <span class="crown" title="Yesterday's Closest to the Pin">🎯</span>` : '';
      const who = `${portrait(r.avatar, 34)}<span>${esc(r.name)}${crowned}<em>${pay?.get(r.playerId)?.payout ? `<b class="pay">${money(pay.get(r.playerId)!.payout)}</b> · ` : ''}${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · last ${lastPlayed(r.last)}</em></span>`;
      const link = golferHref(r.playerId, r.mine);
      return `<tr class="${r.mine ? 'me' : ''}">
        <td class="rank">${r.rank}</td>
        <td class="who">${link ? `<a href="${link}">${who}</a>` : `<div>${who}</div>`}</td>
        ${course.holes.map((h, i) => `<td class="num"><span class="sc ${scoreClass(r.holes[i], h.par)}">${r.holes[i] ?? ''}</span></td>`).join('')}
        <td class="num tot">${r.total}</td>
        <td class="num topar ${r.toPar < 0 ? 'under' : r.toPar > 0 ? 'over' : ''}">${toParLabel(r.toPar)}</td>
      </tr>`;
    })
    .join('');
  return `<div class="table-wrap"><table class="scorecard">
    <thead><tr><th></th><th>Member</th>${head}<th class="num">Tot</th><th class="num">±</th></tr></thead>
    <tbody><tr class="par"><td></td><td>Par</td>${course.holes.map((h) => `<td class="num">${h.par}</td>`).join('')}<td class="num">${course.par}</td><td></td></tr>${body}</tbody>
  </table></div>`;
}

// Called after the home page draws: fills the Open's hole-by-hole scorecard (behind "See hole by hole") and the plaque.
// Returns the Open purse once it's drawn (from Nov 8), so the page can show the same money everywhere
export async function bindOpen(snap: Snapshot): Promise<ReturnType<typeof openPurse> | null> {
  const s = requireSession();
  const [rows, champs] = await Promise.all([api.openBoard(s).catch(() => null), api.openChampions(s).catch(() => [] as OpenChampion[])]);
  const openPane = document.getElementById('board-open');
  if (!openPane || !rows) return null;
  // the hole-by-hole scorecard, a tap away under the list (live.ts shows the list and handles the tabs)
  const list = ranked(rows);
  const purse = openPurseOn(snap.month) ? openPurse(list) : null;
  openPane.innerHTML = table(snap, list, purse?.pay);

  // the plaque: each month's Open champion beside the club's own
  const plaque = document.querySelector('.plaque ol');
  if (plaque && champs.length) {
    plaque.querySelector('.empty')?.remove();
    plaque.insertAdjacentHTML(
      'afterbegin',
      champs.slice(0, 6).map((c) => `<li class="open-champ"><span>${periodName(c.month)} · The Open</span><b>${c.names.map(esc).join(' & ')}</b><em>${toParLabel(c.total - c.par)}</em></li>`).join(''),
    );
  }
  return purse;
}
