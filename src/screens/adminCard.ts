// The Committee Room's Course tab: Sunday's card, self-contained. A copy of the member's Play tile driven by the
// rehearsal card kept on this device (see dryToday in round.ts), so the whole day can be walked through from here:
// the note before a fresh card, leaving mid-round and coming back to Continue, the card going in, and midnight
// forfeiting a card that was never finished. Below it, one picker to preview any course, and the coin test.
import type { Snapshot } from '../api/types';
import { ask, tell } from '../dialog';
import { api } from '../api';
import { courseFor, labHoles, tourCourses, nextCourse, scheduleOf, upcoming, type Course } from '../golf3d/courses';
import { nextStart, periodName } from '../day';
import { refresh, requireSession } from '../state';
import { esc, navigate } from '../ui';
import { bindCardNote, cardNote, cardTile, tileState } from './cardnote';
import { look } from './home';
import { dryForget, dryToday } from './round';

const shortName = (c: Course) => c.name.replace(/ Course$/, '');
const rehearsed = (snap: Snapshot) => nextCourse(snap.month) ?? courseFor(snap.month);
const linksFor = (c: Course) => ({
  play: '#/rehearse',
  practice: `#/preview/${c.id}`,
});

const STEPS = [
  ['Tap Play', "The note comes up first: the card that counts, or practice that doesn't."],
  ['Start the card, then Leave', "Swing once and it's locked. Leave mid-round and you're told where it stands."],
  ['Come back here', 'The tile shows your hole and score, with Continue and the midnight warning.'],
  ['Finish', 'The card-in screen, and the tile flips to practice for the rest of the day.'],
];

export function sundayCardSection(snap: Snapshot): string {
  const c = rehearsed(snap);
  const all = [courseFor(snap.month), ...upcoming(snap.month)];
  return `
    <section class="adm-card adm-sunday" id="adm-sunday">
      <div class="adm-sunday-head">
        <p class="eyebrow">Rehearsal · ${esc(shortName(c))}</p>
        <h2>Sunday's card</h2>
        <p class="muted">A member's day, start to finish. Kept on this device: nothing is posted or paid.</p>
      </div>
      <div class="adm-sunday-grid">
        <div class="adm-mock">
          <span class="adm-mock-tag">What members see on home</span>
          <section class="play-hero${look(c)}"><div class="play-main">
            <p class="eyebrow">This week</p>
            <h1>${esc(c.name)}</h1>
            <p class="muted">${c.holes.length} holes · par ${c.par}</p>
            <div id="adm-card-tile"></div>
          </div></section>
          <div class="adm-sunday-tools" id="adm-card-tools"></div>
        </div>
        <ol class="adm-steps">${STEPS.map(([b, t]) => `<li><b>${b}</b><span>${t}</span></li>`).join('')}</ol>
      </div>
    </section>
    ${weeksSection(snap)}
    ${labSection()}
    <section class="adm-card adm-previews">
      <h2>Preview a course</h2>
      <p class="muted">Jump between holes; the reward moments fire without paying.</p>
      <div class="adm-pick">
        <select id="adm-preview" aria-label="Course to preview">${all.map((x, i) => `<option value="${x.id}">${esc(shortName(x))}${i === 0 ? ' (this week)' : x.draft ? ' (draft)' : ''}</option>`).join('')}</select>
        <button class="btn" data-preview-go>Preview</button>
      </div>
      <button class="link adm-coin" data-coin-test>Test a coin burst</button>
    </section>`;
}

// The weeks ahead: each one's course, picked here (course_schedule). Unpicked weeks follow the calendar in the code.
// Only weeks still to come can change, so no board changes course under it.
const COMMITTEE_WEEKS = 4;
function weeksSection(snap: Snapshot) {
  const weeks: string[] = [];
  let p = snap.month;
  for (let i = 0; i < COMMITTEE_WEEKS; i++) weeks.push((p = nextStart(p)));
  const all = tourCourses();
  const picks = scheduleOf();
  return `
    <section class="adm-card adm-weeks">
      <h2>The weeks ahead</h2>
      <p class="muted">Pick each week's course. It takes effect for everyone at once, no deploy, and carries on until the next pick or new course. A draft is fine once you're happy with it.</p>
      <p class="adm-week-now"><b>${esc(periodName(snap.month))}</b> <span>${esc(courseFor(snap.month).name)} · playing now</span></p>
      ${weeks
        .map((w) => {
          const cal = courseFor(w, false);
          return `<label class="adm-week"><b>${esc(periodName(w))}</b>
            <select data-week="${w}" aria-label="Course for ${esc(periodName(w))}">
              <option value="">${esc(shortName(cal))} (carries on)</option>
              ${all.map((c) => `<option value="${c.id}"${picks[w] === c.id ? ' selected' : ''}>${esc(shortName(c))}${c.draft ? ' (draft)' : ''}</option>`).join('')}
            </select><small data-week-note="${w}"></small></label>`;
        })
        .join('')}
    </section>`;
}
// The Hole Lab: single test holes in new looks, only for the Committee. Play one, then tell Claude which to build out.
function labSection() {
  const lab = labHoles();
  if (!lab.length) return '';
  return `
    <section class="adm-card adm-lab">
      <h2>The Hole Lab</h2>
      <p class="muted">One test hole in each new look. Only you can play them. Pick the ones worth a whole course.</p>
      <div class="adm-lab-grid">${lab
        .map((c) => `<a class="adm-lab-hole" href="#/preview/${c.id}"><b>${esc(c.name.replace(/^Lab · /, ""))}</b><span>${esc(c.tagline)}</span><small>Par ${c.par} · ${c.holes[0].yards ?? ''}${c.holes[0].yards ? ' yd' : ''}</small></a>`)
        .join('')}</div>
    </section>`;
}

function bindWeeks() {
  document.querySelectorAll<HTMLSelectElement>('select[data-week]').forEach((sel) => {
    sel.onchange = async () => {
      const week = sel.dataset.week!;
      const note = document.querySelector<HTMLElement>(`[data-week-note="${week}"]`);
      sel.disabled = true;
      if (note) note.textContent = 'Saving…';
      try {
        await api.setCourseSchedule(requireSession(), week, sel.value || null);
        await refresh();
        if (note) note.textContent = 'Saved';
      } catch (e) {
        if (note) note.textContent = (e as Error).message || 'Could not save';
      } finally {
        sel.disabled = false;
      }
    };
  });
}

export function bindSundayCard(snap: Snapshot) {
  bindWeeks();
  const c = rehearsed(snap);
  const links = linksFor(c);
  const draw = () => {
    const tile = document.getElementById('adm-card-tile');
    const tools = document.getElementById('adm-card-tools');
    if (!tile || !tools) return;
    const t = dryToday(c.id);
    const state = tileState(t, false);
    tile.innerHTML = cardTile(state, c, t, links);
    bindCardNote(tile, links, navigate);
    tools.innerHTML = [
      '<button class="link" data-show-note>Show the note</button>',
      state !== 'fresh' ? '<button class="link" data-midnight>Pretend it\'s midnight</button>' : '',
      state !== 'fresh' ? '<button class="link" data-start-over>Start over</button>' : '',
    ]
      .filter(Boolean)
      .join('<span aria-hidden="true">·</span>');
    tools.querySelector<HTMLButtonElement>('[data-show-note]')!.onclick = async () => {
      const pick = await cardNote();
      if (pick) navigate(pick === 'card' ? links.play : links.practice);
    };
    const midnight = tools.querySelector<HTMLButtonElement>('[data-midnight]');
    if (midnight)
      midnight.onclick = async () => {
        if (state === 'going') {
          if (
            !(await ask({
              title: "Pretend it's midnight?",
              body: "<p>The card in progress was never finished, so it gets forfeited, just as a member's would.</p>",
              ok: 'Midnight',
              cancel: 'Cancel',
            }))
          )
            return;
          dryForget();
          draw();
          await tell(
            'That card was forfeited',
            "<p>It wasn't finished before midnight ET, so it doesn't count for the day. A fresh card is dealt for the new day, and the tile is back to Play.</p>",
          );
        } else {
          dryForget();
          draw();
          await tell('A new day', "<p>Yesterday's card stays on the board. Today's is a fresh one, and the tile is back to Play.</p>");
        }
      };
    const over = tools.querySelector<HTMLButtonElement>('[data-start-over]');
    if (over)
      over.onclick = async () => {
        if (
          !(await ask({
            title: 'Start the rehearsal over?',
            body: '<p>Throws away this rehearsal card and deals a fresh one. Nothing real is touched.</p>',
            ok: 'Start over',
          }))
        )
          return;
        dryForget();
        draw();
      };
  };
  draw();
  const go = document.querySelector<HTMLButtonElement>('[data-preview-go]');
  if (go) go.onclick = () => navigate(`#/preview/${document.querySelector<HTMLSelectElement>('#adm-preview')!.value}`);
}
