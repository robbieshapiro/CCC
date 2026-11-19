// A member's face beside their name (Nov 19): wherever a name shows on home, at the bar and on the boards. The row's own
// avatar when the server sent one (from any club), else this club's member of that id or name; nothing if neither.
import type { Avatar } from './api/types';
import { portrait } from './avatar';
import { snapshot } from './state';

export function face(who: { avatar?: Avatar | null; playerId?: string | null; name?: string | null }, size = 24): string {
  const s = snapshot();
  const name = who.name?.toLowerCase();
  const av = who.avatar ?? s?.players.find((p) => (who.playerId && p.id === who.playerId) || (name && p.name.toLowerCase() === name))?.avatar;
  return av ? `<span class="face" style="--fs:${size}px">${portrait(av, size)}</span>` : '';
}
