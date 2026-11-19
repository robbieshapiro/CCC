// A course's look on the page (see CourseLook in golf3d/courses.ts): a class and the CSS variables the .looked rules in
// style.css paint with, so a new course needs only its colours, never new CSS.
import type { Course } from './golf3d/courses';

export const looked = (c: Course) => (c.look ? ' looked' : '');
export const lookAttrs = (c: Course) => {
  const l = c.look;
  if (!l) return '';
  const [c1, c2, c3] = l.colors;
  return ` style="--c1:${c1};--c2:${c2};--c3:${c3};--glow:${l.glow};--acc:${l.accent};--acc-ink:${l.ink};--soft:${l.soft}" data-pattern="${l.pattern}"`;
};
