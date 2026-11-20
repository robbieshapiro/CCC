// A member's course (Nov 20): one signature hole (the first ones had three) designed from one prompt, named and reviewed as a whole. It's kept
// in the same `designs` table as a single hole (spec.kind 'course'). The designer plays it first; that round is their
// mark, kept shot by shot, and it goes to the Committee. The newest approved course is the Members' Course, where every
// challenger plays the designer's ghost (PR 3).
import type { Hole } from '../golf3d/types';
import type { ReplayData } from '../replay';
import { buildHole, checkHole, tidy, type HoleSpec } from './hole';
import { tidyWorld, type World } from './world';

// world: the place it's set in, the member's own (Nov 20); courses drawn before it are in their holes' looks
export type CourseSpec = { kind: 'course'; name: string; review: string; holes: HoleSpec[]; world?: World };
// the designer's round: strokes on each hole, and every stroke as it flew (for the ghost)
export type DesignerMark = { holes: number[]; total: number; shots: ReplayData[][] };

export const COURSE_HOLES = 1; // a new course is one signature hole; courses drawn before keep their three

export const isCourse = (d: { spec: unknown }): d is { spec: CourseSpec } => (d.spec as { kind?: string } | null)?.kind === 'course';

export function tidyCourse(raw: CourseSpec): CourseSpec {
  const holes = (Array.isArray(raw?.holes) ? raw.holes : []).slice(0, 3).map((h) => tidy({ ...h, kind: 'hole' }));
  return {
    kind: 'course',
    name: String(raw?.name ?? 'A Members’ Course').slice(0, 40),
    review: String(raw?.review ?? '').slice(0, 220),
    holes,
    ...(raw?.world ? { world: tidyWorld(raw.world) } : {}),
  };
}

// the holes, built: their ids say which course and hole they are; the designer's name flies on the flags
export function courseHoles(spec: CourseSpec, id: string, by?: string): Hole[] {
  const c = tidyCourse(spec);
  return c.holes.map((h, i) => buildHole(h, `${id}-${i + 1}`, by?.slice(0, 9), c.world, c.world?.landmarks.filter((l) => l.hole === i + 1)).hole);
}

// the quick check on every hole: what's wrong where, so the architect can be asked to fix just that
export function checkCourse(spec: CourseSpec): { ok: boolean; problems: string[] } {
  const s = tidyCourse(spec);
  if (!s.holes.length) return { ok: false, problems: ['A course needs a hole.'] };
  const problems = s.holes.flatMap((h, i) => {
    const { hole } = buildHole(h, `check-${i}`, undefined, s.world);
    return checkHole(hole, h).problems.map((p) => `Hole ${i + 1}: ${p}`);
  });
  return { ok: !problems.length, problems };
}

export const coursePar = (spec: CourseSpec) => tidyCourse(spec).holes.reduce((a, h) => a + h.par, 0);
export const courseYards = (spec: CourseSpec) => tidyCourse(spec).holes.reduce((a, h) => a + h.yards, 0);
