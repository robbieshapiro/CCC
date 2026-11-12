// The Design Room: the Committee shapes a course hole by hole on a floating holo-table. The panel sets the hole's
// shape (length, bends, the ground, the fairway, the green); the things on it (bunkers, water, trees, mounds) are
// added from the panel and dragged about on the table. The holes are the Design Desk's (src/designer/hole.ts), so
// they build and play exactly as members' holes do. Saved in the club (room_courses): a saved course is on the
// planner's shelf at once, and plays with no deploy.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { api } from '../api';
import type { RoomCourse, Snapshot } from '../api/types';
import { ask, tell } from '../dialog';
import { buildHole, checkHole, frameOf, parFor, tidy, type HoleSpec, type Look, type Size } from '../designer/hole';
import { blankHole, roomId } from '../designer/room';
import { heightAt, isWater, surfaceAt, inPoly } from '../golf3d/terrain';
import type { Hole } from '../golf3d/types';
import { refresh, requireSession } from '../state';
import { esc, navigate, render } from '../ui';
import { testHole } from './round';

type Work = { id: number | null; name: string; tagline: string; draft: boolean; holes: HoleSpec[]; dirty: boolean };
type List = 'bunkers' | 'water' | 'trees' | 'mounds';
type Sel = { list: List; i: number } | { list: 'green' };

let work: Work | null = null;
let at = 0; // the hole being worked on
let sel: Sel | null = null;
let table: Table | null = null;

const LOOKS: [Look, string][] = [['highlands', '🌲 Highlands'], ['caldera', '🌋 Caldera'], ['links', '🌊 Links'], ['desert', '🌵 Desert']];
const SHAPES: [HoleSpec['shape'], string][] = [['straight', 'Straight'], ['dogleg-left', 'Bends left'], ['dogleg-right', 'Bends right'], ['double-dogleg', 'S-bend']];
const GROUND: [HoleSpec['elevation'], string][] = [['flat', 'Flat'], ['downhill', 'Downhill'], ['uphill', 'Uphill'], ['tee-high', 'High tee'], ['valley', 'Down and up'], ['climb', 'A long climb']];
const SLOPES: [HoleSpec['green']['slope'], string][] = [['flat', 'Flat'], ['back-to-front', 'Back to front'], ['front-to-back', 'Front to back'], ['left-to-right', 'Left to right'], ['right-to-left', 'Right to left']];
const SIZES: [Size, string][] = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
const TREE: Record<Look, string> = { highlands: '🌲', caldera: '🌴', links: '🌿', desert: '🌵' };
const NAMES: Record<List, string> = { bunkers: 'Bunker', water: 'Water', trees: 'Trees', mounds: 'Mound' };

const spec = () => work!.holes[at];
const fromRow = (r: RoomCourse): Work => ({ id: r.id, name: r.name, tagline: r.tagline, draft: r.draft, holes: r.holes.map(tidy), dirty: false });
const fresh = (): Work => ({ id: null, name: 'New course', tagline: '', draft: true, holes: [blankHole('highlands', 1)], dirty: true });
const build = (s: HoleSpec) => buildHole(s, `room-draft-${at}`).hole;

export function closeRoom() {
  table?.dispose();
  table = null;
  document.body.classList.remove('room-open');
}

export async function designRoom(snap: Snapshot, arg?: string) {
  if (!snap.admin) return navigate('#/');
  render(`<main class="narrow"><p class="muted">Lighting the table…</p></main>`);
  const rows = await api.roomCourses(requireSession()).catch(() => [] as RoomCourse[]);
  const id = Number(arg);
  if (arg === 'new') {
    if (!work || work.id !== null) work = fresh();
  } else if (id) {
    const row = rows.find((r) => r.id === id);
    if (!row) return navigate('#/room');
    if (!work || work.id !== id) work = fromRow(row);
  } else if (!work) {
    work = rows.length ? fromRow(rows[rows.length - 1]) : fresh();
  }
  at = Math.min(at, work.holes.length - 1);
  draw(snap, rows);
}

function draw(snap: Snapshot, rows: RoomCourse[]) {
  const w = work!;
  closeRoom();
  render(`<div class="room">
    <header class="room-top">
      <a class="room-back" href="#/admin/courses">‹ Courses</a>
      <select id="room-pick" aria-label="Course">
        ${rows.map((r) => `<option value="${r.id}" ${r.id === w.id ? 'selected' : ''}>${esc(r.name)}${r.draft ? ' (draft)' : ''}</option>`).join('')}
        <option value="new" ${w.id === null ? 'selected' : ''}>＋ New course</option>
      </select>
      <input id="room-name" maxlength="40" value="${esc(w.name)}" aria-label="Course name">
      <span class="room-state" id="room-state"></span>
      <button class="btn" id="room-save">Save</button>
    </header>
    <div class="room-main">
      <div class="room-table" id="room-table">
        <div class="room-tabs" id="room-tabs"></div>
        <div class="room-hud" id="room-hud"></div>
        <div class="room-views">
          <button data-view="tee">Tee</button><button data-view="top">Above</button><button data-view="green">Green</button><button data-view="spin">Spin</button>
        </div>
        <p class="room-tip">Drag a marker to move it. Drag the table to turn it, pinch or scroll to zoom.</p>
      </div>
      <aside class="room-panel" id="room-panel"></aside>
    </div>
  </div>`);
  document.body.classList.add('room-open');
  const el = document.getElementById('room-table')!;
  try {
    table = new Table(el, {
      select: (s) => {
        sel = s;
        panel(snap);
      },
      moved: () => {
        w.dirty = true;
        status();
      },
      dropped: () => {
        tabs(snap);
        const s = spec();
        const hud = document.getElementById('room-hud');
        if (hud) hud.innerHTML = `<b>${esc(s.name)}</b><span>Par ${parFor(s.yards)} · ${s.yards} yd</span>`;
        panel(snap);
      },
    });
    // the browser checks reach the table through this, in dev only
    if (import.meta.env.DEV) (window as unknown as { __room?: Table | null }).__room = table;
  } catch {
    el.innerHTML = `<p class="room-nogl">This device can't draw the table (it needs WebGL). The panel still works.</p>`;
  }
  (document.getElementById('room-pick') as HTMLSelectElement).onchange = async (e) => {
    const v = (e.target as HTMLSelectElement).value;
    if (w.dirty && !(await ask({ title: 'Leave without saving?', body: 'Your changes to this course will be lost.', ok: 'Leave it', cancel: 'Stay' }))) {
      (e.target as HTMLSelectElement).value = w.id === null ? 'new' : String(w.id);
      return;
    }
    work = v === 'new' ? fresh() : fromRow(rows.find((r) => r.id === Number(v))!);
    at = 0;
    sel = null;
    history.replaceState(null, '', `#/room/${v}`);
    draw(snap, rows);
  };
  (document.getElementById('room-name') as HTMLInputElement).oninput = (e) => {
    w.name = (e.target as HTMLInputElement).value;
    w.dirty = true;
    status();
  };
  document.getElementById('room-save')!.onclick = () => save(snap);
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => (b.onclick = () => table?.view(b.dataset.view as View)));
  tabs(snap);
  status();
  update(snap);
}

function status() {
  const w = work!;
  const el = document.getElementById('room-state');
  if (el) el.innerHTML = `<b class="${w.draft ? 'draft' : 'ready'}">${w.draft ? 'Draft' : 'Ready'}</b>${w.dirty ? ' · not saved' : w.id ? ' · saved' : ''}`;
}

function tabs(snap: Snapshot) {
  const w = work!;
  const el = document.getElementById('room-tabs')!;
  el.innerHTML = `${w.holes.map((h, i) => `<button class="${i === at ? 'on' : ''}" data-hole="${i}">${i + 1}<small>Par ${parFor(h.yards)}</small></button>`).join('')}${w.holes.length < 9 ? '<button data-hole="add" aria-label="Add a hole">＋</button>' : ''}`;
  el.querySelectorAll<HTMLButtonElement>('[data-hole]').forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.hole === 'add') {
          w.holes.push(blankHole(spec().look, w.holes.length + 1));
          at = w.holes.length - 1;
          w.dirty = true;
        } else at = Number(b.dataset.hole);
        sel = null;
        tabs(snap);
        status();
        update(snap, true);
      }),
  );
}

// the hole changed: rebuild the table and the panel
function update(snap: Snapshot, reframe = false) {
  const s = spec();
  const hole = build(s);
  table?.show(s, hole, sel, reframe);
  const hud = document.getElementById('room-hud');
  if (hud) hud.innerHTML = `<b>${esc(s.name)}</b><span>Par ${parFor(s.yards)} · ${s.yards} yd</span>`;
  panel(snap, hole);
}

const chips = <T extends string>(name: string, opts: [T, string][], on: T) =>
  `<div class="room-chips" role="group">${opts.map(([v, l]) => `<button data-set="${name}" data-v="${v}" class="${v === on ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const slider = (name: string, label: string, v: number, min: number, max: number, step: number, show: string) =>
  `<label class="room-slide"><span>${label} <output data-out="${name}">${show}</output></span><input type="range" data-slide="${name}" min="${min}" max="${max}" step="${step}" value="${v}"></label>`;
const pct = (v: number) => `${Math.round(v * 100)}%`;
const side = (v: number) => (Math.abs(v) < 0.08 ? 'middle' : `${Math.abs(v).toFixed(1)} ${v < 0 ? 'left' : 'right'}`);

function panel(snap: Snapshot, hole = build(spec())) {
  const el = document.getElementById('room-panel');
  if (!el) return;
  const w = work!;
  const s = spec();
  const check = checkHole(hole, s);
  const things = ([['bunkers', '⛱️'], ['water', '💧'], ['trees', TREE[s.look]], ['mounds', '⛰️']] as [List, string][]).flatMap(([list, icon]) =>
    (s[list] as unknown[]).map((_, i) => {
      const on = sel && sel.list === list && sel.i === i;
      const label = list === 'water' ? { pond: 'Pond', creek: 'Creek', sea: 'Sea' }[s.water[i].kind] : NAMES[list];
      return `<button class="${on ? 'on' : ''}" data-pick="${list}:${i}">${list === 'water' && s.water[i].kind === 'sea' ? '🌊' : icon} ${label} ${i + 1}</button>`;
    }),
  );
  el.innerHTML = `
    <section>
      <h3>The course</h3>
      <label class="room-field"><span>A line about it</span><input data-text="tagline" maxlength="160" value="${esc(w.tagline)}" placeholder="Three holes by the sea."></label>
      ${chips('draft', [['yes', '📝 Draft'], ['no', '✅ Ready']], w.draft ? 'yes' : 'no')}
      <p class="fine">Ready courses sit on the planner's shelf like any other. Nothing reaches members until you put it on a week.</p>
    </section>
    <section>
      <h3>Hole ${at + 1}</h3>
      <label class="room-field"><span>Name</span><input data-text="name" maxlength="30" value="${esc(s.name)}"></label>
      ${chips('look', LOOKS, s.look)}
      ${slider('yards', 'Length', s.yards, 110, 600, 5, `${s.yards} yd · par ${parFor(s.yards)}`)}
      ${chips('shape', SHAPES, s.shape)}
      ${s.shape === 'straight' ? '' : `${slider('bend_at', 'Turns at', s.bend_at, 0.3, 0.7, 0.01, pct(s.bend_at))}${slider('bend', 'How sharp', s.bend, 10, 75, 1, `${Math.round(s.bend)}°`)}`}
      <label class="room-field"><span>The ground</span><select data-pick-select="elevation">${GROUND.map(([v, l]) => `<option value="${v}" ${v === s.elevation ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </section>
    <section>
      <h3>Fairway</h3>
      ${chips('width', [['narrow', 'Narrow'], ['medium', 'Medium'], ['wide', 'Wide']], s.fairway.width)}
      ${slider('from', 'Starts', s.fairway.from, 0.05, 0.6, 0.01, pct(s.fairway.from))}
      ${slider('to', 'Ends', s.fairway.to, 0.5, 0.97, 0.01, pct(s.fairway.to))}
    </section>
    <section>
      <h3>Green <button class="link room-sel ${sel?.list === 'green' ? 'on' : ''}" data-pick="green">⛳ ${sel?.list === 'green' ? 'selected' : 'select'}</button></h3>
      ${chips('gsize', SIZES, s.green.size)}
      <label class="room-field"><span>Slope</span><select data-pick-select="slope">${SLOPES.map(([v, l]) => `<option value="${v}" ${v === s.green.slope ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="room-chips"><button data-toggle="tiered" class="${s.green.tiered ? 'on' : ''}">Two tiers</button><button data-toggle="raised" class="${s.green.raised ? 'on' : ''}">Raised</button></div>
      ${slider('gacross', 'Sits', s.green.across, -1, 1, 0.05, side(s.green.across))}
    </section>
    <section>
      <h3>Add to the hole</h3>
      <div class="room-add">
        <button data-add="bunker">⛱️ Bunker</button><button data-add="pond">💧 Pond</button><button data-add="creek">〰️ Creek</button>
        <button data-add="trees">${TREE[s.look]} Trees</button><button data-add="mound">⛰️ Mound</button>${s.look === 'links' || s.look === 'caldera' ? '<button data-add="sea">🌊 Sea</button>' : ''}
      </div>
      ${things.length ? `<div class="room-things">${things.join('')}</div>` : '<p class="fine">Nothing on the hole yet.</p>'}
      ${selected(s)}
    </section>
    ${check.problems.length ? `<section class="room-notes"><h3>Before it plays</h3>${check.problems.map((p) => `<p>⚠️ ${esc(p)}</p>`).join('')}</section>` : ''}
    <section class="room-go">
      <button class="btn" data-go="hole">▶ Play this hole</button>
      <button class="btn ghost" data-go="course" ${w.id && !w.dirty ? '' : 'disabled'} title="Save first">Play the course</button>
      <div class="room-small">
        <button class="link" data-go="copy" ${w.holes.length >= 9 ? 'disabled' : ''}>Copy this hole</button>
        ${w.holes.length > 1 ? '<button class="link" data-go="drop">Remove this hole</button>' : ''}
        ${w.id ? '<button class="link danger" data-go="delete">Delete the course</button>' : ''}
      </div>
    </section>`;
  bindPanel(snap, el);
}

// the selected thing's own settings
function selected(s: HoleSpec): string {
  if (!sel || sel.list === 'green') return '';
  const head = (t: string) => `<div class="room-picked"><h4>${t}</h4>`;
  const end = `<p class="fine">Drag it on the table to move it.</p><button class="link danger" data-go="remove">Remove it</button></div>`;
  if (sel.list === 'bunkers') {
    const b = s.bunkers[sel.i];
    return `${head(`Bunker ${sel.i + 1}`)}${chips('bkind', [['fairway', 'Fairway'], ['greenside', 'Greenside'], ['pot', 'Pot'], ['waste', 'Waste']], b.kind)}${b.kind === 'pot' || b.kind === 'waste' ? '' : chips('osize', SIZES, b.size)}${end}`;
  }
  if (sel.list === 'water') {
    const x = s.water[sel.i];
    if (x.kind === 'sea') return `${head('The sea')}${chips('wside', [['left', 'Down the left'], ['right', 'Down the right']], x.side)}<button class="link danger" data-go="remove">Remove it</button></div>`;
    return `${head(x.kind === 'pond' ? `Pond` : 'Creek')}${x.kind === 'pond' ? chips('osize', SIZES, x.size) : '<p class="fine">A creek runs right across the hole.</p>'}${end}`;
  }
  if (sel.list === 'trees') {
    const t = s.trees[sel.i];
    return `${head('Trees')}${slider('count', 'How many', t.count, 1, 12, 1, String(t.count))}${chips('spread', [['tight', 'Tight'], ['loose', 'Spread out']], t.spread)}${end}`;
  }
  return `${head('Mound')}${chips('osize', SIZES, s.mounds[sel.i].size)}${end}`;
}

function bindPanel(snap: Snapshot, el: HTMLElement) {
  const w = work!;
  const changed = (redo = true) => {
    w.dirty = true;
    status();
    if (redo) {
      tabs(snap);
      update(snap);
    }
  };
  let timer = 0;
  // a slider moves the table as it goes, and only its own label on the panel
  el.querySelectorAll<HTMLInputElement>('[data-slide]').forEach(
    (r) =>
      (r.oninput = () => {
        const s = spec();
        const v = Number(r.value);
        const k = r.dataset.slide!;
        if (k === 'yards') s.yards = v;
        else if (k === 'bend_at') s.bend_at = v;
        else if (k === 'bend') s.bend = v;
        else if (k === 'from') s.fairway.from = v;
        else if (k === 'to') s.fairway.to = v;
        else if (k === 'gacross') s.green.across = v;
        else if (k === 'count' && sel?.list === 'trees') s.trees[sel.i].count = v;
        s.par = parFor(s.yards);
        const out = el.querySelector(`[data-out="${k}"]`);
        if (out)
          out.textContent =
            k === 'yards' ? `${v} yd · par ${parFor(v)}` : k === 'bend' ? `${v}°` : k === 'gacross' ? side(v) : k === 'count' ? String(v) : pct(v);
        w.dirty = true;
        status();
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const hole = build(s);
          table?.show(s, hole, sel, false);
          const hud = document.getElementById('room-hud');
          if (hud) hud.innerHTML = `<b>${esc(s.name)}</b><span>Par ${parFor(s.yards)} · ${s.yards} yd</span>`;
        }, 60);
      }),
  );
  el.querySelectorAll<HTMLInputElement>('[data-slide]').forEach((r) => (r.onchange = () => changed()));
  el.querySelectorAll<HTMLInputElement>('[data-text]').forEach(
    (t) =>
      (t.oninput = () => {
        if (t.dataset.text === 'tagline') w.tagline = t.value;
        else {
          spec().name = t.value;
          const hud = document.querySelector('#room-hud b');
          if (hud) hud.textContent = t.value;
        }
        changed(false);
      }),
  );
  el.querySelectorAll<HTMLSelectElement>('[data-pick-select]').forEach(
    (x) =>
      (x.onchange = () => {
        if (x.dataset.pickSelect === 'elevation') spec().elevation = x.value as HoleSpec['elevation'];
        else spec().green.slope = x.value as HoleSpec['green']['slope'];
        changed();
      }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = spec();
        const v = b.dataset.v!;
        const k = b.dataset.set!;
        if (k === 'draft') w.draft = v === 'yes';
        else if (k === 'look') {
          s.look = v as Look;
          // the sea only comes with links or the Caldera
          if (v !== 'links' && v !== 'caldera') s.water = s.water.filter((x) => x.kind !== 'sea');
          sel = null;
        } else if (k === 'shape') s.shape = v as HoleSpec['shape'];
        else if (k === 'width') s.fairway.width = v as HoleSpec['fairway']['width'];
        else if (k === 'gsize') s.green.size = v as Size;
        else if (sel && sel.list !== 'green') {
          const o = (s[sel.list] as Record<string, unknown>[])[sel.i];
          if (k === 'osize') o.size = v;
          else if (k === 'bkind') o.kind = v;
          else if (k === 'spread') o.spread = v;
          else if (k === 'wside') o.side = v;
        }
        changed();
      }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-toggle]').forEach(
    (b) =>
      (b.onclick = () => {
        const g = spec().green;
        if (b.dataset.toggle === 'tiered') g.tiered = !g.tiered;
        else g.raised = !g.raised;
        changed();
      }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(
    (b) =>
      (b.onclick = () => {
        const [list, i] = b.dataset.pick!.split(':');
        const next: Sel = list === 'green' ? { list: 'green' } : { list: list as List, i: Number(i) };
        sel = sel && JSON.stringify(sel) === JSON.stringify(next) ? null : next;
        table?.select(sel);
        panel(snap);
      }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(
    (b) =>
      (b.onclick = () => {
        const s = spec();
        const k = b.dataset.add!;
        // somewhere sensible to start, off to one side, then drag it where it belongs
        const n = s.bunkers.length + s.water.length + s.trees.length + s.mounds.length;
        const flip = n % 2 ? -1 : 1;
        const tooMany = (list: List, max: number) => (s[list].length >= max ? (void tell(`That's the most ${NAMES[list].toLowerCase()} a hole can take.`), true) : false);
        if (k === 'bunker') {
          if (tooMany('bunkers', 12)) return;
          s.bunkers.push({ along: 0.62, across: 1.3 * flip, size: 'medium', kind: 'fairway' });
          sel = { list: 'bunkers', i: s.bunkers.length - 1 };
        } else if (k === 'pond' || k === 'creek' || k === 'sea') {
          if (tooMany('water', 3)) return;
          if (k === 'sea' && s.water.some((x) => x.kind === 'sea')) return void tell('The sea is already there.');
          s.water.push({ kind: k, along: k === 'creek' ? 0.5 : 0.55, across: k === 'pond' ? 2.2 * flip : 0, size: 'medium', side: flip > 0 ? 'right' : 'left' });
          sel = { list: 'water', i: s.water.length - 1 };
        } else if (k === 'trees') {
          if (tooMany('trees', 10)) return;
          s.trees.push({ along: 0.45, across: 2.3 * flip, count: 6, spread: 'loose' });
          sel = { list: 'trees', i: s.trees.length - 1 };
        } else {
          if (tooMany('mounds', 6)) return;
          s.mounds.push({ along: 0.4, across: 1.8 * flip, size: 'medium' });
          sel = { list: 'mounds', i: s.mounds.length - 1 };
        }
        changed();
      }),
  );
  el.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(
    (b) =>
      (b.onclick = async () => {
        const s = spec();
        const go = b.dataset.go!;
        if (go === 'remove' && sel && sel.list !== 'green') {
          s[sel.list].splice(sel.i, 1);
          sel = null;
          changed();
        } else if (go === 'copy') {
          w.holes.splice(at + 1, 0, { ...JSON.parse(JSON.stringify(s)), name: `${s.name} II`.slice(0, 30) });
          at += 1;
          sel = null;
          changed();
        } else if (go === 'drop') {
          if (!(await ask({ title: `Remove hole ${at + 1}?`, body: `${esc(s.name)} goes from the course.`, ok: 'Remove it', danger: true }))) return;
          w.holes.splice(at, 1);
          at = Math.max(0, at - 1);
          sel = null;
          changed();
        } else if (go === 'hole') {
          const hole = buildHole(s, `room-try-${at}`).hole;
          hole.yards = s.yards;
          closeRoom();
          document.body.classList.remove('room-open');
          testHole(snap, hole, () => navigate(`#/room/${w.id ?? 'new'}`));
        } else if (go === 'course' && w.id) {
          navigate(`#/preview/${roomId(w.id)}`);
        } else if (go === 'delete' && w.id) {
          if (!(await ask({ title: `Delete ${esc(w.name)}?`, body: 'It goes for good.', ok: 'Delete it', danger: true }))) return;
          try {
            await api.roomDelete(requireSession(), w.id);
            work = null;
            await refresh();
            navigate('#/room');
          } catch (x) {
            void tell((x as Error).message);
          }
        }
      }),
  );
}

async function save(snap: Snapshot) {
  const w = work!;
  const btn = document.getElementById('room-save') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const id = await api.roomSave(requireSession(), { id: w.id, name: w.name, tagline: w.tagline, holes: w.holes.map(tidy), draft: w.draft });
    w.id = id;
    w.dirty = false;
    await refresh();
    history.replaceState(null, '', `#/room/${id}`);
    const rows = await api.roomCourses(requireSession()).catch(() => [] as RoomCourse[]);
    draw(snap, rows);
  } catch (x) {
    void tell("Couldn't save", esc((x as Error).message));
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

// ---- the holo-table ----

type View = 'tee' | 'top' | 'green' | 'spin';
const LIFT = 2; // the ground's rises and falls, made easier to see
const PAL: Record<string, number> = { green: 0x7dffb2, fringe: 0x3fd99a, fairway: 0x22b38a, sand: 0xffd27a, rough: 0x0e5a66, water: 0x3aa0ff, off: 0x06222c };

const toWorld = (x: number, y: number, h: number) => new THREE.Vector3(x, h * LIFT, -y);

function emojiSprite(emoji: string, size = 26): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(8, 40, 56, 0.85)';
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#6ff6ff';
  g.lineWidth = 6;
  g.stroke();
  g.font = '68px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(size, size, 1);
  s.renderOrder = 10;
  return s;
}

type Hooks = { select: (s: Sel | null) => void; moved: () => void; dropped: () => void };

class Table {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 1, 8000);
  private controls: OrbitControls;
  private holo = new THREE.Group();
  private marks = new THREE.Group();
  private base = new THREE.Group();
  private raf = 0;
  private ro: ResizeObserver;
  private spec: HoleSpec | null = null;
  private hole: Hole | null = null;
  private sel: Sel | null = null;
  private hits: { obj: THREE.Object3D; sel: Sel }[] = [];
  private drag: { sel: Sel; start: HoleSpec; moved: boolean; x: number; y: number } | null = null;
  private rebuildAt = 0;
  private t0 = performance.now();

  constructor(
    private el: HTMLElement,
    private hooks: Hooks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x030a12);
    el.prepend(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0x030a12, 1400, 4200);
    this.scene.add(this.base, this.holo, this.marks);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 80;
    this.controls.maxDistance = 2600;
    this.controls.autoRotateSpeed = 0.6;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    const c = this.renderer.domElement;
    c.addEventListener('pointerdown', this.down);
    c.addEventListener('pointermove', this.move);
    c.addEventListener('pointerup', this.up);
    c.addEventListener('pointercancel', this.up);
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.controls.update();
      // the hologram hums: a slow shimmer on the grid
      const t = (performance.now() - this.t0) / 1000;
      const wire = this.holo.getObjectByName('wire') as THREE.Mesh | undefined;
      if (wire) (wire.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.04 * Math.sin(t * 2);
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.clear(this.holo);
    this.clear(this.marks);
    this.clear(this.base);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private clear(g: THREE.Group) {
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const x of mats) {
        (x as THREE.SpriteMaterial).map?.dispose();
        x.dispose();
      }
    });
    g.clear();
  }

  private resize() {
    const w = this.el.clientWidth || 1;
    const h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  show(spec: HoleSpec, hole: Hole, sel: Sel | null, reframe: boolean) {
    const first = !this.hole;
    this.spec = spec;
    this.hole = hole;
    this.sel = sel;
    this.ground();
    this.markers();
    if (first || reframe) this.view('tee');
  }

  select(sel: Sel | null) {
    this.sel = sel;
    this.markers();
  }

  view(v: View) {
    if (!this.hole) return;
    if (v === 'spin') {
      this.controls.autoRotate = !this.controls.autoRotate;
      return;
    }
    this.controls.autoRotate = false;
    const b = this.hole.bounds;
    const mid = toWorld((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 0);
    const len = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    const g = frameOf(this.spec!).green;
    if (v === 'top') {
      this.controls.target.copy(mid);
      this.camera.position.set(mid.x + 1, len * 1.1, mid.z + 1);
    } else if (v === 'green') {
      const gw = toWorld(g.x, g.y, heightAt(this.hole, g.x, g.y));
      this.controls.target.copy(gw);
      this.camera.position.set(gw.x - 60, gw.y + 120, gw.z + 200);
    } else {
      // from behind the tee, high enough to see the whole hole on its table
      this.controls.target.copy(mid);
      this.camera.position.set(mid.x * 0.3, len * 0.55, len * 0.42);
    }
    this.controls.update();
  }

  // the ground as a glowing grid: each surface its own colour, the property lit and everything off it dark
  private ground() {
    const h = this.hole!;
    this.clear(this.holo);
    this.clear(this.base);
    const { x0, y0, x1, y1 } = h.bounds;
    const span = Math.max(x1 - x0, y1 - y0);
    const step = Math.max(3, Math.min(8, span / 150));
    const nx = Math.ceil((x1 - x0) / step) + 1;
    const ny = Math.ceil((y1 - y0) / step) + 1;
    const pos = new Float32Array(nx * ny * 3);
    const col = new Float32Array(nx * ny * 3);
    const c = new THREE.Color();
    let low = Infinity;
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * step;
        const y = y0 + j * step;
        const p = { x, y };
        let z = heightAt(h, x, y);
        const on = inPoly(p, h.border);
        const wet = on && isWater(h, p);
        if (wet) z = Math.max(z, Math.max(...h.water.filter((w) => inPoly(p, w.poly)).map((w) => w.level)));
        const k = (j * nx + i) * 3;
        const v = toWorld(x, y, z);
        pos[k] = v.x;
        pos[k + 1] = v.y;
        pos[k + 2] = v.z;
        low = Math.min(low, v.y);
        const surf = surfaceAt(h, p);
        c.setHex(!on ? PAL.off : wet ? PAL.water : PAL[surf] ?? PAL.rough);
        col[k] = c.r;
        col[k + 1] = c.g;
        col[k + 2] = c.b;
      }
    const idx: number[] = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    const skin = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, side: THREE.DoubleSide }));
    skin.name = 'skin';
    const wire = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({ color: 0x8ff8ff, wireframe: true, transparent: true, opacity: 0.12, depthWrite: false }));
    wire.name = 'wire';
    wire.position.y = 0.3;
    this.holo.add(skin, wire);

    // the property line and the centre line
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(h.border.map((p) => toWorld(p.x, p.y, heightAt(h, p.x, p.y) + 1))),
      new THREE.LineBasicMaterial({ color: 0x6ff6ff, transparent: true, opacity: 0.9 }),
    );
    const f = frameOf(this.spec!);
    const centre = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(f.centre.map((p) => toWorld(p.x, p.y, heightAt(h, p.x, p.y) + 1.5))),
      new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 10, gapSize: 8, transparent: true, opacity: 0.45 }),
    );
    centre.computeLineDistances();
    this.holo.add(edge, centre);

    // the trees (and rocks, gorse and cacti), as small glowing spires
    if (h.posts.length) {
      const spire = new THREE.ConeGeometry(3.2, 14, 6);
      spire.translate(0, 7, 0);
      const trees = new THREE.InstancedMesh(spire, new THREE.MeshBasicMaterial({ color: 0x9dffcf, transparent: true, opacity: 0.85 }), h.posts.length);
      const m = new THREE.Matrix4();
      h.posts.forEach((p, i) => {
        const k = p.look === 'rock' || p.look === 'gorse' ? 0.45 : 1;
        m.makeScale(k, k, k).setPosition(toWorld(p.x, p.y, heightAt(h, p.x, p.y)));
        trees.setMatrixAt(i, m);
      });
      this.holo.add(trees);
    }

    // the table it floats over: a dark disc, a lit rim, and a beam of light up into the hologram
    const mid = toWorld((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const r = span * 0.62;
    const floor = low - 60;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, 14, 96), new THREE.MeshBasicMaterial({ color: 0x061620 }));
    disc.position.set(mid.x, floor - 7, mid.z);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 2.2, 8, 160), new THREE.MeshBasicMaterial({ color: 0x3fe6ff }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(mid.x, floor, mid.z);
    const rings = new THREE.Group();
    for (const k of [0.33, 0.66]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * k - 0.8, r * k + 0.8, 128), new THREE.MeshBasicMaterial({ color: 0x1b6c80, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(mid.x, floor + 0.2, mid.z);
      rings.add(ring);
    }
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.92, r * 0.98, 60, 96, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2bd9ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    beam.position.set(mid.x, floor + 30, mid.z);
    this.base.add(disc, rim, rings, beam);
  }

  // a marker over each thing on the hole: tap to pick it, drag to move it
  private markers() {
    const h = this.hole!;
    const s = tidy(this.spec!);
    const f = frameOf(s);
    this.clear(this.marks);
    this.hits = [];
    const add = (emoji: string, x: number, y: number, sel: Sel | null) => {
      const on = !!sel && JSON.stringify(sel) === JSON.stringify(this.sel);
      const z = heightAt(h, x, y);
      const sp = emojiSprite(emoji, on ? 34 : 24);
      sp.position.copy(toWorld(x, y, z)).add(new THREE.Vector3(0, 34, 0));
      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([toWorld(x, y, z), toWorld(x, y, z).add(new THREE.Vector3(0, 22, 0))]),
        new THREE.LineBasicMaterial({ color: on ? 0xffffff : 0x6ff6ff, transparent: true, opacity: 0.8 }),
      );
      this.marks.add(sp, stem);
      if (on) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(10, 13, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthTest: false, transparent: true }));
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(toWorld(x, y, z)).add(new THREE.Vector3(0, 1, 0));
        ring.renderOrder = 9;
        this.marks.add(ring);
      }
      if (sel) this.hits.push({ obj: sp, sel });
    };
    add('🏌️', h.tee.x, h.tee.y, null);
    add('⛳', f.green.x, f.green.y, { list: 'green' });
    s.bunkers.forEach((b, i) => {
      const p = f.place(b.along, b.across);
      add('⛱️', p.x, p.y, { list: 'bunkers', i });
    });
    s.water.forEach((w, i) => {
      const p = w.kind === 'sea' ? f.place(0.5, w.side === 'left' ? -2.8 : 2.8) : f.place(w.along, w.kind === 'creek' ? 0 : w.across);
      add(w.kind === 'sea' ? '🌊' : w.kind === 'creek' ? '〰️' : '💧', p.x, p.y, { list: 'water', i });
    });
    s.trees.forEach((t, i) => {
      const p = f.place(t.along, t.across);
      add(TREE[s.look], p.x, p.y, { list: 'trees', i });
    });
    s.mounds.forEach((m, i) => {
      const p = f.place(m.along, m.across);
      add('⛰️', p.x, p.y, { list: 'mounds', i });
    });
  }

  private ray(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    return rc;
  }

  private down = (e: PointerEvent) => {
    if (!this.hole) return;
    const rc = this.ray(e);
    const hit = rc.intersectObjects(this.hits.map((h) => h.obj), false)[0];
    if (!hit) {
      this.drag = null;
      this.tapAt = { x: e.clientX, y: e.clientY };
      return;
    }
    const sel = this.hits.find((h) => h.obj === hit.object)!.sel;
    this.controls.enabled = false;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.drag = { sel, start: JSON.parse(JSON.stringify(tidy(this.spec!))), moved: false, x: e.clientX, y: e.clientY };
    if (JSON.stringify(sel) !== JSON.stringify(this.sel)) {
      this.sel = sel;
      this.markers();
      this.hooks.select(sel);
    }
  };

  private tapAt: { x: number; y: number } | null = null;

  private move = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || !this.hole || !this.spec) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    // where the pointer meets the ground's level under the thing being dragged
    const rc = this.ray(e);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -heightAt(this.hole, this.hole.tee.x, this.hole.tee.y) * LIFT);
    const q = new THREE.Vector3();
    if (!rc.ray.intersectPlane(plane, q)) return;
    const p = { x: q.x, y: -q.z };
    const f = frameOf(d.start);
    const s = this.spec;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    if (d.sel.list === 'green') {
      const { along, across } = f.locate(p, 1.4);
      s.green.across = clamp(across / 0.8, -1, 1);
      // dragging the flag further or nearer changes the length too
      s.yards = clamp(Math.round((d.start.yards * along) / 5) * 5, 110, 600);
      s.par = parFor(s.yards);
    } else {
      const { along, across } = f.locate(p);
      const o = (s[d.sel.list] as { along: number; across: number }[])[d.sel.i];
      const w = d.sel.list === 'water' ? s.water[d.sel.i] : null;
      if (w?.kind === 'sea') return;
      o.along = clamp(along, w ? 0.1 : 0, w ? 0.95 : 1);
      if (w?.kind !== 'creek') o.across = clamp(across, -3.5, 3.5);
    }
    this.hooks.moved();
    // the hole rebuilds a few times a second while it moves, and the markers follow at once
    const now = performance.now();
    if (now - this.rebuildAt > 180) {
      this.rebuildAt = now;
      this.hole = build(s);
      this.ground();
    }
    this.markers();
  };

  private up = (e: PointerEvent) => {
    const d = this.drag;
    this.drag = null;
    this.controls.enabled = true;
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId);
    if (d?.moved && this.spec) {
      this.hole = build(this.spec);
      this.ground();
      this.markers();
      this.hooks.dropped();
      return;
    }
    // a tap on empty ground lets go of what was picked
    if (!d && this.tapAt && Math.hypot(e.clientX - this.tapAt.x, e.clientY - this.tapAt.y) < 4 && this.sel) {
      this.sel = null;
      this.markers();
      this.hooks.select(null);
    }
    this.tapAt = null;
  };
}
