import type { Avatar } from './api/types';
import { DEFAULT_SPEC, golferThumb, type GolferSpec } from './golf3d/golfer';

const COLORS = ['#c0623b', '#d9a441', '#6f8f7a', '#4f6d8f', '#8c4a5c', '#3f3a36', '#b8875a', '#e8dcc6'];
const SKINS = ['#f3d5b5', '#e2b48b', '#c68c62', '#94603f', '#5f3c27'];
const HAIR_COLORS = ['#2b1d14', '#5a3a22', '#a8743f', '#e0be7a', '#1a1a1a'];

export type Pose = 'idle' | 'cheer' | 'groan';

function hairShapes(style: string, c: string): { back: string; front: string } {
  switch (style) {
    case 'long':
      return {
        back: `<path d="M23 22 Q22 6 40 5 Q58 6 57 22 L59 50 Q50 54 47 44 L33 44 Q30 54 21 50 Z" fill="${c}"/>`,
        front: `<path d="M26 20 Q30 8 40 8 Q52 8 55 20 Q46 14 40 16 Q33 13 26 20 Z" fill="${c}"/>`,
      };
    case 'curly':
      return {
        back: '',
        front: [18, 26, 34, 42, 50, 58].map((x, i) => `<circle cx="${x + 2}" cy="${i % 2 ? 9 : 12}" r="7" fill="${c}"/>`).join('') +
          `<circle cx="22" cy="20" r="6" fill="${c}"/><circle cx="58" cy="20" r="6" fill="${c}"/>`,
      };
    case 'bun':
      return {
        back: `<circle cx="40" cy="3" r="8" fill="${c}"/>`,
        front: `<path d="M24 22 Q24 7 40 7 Q56 7 56 22 Q48 13 40 14 Q32 13 24 22 Z" fill="${c}"/>`,
      };
    case 'buzz':
      return { back: '', front: `<path d="M25 18 Q26 8 40 8 Q54 8 55 18 Q48 13 40 13 Q32 13 25 18 Z" fill="${c}" opacity=".85"/>` };
    default:
      return { back: '', front: `<path d="M24 20 Q23 6 40 6 Q57 6 56 20 L52 15 Q40 10 30 14 Z" fill="${c}"/>` };
  }
}

// Front-facing 2D person. Gear is drawn on the body so it's visible everywhere the avatar appears.
// The original 2D drawing, kept as a fallback portrait where WebGL isn't available.
export function avatarSvg(av: Avatar, size = 40, pose: Pose = 'idle'): string {
  const c = av.color || COLORS[0];
  const skin = av.skin ?? SKINS[1];
  const hairC = av.hairColor ?? HAIR_COLORS[0];
  const e = av.equip ?? {};
  const hair = hairShapes(av.hair ?? 'short', hairC);
  const band = e.arms === 'wristbands' ? '#f4ecdf' : skin;
  const arm = (x1: number, y1: number, x2: number, y2: number) =>
    `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="8" stroke-linecap="round"/>` +
    `<path d="M${(x1 + x2 * 2) / 3} ${(y1 + y2 * 2) / 3} L${x2} ${y2}" stroke="${skin}" stroke-width="7" stroke-linecap="round"/>` +
    `<circle cx="${(x1 + x2 * 4) / 5}" cy="${(y1 + y2 * 4) / 5}" r="3.6" fill="${band}"/>` +
    `<circle cx="${x2}" cy="${y2}" r="4.2" fill="${skin}"/>`;
  const arms =
    pose === 'cheer'
      ? arm(27, 52, 14, 22) + arm(53, 52, 66, 22)
      : pose === 'groan'
        ? arm(27, 52, 22, 20) + arm(53, 52, 58, 20)
        : arm(27, 52, 20, 80) + arm(53, 52, 60, 80);
  const shoes = e.feet === 'cleats' ? '#1d1a17' : '#efe6d8';
  const parts = [
    hair.back,
    // legs + shoes
    `<rect x="30" y="80" width="8" height="28" rx="3" fill="#3a3330"/>`,
    `<rect x="42" y="80" width="8" height="28" rx="3" fill="#3a3330"/>`,
    `<path d="M26 108 h13 v5 h-15 z" fill="${shoes}"/><path d="M41 108 h13 l2 5 h-15 z" fill="${shoes}"/>`,
    e.feet === 'cleats' ? `<path d="M26 113 h2 v2 h-2 z M33 113 h2 v2 h-2 z M44 113 h2 v2 h-2 z M51 113 h2 v2 h-2 z" fill="#1d1a17"/>` : '',
    // jersey
    `<path d="M26 50 Q40 44 54 50 L56 84 Q40 88 24 84 Z" fill="${c}"/>`,
    e.torso === 'stripe' ? `<rect x="24.5" y="62" width="31" height="5" fill="#f4ecdf" opacity=".9"/>` : '',
    `<rect x="36" y="40" width="8" height="8" fill="${skin}"/>`,
    arms,
    // head
    `<circle cx="40" cy="26" r="16" fill="${skin}"/>`,
    hair.front,
    `<circle cx="34" cy="27" r="1.8" fill="#2a1f19"/><circle cx="46" cy="27" r="1.8" fill="#2a1f19"/>`,
    pose === 'groan'
      ? `<path d="M35 35 Q40 32 45 35" stroke="#2a1f19" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
      : pose === 'cheer'
        ? `<path d="M34 33 Q40 40 46 33 Z" fill="#7a2e22"/>`
        : `<path d="M35 33 Q40 37 45 33" stroke="#2a1f19" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  ];
  if (e.eyes === 'shades') parts.push(`<rect x="29" y="23" width="22" height="7" rx="3" fill="#15110e"/><rect x="31" y="24" width="6" height="2" rx="1" fill="#6b5f55"/>`);
  switch (e.head) {
    case 'headband':
      parts.push(`<rect x="24" y="15" width="32" height="5" rx="2.5" fill="#c0623b"/><rect x="24" y="16.5" width="32" height="1.5" fill="#f4ecdf"/>`);
      break;
    case 'cap':
      parts.push(`<path d="M24 19 Q24 6 40 6 Q56 6 56 19 Z" fill="#2f3b4a"/><path d="M26 18 Q40 14 58 20 L58 23 Q40 18 24 21 Z" fill="#1f2833"/><circle cx="40" cy="7" r="1.6" fill="#d9a441"/>`);
      break;
    case 'visor':
      parts.push(`<rect x="24" y="14" width="32" height="4" rx="2" fill="#d9a441"/><path d="M24 17 Q40 14 56 17 L58 21 Q40 17 22 21 Z" fill="#b8862f"/>`);
      break;
    case 'crown':
      parts.push(`<path d="M27 13 L27 2 L33 8 L40 0 L47 8 L53 2 L53 13 Z" fill="#e2b546" stroke="#9b7520" stroke-width="1"/><circle cx="40" cy="7" r="1.6" fill="#c0623b"/>`);
      break;
  }
  return `<svg class="avatar" width="${Math.round(size * 0.67)}" height="${size}" viewBox="0 0 80 120" aria-hidden="true">${parts.join('')}</svg>`;
}

// ---------- 3D golfers ----------

const HAIR_MAP: Record<string, GolferSpec['hair']> = { short: 'short', curly: 'curly', long: 'long', bun: 'bun', buzz: 'short' };

// The golfer for any avatar: the saved spec, or one made from an old 2D avatar.
export function specOf(av: Avatar): GolferSpec {
  if (av.golfer) return { ...DEFAULT_SPEC, ...av.golfer };
  return {
    ...DEFAULT_SPEC,
    skin: av.skin ?? DEFAULT_SPEC.skin,
    hair: HAIR_MAP[av.hair ?? 'short'] ?? 'short',
    hairColor: av.hairColor ?? DEFAULT_SPEC.hairColor,
    topColor: av.color || DEFAULT_SPEC.topColor,
    hat: av.equip?.head === 'cap' ? 'cap' : av.equip?.head === 'visor' ? 'visor' : 'none',
  };
}

// A small round portrait for lists and cards: the 3D golfer if WebGL is around, else the old 2D drawing.
export function portrait(av: Avatar, size = 32): string {
  const url = golferThumb(specOf(av));
  if (url) return `<img class="portrait" src="${url}" width="${size}" height="${size}" alt="" />`;
  return avatarSvg(av, size);
}
