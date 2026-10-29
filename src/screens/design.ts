// The Design Desk (#/design, a hole: #/design/<id>): describe a golf hole, the architect (Claude) lays it out (tee,
// fairway, green, bunkers, water, trees, the lie of the land) in one of four looks, a quick check makes sure it's
// fair, and you play it. Ask for changes, then send it to the Committee; approved holes go on the Members' Course
// at the bar.
import { api } from '../api';
import type { Design, Snapshot } from '../api/types';
import { askArchitect, isHole, tryHole } from '../designer/desk';
import { buildHole, tidy } from '../designer/hole';
import { planCanvas } from '../designer/plan';
import { hostChip } from '../host';
import { requireSession } from '../state';
import { esc, header, navigate, render } from '../ui';
import { testHole } from './round';

const LOOKS = [
  ['', 'Architect’s choice'],
  ['highlands', '🌲 Highlands'],
  ['caldera', '🌋 Caldera'],
  ['links', '🌊 Links'],
  ['desert', '🌵 Desert'],
] as const;
const PARS = [
  ['', 'Any par'],
  ['3', 'Par 3'],
  ['4', 'Par 4'],
  ['5', 'Par 5'],
] as const;
const IDEAS = [
  'A short par 4 over a ravine, drivable if you dare, with a tiny green',
  'A par 3 to an island green, Sawgrass style, with the wind off the sea',
  'A long par 5 through a desert canyon with a waste bunker you have to carry',
  'A dogleg right around a lake with pines down the left',
];
const STATUS: Record<Design['status'], string> = { draft: 'Draft', submitted: 'With the Committee', approved: 'On the course', rejected: 'Not this time' };
const LOOK_NAME: Record<string, string> = { highlands: 'Highlands', caldera: 'Caldera', links: 'Links', desert: 'Desert' };

export async function designDesk(snap: Snapshot, id?: number) {
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="desk">
      <section class="desk-head">
        <p class="eyebrow">The Design Desk</p>
        <h1>Design a hole</h1>
        ${hostChip('Describe the hole you’ve always wanted to play. The architect lays it out, you play it, the Committee has the final say. It usually does.')}
      </section>
      <section class="desk-new" id="desk-new">
        <textarea id="desk-prompt" maxlength="600" rows="3" placeholder="${esc(IDEAS[Math.floor(Math.random() * IDEAS.length)])}" aria-label="Describe your hole"></textarea>
        <div class="desk-looks" role="radiogroup" aria-label="Look">${LOOKS.map(([v, l], i) => `<button type="button" role="radio" data-look="${v}" aria-checked="${i === 0}">${l}</button>`).join('')}</div>
        <div class="desk-looks" role="radiogroup" aria-label="Par">${PARS.map(([v, l], i) => `<button type="button" role="radio" data-par="${v}" aria-checked="${i === 0}">${l}</button>`).join('')}</div>
        <button class="btn" id="desk-draw">Draw it</button>
        <p class="error" id="desk-err" role="alert"></p>
      </section>
      <section id="desk-work" class="desk-work" hidden></section>
      <section id="desk-hole"></section>
      <section class="desk-mine"><h2>Your holes</h2><div id="desk-list"><p class="muted">Loading…</p></div></section>
    </main>`);
  let look = '';
  let par = '';
  const radio = (attr: string, set: (v: string) => void) =>
    document.querySelectorAll<HTMLButtonElement>(`[${attr}]`).forEach((b) => {
      b.onclick = () => {
        set(b.getAttribute(attr) ?? '');
        document.querySelectorAll(`[${attr}]`).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      };
    });
  radio('data-look', (v) => (look = v));
  radio('data-par', (v) => (par = v));
  document.getElementById('desk-draw')!.onclick = async () => {
    const text = (document.getElementById('desk-prompt') as HTMLTextAreaElement).value.trim();
    if (text.length < 8) return void (document.getElementById('desk-err')!.textContent = 'Tell the architect a little more.');
    document.getElementById('desk-err')!.textContent = '';
    const asks = [look && `Look: ${LOOK_NAME[look]}`, par && `Par ${par}`].filter(Boolean).join(', ');
    await draw(snap, () => askArchitect({ prompt: asks ? `${text} (${asks})` : text }));
  };
  const list = (await api.myDesigns(requireSession()).catch(() => [] as Design[])).filter(isHole);
  drawList(list);
  const open = id ? list.find((d) => d.id === id) : undefined;
  if (open) show(snap, open);
}

function drawList(list: Design[]) {
  const el = document.getElementById('desk-list');
  if (!el) return;
  el.innerHTML = list.length
    ? `<ul class="desk-list">${list
        .map((d) => {
          const s = tidy(d.spec);
          return `<li><a href="#/design/${d.id}"><b>${esc(s.name)}</b><span class="pill ${d.status}">${STATUS[d.status]}</span><small>Par ${s.par} · ${s.yards} yd · ${LOOK_NAME[s.look]} · ${esc(d.prompt.slice(0, 70))}</small></a></li>`;
        })
        .join('')}</ul>`
    : '<p class="muted">Nothing yet. The first one is always the hardest. Then they get harder.</p>';
}

const WORK = ['The architect is sharpening a pencil…', 'Walking the land…', 'Moving a bunker. Moving it back…', 'Arguing with the greenkeeper…', 'Measuring the yardage…'];

function working(on: boolean, text = WORK[0]) {
  const el = document.getElementById('desk-work')!;
  el.hidden = !on;
  el.innerHTML = on ? hostChip(`<span class="reg-thinking">${esc(text)}</span>`) : '';
  document.querySelectorAll<HTMLButtonElement>('#desk-draw, [data-change], [data-submit]').forEach((b) => (b.disabled = on));
}

// Ask the architect, run the quick check, and if it finds a problem, send it back once with the reason
async function draw(snap: Snapshot, ask: () => ReturnType<typeof askArchitect>) {
  let i = 0;
  working(true);
  const tick = window.setInterval(() => working(true, WORK[++i % WORK.length]), 2800);
  try {
    let reply = await ask();
    if ('error' in reply) return void (document.getElementById('desk-err')!.textContent = reply.error);
    const check = tryHole(reply.spec);
    if (!check.ok) {
      working(true, 'Back to the drawing board…');
      const fix = await askArchitect({ id: reply.id, change: `${check.problems.join(' ')} Fix that, keeping the idea.` });
      if (!('error' in fix)) reply = fix;
    }
    const list = (await api.myDesigns(requireSession()).catch(() => [] as Design[])).filter(isHole);
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
  const el = document.getElementById('desk-hole');
  if (!el) return;
  const spec = tidy(d.spec);
  const { hole } = buildHole(spec, `design-${d.id}`);
  const check = tryHole(spec, `design-${d.id}`);
  const draft = d.status === 'draft';
  const notes = [...check.problems, ...check.warnings];
  el.innerHTML = `
    <article class="desk-card">
      <div class="desk-plan" id="desk-plan"></div>
      <div class="desk-info">
        <p class="eyebrow">${LOOK_NAME[spec.look]} · ${esc(spec.shape.replace('-', ' '))} · ${esc(spec.elevation.replace('-', ' '))}</p>
        <h2>${esc(spec.name)}</h2>
        <p class="desk-par">Par ${spec.par} · ${spec.yards} yards</p>
        ${spec.review ? hostChip(esc(spec.review)) : ''}
        ${spec.hint ? `<p class="desk-hint">${esc(spec.hint)}</p>` : ''}
        ${notes.length ? `<p class="fine ${check.ok ? '' : 'error'}">${notes.map(esc).join(' ')}</p>` : ''}
        <div class="desk-actions">
          <button class="btn" data-play>Play it</button>
          ${draft ? '<button class="btn ghost" data-submit>Send to the Committee</button>' : `<span class="pill ${d.status}">${STATUS[d.status]}</span>`}
        </div>
        ${
          draft
            ? `<div class="desk-change"><input id="desk-change" maxlength="400" placeholder="Change something: “move the pond to the left”" aria-label="Change it"><button class="btn ghost" data-change>Change it</button></div>`
            : ''
        }
        <p class="error" id="desk-card-err" role="alert"></p>
      </div>
    </article>`;
  document.getElementById('desk-plan')!.appendChild(planCanvas(hole, el.clientWidth > 600 ? 260 : Math.min(300, el.clientWidth - 40)));
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => testHole(snap, hole, () => navigate(`#/design/${d.id}`));
  el.querySelector<HTMLButtonElement>('[data-change]')?.addEventListener('click', async () => {
    const change = (document.getElementById('desk-change') as HTMLInputElement).value.trim();
    if (change.length < 3) return;
    await draw(snap, () => askArchitect({ id: d.id, change }));
  });
  el.querySelector<HTMLButtonElement>('[data-submit]')?.addEventListener('click', async () => {
    const err = document.getElementById('desk-card-err')!;
    if (!check.ok) return void (err.textContent = 'Fix the problems first: ask for a change.');
    try {
      await api.submitDesign(requireSession(), d.id, spec.par);
      navigate(`#/design/${d.id}`);
    } catch (e) {
      err.textContent = (e as Error).message;
    }
  });
}
