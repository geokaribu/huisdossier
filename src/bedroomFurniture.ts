import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import type { PlanDecoration } from "./types";

/** Local +Z is the front of cabinets and the foot of the bed. No house coordinates. */
export function bedroomFurniture(item: PlanDecoration, reflections = false) {
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  group.userData.role = item.kind;
  group.userData.componentId = item.id;
  const [w, d] = item.size,
    h = item.height;
  const material = (color: string, roughness = 0.75, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const body = material(item.color ?? "#554f49");
  function mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    role?: string,
  ) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    if (role) object.userData.role = role;
    group.add(object);
    return object;
  }
  function box(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    mat = body,
    role?: string,
  ) {
    return mesh(new THREE.BoxGeometry(bw, bh, bd), mat, x, y, z, role);
  }
  function cushion(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    mat: THREE.Material,
    role?: string,
  ) {
    return mesh(
      new RoundedBoxGeometry(bw, bh, bd, 3, Math.min(bw, bh, bd) * 0.3),
      mat,
      x,
      y,
      z,
      role,
    );
  }
  if (item.kind === "bed") {
    const lift = h / 0.62;
    const wood = material("#927452"),
      linen = material(item.color ?? "#647d82", 0.98);
    const mattress = material("#d3d2c5", 0.95),
      throwMat = material(item.secondaryColor ?? "#cc3975", 0.98);
    // Open storage platform at the foot: solid bottom, back and dividers, no floating mattress.
    box(0, 0.035 * lift, 0, w, 0.07 * lift, d, wood);
    box(
      0,
      0.225 * lift,
      -d * 0.08,
      w - 0.055,
      0.31 * lift,
      d * 0.8,
      material("#514334"),
    );
    for (const x of [-w / 2 + 0.018, 0, w / 2 - 0.018])
      box(x, 0.19 * lift, 0, 0.035, 0.31 * lift, d, wood);
    box(0, 0.34 * lift, 0, w, 0.035 * lift, d, wood);
    box(0, 0.19 * lift, d * 0.35, w, 0.29 * lift, 0.025, wood);
    cushion(
      0,
      0.435 * lift,
      -d * 0.055,
      w - 0.07,
      0.18 * lift,
      d * 0.86,
      mattress,
      "mattress",
    );
    // Deterministic cloth folds, with side drops connected to the top surface.
    function blanket(
      from: number,
      to: number,
      y: number,
      mat: THREE.MeshStandardMaterial,
      role: string,
    ) {
      const geometry = new THREE.PlaneGeometry(w - 0.035, to - from, 44, 42);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          z = (from + to) / 2 + positions.getY(i);
        const edgeDrop = Math.pow(Math.abs(x) / (w * 0.49), 40) * 0.07 * lift;
        const folds =
          (0.013 * Math.sin(x * 29 + z * 11) +
            0.009 * Math.sin(z * 26 - x * 9)) *
          lift;
        positions.setXYZ(i, x, y + folds - edgeDrop, z);
      }
      geometry.computeVertexNormals();
      mat.side = THREE.DoubleSide;
      mesh(geometry, mat, 0, 0, 0, role);
    }
    blanket(-d * 0.35, d * 0.35, h * 0.91, linen, "duvet");
    blanket(d * 0.12, d * 0.36, h * 0.91 + 0.026 * lift, throwMat, "bed-throw");
    for (const x of [-w * 0.23, w * 0.23]) {
      const pillow = cushion(
        x,
        h * 0.92,
        -d * 0.32,
        w * 0.41,
        h * 0.16,
        0.38,
        linen,
        "pillow",
      );
      pillow.rotation.y = x < 0 ? -0.08 : 0.08;
    }
  } else if (item.kind === "sliding-wardrobe") {
    const trim = material("#9b9990", 0.32, 0.65),
      dark = material("#262823");
    box(0, h / 2, -d / 2 + 0.015, w, h, 0.03);
    for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) box(x, h / 2, 0, 0.04, h, d);
    for (const y of [0.035, h - 0.025]) box(0, y, 0, w, 0.05, d);
    box(0, h / 2, d * 0.34, w - 0.05, h - 0.06, 0.035, dark);
    const count = item.panelCount ?? 3,
      panelW = (w - 0.06) / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + 0.03 + panelW * (i + 0.5),
        z = d / 2 - 0.026 + (i % 2) * 0.012;
      box(x, h / 2, z - 0.018, panelW, h - 0.08, 0.025, body, "wardrobe-panel");
      if (i === (item.mirrorPanel ?? Math.floor(count / 2))) {
        const geometry = new THREE.PlaneGeometry(panelW - 0.025, h - 0.12);
        const mirror = reflections
          ? new Reflector(geometry, {
              color: 0x858584,
              textureWidth: 512,
              textureHeight: 1024,
              clipBias: 0.002,
              multisample: 2,
            })
          : new THREE.Mesh(geometry, material("#a2aaa5", 0.08, 1));
        mirror.position.set(x, h / 2, z + 0.004);
        mirror.userData.role = "wardrobe-mirror";
        group.add(mirror);
      }
      for (const edge of [-1, 1])
        box(
          x + edge * (panelW / 2 - 0.008),
          h / 2,
          z + 0.009,
          0.016,
          h - 0.07,
          0.027,
          trim,
        );
    }
    for (const y of [0.04, h - 0.04]) {
      box(0, y, d / 2 - 0.006, w, 0.024, 0.06, trim);
      box(0, y, d / 2 - 0.045, w, 0.006, 0.008, dark);
    }
  } else if (item.kind === "low-cabinet") {
    const trim = material(item.color ?? "#697347", 0.55),
      brass = material("#9f8a54", 0.32, 0.6);
    for (const x of [-w * 0.43, w * 0.43])
      for (const z of [-d * 0.36, d * 0.36])
        box(x, 0.085, z, 0.055, 0.17, 0.055, trim);
    box(0, (0.15 + h - 0.046) / 2, 0, w - 0.035, h - 0.196, d - 0.025, trim);
    box(0, 0.15, 0, w, 0.065, d, trim);
    for (const x of [-w * 0.24, w * 0.24]) {
      const doorW = w * 0.45,
        doorH = h * 0.54;
      box(x, h * 0.46, d / 2 - 0.006, doorW, doorH, 0.035, trim);
      box(x, h * 0.46, d / 2 + 0.014, doorW - 0.075, doorH - 0.08, 0.014, body);
      box(x, h * 0.84, d / 2 + 0.004, doorW, h * 0.17, 0.035, trim);
      box(x, h * 0.84, d / 2 + 0.038, 0.105, 0.015, 0.026, brass);
      box(
        x + (x < 0 ? 0.08 : -0.08),
        h * 0.51,
        d / 2 + 0.04,
        0.016,
        0.08,
        0.022,
        brass,
      );
    }
    const marble = material(item.topColor ?? "#75604c", 0.25);
    box(0, h - 0.023, 0, w, 0.046, d, marble, "marble-top");
    // Veining is a procedural approximation, not a photographed or measured slab.
    const top = new THREE.PlaneGeometry(w, d, 180, 64),
      pos = top.attributes.position;
    const colors = [],
      brown = new THREE.Color(item.topColor ?? "#75604c"),
      cream = new THREE.Color("#ddd2b3");
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getY(i);
      const warp =
        marbleNoise(x * 9, z * 9) * 7 + marbleNoise(x * 27, z * 27) * 2;
      const vein = Math.sin(x * 29 + z * 37 + warp);
      const c = brown
        .clone()
        .multiplyScalar(0.78 + marbleNoise(x * 55, z * 55) * 0.4)
        .lerp(cream, Math.pow(1 - Math.abs(vein), 5) * 0.86);
      colors.push(c.r, c.g, c.b);
    }
    top.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const surface = mesh(
      top,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25 }),
      0,
      h + 0.001,
      0,
    );
    surface.rotation.x = -Math.PI / 2;
  } else if (item.kind === "laundry-hamper") {
    const black = material(item.color ?? "#202322", 0.95);
    cushion(0, h / 2, 0, w, h, d, black);
    const rim = mesh(new THREE.TorusGeometry(1, 0.023, 6, 48), black, 0, h, 0);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(w * 0.46, d * 0.46, 1);
    const inset = mesh(
      new THREE.CircleGeometry(1, 32),
      material("#0e1110"),
      0,
      h - 0.008,
      0,
    );
    inset.rotation.x = -Math.PI / 2;
    inset.scale.set(w * 0.43, d * 0.43, 1);
    for (const x of [-w * 0.3, w * 0.3])
      box(x, h + 0.015, 0, 0.018, 0.08, 0.06, black);
  } else if (item.kind === "potted-dracaena") {
    const potH = h * 0.27,
      radius = Math.min(w, d) * 0.25;
    const pot = material(item.color ?? "#823b29", 0.22);
    mesh(
      new THREE.CylinderGeometry(radius, radius * 0.73, potH, 32),
      pot,
      0,
      potH / 2,
      0,
    );
    const soil = mesh(
      new THREE.CircleGeometry(radius * 0.95, 24),
      material("#30291e"),
      0,
      potH + 0.001,
      0,
    );
    soil.rotation.x = -Math.PI / 2;
    const leafMat = material("#4b6030", 0.9);
    leafMat.side = THREE.DoubleSide;
    for (let stem = 0; stem < 3; stem++) {
      const sx = (stem - 1) * radius * 0.5,
        sy = h * (0.54 + stem * 0.09);
      mesh(
        new THREE.CylinderGeometry(0.012, 0.022, sy - potH, 8),
        material("#75624b"),
        sx,
        (sy + potH) / 2,
        0,
      );
      for (let i = 0; i < 19; i++) {
        const angle = i * 2.4 + stem,
          spread = Math.min(w, d) * (0.32 + (i % 3) * 0.035);
        const rise = (h - sy) * (0.25 + (i % 5) * 0.15);
        const geometry = new THREE.PlaneGeometry(0.025, 1, 1, 12),
          points = geometry.attributes.position;
        for (let j = 0; j < points.count; j++) {
          const t = points.getY(j) + 0.5;
          const width = Math.sin(Math.PI * t) * points.getX(j);
          points.setXYZ(
            j,
            sx + Math.cos(angle) * spread * t + Math.sin(angle) * width,
            sy + rise * Math.sin(t * Math.PI * 0.75) - 0.08 * t * t,
            Math.sin(angle) * spread * t - Math.cos(angle) * width,
          );
        }
        geometry.computeVertexNormals();
        mesh(geometry, leafMat, 0, 0, 0);
      }
    }
  }
  return group;
}

/** Reflectors own a render target in addition to their ordinary geometry/material. */
export function disposeFurnitureReflection(object: THREE.Object3D) {
  if (object instanceof Reflector) object.getRenderTarget().dispose();
}

function marbleNoise(x: number, y: number) {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), u),
    THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  );
}
