// The Design Desk (#/design, a design: #/design/<id>): describe a three-hole course (Nov 20), the architect (Claude)
// lays out all three holes (tee, fairway, green, bunkers, water, trees, the lie of the land) in one go, a quick check
// makes sure each is fair, and you try any of them. Ask for changes (to the course, or to one hole) as often as you
// like. Then play it to publish: that round is your mark, the score challengers have to beat, and it goes to the
// Committee. The newest approved course is the Members' Course. Older single holes are listed underneath.
import { api } from '../api';
import type { Design, Snapshot } from '../api/types';
import { askArchitect, isHole, tryHole } from '../designer/desk';
import { checkCourse, courseHoles, coursePar, courseYards, isCourse, tidyCourse, type CourseSpec } from '../designer/course';
import { buildHole, tidy } from '../designer/hole';
import { planCanvas } from '../designer/plan';
import { hostChip } from '../host';
import { requireSession } from '../state';
import { esc, header, navigate, render } from '../ui';
import { designerRound, testHole } from './round';

// worlds to start from: tap one and the architect builds it (sky, light, ground, water, trees, landmarks, what's
// beyond), or write any world you like in the box. Anything goes: it changes how the course looks, never how it plays.
const WORLDS = [
  ['', 'Architect’s choice', ''],
  ['🌲', 'Highland pines', 'parkland in the mountains: tall pines, oaks, a lake, mountains beyond'],
  ['🌋', 'Volcano', 'a volcanic island: black sand, rivers of lava, palms, embers in the air'],
  ['🌊', 'Seaside links', 'links on the coast: dunes, fescue, gorse, ruins, sheep, the sea alongside'],
  ['🌵', 'Desert', 'the desert: sand waste, cacti, red mesas, a hard bright sun'],
  ['🏜️', 'Red canyon', 'a red rock canyon: hoodoos, mesas, golden light'],
  ['🏔️', 'Snowy Alps', 'a ski resort: snowy firs, snow falling, a lodge, peaks all round'],
  ['🍁', 'Autumn farm', 'an autumn farm: maples turning, a red barn, silo, hay bales, pumpkins, leaves falling'],
  ['🐊', 'Florida swamp', 'a Florida swamp at sunset: sabal palms, live oaks, gators, egrets'],
  ['🌆', 'City skyline', 'a city course: towers all round, streetlights, the skyline beyond'],
  ['🌃', 'Neon night', 'a neon city at night: glowing greens, a dark purple sky, streetlights'],
  ['🌸', 'Cherry blossom', 'a spring garden: pink blossom trees, petals drifting, azaleas'],
  ['🌴', 'Tropical island', 'a tropical island: palms, white sand, turquoise sea all round'],
  ['🌕', 'The Moon', 'the Moon: grey dust, a black sky full of stars, craters, no trees, just rocks'],
  ['🍭', 'Candy land', 'candy land: pink and mint ground, a cotton-candy sky, confetti in the air'],
  ['🦖', 'Jurassic jungle', 'a prehistoric jungle: huge palms, a waterfall, steam, a green haze'],
  ['👻', 'Haunted', 'a haunted graveyard at night: dead trees, tombstones, lanterns, a giant pumpkin'],
  ['🎪', 'Carnival', 'a carnival at dusk: a big top, booths, a ferris wheel, confetti'],
  ['🏰', 'Castle ruins', 'old castle ruins on the moors: stone, gorse, sheep, grey skies'],
  ['🧊', 'Ice planet', 'an ice planet: pale blue ground, frozen lakes, snow, a strange green sky'],
  ['🔥', 'Inferno', 'an inferno: scorched red ground, lava everywhere, ash falling, a blood-red sky'],
  ['🌅', 'Sunset beach', 'a beach at golden hour: palms, sand, the sea, a big low sun'],
  ['🪐', 'Alien planet', 'an alien planet: purple grass, a teal sky, glowing slime pools, strange rocks'],
  ['🫧', 'Underwater', 'the sea floor: blue-green light, bubbles rising, coral-coloured rocks'],
  ['🎲', 'Surprise me', 'somewhere nobody has ever played golf: surprise me'],
] as const;
const IDEAS = [
  'A volcanic island course: a par 3 over lava, a risky par 4 along the sea, a par 5 into the crater',
  'Three holes on the Moon, the last a long par 5 across the craters',
  'A links course on the cliffs: wind, pot bunkers, and a par 3 to a green on the edge',
  'A candy land course with a lollipop forest and a chocolate river to carry',
  'A haunted graveyard course, a drivable par 4 in the middle',
];
const STATUS: Record<Design['status'], string> = { draft: 'Draft', submitted: 'With the Committee', approved: 'Approved', rejected: 'Not this time' };
const LOOK_NAME: Record<string, string> = { highlands: 'Highlands', caldera: 'Caldera', links: 'Links', desert: 'Desert' };
const worldOf = (c: CourseSpec, i: number) => c.world?.name ?? LOOK_NAME[c.holes[i].look];

export async function designDesk(snap: Snapshot, id?: number) {
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="desk">
      <section class="desk-head">
        <p class="eyebrow">The Design Desk</p>
        <h1>Design a course</h1>
        ${hostChip('Three holes, one idea. The architect lays them out, you play it first, and your score is the one to beat. The Committee has the final say. It usually does.')}
      </section>
      <section class="desk-new" id="desk-new">
        <textarea id="desk-prompt" maxlength="600" rows="3" placeholder="${esc(IDEAS[Math.floor(Math.random() * IDEAS.length)])}" aria-label="Describe your course"></textarea>
        <p class="desk-worlds-h">Pick a world, or write your own. Anything goes.</p>
        <div class="desk-looks" role="radiogroup" aria-label="World">${WORLDS.map(([e, l], i) => `<button type="button" role="radio" data-look="${i}" aria-checked="${i === 0}">${e ? `${e} ` : ''}${l}</button>`).join('')}</div>
        <button class="btn" id="desk-draw">Draw the course</button>
        <p class="error" id="desk-err" role="alert"></p>
      </section>
      <section id="desk-work" class="desk-work" hidden></section>
      <section id="desk-hole"></section>
      <section class="desk-mine"><h2>Your courses</h2><div id="desk-list"><p class="muted">Loading…</p></div></section>
    </main>`);
  let look = 0;
  document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) => {
    b.onclick = () => {
      look = Number(b.dataset.look ?? 0);
      document.querySelectorAll('[data-look]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    };
  });
  document.getElementById('desk-draw')!.onclick = async () => {
    const typed = (document.getElementById('desk-prompt') as HTMLTextAreaElement).value.trim();
    const world = WORLDS[look]?.[2] ?? '';
    // a world on its own is enough: the architect designs the holes to suit it
    const text = typed || (world ? `Three holes in ${world}` : '');
    if (text.length < 8) return void (document.getElementById('desk-err')!.textContent = 'Pick a world or tell the architect a little more.');
    document.getElementById('desk-err')!.textContent = '';
    await draw(snap, () => askArchitect({ prompt: world && typed ? `${typed} (World: ${world})` : text, kind: 'course' }));
  };
  const list = await mine();
  drawList(list);
  const open = id ? list.find((d) => d.id === id) : undefined;
  if (open) show(snap, open);
}

const mine = async () => (await api.myDesigns(requireSession()).catch(() => [] as Design[])).filter((d) => isCourse(d) || isHole(d));

function drawList(list: Design[]) {
  const el = document.getElementById('desk-list');
  if (!el) return;
  const courses = list.filter(isCourse);
  const holes = list.filter(isHole);
  const courseRow = (d: Design) => {
    const c = tidyCourse(d.spec as unknown as CourseSpec);
    return `<li><a href="#/design/${d.id}"><b>${esc(c.name)}</b><span class="pill ${d.status}">${STATUS[d.status]}</span><small>3 holes · par ${coursePar(c)} · ${courseYards(c)} yd${d.mark ? ` · your mark ${d.mark.total}` : ''}</small></a></li>`;
  };
  const holeRow = (d: Design) => {
    const s = tidy(d.spec);
    return `<li><a href="#/design/${d.id}"><b>${esc(s.name)}</b><span class="pill">${d.status === 'approved' ? 'Retired' : STATUS[d.status]}</span><small>A single hole · par ${s.par} · ${s.yards} yd</small></a></li>`;
  };
  el.innerHTML =
    (courses.length ? `<ul class="desk-list">${courses.map(courseRow).join('')}</ul>` : '<p class="muted">Nothing yet. The first one is always the hardest. Then they get harder.</p>') +
    (holes.length ? `<details class="desk-old"><summary>Your earlier single holes</summary><ul class="desk-list">${holes.map(holeRow).join('')}</ul></details>` : '');
}

const WORK = ['The architect is sharpening a pencil…', 'Walking the land…', 'Laying out the first hole…', 'Moving a bunker. Moving it back…', 'Arguing with the greenkeeper…', 'Measuring the yardage…', 'Now the third hole…'];

function working(on: boolean, text = WORK[0]) {
  const el = document.getElementById('desk-work')!;
  el.hidden = !on;
  el.innerHTML = on ? hostChip(`<span class="reg-thinking">${esc(text)}</span>`) : '';
  document.querySelectorAll<HTMLButtonElement>('#desk-draw, [data-change], [data-publish]').forEach((b) => (b.disabled = on));
}

// Ask the architect, run the quick check on every hole, and if it finds a problem, send it back once with the reasons
async function draw(snap: Snapshot, ask: () => ReturnType<typeof askArchitect>) {
  let i = 0;
  working(true);
  const tick = window.setInterval(() => working(true, WORK[++i % WORK.length]), 2800);
  try {
    let reply = await ask();
    if ('error' in reply) return void ((document.getElementById('desk-card-err') ?? document.getElementById('desk-err'))!.textContent = reply.error);
    const spec = reply.spec as unknown as CourseSpec;
    const check = spec.kind === 'course' ? checkCourse(spec) : tryHole(reply.spec);
    if (!check.ok) {
      working(true, 'Back to the drawing board…');
      const fix = await askArchitect({ id: reply.id, change: `${check.problems.join(' ')} Fix that, keeping the idea.` });
      if (!('error' in fix)) reply = fix;
    }
    const list = await mine();
    drawList(list);
    const d = list.find((x) => x.id === reply.id) ?? { id: reply.id, prompt: '', spec: reply.spec, par: null, status: 'draft' as const, createdAt: new Date().toISOString() };
    history.replaceState(null, '', `#/design/${reply.id}`);
    show(snap, d);
  } finally {
    window.clearInterval(tick);
    working(false);
  }
}

function show(snap: Snapshot, d: Design) {
  if (isCourse(d)) return showCourse(snap, d);
  showHole(snap, d);
}

// a course: its name and review, the three holes side by side (each to try), changes, and the round that publishes it
function showCourse(snap: Snapshot, d: Design) {
  const el = document.getElementById('desk-hole');
  if (!el) return;
  const c = tidyCourse(d.spec as unknown as CourseSpec);
  const holes = courseHoles(c, `design-${d.id}`);
  const check = checkCourse(c);
  const draft = d.status === 'draft';
  el.innerHTML = `
    <article class="desk-card desk-course">
      <div class="desk-info">
        <p class="eyebrow">A members’ course · 3 holes · par ${coursePar(c)} · ${courseYards(c).toLocaleString('en-US')} yd</p>
        <h2>${esc(c.name)}</h2>
        ${c.review ? hostChip(esc(c.review)) : ''}
      </div>
      <ol class="desk-holes">${c.holes
        .map(
          (h, i) => `<li><div class="desk-plan" data-plan="${i}"></div>
            <p class="eyebrow">Hole ${i + 1} · ${esc(worldOf(c, i))}</p><b>${esc(h.name)}</b><span class="desk-par">Par ${h.par} · ${h.yards} yd</span>
            ${h.hint ? `<p class="desk-hint">${esc(h.hint)}</p>` : ''}
            <button class="btn ghost small" data-try="${i}">Try it</button></li>`,
        )
        .join('')}</ol>
      ${check.problems.length ? `<p class="fine error">${check.problems.map(esc).join(' ')}</p>` : ''}
      ${
        draft
          ? `<div class="desk-change"><input id="desk-change" maxlength="400" placeholder="Change something: “hole 2: move the pond to the left”" aria-label="Change it"><button class="btn ghost" data-change>Change it</button></div>
             <div class="desk-actions"><button class="btn gold" data-publish>Play it to publish</button><span class="fine">Your score is the mark to beat. Then it goes to the Committee.</span></div>`
          : `<div class="desk-actions"><span class="pill ${d.status}">${STATUS[d.status]}</span>${d.mark ? `<span class="desk-mark">Your mark: <b>${d.mark.total}</b> (${d.mark.holes.join(', ')})</span>` : ''}</div>`
      }
      <p class="error" id="desk-card-err" role="alert"></p>
    </article>`;
  const w = Math.min(200, Math.max(90, (el.clientWidth - 90) / 3));
  holes.forEach((h, i) => el.querySelector(`[data-plan="${i}"]`)!.appendChild(planCanvas(h, w)));
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.querySelectorAll<HTMLButtonElement>('[data-try]').forEach((b) => (b.onclick = () => testHole(snap, holes[Number(b.dataset.try)], () => navigate(`#/design/${d.id}`))));
  el.querySelector<HTMLButtonElement>('[data-change]')?.addEventListener('click', async () => {
    const change = (document.getElementById('desk-change') as HTMLInputElement).value.trim();
    if (change.length < 3) return;
    await draw(snap, () => askArchitect({ id: d.id, change }));
  });
  el.querySelector<HTMLButtonElement>('[data-publish]')?.addEventListener('click', () => {
    const err = document.getElementById('desk-card-err')!;
    if (!check.ok) return void (err.textContent = 'Fix the problems first: ask for a change.');
    designerRound(
      snap,
      holes,
      async (mark) => {
        try {
          await api.postDesignerRound(requireSession(), d.id, mark);
          navigate(`#/design/${d.id}`);
        } catch (e) {
          navigate(`#/design/${d.id}`);
          window.setTimeout(() => {
            const x = document.getElementById('desk-card-err');
            if (x) x.textContent = (e as Error).message;
          }, 600);
        }
      },
      () => navigate(`#/design/${d.id}`),
    );
  });
}

// an older single hole: shown and playable, but it no longer goes anywhere (the Members' Course is courses now)
function showHole(snap: Snapshot, d: Design) {
  const el = document.getElementById('desk-hole');
  if (!el) return;
  const spec = tidy(d.spec);
  const { hole } = buildHole(spec, `design-${d.id}`);
  el.innerHTML = `
    <article class="desk-card">
      <div class="desk-plan" id="desk-plan"></div>
      <div class="desk-info">
        <p class="eyebrow">${LOOK_NAME[spec.look]} · a single hole</p>
        <h2>${esc(spec.name)}</h2>
        <p class="desk-par">Par ${spec.par} · ${spec.yards} yards</p>
        ${spec.review ? hostChip(esc(spec.review)) : ''}
        ${spec.hint ? `<p class="desk-hint">${esc(spec.hint)}</p>` : ''}
        <div class="desk-actions"><button class="btn" data-play>Play it</button></div>
        <p class="fine">The Members’ Course is three-hole courses now. Draw one above.</p>
      </div>
    </article>`;
  document.getElementById('desk-plan')!.appendChild(planCanvas(hole, el.clientWidth > 600 ? 260 : Math.min(300, el.clientWidth - 40)));
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => testHole(snap, hole, () => navigate(`#/design/${d.id}`));
}
