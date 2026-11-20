// A member's course (Nov 20): three holes designed together from one prompt, named and reviewed as a whole. It's kept
// in the same `designs` table as a single hole (spec.kind 'course'). The designer plays it first; that round is their
// mark, kept shot by shot, and it goes to the Committee. The newest approved course is the Members' Course, where every
// challenger plays the designer's ghost (PR 3).
import type { Hole } from '../golf3d/types';
import type { ReplayData } from '../replay';
import { buildHole, checkHole, tidy, type HoleSpec } from './hole';

export type CourseSpec = { kind: 'course'; name: string; review: string; holes: HoleSpec[] };
// the designer's round: strokes on each hole, and every stroke as it flew (for the ghost)
export type DesignerMark = { holes: number[]; total: number; shots: ReplayData[][] };

export const COURSE_HOLES = 3;

export const isCourse = (d: { spec: unknown }): d is { spec: CourseSpec } => (d.spec as { kind?: string } | null)?.kind === 'course';

export function tidyCourse(raw: CourseSpec): CourseSpec {
  const holes = (Array.isArray(raw?.holes) ? raw.holes : []).slice(0, COURSE_HOLES).map((h) => tidy({ ...h, kind: 'hole' }));
  return {
    kind: 'course',
    name: String(raw?.name ?? 'A Members’ Course').slice(0, 40),
    review: String(raw?.review ?? '').slice(0, 220),
    holes,
  };
}

// the three holes, built: their ids say which course and hole they are; the designer's name flies on the flags
export function courseHoles(spec: CourseSpec, id: string, by?: string): Hole[] {
  return tidyCourse(spec).holes.map((h, i) => buildHole(h, `${id}-${i + 1}`, by?.slice(0, 9)).hole);
}

// the quick check on every hole: what's wrong where, so the architect can be asked to fix just that
export function checkCourse(spec: CourseSpec): { ok: boolean; problems: string[] } {
  const s = tidyCourse(spec);
  if (s.holes.length !== COURSE_HOLES) return { ok: false, problems: ['A course needs three holes.'] };
  const problems = s.holes.flatMap((h, i) => {
    const { hole } = buildHole(h, `check-${i}`);
    return checkHole(hole, h).problems.map((p) => `Hole ${i + 1}: ${p}`);
  });
  return { ok: !problems.length, problems };
}

export const coursePar = (spec: CourseSpec) => tidyCourse(spec).holes.reduce((a, h) => a + h.par, 0);
export const courseYards = (spec: CourseSpec) => tidyCourse(spec).holes.reduce((a, h) => a + h.yards, 0);
