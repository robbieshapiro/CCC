// Home, under the Open: Around the club. Practise the course, the range, design a course, a course idea for Reginald,
// and the Pro Shop with a few featured pieces and your bank (the Members' Course duel is up in the Nineteenth Hole);
// then the classic courses of weeks gone by, each with its course record and the
// champions of its week. The bar's games are in the Nineteenth Hole row above the Open (barstrip.ts).
import { lookAttrs, looked } from '../courselook';
import { api } from '../api';
import type { CourseRecord, Snapshot } from '../api/types';
import { classics, courseFor, type Course } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc } from '../ui';
import { balanceOf, ITEMS } from '../shop';
import { money } from '../purse';
import { todayInGameTz } from '../day';

const ICON: Record<string, string> = { volcanic: '🌋', coastal: '🌊', autumn: '🍁', chicago: '🏙️', linksland: '☘️' };

export function playTiles(snap: Snapshot) {
  const course = courseFor(snap.month);
  const old = classics(snap.month);
  return `<section class="play-more" aria-label="Around the club">
      <h2 class="pm-head">Around the club</h2>
      <div class="pm-grid">
        <a class="tile pm-tile" href="#/round/practice"><i>⛳</i><b>Practise the course</b><span>${esc(course.name.replace(/ Course$/, ""))} in today's wind and pins. Nothing counts</span></a>
        <a class="tile pm-tile" href="#/facility"><i>🏌️</i><b>The range</b><span>Range and short game</span></a>
        <a class="tile pm-tile" href="#/design"><i>✏️</i><b>Design a course</b><span>Any world you can dream up. Your score is the one to beat</span></a>
        <button class="tile pm-tile" data-course-idea><i>💡</i><b>A course idea</b><span>Send Reginald a place you'd like to play</span></button>
        ${proShop(snap)}
      </div>
      ${
        old.length
          ? `<h2 class="pm-head">Classic courses <small>beat the course record</small></h2>
        <div class="pm-classics">${old.map((c) => classicTile(c)).join('')}</div>`
          : ''
      }
    </section>`;
}

// The Pro Shop: your bank and three pieces you don't own yet, the newest collection first, a different three each day
function proShop(snap: Snapshot) {
  const me = snap.players.find((p) => p.id === snap.me);
  if (!me) return '';
  const owned = new Set(me.owned ?? []);
  const rank = (c?: string) => (c === 'wizard' ? 0 : c === 'tour' ? 1 : 2);
  const pool = ITEMS.filter((i) => !owned.has(i.id) && i.rack === 'member').sort((a, b) => rank(a.collection) - rank(b.collection));
  const fresh = pool.filter((i) => rank(i.collection) === rank(pool[0]?.collection));
  const from = fresh.length >= 3 ? fresh : pool;
  const day = Number(todayInGameTz().replace(/-/g, '')) % Math.max(1, from.length);
  const picks = [0, 1, 2].map((k) => from[(day + k) % from.length]).filter((x, i, a) => x && a.indexOf(x) === i);
  return `<a class="tile pm-tile pm-shop" href="#/clubhouse/shop">
      <div class="pm-shop-top"><i>🛍️</i><b>The Pro Shop</b><span class="pm-bank">In the bank <b>${money(balanceOf(me))}</b></span></div>
      ${picks.length ? `<ul class="pm-picks">${picks.map((i) => `<li><span>${esc(i.name)}</span><em>${money(i.price)}</em></li>`).join('')}</ul>` : '<span>You own the lot. Reginald is impressed.</span>'}
      <span class="pm-shop-go">Shop ›</span>
    </a>`;
}

const classicTile = (c: Course) => `<a class="pm-classic${c.look ? looked(c) : ` ${esc(c.holes[0]?.theme ?? '')}`}"${lookAttrs(c)} href="#/classic/${c.id}" data-classic="${c.id}">
    <span class="pm-ic">${c.look?.icon ?? ICON[c.holes[0]?.theme ?? ''] ?? '⛳'}</span>
    <b>${esc(c.name)}</b>
    <span class="pm-meta">${c.holes.length} holes · par ${c.par}</span>
    <span class="pm-rec" data-rec>Course record loading…</span>
    <span class="pm-champ" data-champ></span>
    <span class="pm-go">Play for the record</span>
  </a>`;

export async function bindPlayTiles(snap: Snapshot) {
  const s = requireSession();
  if (!classics(snap.month).length) return;
  const records = await api.courseRecords(s).catch(() => null as CourseRecord[] | null);
  document.querySelectorAll<HTMLElement>('[data-classic]').forEach((el) => {
    const r = records?.find((x) => x.course === el.dataset.classic);
    const rec = el.querySelector<HTMLElement>('[data-rec]');
    const champ = el.querySelector<HTMLElement>('[data-champ]');
    if (!rec || !champ) return;
    if (!r) {
      rec.textContent = records ? 'No record yet. Set one.' : '';
      return;
    }
    const holders = r.holders ?? [];
    rec.innerHTML = `Record <b>${toParLabel(r.toPar)}</b> · ${holders.slice(0, 2).map((h) => esc(h.name)).join(' & ')}${holders.length > 2 ? ` +${holders.length - 2}` : ''}${r.mine !== null ? `<br><small>Your best ${toParLabel(r.mine)}</small>` : ''}`;
    champ.innerHTML = r.champions.length ? `🏆 ${r.champions.map((c) => `${esc(c.name)} <small>${esc(c.club)}</small>`).join(' · ')}` : '';
  });
}
