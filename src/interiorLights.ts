import * as THREE from "three";
import type { Floorplan, PlanDecoration } from "./types";
import { insidePolygon } from "./walkthrough.ts";

export function pendantBulbOffsets(item: PlanDecoration) {
  const count = item.bulbs ?? 2;
  return Array.from({ length: count }, (_, i) =>
    count === 1 ? 0 : ((i / (count - 1)) * 2 - 1) * item.size[0] * 0.3,
  );
}

/** Authored fixtures replace the illustrative room light; they never add a duplicate. */
export function interiorLights(plan: Floorplan) {
  const group = new THREE.Group();
  const pendants = (plan.decorations ?? []).filter(
    (item) => item.kind === "pendant" && item.light,
  );
  for (const room of plan.rooms.filter((room) => !room.outside)) {
    const fixtures = pendants.filter((item) =>
      insidePolygon(item.center, room.polygon),
    );
    if (!fixtures.length) {
      const light = new THREE.PointLight("#fff9ee", 2.2, 4, 2);
      light.position.set(room.center[0], 2.35, room.center[1]);
      light.userData.roomId = room.id;
      group.add(light);
    } else
      for (const item of fixtures) {
        for (const x of pendantBulbOffsets(item)) {
          const light = new THREE.PointLight(
            item.light!.color,
            item.light!.intensity,
            item.light!.distance,
            2,
          );
          const angle = item.rotation ?? 0;
          light.position.set(
            item.center[0] + Math.cos(angle) * x,
            (item.base ?? 0) + 0.055,
            item.center[1] - Math.sin(angle) * x,
          );
          light.castShadow = true;
          light.shadow.mapSize.set(512, 512);
          light.shadow.camera.near = 0.05;
          light.shadow.bias = -0.0002;
          light.shadow.normalBias = 0.015;
          light.userData.roomId = room.id;
          light.userData.componentId = item.id;
          group.add(light);
        }
      }
  }
  return group;
}
