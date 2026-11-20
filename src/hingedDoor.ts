import * as THREE from "three";
import type { PlanWall, HingedDoor } from "./types";
import { hingedDoorLayout } from "./doorLayout.ts";

export function hingedDoor(
  wall: PlanWall,
  opening: PlanWall["openings"][number],
  config: HingedDoor,
) {
  const group = new THREE.Group(),
    dx = wall.b[0] - wall.a[0],
    dz = wall.b[1] - wall.a[1],
    length = Math.hypot(dx, dz);
  group.position.set(
    wall.a[0] + (dx * opening.offset) / length,
    opening.sill,
    wall.a[1] + (dz * opening.offset) / length,
  );
  group.rotation.y = -Math.atan2(dz, dx);
  group.userData.doorId = config.id;
  const paint = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.6,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: "#a9afaa",
    roughness: 0.3,
    metalness: 0.8,
  });
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material = paint,
    role = "door-frame",
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = role;
    parent.add(mesh);
    return mesh;
  }
  const height = opening.height,
    layout = hingedDoorLayout(opening.width, config, false);
  for (const x of [0, opening.width])
    box(group, x, height / 2, 0, 0.045, height, wall.thickness + 0.035);
  box(
    group,
    opening.width / 2,
    height,
    0,
    opening.width,
    0.045,
    wall.thickness + 0.035,
  );
  const pivot = new THREE.Group();
  pivot.position.x = layout.hinge;
  group.add(pivot);
  const center = (layout.direction * layout.leaf) / 2;
  box(
    pivot,
    center,
    height / 2,
    0,
    layout.leaf,
    height - 0.05,
    0.035,
    paint,
    "door-leaf",
  );
  // Subtle raised mouldings on each face, based on a conventional panel door.
  for (const face of [-1, 1])
    for (const [bottom, top] of [
      [0.18, 0.79],
      [0.98, height - 0.19],
    ]) {
      const left = center - layout.leaf * 0.38,
        right = center + layout.leaf * 0.38;
      for (const x of [left, right])
        box(
          pivot,
          x,
          (top + bottom) / 2,
          face * 0.02,
          0.012,
          top - bottom,
          0.009,
          paint,
          "door-moulding",
        );
      for (const y of [bottom, top])
        box(
          pivot,
          center,
          y,
          face * 0.02,
          right - left,
          0.012,
          0.009,
          paint,
          "door-moulding",
        );
    }
  const handleX = layout.direction * (layout.leaf - 0.09);
  for (const face of [-1, 1]) {
    const rose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.014, 16),
      steel,
    );
    rose.rotation.x = Math.PI / 2;
    rose.position.set(handleX, 1, face * 0.027);
    pivot.add(rose);
    box(
      pivot,
      handleX - layout.direction * 0.035,
      1,
      face * 0.047,
      0.09,
      0.017,
      0.016,
      steel,
      "door-handle",
    );
  }
  const setOpen = (open: boolean) => {
    pivot.rotation.y = hingedDoorLayout(opening.width, config, open).angle;
  };
  setOpen(config.defaultOpen);
  return { group, setOpen };
}
