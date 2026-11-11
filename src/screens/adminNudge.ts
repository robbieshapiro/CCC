// "Text the group": the Committee Room writes a short nudge from the live board, for Robbie to send to the group chat
// himself. Nothing is sent by the club. The draft can be edited before it goes. No AI: it's built from the numbers.
import type { Snapshot } from '../api/types';
import { courseFor } from '../golf3d/courses';
import { openPurseOn, periodClosesAt } from '../day';
import { money, OPEN_FLOOR, purseOf } from '../purse';
import { board, toParLabel } from '../standings';
import { esc } from '../ui';
import { copyBox } from '../dialog';

const BACK = ['', 'one', 'two'];
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export function nudgeText(snap: Snapshot, now = Date.now()): string {
  const course = courseFor(snap.month);
  const name = course.name.replace(/ Course$/, '');
  const ends = periodClosesAt(snap.month).getTime();
  const days = Math.ceil((ends - now) / 86_400_000);
  const weekday = new Date(ends - 1).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  const who = (id: string) => snap.players.find((p) => p.id === id)?.name ?? '?';
  const rows = board(snap);
  const played = rows.filter((r) => r.best);
  const lines: string[] = [];

  // when
  if (days <= 1) lines.push(`⛳ Last day on ${name}. It closes at midnight ET tonight.`);
  else if (days >= 6) lines.push(`⛳ ${name} is open: ${course.holes.length} holes, par ${course.par}. It runs till ${weekday} midnight ET.`);
  else lines.push(`⛳ ${name} closes ${weekday} at midnight ET, ${days} days left.`);

  // who's leading, and who's close
  if (!played.length) lines.push("Nobody's posted a card yet. First one sets the bar.");
  else {
    const top = played.filter((r) => r.rank === 1);
    lines.push(`${list(top.map((r) => who(r.playerId)))} ${top.length > 1 ? 'lead' : 'leads'} at ${toParLabel(top[0].toPar)}.`);
    for (const gap of [1, 2]) {
      const near = played.filter((r) => r.toPar - top[0].toPar === gap);
      if (near.length) lines.push(`${list(near.map((r) => who(r.playerId)))} ${near.length > 1 ? 'are' : 'is'} ${BACK[gap]} back.`);
    }
  }

  // how many are in
  const left = rows.length - played.length;
  if (played.length) lines.push(left ? `${played.length} of ${rows.length} have a card in, ${left} still to play.` : `All ${rows.length} have a card in.`);
  lines.push(openPurseOn(snap.month) ? `${money(OPEN_FLOOR)}+ Open purse, top 10 paid.` : `${money(purseOf(played.length))} purse, top 10 paid.`);
  return lines.join(' ');
}

const clubLink = () => `${location.origin}${location.pathname}`;
const canShare = () => typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches;

export function nudgeSection(snap: Snapshot) {
  return `<section class="adm-card adm-nudge">
    <h2>Text the group</h2>
    <p class="muted">A nudge from today's board, for you to send. Change anything before it goes.</p>
    <textarea id="adm-nudge" rows="5" maxlength="1000">${esc(nudgeText(snap))}</textarea>
    <div class="adm-actions"><button class="btn" id="adm-nudge-send">${canShare() ? '💬 Share to the group' : 'Copy the text'}</button><button class="link" id="adm-nudge-reset">Start over</button></div>
  </section>`;
}

export function bindNudge(snap: Snapshot) {
  const box = document.getElementById('adm-nudge') as HTMLTextAreaElement | null;
  const send = document.getElementById('adm-nudge-send') as HTMLButtonElement | null;
  if (!box || !send) return;
  (document.getElementById('adm-nudge-reset') as HTMLButtonElement).onclick = () => (box.value = nudgeText(snap));
  send.onclick = async () => {
    const text = `${box.value.trim()}\n${clubLink()}`;
    try {
      // the share sheet picks the group chat; the link goes in the text so it comes out the same everywhere
      if (canShare()) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        send.textContent = 'Copied';
      }
    } catch (x) {
      if ((x as Error).name !== 'AbortError') void copyBox('Copy this text', text);
    }
  };
}
