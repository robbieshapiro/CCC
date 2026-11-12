// What Mo knows. He stands behind the bar all day, so he's seen the boards: who's hot, what's worth a go tonight, where
// you stand, and who from another club you ought to meet. Every line is built from live numbers, no AI.
import type { BarBoard, DailyState, OpenRow, Snapshot } from '../api/types';
import { scoreLabel } from '../bar';
import { bestTry, dailyShot, resultLabel } from '../daily';
import { toParLabel } from '../standings';
import { golferHref } from '../ui';

// href/cta: somewhere the line points (a member's card, a game)
export type MoLine = { text: string; href?: string; cta?: string };

const place = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;

export function moKnows(d: {
  snap: Snapshot;
  welcome: string;
  daily: DailyState | null;
  drive: BarBoard | null;
  midway: BarBoard | null;
  waiting: number;
  open: OpenRow[] | null;
}): MoLine[] {
  const { snap } = d;
  const lines: MoLine[] = [{ text: d.welcome }];
  const shot = dailyShot(snap.today);

  // something sent your way comes first
  if (d.waiting) lines.push({ text: `Word is someone's left ${d.waiting === 1 ? 'a little something' : `${d.waiting} little somethings`} for your next Midway round. I didn't see who.`, href: '#/bar/midway', cta: 'To the Midway' });

  // the Open, and the people in it you don't know yet
  const open = (d.open ?? []).slice().sort((a, b) => a.total - a.par - (b.total - b.par));
  const me = open.findIndex((r) => r.mine);
  const club = snap.groupName;
  const away = (r: OpenRow) => !r.mine && r.club !== club;
  if (open.length) {
    const top = open[0];
    if (me === 0) lines.push({ text: `You're leading the Open at ${toParLabel(top.total - top.par)}. Everyone in here knows it.` });
    else if (away(top)) lines.push({ text: `${top.name} from ${top.club} leads the Open at ${toParLabel(top.total - top.par)}. Not one of ours. Go and have a look.`, href: golferHref(top.playerId), cta: `Meet ${top.name}` });
    else if (!top.mine) lines.push({ text: `${top.name} leads the Open at ${toParLabel(top.total - top.par)}. One of ours, at least.`, href: golferHref(top.localId ?? top.playerId), cta: `${top.name}'s card` });
    if (me > 0) {
      const mine = open[me];
      // the nearest person above you from another club: someone to chase
      const ahead = open.slice(0, me).reverse().find(away);
      if (ahead) {
        const gap = mine.total - mine.par - (ahead.total - ahead.par);
        lines.push({
          text: gap === 0 ? `You're ${place(me + 1)} in the Open, level with ${ahead.name} from ${ahead.club}. You two should meet.` : `You're ${place(me + 1)} in the Open. ${ahead.name} from ${ahead.club} is ${gap === 1 ? 'one shot' : `${gap} shots`} ahead of you. Worth knowing who that is.`,
          href: golferHref(ahead.playerId),
          cta: `Meet ${ahead.name}`,
        });
      } else lines.push({ text: `You're ${place(me + 1)} in the Open at ${toParLabel(mine.total - mine.par)}.` });
    } else if (me < 0) lines.push({ text: `${open.length} cards in the Open this week and none of them yours. The first tee's that way.`, href: '#/round', cta: 'Play today’s card' });
    // how the clubs are doing against each other: best card each
    const best = new Map<string, number>();
    for (const r of open) best.set(r.club, Math.min(best.get(r.club) ?? 99, r.total - r.par));
    if (best.size > 1) {
      const ranked = [...best.entries()].sort((a, b) => a[1] - b[1]);
      lines.push({ text: `Club against club: ${ranked.map(([c, v]) => `${c} ${toParLabel(v)}`).join(', ')}. That's each club's best card.` });
    }
  }

  // tonight's games
  if (d.daily) {
    const lead = d.daily.board[0];
    const mine = d.daily.mine.length ? bestTry(d.daily.mine) : null;
    if (!mine) lines.push({ text: lead ? `Closest to the Pin is ${shot.label} today. ${lead.name} ${lead.holed ? 'holed it' : `is in to ${resultLabel({ ft: lead.ft, holed: false, lost: false })}`}. You've three tries.` : `Closest to the Pin is ${shot.label} today and nobody's had a go. Three tries.`, href: '#/daily', cta: 'Have a go' });
    else if (lead && !lead.mine) lines.push({ text: `${lead.name} has the pin today${lead.holed ? ', holed out' : ` at ${resultLabel({ ft: lead.ft, holed: false, lost: false })}`}. You're at ${resultLabel(mine)}.` });
    else if (lead?.mine) lines.push({ text: `Closest to the Pin is yours so far today. Don't let it go to your head.` });
  }
  if (d.drive?.board[0]) {
    const lead = d.drive.board[0];
    lines.push(lead.mine ? { text: `Longest drive of the week is yours: ${scoreLabel('drive', lead.score)}. The net's still standing.` } : { text: `${lead.name} put one out ${scoreLabel('drive', lead.score)} on the long drive. Three swings, two with a fireball.`, href: '#/bar/drive', cta: 'Swing' });
  }
  if (d.midway && !d.midway.playedToday) lines.push({ text: "Today's Midway round is still waiting. One a day counts.", href: '#/bar/midway', cta: 'To the Midway' });
  return lines;
}
