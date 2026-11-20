import type { Floorplan, PlanPoint, PlanWall } from "./types";

export function insidePolygon(p: PlanPoint, polygon: PlanPoint[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

export function wallSolids(wall: PlanWall): [number, number][] {
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  let cursor = 0;
  const intervals: [number, number][] = [];
  for (const opening of wall.openings.filter(
    (o) => o.kind === "door" && o.sill < 0.05 && o.height >= 1.9,
  )) {
    if (opening.offset > cursor) intervals.push([cursor, opening.offset]);
    cursor = opening.offset + opening.width;
  }
  if (cursor < length) intervals.push([cursor, length]);
  return intervals;
}

export function canStand(plan: Floorplan, p: PlanPoint, radius = 0.16) {
  // Check the body perimeter as well as its center to keep feet inside the footprint.
  for (const [dx, dz] of [
    [0, 0],
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
  ])
    if (!insidePolygon([p[0] + dx, p[1] + dz], plan.outline)) return false;
  for (const wall of plan.walls) {
    const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
    const ux = (wall.b[0] - wall.a[0]) / length,
      uz = (wall.b[1] - wall.a[1]) / length;
    const along = (p[0] - wall.a[0]) * ux + (p[1] - wall.a[1]) * uz;
    for (const [a, b] of wallSolids(wall)) {
      const t = Math.max(a, Math.min(b, along));
      if (
        Math.hypot(p[0] - wall.a[0] - t * ux, p[1] - wall.a[1] - t * uz) <
        radius + wall.thickness / 2
      )
        return false;
    }
  }
  for (const f of plan.fixtures) {
    const dx = Math.max(Math.abs(p[0] - f.center[0]) - f.size[0] / 2, 0);
    const dz = Math.max(Math.abs(p[1] - f.center[1]) - f.size[1] / 2, 0);
    if (Math.hypot(dx, dz) < radius) return false;
  }
  return true;
}

/** Small substeps prevent walking through walls after a slow frame or a long key press. */
export function moveInside(
  plan: Floorplan,
  start: PlanPoint,
  delta: PlanPoint,
): PlanPoint {
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.07));
  const p: PlanPoint = [...start];
  for (let i = 0; i < steps; i++) {
    const x: PlanPoint = [p[0] + delta[0] / steps, p[1]];
    if (canStand(plan, x)) p[0] = x[0];
    const z: PlanPoint = [p[0], p[1] + delta[1] / steps];
    if (canStand(plan, z)) p[1] = z[1];
  }
  return p;
}
