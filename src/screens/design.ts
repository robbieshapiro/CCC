// The Design Desk (#/design, a hole: #/design/<id>): describe a mini golf hole, the architect (Claude) draws it
// from the club's parts, the test golfer tries it and sets its par, and you play it. Ask for changes, then send it
// to the Committee; approved holes go on the Members' Course at the bar.
import { api } from '../api';
import type { Design, Snapshot } from '../api/types';
import { askArchitect, tryHole } from '../designer/desk';
import { planCanvas } from '../designer/plan';
import { buildHole, tidy } from '../designer/spec';
import type { TryResult } from '../designer/check.worker';
import { hostChip } from '../host';
import { requireSession } from '../state';
import { esc, header, navigate, render } from '../ui';
import { testHole } from './round';

const LOOKS = [
  ['', 'Architect’s choice'],
  ['night', '🌙 Night'],
  ['day', '☀️ Day'],
  ['volcano', '🌋 Volcano'],
] as const;
const IDEAS = [
  'A pirate ship bridge over shark-infested slime, with a cannon-ball pendulum',
  'A haunted library: rows of stones like bookshelves, and a secret tunnel behind them',
  'A sunny garden hole with a pond and a plank, and a sneaky shortcut',
  'The cup inside a giant pumpkin at the end of a long zigzag',
];
const STATUS: Record<Design['status'], string> = { draft: 'Draft', submitted: 'With the Committee', approved: 'On the course', rejected: 'Not this time' };

// the test golfer's verdicts, by design id, for this visit
const tried = new Map<number, TryResult>();

export async function designDesk(snap: Snapshot, id?: number) {
  render(`
    ${header(snap.groupName, 'clubhouse')}
    <main class="desk">
      <section class="desk-head">
        <p class="eyebrow">The Design Desk</p>
        <h1>Design a hole</h1>
        ${hostChip('Describe a hole. The architect draws it, the greenkeeper tries it, you play it. The Committee has the final say. It usually does.')}
      </section>
      <section class="desk-new" id="desk-new">
        <textarea id="desk-prompt" maxlength="600" rows="3" placeholder="${esc(IDEAS[Math.floor(Math.random() * IDEAS.length)])}" aria-label="Describe your hole"></textarea>
        <div class="desk-looks" role="radiogroup" aria-label="Look">${LOOKS.map(([v, l], i) => `<button type="button" role="radio" data-look="${v}" aria-checked="${i === 0}">${l}</button>`).join('')}</div>
        <button class="btn" id="desk-draw">Draw it</button>
        <p class="error" id="desk-err" role="alert"></p>
      </section>
      <section id="desk-work" class="desk-work" hidden></section>
      <section id="desk-hole"></section>
      <section class="desk-mine"><h2>Your holes</h2><div id="desk-list"><p class="muted">Loading…</p></div></section>
    </main>`);
  let look = '';
  document.querySelectorAll<HTMLButtonElement>('[data-look]').forEach((b) => {
    b.onclick = () => {
      look = b.dataset.look ?? '';
      document.querySelectorAll('[data-look]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    };
  });
  document.getElementById('desk-draw')!.onclick = async () => {
    const text = (document.getElementById('desk-prompt') as HTMLTextAreaElement).value.trim();
    if (text.length < 8) return void (document.getElementById('desk-err')!.textContent = 'Tell the architect a little more.');
    document.getElementById('desk-err')!.textContent = '';
    const prompt = look ? `${text} (Look: ${look})` : text;
    await draw(snap, () => askArchitect({ prompt }));
  };
  const list = await api.myDesigns(requireSession()).catch(() => [] as Design[]);
  drawList(list);
  const open = id ? list.find((d) => d.id === id) : undefined;
  if (open) void show(snap, open);
}

function drawList(list: Design[]) {
  const el = document.getElementById('desk-list');
  if (!el) return;
  el.innerHTML = list.length
    ? `<ul class="desk-list">${list
        .map((d) => `<li><a href="#/design/${d.id}"><b>${esc(tidy(d.spec).name)}</b><span class="pill ${d.status}">${STATUS[d.status]}</span><small>${esc(d.prompt.slice(0, 80))}</small></a></li>`)
        .join('')}</ul>`
    : '<p class="muted">Nothing yet. The first one is always the hardest. Then they get harder.</p>';
}

const WORK = ['The architect is sharpening a pencil…', 'Drawing it up…', 'Arguing with the greenkeeper…', 'Measuring twice…'];

function working(on: boolean, text = WORK[0]) {
  const el = document.getElementById('desk-work')!;
  el.hidden = !on;
  el.innerHTML = on ? hostChip(`<span class="reg-thinking">${esc(text)}</span>`) : '';
  document.querySelectorAll<HTMLButtonElement>('#desk-draw, [data-change], [data-submit]').forEach((b) => (b.disabled = on));
}

// Ask the architect, have the test golfer try it, and if it can't be holed, send it back once with the reason
async function draw(snap: Snapshot, ask: () => ReturnType<typeof askArchitect>) {
  let i = 0;
  working(true);
  const tick = window.setInterval(() => working(true, WORK[++i % WORK.length]), 2600);
  try {
    let reply = await ask();
    if ('error' in reply) return void (document.getElementById('desk-err')!.textContent = reply.error);
    working(true, 'The greenkeeper is trying it…');
    let verdict = await tryHole(reply.spec);
    if (!verdict.ok) {
      working(true, 'Back to the drawing board…');
      const fix = await askArchitect({ id: reply.id, change: `${verdict.reason} Fix it so it can be holed in two to four strokes, keeping the idea.` });
      if (!('error' in fix)) {
        reply = fix;
        working(true, 'The greenkeeper is trying it again…');
        verdict = await tryHole(fix.spec);
      }
    }
    tried.set(reply.id, verdict);
    const list = await api.myDesigns(requireSession()).catch(() => [] as Design[]);
    drawList(list);
    const d = list.find((x) => x.id === reply.id) ?? { id: reply.id, prompt: '', spec: reply.spec, par: null, status: 'draft' as const, createdAt: new Date().toISOString() };
    history.replaceState(null, '', `#/design/${reply.id}`);
    await show(snap, d);
  } finally {
    window.clearInterval(tick);
    working(false);
  }
}

async function show(snap: Snapshot, d: Design) {
  const el = document.getElementById('desk-hole');
  if (!el) return;
  const spec = tidy(d.spec);
  const { hole, warnings } = buildHole(spec, `design-${d.id}`);
  let verdict = tried.get(d.id);
  const draft = d.status === 'draft';
  el.innerHTML = `
    <article class="desk-card">
      <div class="desk-plan" id="desk-plan"></div>
      <div class="desk-info">
        <p class="eyebrow">${esc(spec.look)} · ${esc(spec.shape.replace('-', ' '))} · ${Math.round(spec.length * 2.2)} ft</p>
        <h2>${esc(spec.name)}</h2>
        <p class="desk-par" id="desk-par">${d.par ? `Par ${d.par}` : verdict ? (verdict.ok ? `Par ${verdict.par}` : 'Not holeable yet') : 'The greenkeeper is trying it…'}</p>
        ${spec.review ? hostChip(esc(spec.review)) : ''}
        ${spec.hint ? `<p class="desk-hint">${esc(spec.hint)}</p>` : ''}
        <p class="fine" id="desk-warn">${warnings.map(esc).join(' ')}</p>
        <div class="desk-actions">
          <button class="btn" data-play>Play it</button>
          ${draft ? '<button class="btn ghost" data-submit>Send to the Committee</button>' : `<span class="pill ${d.status}">${STATUS[d.status]}</span>`}
        </div>
        ${
          draft
            ? `<div class="desk-change"><input id="desk-change" maxlength="400" placeholder="Change something: “make the ghost slower”" aria-label="Change it"><button class="btn ghost" data-change>Change it</button></div>`
            : ''
        }
        <p class="error" id="desk-card-err" role="alert"></p>
      </div>
    </article>`;
  document.getElementById('desk-plan')!.appendChild(planCanvas(hole, el.clientWidth > 600 ? 300 : Math.min(320, el.clientWidth - 40)));
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // the test golfer's par, if we don't have it yet
  if (!verdict && !d.par) {
    verdict = await tryHole(spec);
    tried.set(d.id, verdict);
    const par = document.getElementById('desk-par');
    if (par) par.textContent = verdict.ok ? `Par ${verdict.par}` : 'Not holeable yet';
  }
  el.querySelector<HTMLButtonElement>('[data-play]')!.onclick = () => testHole(snap, { ...hole, par: d.par ?? tried.get(d.id)?.par ?? 3 }, () => navigate(`#/design/${d.id}`));
  el.querySelector<HTMLButtonElement>('[data-change]')?.addEventListener('click', async () => {
    const change = (document.getElementById('desk-change') as HTMLInputElement).value.trim();
    if (change.length < 3) return;
    tried.delete(d.id);
    await draw(snap, () => askArchitect({ id: d.id, change }));
  });
  el.querySelector<HTMLButtonElement>('[data-submit]')?.addEventListener('click', async () => {
    const v = tried.get(d.id);
    const err = document.getElementById('desk-card-err')!;
    if (!v?.ok) return void (err.textContent = "The greenkeeper couldn't hole it. Ask for a change first.");
    try {
      await api.submitDesign(requireSession(), d.id, v.par);
      navigate(`#/design/${d.id}`);
    } catch (e) {
      err.textContent = (e as Error).message;
    }
  });
}

