import * as THREE from "three";
import type { PlanDecoration } from "./types";
import { interiorFurniture } from "./interiorFurniture.ts";

/** Photo-observed furnishings with positions and dimensions supplied per house. */
export function livingFurniture(item: PlanDecoration) {
  if (item.kind === "recliner")
    return interiorFurniture({ ...item, kind: "armchair" });
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  const [w, d] = item.size,
    h = item.height;
  const mat = (color: string, roughness = 0.8, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const timber = mat("#725239"),
    white = mat(item.color ?? "#eee9df"),
    black = mat("#292e2e", 0.5),
    steel = mat("#a6aaa5", 0.3, 0.65),
    cloth = mat("#b39773");
  function box(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    m: THREE.Material = white,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  function cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    height: number,
    m = steel,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, height, 20),
      m,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }
  if (item.kind === "bookcase") {
    box(0, h / 2, -d / 2, w, h, 0.025);
    for (const x of [-w / 2, w / 2]) box(x, h / 2, 0, 0.035, h, d);
    const colors = ["#353f41", "#c2ad83", "#8e5547", "#e5dfca", "#6b786c"];
    for (let row = 0; row < 5; row++) {
      const y = 0.07 + row * h * 0.19;
      box(0, y, 0, w, 0.028, d);
      if (row === 2) {
        box(0, y + 0.12, 0, w * 0.48, 0.19, d * 0.85, black);
        for (const x of [-w * 0.35, w * 0.35]) {
          box(x, y + 0.13, 0, w * 0.18, 0.24, d * 0.9, black);
          const speaker = new THREE.Mesh(
            new THREE.CircleGeometry(w * 0.055, 20),
            steel,
          );
          speaker.position.set(x, y + 0.13, d * 0.46);
          group.add(speaker);
        }
      } else
        for (let i = 0; i < 14; i++) {
          const height = h * (row % 2 ? 0.13 : 0.16) * (0.82 + (i % 3) * 0.08);
          const book = box(
            -w * 0.43 + i * w * 0.064,
            y + height / 2 + 0.02,
            0,
            w * 0.045,
            height,
            d * 0.7,
            mat(colors[(i + row) % colors.length]),
          );
          if (i > 10) book.rotation.z = -0.06;
        }
    }
    box(0, h, 0, w + 0.06, 0.035, d + 0.04, timber);
  } else if (item.kind === "dining-table") {
    box(0, h - 0.035, 0, w, 0.06, d, timber);
    for (const x of [-w * 0.4, w * 0.4])
      for (const z of [-d * 0.4, d * 0.4])
        box(x, h / 2, z, 0.065, h, 0.065, timber);
    const yellow = mat(item.color ?? "#d5bd68");
    box(0, h + 0.002, 0, w + 0.04, 0.012, d + 0.04, yellow);
    for (const x of [-1, 1])
      box(x * (w / 2 + 0.015), h - 0.075, 0, 0.014, 0.16, d + 0.04, yellow);
    for (const z of [-1, 1])
      box(0, h - 0.075, z * (d / 2 + 0.015), w + 0.04, 0.16, 0.014, yellow);
    const flowers: THREE.Vector3[] = [];
    for (let x = -w / 2 + 0.08; x < w / 2; x += 0.16)
      for (let z = -d / 2 + 0.07; z < d / 2; z += 0.16)
        flowers.push(new THREE.Vector3(x, h + 0.01, z));
    const petals = new THREE.InstancedMesh(
        new THREE.CircleGeometry(1, 8),
        mat("#f6f0dd"),
        flowers.length * 6,
      ),
      centers = new THREE.InstancedMesh(
        new THREE.CircleGeometry(1, 10),
        mat("#b28c29"),
        flowers.length,
      );
    const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, 0),
      ),
      matrix = new THREE.Matrix4();
    flowers.forEach((p, i) => {
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        matrix.compose(
          p
            .clone()
            .add(
              new THREE.Vector3(Math.cos(a) * 0.013, 0, Math.sin(a) * 0.013),
            ),
          q,
          new THREE.Vector3(0.011, 0.008, 1),
        );
        petals.setMatrixAt(i * 6 + j, matrix);
      }
      matrix.compose(
        p.clone().add(new THREE.Vector3(0, 0.001, 0)),
        q,
        new THREE.Vector3(0.007, 0.007, 1),
      );
      centers.setMatrixAt(i, matrix);
    });
    group.add(petals, centers);
  } else if (item.kind === "dining-chair") {
    box(0, 0.44, 0, w, 0.075, d, cloth);
    for (const x of [-w * 0.4, w * 0.4])
      for (const z of [-d * 0.4, d * 0.4])
        box(x, 0.22, z, 0.035, 0.44, 0.035, timber);
    for (const x of [-w * 0.4, w * 0.4])
      box(x, h * 0.65, d * 0.4, 0.035, h * 0.7, 0.035, timber);
    box(0, h * 0.89, d * 0.4, w, h * 0.16, 0.035, timber);
    box(0, h * 0.69, d * 0.4, w * 0.8, 0.065, 0.03, timber);
  } else if (item.kind === "fridge") {
    box(0, h / 2, 0, w, h, d, steel);
    box(0, h * 0.17, d / 2 + 0.012, w * 0.94, h * 0.3, 0.025, steel);
    box(0, h * 0.66, d / 2 + 0.012, w * 0.94, h * 0.66, 0.025, steel);
    for (const y of [h * 0.31, h * 0.55])
      box(-w * 0.37, y, d / 2 + 0.05, 0.018, h * 0.14, 0.025, steel);
    const colors = ["#5e7d81", "#c7b996", "#645c54", "#839279", "#ac7461"];
    for (let i = 0; i < 35; i++)
      box(
        -w * 0.37 + (i % 5) * w * 0.18,
        h * 0.41 + Math.floor(i / 5) * h * 0.075,
        d / 2 + 0.032,
        w * 0.15,
        h * 0.058,
        0.004,
        mat(colors[i % colors.length]),
      );
  } else if (item.kind === "curtain") {
    const fabric = mat(item.color ?? "#3f4240");
    for (let x = -w / 2; x < w / 2; x += 0.035)
      cylinder(x, h / 2, Math.cos(x * 100) * d * 0.3, 0.022, h, fabric);
  } else if (item.kind === "footstool") {
    cylinder(0, 0.06, 0, w * 0.34, 0.045, timber);
    box(0, h * 0.48, 0, 0.055, h * 0.7, 0.055, timber);
    box(0, h * 0.86, 0, w, h * 0.25, d, mat(item.color ?? "#8f654b"));
  } else if (item.kind === "pendant") {
    for (const x of [-w * 0.3, w * 0.3]) {
      cylinder(x, h / 2 + 0.06, 0, 0.006, h - 0.12, black);
      cylinder(x, 0.12, 0, 0.027, 0.065, steel);
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 16, 12),
        new THREE.MeshStandardMaterial({
          color: "#ffd177",
          emissive: "#ffac40",
          emissiveIntensity: 1.4,
        }),
      );
      bulb.position.set(x, 0.055, 0);
      group.add(bulb);
    }
  } else if (item.kind === "picture-frame") {
    box(0, h / 2, 0, w, h, 0.025, mat("#4a5140"));
    const gold = mat("#907044", 0.4, 0.3);
    for (const x of [-w / 2, w / 2])
      box(x, h / 2, 0.025, 0.035, h + 0.04, 0.04, gold);
    for (const y of [0, h]) box(0, y, 0.025, w, 0.035, 0.04, gold);
  } else if (item.kind === "wall-shelf") {
    box(0, 0, 0, w, 0.025, d, black);
    for (let i = 0; i < 3; i++)
      cylinder(
        -w * 0.3 + i * w * 0.3,
        0.07,
        0,
        0.045,
        0.12,
        i === 1 ? white : timber,
      );
  } else if (item.kind === "kitchen-run" || item.kind === "kitchen-cabinet") {
    const base = 0.9;
    box(0, base / 2, 0, w, base, d);
    box(0, base, 0, w + 0.025, 0.045, d + 0.025, black);
    const n = Math.max(2, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n;
      box(x, base / 2, d / 2 + 0.01, w / n - 0.012, base - 0.06, 0.02);
      box(x, base * 0.8, d / 2 + 0.035, (w / n) * 0.6, 0.018, 0.025, steel);
      if (item.kind === "kitchen-run") {
        box(x, h - 0.27, -d * 0.15, w / n - 0.012, 0.52, d * 0.7);
        box(x, h - 0.46, d * 0.22, (w / n) * 0.7, 0.018, 0.025, steel);
      }
    }
    if (item.kind === "kitchen-run") {
      box(w * 0.08, base + 0.025, 0, w * 0.28, 0.018, d * 0.78, steel);
      box(w * 0.08, base + 0.035, 0, w * 0.21, 0.01, d * 0.58, black);
      cylinder(w * 0.08, base + 0.16, -d * 0.35, 0.015, 0.26, steel);
      box(w * 0.08, base + 0.28, -d * 0.15, 0.025, 0.025, d * 0.4, steel);
      cylinder(-w * 0.32, base + 0.12, 0, 0.065, 0.2, white);
    }
  } else if (item.kind === "range-cooker") {
    box(0, 0.45, 0, w, 0.88, d, steel);
    box(0, 0.91, 0, w * 0.96, 0.025, d * 0.96, black);
    for (const x of [-w * 0.25, w * 0.25])
      for (const z of [-d * 0.22, d * 0.22]) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(w * 0.12, 0.004, 6, 24),
          steel,
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.set(x, 0.927, z);
        group.add(ring);
      }
    box(0, 0.4, d / 2 + 0.012, w * 0.85, 0.47, 0.025, black);
    box(0, 0.67, d / 2 + 0.045, w * 0.8, 0.028, 0.035, steel);
    for (let i = 0; i < 6; i++) {
      const knob = cylinder(-w * 0.35 + i * w * 0.14, 0, 0, 0.024, 0.03, steel);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(-w * 0.35 + i * w * 0.14, 0.81, d / 2 + 0.03);
    }
    box(0, 1.32, -d / 2, w, 0.79, 0.025, steel);
    const hood = new THREE.Shape([
      new THREE.Vector2(-w * 0.55, 0),
      new THREE.Vector2(w * 0.55, 0),
      new THREE.Vector2(w * 0.18, 0.25),
      new THREE.Vector2(-w * 0.18, 0.25),
    ]);
    const canopy = new THREE.Mesh(
      new THREE.ExtrudeGeometry(hood, { depth: d * 0.9, bevelEnabled: false }),
      steel,
    );
    canopy.position.set(0, 1.72, -d / 2);
    canopy.castShadow = true;
    group.add(canopy);
    box(0, (1.97 + h) / 2, -d * 0.28, w * 0.34, h - 1.97, d * 0.35, steel);
  }
  group.userData.role = item.kind;
  return group;
}
