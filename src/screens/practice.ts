// Practice sessions: joined when a member steps onto the range, the short game area or a practice round of the next
// course, and ended when they leave. Nothing goes on the board; the admin's practice log counts them.
import { api } from '../api';
import type { PracticeKind } from '../api/types';
import { requireSession } from '../state';
import { esc, render } from '../ui';

let current: { end: () => void } | null = null;

// Join a session. If the club can't log it (offline, say) the practice still goes ahead.
export function joinPractice(kind: PracticeKind) {
  leavePractice();
  const session = requireSession();
  let shots = 0;
  let ended = false;
  const id = api.startPractice(session, kind).catch(() => null);
  const end = () => {
    if (ended) return;
    ended = true;
    window.removeEventListener('pagehide', end);
    void id.then((n) => (n ? api.endPractice(session, n, shots) : undefined)).catch(() => {});
  };
  // closing the tab counts as leaving, if the browser lets the request out
  window.addEventListener('pagehide', end);
  current = { end };
  return { shot: () => shots++ };
}

export function leavePractice() {
  current?.end();
  current = null;
}

// The practice facility: the range and the short game area. Open to every member, any month.
export function facility() {
  render(`
    <main class="narrow facility">
      <p class="eyebrow">Practice facility</p>
      <h1>Warm up, or work on it</h1>
      <p class="muted">Nothing counts. Just practice.</p>
      <div class="facility-choice">
        <a class="panel" href="#/facility/range"><h2>Driving range</h2><p class="muted">Long shots</p></a>
        <a class="panel" href="#/facility/shortgame"><h2>Short game</h2><p class="muted">Chips and putts</p></a>
      </div>
      <p><a class="link" href="#/">Back to the club</a></p>
    </main>`);
}

// On the home page, for everyone: the way to the range.
export function facilityPanel() {
  return `
    <section class="panel coming-soon facility-panel">
      <div>
        <p class="eyebrow">Practice facility</p>
        <h2>Range &amp; short game</h2>
        <p class="muted">Nothing counts. Just practice.</p>
      </div>
      <a class="btn" href="#/facility">Hit the range</a>
    </section>`;
}

const KIND: Record<PracticeKind, string> = { caldera: 'Caldera practice', range: 'Range', shortgame: 'Short game' };
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

// For the admin: who has been practising this month. Their own sessions are left out.
export function practiceLogPanel(admin: boolean) {
  if (!admin) return '';
  return `<section class="panel admin practice-log"><div class="board-head"><h2>Practice log</h2><span class="muted">This month, members only</span></div><div id="pl-body"><p class="muted">Loading…</p></div></section>`;
}

export async function bindPracticeLog() {
  if (!document.getElementById('pl-body')) return;
  const r = await api.practiceReport(requireSession()).catch(() => null);
  const body = document.getElementById('pl-body');
  if (!body) return;
  if (!r) {
    body.innerHTML = `<p class="muted">Couldn't load the practice log. If the practice SQL hasn't been run in Supabase yet, run it and this fills in.</p>`;
    return;
  }
  const rows = (Object.keys(KIND) as PracticeKind[]).map((k) => {
    const x = r.kinds.find((y) => y.kind === k);
    return `<tr><td>${KIND[k]}</td><td class="num">${x?.sessions ?? 0}</td><td class="num">${x?.members ?? 0}</td><td class="num">${x?.minutes ?? 0}</td></tr>`;
  });
  body.innerHTML = `
    <table class="practice-table"><thead><tr><th></th><th class="num">Sessions</th><th class="num">Members</th><th class="num">Minutes</th></tr></thead><tbody>${rows.join('')}</tbody></table>
    ${
      r.members.length
        ? `<details><summary>By member</summary>
            <table class="practice-table"><thead><tr><th>Member</th><th class="num">Caldera</th><th class="num">Range</th><th class="num">Short</th><th>Last</th></tr></thead>
            <tbody>${r.members.map((m) => `<tr><td>${esc(m.name)}</td><td class="num">${m.caldera}</td><td class="num">${m.range}</td><td class="num">${m.shortgame}</td><td><small>${when(m.lastAt)}</small></td></tr>`).join('')}</tbody></table>
          </details>
          <details><summary>Recent sessions</summary>
            <ul class="practice-recent">${r.recent
              .map((x) => {
                const mins = x.endedAt ? Math.max(1, Math.round((Date.parse(x.endedAt) - Date.parse(x.startedAt)) / 60000)) : 0;
                return `<li><b>${esc(x.name)}</b> ${KIND[x.kind]} <small>${when(x.startedAt)} · ${x.endedAt ? `${mins} min, ${x.shots} shots` : "didn't check out"}</small></li>`;
              })
              .join('')}</ul>
          </details>`
        : '<p class="muted">No member practice yet this month.</p>'
    }`;
}
