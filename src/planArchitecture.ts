import * as THREE from "three";
import clipping from "polygon-clipping";
import type { MultiPolygon, Polygon } from "polygon-clipping";
import type { PlanPoint, PlanWall } from "./types";

const EPS = 1e-6;
const cross = (a: PlanPoint, b: PlanPoint) => a[0] * b[1] - a[1] * b[0];
const lengthOf = (w: PlanWall) => Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);

/** A filled slab shares the outside of the wall union, with no stacked roof-edge caps. */
export function filledSlabGeometry(
  points: PlanPoint[],
  walls: PlanWall[],
  thickness: number,
) {
  const polys = clipping.union([points], section(walls, 1, 0.5));
  const shapes = polys.map((rings) => {
    const shape = new THREE.Shape(
      rings[0].map(([x, z]) => new THREE.Vector2(x, -z)),
    );
    for (const ring of rings.slice(1))
      shape.holes.push(
        new THREE.Path(ring.map(([x, z]) => new THREE.Vector2(x, -z))),
      );
    return shape;
  });
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: thickness,
    bevelEnabled: false,
    steps: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.clearGroups();
  const normal = geometry.getAttribute("normal");
  let start = 0,
    material = -1;
  for (let i = 0; i < normal.count; i += 3) {
    const next = normal.getY(i) < -0.99 ? 1 : 0;
    if (next !== material) {
      if (i > start) geometry.addGroup(start, i - start, material);
      start = i;
      material = next;
    }
  }
  if (normal.count > start)
    geometry.addGroup(start, normal.count - start, material);
  return geometry;
}

/** Butt T junctions, miter connected corners; never snap an unconnected source wall. */
function footprint(
  w: PlanWall,
  from: number,
  to: number,
  walls: PlanWall[],
  padding = 0,
): Polygon {
  const length = lengthOf(w),
    u: PlanPoint = [(w.b[0] - w.a[0]) / length, (w.b[1] - w.a[1]) / length],
    n: PlanPoint = [-u[1], u[0]],
    half = w.thickness / 2 + padding;
  function edge(t: number, sign: number): PlanPoint {
    const p: PlanPoint = [
      w.a[0] + u[0] * t + n[0] * half * sign,
      w.a[1] + u[1] * t + n[1] * half * sign,
    ];
    if (t > EPS && t < length - EPS) return p;
    const end = t < EPS ? w.a : w.b,
      into: PlanPoint = t < EPS ? u : [-u[0], -u[1]];
    const neighbours = walls.filter(
      (o) =>
        o !== w &&
        [o.a, o.b].some((q) => Math.hypot(q[0] - end[0], q[1] - end[1]) < EPS),
    );
    if (neighbours.length !== 1) return p;
    const other = neighbours[0],
      q =
        Math.hypot(other.a[0] - end[0], other.a[1] - end[1]) < EPS
          ? other.b
          : other.a,
      l = lengthOf(other),
      v: PlanPoint = [(q[0] - end[0]) / l, (q[1] - end[1]) / l],
      m: PlanPoint = [-v[1], v[0]],
      det = cross(u, v);
    if (Math.abs(det) < 0.1) return p;
    const side =
        Math.sign(m[0] * into[0] + m[1] * into[1]) *
        Math.sign(sign * (n[0] * v[0] + n[1] * v[1])),
      offset = other.thickness / 2 + padding,
      delta: PlanPoint = [
        end[0] + m[0] * offset * side - p[0],
        end[1] + m[1] * offset * side - p[1],
      ],
      d = cross(delta, v) / det;
    // A bounded miter avoids spikes at acute or corrupt joins.
    return Math.abs(d) <= Math.max(half, offset) * 4
      ? [p[0] + u[0] * d, p[1] + u[1] * d]
      : p;
  }
  return [[edge(from, 1), edge(to, 1), edge(to, -1), edge(from, -1)]];
}

function section(
  walls: PlanWall[],
  defaultHeight: number,
  y: number,
  padding = 0,
): MultiPolygon {
  const active = walls.filter((w) => (w.height ?? defaultHeight) > y),
    polygons: Polygon[] = [];
  for (const w of active) {
    const length = lengthOf(w);
    if (length < EPS) continue;
    let end = 0;
    for (const o of [...w.openings].sort((a, b) => a.offset - b.offset)) {
      if (y < o.sill || y >= o.sill + o.height) continue;
      if (o.offset > end + EPS)
        polygons.push(
          footprint(w, end, Math.min(length, o.offset), active, padding),
        );
      end = Math.max(end, o.offset + o.width);
    }
    if (end < length - EPS)
      polygons.push(footprint(w, end, length, active, padding));
  }
  return polygons.length
    ? clipping.union(polygons[0], ...polygons.slice(1))
    : [];
}

/** Union each height band, then emit only exposed faces. No internal caps or coplanar overlaps. */
export function architectureGeometry(
  walls: PlanWall[],
  height: number,
  skirting = false,
) {
  const levels = skirting
    ? [0, 0.09]
    : [
        ...new Set([
          0,
          ...walls.flatMap((w) => [
            w.height ?? height,
            ...w.openings.flatMap((o) => [o.sill, o.sill + o.height]),
          ]),
        ]),
      ]
        .filter((y) => y >= 0)
        .sort((a, b) => a - b);
  const bands = levels
    .slice(0, -1)
    .map((lo, i) =>
      section(walls, height, (lo + levels[i + 1]) / 2, skirting ? 0.0125 : 0),
    );
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const geometry = new THREE.BufferGeometry();
  function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    const n = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      normals.push(n.x, n.y, n.z);
      uvs.push(Math.abs(n.z) > 0.5 ? p.x : p.z, p.y);
      indices.push(indices.length);
    }
  }
  function horizontal(polys: MultiPolygon, y: number, up: boolean) {
    for (const poly of polys) {
      const rings = poly.map((r) =>
          r.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)),
        ),
        flat = rings.flat();
      for (const face of THREE.ShapeUtils.triangulateShape(
        rings[0],
        rings.slice(1),
      )) {
        const v = face.map((i) => new THREE.Vector3(flat[i].x, y, flat[i].y));
        if (
          new THREE.Vector3()
            .subVectors(v[1], v[0])
            .cross(new THREE.Vector3().subVectors(v[2], v[0])).y >
            0 !==
          up
        )
          [v[1], v[2]] = [v[2], v[1]];
        triangle(v[0], v[1], v[2]);
      }
    }
  }
  for (let i = 0; i < bands.length; i++) {
    const polys = bands[i],
      lo = levels[i],
      hi = levels[i + 1],
      start = indices.length;
    for (const poly of polys)
      for (const ring of poly)
        for (let j = 0; j < ring.length - 1; j++) {
          const a = ring[j],
            b = ring[j + 1],
            p = new THREE.Vector3(a[0], lo, a[1]),
            q = new THREE.Vector3(b[0], lo, b[1]),
            r = new THREE.Vector3(b[0], hi, b[1]),
            s = new THREE.Vector3(a[0], hi, a[1]);
          triangle(p, r, q);
          triangle(p, s, r);
        }
    horizontal(i ? clipping.difference(polys, bands[i - 1]) : polys, lo, false);
    geometry.addGroup(start, indices.length - start, 0);
    const capStart = indices.length;
    horizontal(
      i + 1 < bands.length ? clipping.difference(polys, bands[i + 1]) : polys,
      hi,
      true,
    );
    geometry.addGroup(capStart, indices.length - capStart, skirting ? 0 : 1);
  }
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
