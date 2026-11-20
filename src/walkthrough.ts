import type { Floorplan, PlanPoint, PlanWall } from "./types";
import { stairUnderside } from "./stairs.ts";
import { hingedDoorLayout } from "./doorLayout.ts";
export type DoorState = Record<string, boolean>;

/** Open leaf segments shared by walking collisions and the floor-plan drawing. */
export function openDoorLeaves(
  wall: PlanWall,
  doors: DoorState = {},
): [PlanPoint, PlanPoint][] {
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const ux = (wall.b[0] - wall.a[0]) / length,
    uz = (wall.b[1] - wall.a[1]) / length;
  const leaves: [PlanPoint, PlanPoint][] = [];
  for (const opening of wall.openings) {
    if (opening.door) {
      const config = opening.door;
      if (doors[config.id] ?? config.defaultOpen) {
        const layout = hingedDoorLayout(opening.width, config, true);
        const start = opening.offset + layout.hinge;
        leaves.push([
          [wall.a[0] + ux * start, wall.a[1] + uz * start],
          [
            wall.a[0] +
              ux * (opening.offset + layout.end[0]) -
              uz * layout.end[1],
            wall.a[1] +
              uz * (opening.offset + layout.end[0]) +
              ux * layout.end[1],
          ],
        ]);
      }
      continue;
    }
    const j = opening.joinery;
    if (!j || !(doors[j.id] ?? j.defaultOpen)) continue;
    const angle = (j.openAngle * Math.PI) / 180,
      leaf = (opening.width - j.fixedLeft) / 2;
    for (const [offset, sign] of [
      [opening.offset + j.fixedLeft, 1],
      [opening.offset + opening.width, -1],
    ]) {
      const a: PlanPoint = [wall.a[0] + ux * offset, wall.a[1] + uz * offset];
      leaves.push([
        a,
        [
          a[0] + leaf * (sign * ux * Math.cos(angle) + uz * Math.sin(angle)),
          a[1] + leaf * (sign * uz * Math.cos(angle) - ux * Math.sin(angle)),
        ],
      ]);
    }
  }
  return leaves;
}

function distanceToSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared),
      )
    : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}

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

export function wallSolids(
  wall: PlanWall,
  doors: DoorState = {},
): [number, number][] {
  const length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  let cursor = 0;
  const intervals: [number, number][] = [];
  for (const opening of [...wall.openings]
    .sort((a, b) => a.offset - b.offset)
    .filter((o) => o.kind === "door" && o.sill < 0.05 && o.height >= 1.9)) {
    if (
      (opening.door && !(doors[opening.door.id] ?? opening.door.defaultOpen)) ||
      (opening.joinery &&
        !(doors[opening.joinery.id] ?? opening.joinery.defaultOpen))
    )
      continue;
    const from = opening.offset + (opening.joinery?.fixedLeft ?? 0);
    if (from > cursor) intervals.push([cursor, from]);
    cursor = opening.offset + opening.width;
  }
  if (cursor < length) intervals.push([cursor, length]);
  return intervals;
}

export function canStand(
  plan: Floorplan,
  p: PlanPoint,
  radius = 0.16,
  doors: DoorState = {},
) {
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
    for (const [a, b] of wallSolids(wall, doors)) {
      const t = Math.max(a, Math.min(b, along));
      if (
        Math.hypot(p[0] - wall.a[0] - t * ux, p[1] - wall.a[1] - t * uz) <
        radius + wall.thickness / 2
      )
        return false;
    }
    for (const [a, b] of openDoorLeaves(wall, doors))
      if (distanceToSegment(p, a, b) < radius + 0.035) return false;
  }
  for (const item of plan.decorations ?? []) {
    if (item.solid === false || (item.base ?? 0) > 1.8) continue;
    const dx = p[0] - item.center[0],
      dz = p[1] - item.center[1],
      angle = item.rotation ?? 0;
    if (item.kind === "patio-table" || item.kind === "planter") {
      if (Math.hypot(dx, dz) < Math.max(...item.size) / 2 + radius)
        return false;
    } else {
      const x = Math.cos(angle) * dx - Math.sin(angle) * dz,
        z = Math.sin(angle) * dx + Math.cos(angle) * dz;
      if (item.kind === "utility-niche" && item.contents === false) {
        const [w, d] = item.size;
        if (Math.abs(x) > w / 2 + radius || Math.abs(z) > d / 2 + radius)
          continue;
        if (
          Math.abs(z + d / 2) < radius + 0.02 ||
          Math.abs(Math.abs(x) - w / 2) < radius + 0.025
        )
          return false;
        const soffit =
          (item.base ?? 0) +
          item.height -
          item.height *
            0.52 *
            Math.max(0, Math.min(1, (x + radius + w / 2) / w));
        if (soffit < 1.78) return false;
        continue;
      }
      if (
        Math.hypot(
          Math.max(Math.abs(x) - item.size[0] / 2, 0),
          Math.max(Math.abs(z) - item.size[1] / 2, 0),
        ) < radius
      )
        return false;
    }
  }
  for (const f of plan.fixtures) {
    const angle = f.rotation ?? 0,
      x = p[0] - f.center[0],
      z = p[1] - f.center[1];
    const dx = Math.max(
      Math.abs(Math.cos(angle) * x - Math.sin(angle) * z) - f.size[0] / 2,
      0,
    );
    const dz = Math.max(
      Math.abs(Math.sin(angle) * x + Math.cos(angle) * z) - f.size[1] / 2,
      0,
    );
    if (Math.hypot(dx, dz) < radius) {
      if (f.kind === "stairs" && (f.base ?? 0) > 0) {
        const localZ = Math.sin(angle) * x + Math.cos(angle) * z;
        if (stairUnderside(f, localZ + radius) >= 1.78) continue;
      }
      return false;
    }
  }
  return true;
}

/** Small substeps prevent walking through walls after a slow frame or a long key press. */
export function moveInside(
  plan: Floorplan,
  start: PlanPoint,
  delta: PlanPoint,
  doors: DoorState = {},
): PlanPoint {
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.07));
  const p: PlanPoint = [...start];
  for (let i = 0; i < steps; i++) {
    const x: PlanPoint = [p[0] + delta[0] / steps, p[1]];
    if (canStand(plan, x, 0.16, doors)) p[0] = x[0];
    const z: PlanPoint = [p[0], p[1] + delta[1] / steps];
    if (canStand(plan, z, 0.16, doors)) p[1] = z[1];
  }
  return p;
}
