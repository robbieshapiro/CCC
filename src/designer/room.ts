// The Design Room's courses, as the game plays them: each room course (room_courses) becomes a Course with id
// 'room-<id>', its holes built by the Design Desk's builder. They never open on the calendar by themselves
// ('2099-01-01'); a week plays one only when the Committee puts it there in the planner.
import type { RoomCourse } from '../api/types';
import type { Course } from '../golf3d/courses';
import { buildHole, tidy, type HoleSpec } from './hole';
import { SAMPLES } from './samples';

export const roomId = (id: number) => `room-${id}`;

export function roomCourse(r: RoomCourse): Course {
  const holes = r.holes.map((spec, i) => {
    const s = tidy(spec);
    const { hole } = buildHole(s, `${roomId(r.id)}-${i + 1}`);
    hole.yards = s.yards;
    return hole;
  });
  const last = holes[holes.length - 1];
  return {
    id: roomId(r.id),
    opens: '2099-01-01',
    name: r.name,
    tagline: r.tagline || 'Made in the Design Room.',
    holes,
    par: holes.reduce((a, h) => a + h.par, 0),
    draft: r.draft,
    // a tie is played off on the last hole: from the fairway where the drive lands, or the tee of a par 3
    playoff: { hole: last, from: last.par === 3 ? last.tee : last.flyover?.[1] ?? last.tee, label: last.par === 3 ? 'From the tee' : 'From the fairway' },
  };
}

// a fresh hole to start from: a plain par 4 in the chosen look
export function blankHole(look: HoleSpec['look'] = 'highlands', n = 1): HoleSpec {
  return {
    ...SAMPLES[look],
    name: `Hole ${n}`,
    yards: 380,
    shape: 'straight',
    bend_at: 0.55,
    bend: 25,
    elevation: 'flat',
    fairway: { width: 'medium', from: 0.3, to: 0.9 },
    green: { size: 'medium', slope: 'back-to-front', tiered: false, raised: false, across: 0 },
    bunkers: [{ along: 0.96, across: 1.2, size: 'medium', kind: 'greenside' }],
    water: [],
    trees: [],
    mounds: [],
    review: '',
    hint: '',
  };
}
