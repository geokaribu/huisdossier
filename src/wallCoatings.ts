import * as THREE from "three";
import type { PlanWall } from "./types";

/** Paint only the solid piece of one wall face; door/window openings remain empty. */
export function wallCoatings(
  wall: PlanWall,
  from: number,
  to: number,
  bottom: number,
  top: number,
) {
  const group = new THREE.Group();
  const dx = wall.b[0] - wall.a[0],
    dz = wall.b[1] - wall.a[1];
  group.position.set(wall.a[0], 0, wall.a[1]);
  group.rotation.y = -Math.atan2(dz, dx);
  for (const coat of wall.coatings ?? []) {
    const start = Math.max(from, coat.from),
      end = Math.min(to, coat.to);
    if (end - start < 0.005) continue;
    const sign = coat.side === "positive" ? 1 : -1;
    function paint(lo: number, hi: number, color: string) {
      lo = Math.max(lo, bottom);
      hi = Math.min(hi, top);
      if (hi - lo < 0.001) return;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(end - start, hi - lo),
        new THREE.MeshStandardMaterial({ color, roughness: 0.88 }),
      );
      panel.position.set(
        (start + end) / 2,
        (lo + hi) / 2,
        sign * (wall.thickness / 2 + 0.001),
      );
      if (sign < 0) panel.rotation.y = Math.PI;
      panel.receiveShadow = true;
      panel.userData.role = "wall-paint";
      panel.userData.side = coat.side;
      group.add(panel);
    }
    paint(coat.lower?.height ?? bottom, top, coat.color);
    if (coat.lower) {
      paint(bottom, coat.lower.height, coat.lower.color);
      const lo = Math.max(bottom, coat.lower.height - 0.018),
        hi = Math.min(top, coat.lower.height + 0.018);
      if (hi - lo > 0.001) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(end - start, hi - lo, 0.018),
          new THREE.MeshStandardMaterial({
            color: coat.lower.railColor,
            roughness: 0.6,
          }),
        );
        rail.position.set(
          (start + end) / 2,
          (lo + hi) / 2,
          sign * (wall.thickness / 2 + 0.01),
        );
        rail.castShadow = true;
        rail.userData.role = "paint-divider-rail";
        group.add(rail);
      }
    }
  }
  return group;
}
