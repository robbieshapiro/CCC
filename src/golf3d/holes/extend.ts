// Lengthening a hole without redrawing it: everything beyond a line across the hole (y > at) slides `by` ft further
// from the tee. Greens, bunkers and anything else wholly past the line move as they are, keeping their shape; whatever
// spans the line (fairways, a gorge, a road) stretches. Heights don't change.
import type { Hole, Piece, V2 } from '../types';

export function extend(h: Hole, at: number, by: number): Hole {
  const y = (v: number) => (v > at ? v + by : v);
  const pt = <T extends V2>(p: T): T => ({ ...p, y: y(p.y) });
  const pts = (ps: V2[]) => ps.map(pt);
  const piece = (p: Piece): Piece => {
    switch (p.kind) {
      case 'tilt':
        return p;
      case 'hill':
      case 'disc':
        return { ...p, y: y(p.y) };
      case 'box':
      case 'ramp':
        return { ...p, y0: y(p.y0), y1: y(p.y1) };
      case 'channel':
      case 'embankment':
        return { ...p, pts: pts(p.pts) };
    }
  };
  return {
    ...h,
    tee: pt(h.tee),
    cup: pt(h.cup),
    pins: h.pins?.map(pt),
    bounds: { ...h.bounds, y1: y(h.bounds.y1) },
    border: pts(h.border),
    regions: h.regions.map((r) => ({ ...r, poly: pts(r.poly) })),
    water: h.water.map((w) => ({ ...w, poly: pts(w.poly) })),
    terrain: h.terrain.map(piece),
    walls: h.walls.map((w) => ({ ...w, a: pt(w.a), b: pt(w.b) })),
    posts: h.posts.map(pt),
    pushes: h.pushes.map(pt),
    roofs: h.roofs?.map((r) => ({ ...r, poly: pts(r.poly) })),
    ceilings: h.ceilings?.map((c) => ({ ...c, poly: pts(c.poly) })),
    zones: h.zones.map((z) => ({ ...z, poly: pts(z.poly) })),
    flyover: pts(h.flyover),
    decor: h.decor.map(pt),
  };
}
