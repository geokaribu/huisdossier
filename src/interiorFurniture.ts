import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { PlanDecoration } from "./types";

/** Only the objects visible in supplied room references are instantiated by the private plan. */
export function interiorFurniture(item: PlanDecoration) {
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  const [w, d] = item.size,
    h = item.height;
  const cloth = new THREE.MeshStandardMaterial({
    color: item.color ?? "#94694e",
    roughness: 0.9,
  });
  const timber = new THREE.MeshStandardMaterial({
    color: "#72563d",
    roughness: 0.8,
  });
  function box(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
  ) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function cushion(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
  ) {
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(
        width,
        height,
        depth,
        3,
        Math.min(width, height, depth) * 0.3,
      ),
      material,
    );
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  if (item.kind === "sofa" || item.kind === "armchair") {
    for (const x of [-w * 0.37, w * 0.37])
      for (const z of [-d * 0.3, d * 0.3])
        box(x, 0.095, z, 0.065, 0.19, 0.065, timber);
    box(0, 0.28, 0, w, 0.24, d, cloth);
    const seats = item.kind === "sofa" ? 3 : 1;
    for (let i = 0; i < seats; i++) {
      const x = -w * 0.4 + (i + 0.5) * ((w * 0.8) / seats);
      cushion(x, 0.44, -d * 0.06, (w * 0.82) / seats, 0.21, d * 0.8, cloth);
      cushion(x, 0.65, d * 0.32, (w * 0.85) / seats, h - 0.25, 0.22, cloth);
    }
    for (const x of [-w * 0.46, w * 0.46])
      cushion(x, 0.56, 0, w * 0.17, 0.37, d * 0.96, cloth);
    if (item.kind === "sofa")
      cushion(
        -w * 0.27,
        0.68,
        d * 0.1,
        0.35,
        0.32,
        0.2,
        new THREE.MeshStandardMaterial({ color: "#63737c", roughness: 1 }),
      );
  } else if (item.kind === "coffee-table") {
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.045, 48),
      new THREE.MeshStandardMaterial({
        color: item.color ?? "#e3d3b0",
        roughness: 0.22,
        metalness: 0.05,
      }),
    );
    top.scale.set(w, 1, d);
    top.position.y = h;
    top.castShadow = true;
    group.add(top);
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(0.49, 0.022, 8, 48),
      timber,
    );
    edge.rotation.x = Math.PI / 2;
    edge.scale.set(w, d, 1);
    edge.position.y = h - 0.025;
    group.add(edge);
    for (const a of [0.4, 2.1, 3.9, 5.5]) {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.04, h - 0.05, 10),
        timber,
      );
      leg.position.set(
        Math.cos(a) * w * 0.3,
        (h - 0.05) / 2,
        Math.sin(a) * d * 0.3,
      );
      leg.castShadow = true;
      group.add(leg);
    }
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.075, 0.11, 20),
      new THREE.MeshStandardMaterial({ color: "#d6cab0", roughness: 0.6 }),
    );
    bowl.position.set(0.08, h + 0.07, 0);
    group.add(bowl);
  } else {
    const potH = h * 0.24;
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.34, w * 0.25, potH, 20),
      new THREE.MeshStandardMaterial({
        color: item.color ?? "#c9b68f",
        roughness: 0.85,
      }),
    );
    pot.position.y = potH / 2;
    group.add(pot);
    const green = new THREE.MeshStandardMaterial({
      color: "#456d37",
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.4,
        y = potH + (i % 4) * h * 0.13,
        leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), green);
      leaf.scale.set(w * 0.13, h * 0.3, 0.025);
      leaf.rotation.set(0.25, angle, Math.cos(angle) * 0.65);
      leaf.position.set(
        Math.cos(angle) * w * 0.23,
        y + h * 0.2,
        Math.sin(angle) * d * 0.23,
      );
      leaf.castShadow = true;
      group.add(leaf);
    }
  }
  group.userData.role = "room-furnishing";
  return group;
}
