import * as THREE from "three";
import type { HouseAppearance, Point, Surface } from "./types.ts";

export function frontFrame(profile: HouseAppearance) {
  const { left, right } = profile.front;
  const width = Math.hypot(right[0] - left[0], right[1] - left[1]);
  const u: [number, number] = [
    (right[0] - left[0]) / width,
    (right[1] - left[1]) / width,
  ];
  const normal: [number, number] = [u[1], -u[0]];
  return { u, normal, width };
}
export function facadeTransform(profile: HouseAppearance, origin: Point) {
  const { u } = frontFrame(profile),
    matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(
      profile.front.left[0] - origin[0],
      profile.front.bottom - origin[2],
      -(profile.front.left[1] - origin[1]),
    ),
    new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.atan2(u[1], u[0]),
    ),
    new THREE.Vector3(1, 1, 1),
  );
  return matrix;
}
/** Approximate registration from the private profile, shared by all renderers. */
export function planToExterior(profile: HouseAppearance, origin: Point) {
  const r = profile.rear!,
    local = new THREE.Matrix4().makeTranslation(
      -r.anchor[0] * r.scale[0],
      0,
      -r.anchor[1] * r.scale[1],
    );
  local.multiply(new THREE.Matrix4().makeScale(r.scale[0], 1, r.scale[1]));
  return facadeTransform(profile, origin).multiply(local);
}

/** One explicit source wall anchors the rear, with the photo-derived ridge anchoring the front. */
export function mainShellLayout(
  profile: HouseAppearance,
  origin: Point,
  surfaces: Surface[],
) {
  if (!profile.shell || !profile.roof) return null;
  const source = surfaces[profile.shell.rearSurface];
  if (source?.type !== "WallSurface") return null;
  const matrix = facadeTransform(profile, origin),
    inverse = matrix.clone().invert();
  const points = source.rings[0].map((p) =>
    new THREE.Vector3(
      p[0] - origin[0],
      p[2] - origin[2],
      -(p[1] - origin[1]),
    ).applyMatrix4(inverse),
  );
  const minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x));
  const lower = (x: number) =>
    points
      .filter((p) => Math.abs(p.x - x) < 1e-4)
      .sort((a, b) => a.y - b.y)[0]
      .clone();
  const left = lower(minX),
    right = lower(maxX),
    { width } = frontFrame(profile);
  const top = profile.roof.top - profile.front.bottom,
    frontTop = profile.front.top - profile.front.bottom;
  if (
    right.x - left.x < 0.1 ||
    Math.max(left.z, right.z) >= -profile.roof.inset
  )
    return null;
  const ridgeLeft = new THREE.Vector3(0, top, -profile.roof.inset),
    ridgeRight = new THREE.Vector3(width, top, -profile.roof.inset);
  const roof = [
    ridgeLeft,
    ridgeRight,
    right.clone().setY(top),
    left.clone().setY(top),
  ];
  return {
    matrix,
    left,
    right,
    width,
    top,
    frontTop,
    ridgeLeft,
    ridgeRight,
    roof,
  };
}
export function mainShellRoof(
  profile: HouseAppearance,
  origin: Point,
  surfaces: Surface[],
): Surface | null {
  const layout = mainShellLayout(profile, origin, surfaces);
  return layout
    ? {
        type: "RoofSurface",
        rings: [
          layout.roof.map((p) => {
            const v = p.clone().applyMatrix4(layout.matrix);
            return [
              v.x + origin[0],
              -v.z + origin[1],
              v.y + origin[2],
            ] as Point;
          }),
        ],
      }
    : null;
}
