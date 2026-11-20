import * as THREE from "three";
import type { PlanDecoration } from "./types";

/** Reusable garden objects. Dimensions, placement and source remain in the private plan. */
export function gardenFurniture(item: PlanDecoration) {
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  const [w, d] = item.size,
    h = item.height;
  const black = new THREE.MeshStandardMaterial({
    color: item.color ?? "#272e30",
    roughness: 0.65,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: "#a8b0ad",
    metalness: 0.75,
    roughness: 0.3,
  });
  function box(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    mat = black,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  }
  if (item.kind === "storage-cabinet") {
    box(0, h / 2, 0, w, h, d);
    for (let x = -w / 2 + 0.07; x < w / 2; x += 0.09) {
      box(x, h / 2, d / 2 + 0.008, 0.072, h * 0.92, 0.016);
      box(x, h + 0.012, 0, 0.072, 0.025, d);
    }
    box(0, h * 0.9, d / 2 + 0.025, w * 0.22, 0.018, 0.025);
    box(0, h * 0.53, d / 2 + 0.025, 0.016, 0.024, 0.008, metal);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.12, w * 0.09, h * 0.28, 24, 1, true),
      black,
    );
    pot.material = black.clone();
    pot.material.side = THREE.DoubleSide;
    pot.position.set(w * 0.25, h * 1.15, 0);
    group.add(pot);
  } else if (item.kind === "barbecue") {
    const bodyY = h * 0.56;
    box(0, bodyY, 0, w * 0.74, h * 0.16, d * 0.88);
    box(w * 0.41, bodyY + h * 0.03, 0, w * 0.25, 0.025, d * 0.9);
    for (const x of [-w * 0.25, w * 0.25]) {
      const leg = box(x, bodyY / 2, 0, 0.025, bodyY, 0.025);
      leg.rotation.z = x < 0 ? -0.23 : 0.23;
      for (const z of [-d * 0.34, d * 0.34])
        box(x, 0.035, z, 0.045, 0.045, 0.045);
    }
    for (let x = -w * 0.32; x < w * 0.34; x += 0.035)
      box(x, bodyY + h * 0.085, 0, 0.008, 0.008, d * 0.77, metal);
    const lid = box(0, bodyY + h * 0.26, -d * 0.39, w * 0.74, h * 0.38, 0.035);
    lid.rotation.x = -0.13;
    box(0, bodyY + h * 0.46, -d * 0.42, w * 0.22, 0.022, 0.035);
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.025, 20),
      black,
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(-w * 0.28, 0.065, -d * 0.34);
    group.add(wheel);
  } else {
    const green = new THREE.MeshStandardMaterial({
      color: "#496340",
      roughness: 0.95,
    });
    const bloom = new THREE.MeshStandardMaterial({
      color: "#a25170",
      roughness: 0.9,
    });
    box(0, h * 0.48, -d * 0.26, w * 0.72, h * 0.7, 0.035);
    for (let i = 0; i < 28; i++) {
      const a = i * 2.4,
        y = h * (0.12 + (i % 8) * 0.1);
      const leaf = new THREE.Mesh(
        new THREE.SphereGeometry(1, 8, 6),
        i % 3 ? green : bloom,
      );
      leaf.scale.set(w * 0.18, h * 0.09, d * 0.22);
      leaf.position.set(
        Math.cos(a) * w * 0.28,
        y,
        Math.sin(a) * d * 0.22 + d * 0.2,
      );
      leaf.castShadow = true;
      group.add(leaf);
    }
    box(0, h * 0.95, -d * 0.13, 0.015, h * 0.17, 0.025);
  }
  group.userData.role = item.kind;
  return group;
}
