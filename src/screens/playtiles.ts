// Home, under the Open: everything else you can play, as big tiles. The day's Closest to the Pin, the week's long drive
// and the Members' Course (each with its leader), the practice facility, and the classic courses of weeks gone by, each
// with its course record and the champions of its week.
import { api } from '../api';
import type { CourseRecord, Snapshot } from '../api/types';
import { scoreLabel } from '../bar';
import { classics, courseFor, type Course } from '../golf3d/courses';
import { toParLabel } from '../standings';
import { requireSession } from '../state';
import { esc } from '../ui';
import { dailyCard } from './daily';
import { driveHole } from './round';

const ICON: Record<string, string> = { volcanic: '🌋', coastal: '🌊', autumn: '🍁' };

export function playTiles(snap: Snapshot) {
  const course = courseFor(snap.month);
  const tee = driveHole(course);
  const old = classics(snap.month);
  return `<section class="play-more" aria-label="More to play">
      <h2 class="pm-head">More to play</h2>
      <div class="pm-grid">
        ${dailyCard()}
        <a class="tile pm-tile" href="#/bar/drive"><i>🚀</i><b>Long drive</b><span>3 swings off ${esc(tee.name)} · the last 2 with a fireball</span><em data-lead="drive"></em></a>
        <a class="tile pm-tile" href="#/bar/members"><i>🏗️</i><b>Members' Course</b><span>Holes the members built</span><em data-lead="members"></em></a>
        <a class="tile pm-tile" href="#/facility"><i>🏌️</i><b>Practice</b><span>Range and short game</span></a>
      </div>
      ${
        old.length
          ? `<h2 class="pm-head">Classic courses <small>beat the course record</small></h2>
        <div class="pm-classics">${old.map((c) => classicTile(c)).join('')}</div>`
          : ''
      }
    </section>`;
}

const classicTile = (c: Course) => `<a class="pm-classic ${esc(c.holes[0]?.theme ?? '')}" href="#/classic/${c.id}" data-classic="${c.id}">
    <span class="pm-ic">${ICON[c.holes[0]?.theme ?? ''] ?? '⛳'}</span>
    <b>${esc(c.name)}</b>
    <span class="pm-meta">${c.holes.length} holes · par ${c.par}</span>
    <span class="pm-rec" data-rec>Course record loading…</span>
    <span class="pm-champ" data-champ></span>
    <span class="pm-go">Play for the record</span>
  </a>`;

export async function bindPlayTiles(snap: Snapshot) {
  const s = requireSession();
  const lead = (game: 'drive' | 'members') =>
    api
      .barBoard(s, game)
      .then((b) => {
        const el = document.querySelector<HTMLElement>(`[data-lead="${game}"]`);
        if (!el) return;
        const top = b.board[0];
        el.textContent = top ? `Leader: ${top.name}, ${scoreLabel(game, top.score)}${b.mine !== null && !top.mine ? ` · you ${scoreLabel(game, b.mine)}` : ''}` : 'Nobody yet this week';
      })
      .catch(() => {});
  void lead('drive');
  void lead('members');
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
