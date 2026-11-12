// The Committee Room's Course tab: Sunday's card, self-contained. A copy of the member's Play tile driven by the
// rehearsal card kept on this device (see dryToday in round.ts), so the whole day can be walked through from here:
// the note before a fresh card, leaving mid-round and coming back to Continue, the card going in, and midnight
// forfeiting a card that was never finished. Below it, one picker to preview any course, and a test of the money note.
import type { Snapshot } from '../api/types';
import { ask, tell } from '../dialog';
import { courseFor, labHoles, nextCourse, upcoming, type Course } from '../golf3d/courses';
import { nextStart, periodName } from '../day';
import { esc, navigate } from '../ui';
import { bindCardNote, cardNote, cardTile, tileState } from './cardnote';
import { look } from './home';
import { dryForget, dryToday } from './round';
import { hasNight } from '../golf3d/kits';
import { setNight } from './previewControls';
import { bindPlanner, plannerSection } from './planner';
import { store } from '../storage';

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
  const next = courseFor(nextStart(snap.month));
  const nextIsNew = next.id !== courseFor(snap.month).id;
  return `
    <section class="adm-card adm-next${look(next)}" id="adm-next">
      <div class="adm-next-head">
        <p class="eyebrow">${nextIsNew ? `Next week · opens ${esc(periodName(nextStart(snap.month)).replace(/^Week of /, ''))}` : 'Next week · carries on'}</p>
        <h2>${esc(shortName(next))}</h2>
        <p class="muted">${esc(next.tagline ?? '')}</p>
      </div>
      <ol class="adm-next-holes">${next.holes.map((h, i) => `<li><div><b>${i + 1}</b><span>${esc(h.name)}</span><em>Par ${h.par}${h.yards ? ` · ${h.yards} yd` : ''}</em></div></li>`).join('')}</ol>
      <div class="adm-next-go">
        <a class="btn big" href="#/preview/${next.id}" data-next-play>Play it, with the controls</a>
        ${hasNight(next.holes[0]) ? `<div class="adm-chips" role="group" aria-label="Time of day"><small>Time</small><button data-next-night="day">☀️ Day</button><button data-next-night="night">🌙 Night</button><button data-next-night="">By the clock</button></div>` : ''}
      </div>
      <p class="fine">In play, the Controls button changes the time of day, the wind and the pin, pours any drink, sends out the cart or Reginald, puts a shot back, and drops the ball anywhere on the map. Holes jumps to any hole. Nothing is posted or paid.</p>
    </section>
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
    ${plannerSection()}
    <a class="adm-card adm-room-link" href="#/room"><span class="adm-room-glow">🛰️</span><span><b>The Design Room</b><small>Shape a course on the holo-table: the holes, the bunkers, the water, the trees. It plays as soon as it's saved.</small></span><span aria-hidden="true">›</span></a>
    ${labSection()}
    <section class="adm-card adm-previews">
      <h2>Preview a course</h2>
      <p class="muted">Jump between holes; the reward moments fire without paying.</p>
      <div class="adm-pick">
        <select id="adm-preview" aria-label="Course to preview">${all.map((x, i) => `<option value="${x.id}">${esc(shortName(x))}${i === 0 ? ' (this week)' : x.draft ? ' (draft)' : ''}</option>`).join('')}</select>
        <button class="btn" data-preview-go>Preview</button>
      </div>
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

export function bindSundayCard(snap: Snapshot) {
  void bindPlanner(snap);
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
  // next week's course: day or night for the preview, remembered on this device
  const nightBtns = [...document.querySelectorAll<HTMLButtonElement>('[data-next-night]')];
  const showNight = () => nightBtns.forEach((b) => b.classList.toggle('on', (store.get('ccc-preview-night') ?? '') === b.dataset.nextNight));
  nightBtns.forEach((b) => (b.onclick = () => (setNight(b.dataset.nextNight as 'day' | 'night' | ''), showNight())));
  showNight();
  const go = document.querySelector<HTMLButtonElement>('[data-preview-go]');
  if (go) go.onclick = () => navigate(`#/preview/${document.querySelector<HTMLSelectElement>('#adm-preview')!.value}`);
}
