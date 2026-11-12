// The Trophy Room, a Clubhouse tab: every plaque, earned ones engraved, the rest with how to get them and how far along
// you are, and the three you're closest to up top. Golfer cards show the same shelf for anyone (shelfHtml).
import { api } from '../api';
import type { TrophyProgress } from '../api/types';
import { requireSession } from '../state';
import { earned, near, payOf, plaques, type Plaque } from '../trophies';
import { money } from '../purse';
import { esc } from '../ui';

const GROUPS: Plaque['group'][] = ['Titles', 'Scoring', 'Skill', 'Course feats', 'Club life'];

export function trophyPane() {
  return `
    <div class="ch-head"><h1>The Trophy Room</h1><p class="muted" id="tr-count">Polishing the brass…</p></div>
    <div id="tr-room"><p class="muted">Loading…</p></div>`;
}

// what each plaque has paid you (from Nov 12; the ones held before then show as earned, unpaid)
let paid: Record<string, number> = {};

function plaque(pl: Plaque, p: TrophyProgress) {
  const got = earned(pl, p);
  const have = Math.min(pl.have(p), pl.need);
  const bar = !got && pl.need > 1 ? `<span class="tr-bar"><i style="width:${Math.round(near(pl, p) * 100)}%"></i></span><small>${have} of ${pl.need}</small>` : '';
  return `<div class="tr-plaque${got ? ' got' : ''}"><b>${esc(pl.name)}</b><span>${esc(pl.how)}</span>${got ? `<small class="tr-earned">Earned${paid[pl.id] ? ` · paid ${money(paid[pl.id])}` : ''}</small>` : `${bar}<small class="tr-pays">Pays ${money(payOf(pl.id))}</small>`}</div>`;
}

export async function fillTrophies() {
  // anything newly earned is paid first, so it shows here
  const fresh = await payTrophies();
  const [p, pd] = await Promise.all([api.trophyProgress(requireSession()).catch(() => null), api.trophyPaid(requireSession()).catch(() => ({}))]);
  paid = pd;
  void fresh;
  const el = document.getElementById('tr-room');
  const count = document.getElementById('tr-count');
  if (!el) return;
  if (!p) {
    el.innerHTML = '<p class="muted">The Trophy Room isn’t open yet. Check back soon.</p>';
    return;
  }
  const all = plaques();
  const got = all.filter((pl) => earned(pl, p));
  if (count) count.textContent = `${got.length} of ${all.length} earned. Every plaque comes from what you’ve already played.`;
  const next = all
    .filter((pl) => !earned(pl, p) && near(pl, p) > 0)
    .sort((a, b) => near(b, p) - near(a, p))
    .slice(0, 3);
  el.innerHTML = `
    ${next.length ? `<section class="tr-group tr-next"><h2>Closest to unlocking</h2><div class="tr-grid">${next.map((pl) => plaque(pl, p)).join('')}</div></section>` : ''}
    ${GROUPS.map((g) => {
      const list = all.filter((pl) => pl.group === g);
      if (g !== 'Course feats')
        return `<section class="tr-group"><h2>${g} <small>${list.filter((pl) => earned(pl, p)).length} of ${list.length}</small></h2><div class="tr-grid">${list.map((pl) => plaque(pl, p)).join('')}</div></section>`;
      const courses = [...new Set(list.map((pl) => pl.course!))];
      return `<section class="tr-group"><h2>${g} <small>${list.filter((pl) => earned(pl, p)).length} of ${list.length}</small></h2>${courses
        .map((c) => `<h3>${esc(c)}</h3><div class="tr-grid">${list.filter((pl) => pl.course === c).map((pl) => plaque(pl, p)).join('')}</div>`)
        .join('')}</section>`;
    }).join('')}`;
}

// a golfer card's shelf: what they've earned, and the count
export function shelfHtml(p: TrophyProgress) {
  const all = plaques();
  const got = all.filter((pl) => earned(pl, p));
  if (!got.length) return `<h2>Trophy shelf</h2><p class="muted">Nothing on the shelf yet.</p>`;
  return `<h2>Trophy shelf <small class="tr-of">${got.length} of ${all.length}</small></h2><div class="tr-shelf">${got.map((pl) => `<span class="tr-chip" title="${esc(pl.how)}">${esc(pl.name)}</span>`).join('')}</div>`;
}

// Pay any plaque newly earned, and say so: after a round, in the Trophy Room, after a bar game. `host`: where the
// money note shows (the round's screen); without one, a toast.
export async function payTrophies(host?: HTMLElement) {
  const fresh = await api.claimTrophies(requireSession()).catch(() => []);
  if (!fresh.length) return fresh;
  const names = new Map(plaques().map((pl) => [pl.id, pl.name]));
  const { coinPop } = await import('./round');
  fresh
    .filter((f) => f.amount > 0)
    .forEach((f, i) => window.setTimeout(() => coinPop(host ?? document.body, f.amount, `Trophy: ${names.get(f.plaque) ?? 'a new plaque'}`, 'In the Trophy Room'), i * 2400));
  return fresh;
}
