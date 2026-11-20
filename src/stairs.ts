import * as THREE from "three";
import type { Floorplan } from "./types";

type Fixture = Floorplan["fixtures"][number];
const STEPS = 9,
  THICKNESS = 0.06;

/** Same underside for the elevated flight's geometry and walking clearance. */
export function stairUnderside(f: Fixture, localZ: number) {
  const step = Math.max(
    0,
    Math.min(
      STEPS - 1,
      Math.floor(((f.size[1] / 2 - localZ) / f.size[1]) * STEPS),
    ),
  );
  const base = f.base ?? 0,
    tread = base + (f.height * (step + 1)) / STEPS - THICKNESS;
  const front = f.size[1] / 2 - (step * f.size[1]) / STEPS;
  return front - localZ <= 0.024 + 1e-8
    ? Math.min(tread, base + (f.height * step) / STEPS)
    : tread;
}

export function stairsFixture(f: Fixture, material: THREE.Material) {
  const group = new THREE.Group(),
    [w, d] = f.size,
    base = f.base ?? 0;
  group.position.set(f.center[0], 0, f.center[1]);
  group.rotation.y = f.rotation ?? 0;
  function box(y: number, z: number, h: number, depth: number, role: string) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
    mesh.position.set(0, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = role;
    group.add(mesh);
  }
  for (let i = 0; i < STEPS; i++) {
    const top = base + (f.height * (i + 1)) / STEPS,
      z = d / 2 - ((i + 0.5) * d) / STEPS;
    if (base > 0) {
      box(top - THICKNESS / 2, z, THICKNESS, d / STEPS, "raised-stair-tread");
      box(
        base + (f.height * (i + 0.5)) / STEPS,
        z + d / (2 * STEPS) - 0.012,
        f.height / STEPS,
        0.024,
        "raised-stair-riser",
      );
    } else box(top / 2, z, top, d / STEPS, "ground-stair");
  }
  if (base > 0) {
    const band = Math.min(0.14, f.height / STEPS);
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape([
        new THREE.Vector2(d / 2, base),
        new THREE.Vector2(-d / 2, base + f.height),
        new THREE.Vector2(-d / 2, base + f.height + band),
        new THREE.Vector2(d / 2, base + band),
      ]);
      const stringer = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false }),
        material,
      );
      stringer.rotation.y = -Math.PI / 2;
      stringer.position.x = (side * w) / 2 + 0.0175;
      stringer.castShadow = stringer.receiveShadow = true;
      stringer.userData.role = "stair-stringer";
      group.add(stringer);
    }
  }
  return group;
}
