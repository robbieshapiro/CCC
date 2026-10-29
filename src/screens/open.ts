// The Open: one board across every club, this month's best round per person. It sits beside the club's own
// board as a tab, and is the one members see first. Clubs aren't shown; only members of your own club link
// through to a card.
import { api } from '../api';
import type { OpenChampion, OpenRow, Snapshot } from '../api/types';
import { portrait } from '../avatar';
import { GAME_TZ } from '../day';
import { courseFor } from '../golf3d/courses';
import { REGINALD } from '../host';
import { monthName, toParLabel } from '../standings';
import { requireSession } from '../state';
import { store } from '../storage';
import { esc } from '../ui';
import { scoreClass } from './home';

const TAB_KEY = 'ccc-board-tab';
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

function table(snap: Snapshot, rows: ReturnType<typeof ranked>) {
  const course = courseFor(snap.month);
  if (!rows.length) return `<p class="muted open-empty">Nobody has posted a round yet, in any club.</p>`;
  const head = course.holes.map((_, i) => `<th class="num">${i + 1}</th>`).join('');
  const body = rows
    .map((r) => {
      const who = `${portrait(r.avatar, 34)}<span>${esc(r.name)}<em>${r.rounds} ${r.rounds === 1 ? 'round' : 'rounds'} · last ${lastPlayed(r.last)}</em></span>`;
      const link = r.mine ? '#/card' : r.localId ? `#/member/${r.localId}` : '';
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

// Reginald on the Open: who leads it, and where you stand
function openLine(rows: ReturnType<typeof ranked>, today: string) {
  if (!rows.length) return REGINALD.openNobody();
  const top = rows[0];
  const me = rows.find((r) => r.mine);
  if (top.mine) return REGINALD.openLeading(toParLabel(top.toPar), today);
  return REGINALD.openLeads(top.name, toParLabel(top.toPar), me ? me.rank : null, rows.length);
}

// Called after the home page draws. If the Open isn't available (the SQL isn't run yet, or offline), nothing
// changes: the club board stays as it always was.
export async function bindOpen(snap: Snapshot, clubLine: string) {
  const s = requireSession();
  const [rows, champs] = await Promise.all([api.openBoard(s).catch(() => null), api.openChampions(s).catch(() => [] as OpenChampion[])]);
  const tabs = document.getElementById('board-tabs');
  const openPane = document.getElementById('board-open');
  const clubPane = document.getElementById('board-club');
  const say = document.querySelector<HTMLElement>('#reg-line');
  if (!rows || !tabs || !openPane || !clubPane) return;
  const list = ranked(rows);
  openPane.innerHTML = table(snap, list);
  const lineOpen = `<b>Reginald</b> ${openLine(list, snap.today)}`;
  const lineClub = `<b>Reginald</b> ${clubLine}`;
  const show = (tab: 'open' | 'club') => {
    openPane.hidden = tab !== 'open';
    clubPane.hidden = tab !== 'club';
    tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    if (say) say.innerHTML = tab === 'open' ? lineOpen : lineClub;
  };
  tabs.hidden = false;
  tabs.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => {
    b.onclick = () => {
      const tab = b.dataset.tab as 'open' | 'club';
      store.set(TAB_KEY, tab);
      show(tab);
    };
  });
  show(store.get(TAB_KEY) === 'club' ? 'club' : 'open');

  // the plaque: each month's Open champion beside the club's own
  const plaque = document.querySelector('.plaque ol');
  if (plaque && champs.length) {
    plaque.querySelector('.empty')?.remove();
    plaque.insertAdjacentHTML(
      'afterbegin',
      champs.slice(0, 6).map((c) => `<li class="open-champ"><span>${monthName(c.month)} · The Open</span><b>${c.names.map(esc).join(' & ')}</b><em>${toParLabel(c.total - c.par)}</em></li>`).join(''),
    );
  }
}
