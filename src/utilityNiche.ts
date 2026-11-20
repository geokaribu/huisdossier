import * as THREE from "three";
import type { PlanDecoration } from "./types";

/** Photo-derived laundry/storage alcove; placement and dimensions belong to the private plan. */
export function utilityNiche(item: PlanDecoration) {
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  const [w, d] = item.size,
    h = item.height;
  const mat = (color: string, roughness = 0.75) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const white = mat("#eeeae0"),
    dark = mat("#333a38", 0.45),
    metal = mat("#9a9e99", 0.35),
    timber = mat("#c5b695"),
    blue = mat("#204c72"),
    red = mat("#a43826");
  function box(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    material: THREE.Material,
    role: string,
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = role;
    group.add(mesh);
    return mesh;
  }
  box(0, h / 2, -d / 2, w, h, 0.035, white, "utility-back-wall");
  box(-w / 2, h / 2, 0, 0.045, h, d, white, "utility-side-wall");
  const drop = h * 0.52,
    slope = box(
      0,
      h - drop / 2,
      0,
      Math.hypot(w, drop),
      0.055,
      d,
      white,
      "stair-soffit",
    );
  slope.rotation.z = -Math.atan2(drop, w);
  box(
    w / 2,
    (h - drop) / 2,
    0,
    0.045,
    h - drop,
    d,
    white,
    "utility-low-side-wall",
  );
  box(
    -w * 0.31,
    h * 0.77,
    -0.025,
    w * 0.38,
    0.035,
    d * 0.86,
    timber,
    "utility-shelf",
  );
  group.userData.role = "utility-niche";
  if (item.contents === false) return group;
  const aw = w * 0.38,
    ah = h * 0.34,
    ad = Math.min(0.62, d * 0.88),
    front = ad / 2;
  const washerX = -w * 0.285,
    darkX = w * 0.105;
  box(washerX, ah / 2, 0, aw, ah, ad, white, "washing-machine");
  box(
    washerX,
    ah * 0.92,
    front + 0.008,
    aw * 0.96,
    ah * 0.14,
    0.016,
    white,
    "washer-controls",
  );
  box(
    washerX + aw * 0.24,
    ah * 0.93,
    front + 0.022,
    aw * 0.28,
    ah * 0.048,
    0.012,
    dark,
    "washer-display",
  );
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(aw * 0.055, aw * 0.055, 0.025, 20),
    metal,
  );
  dial.rotation.x = Math.PI / 2;
  dial.position.set(washerX - aw * 0.07, ah * 0.93, front + 0.027);
  group.add(dial);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(aw * 0.315, aw * 0.055, 12, 48),
    white,
  );
  rim.position.set(washerX, ah * 0.43, front + 0.025);
  rim.userData.role = "washer-door-ring";
  group.add(rim);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(aw * 0.29, 48),
    new THREE.MeshStandardMaterial({
      color: "#404b4c",
      roughness: 0.2,
      metalness: 0.4,
    }),
  );
  glass.position.set(washerX, ah * 0.43, front + 0.012);
  group.add(glass);
  box(
    washerX + aw * 0.29,
    ah * 0.48,
    front + 0.055,
    0.025,
    ah * 0.14,
    0.026,
    white,
    "washer-door-handle",
  );
  box(darkX, ah / 2, 0, aw, ah, ad, dark, "dishwasher");
  box(
    darkX,
    ah * 0.94,
    front + 0.009,
    aw * 0.96,
    ah * 0.11,
    0.018,
    dark,
    "appliance-controls",
  );
  box(
    darkX,
    ah * 0.85,
    front + 0.02,
    aw * 0.42,
    0.025,
    0.025,
    dark,
    "appliance-handle",
  );
  const indicator = mat("#b9d9df");
  for (let i = 0; i < 3; i++)
    box(
      darkX + aw * (0.12 + i * 0.055),
      ah * 0.96,
      front + 0.022,
      0.009,
      0.012,
      0.005,
      indicator,
      "appliance-indicator",
    );
  function bin(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    material: THREE.Material,
    lid = true,
  ) {
    if (lid) box(x, y + bh / 2, z, bw, bh, bd, material, "storage-bin");
    else {
      const t = 0.012;
      box(x, y + t / 2, z, bw, t, bd, material, "storage-base");
      for (const s of [-1, 1]) {
        box(
          x + (s * (bw - t)) / 2,
          y + bh / 2,
          z,
          t,
          bh,
          bd,
          material,
          "storage-side",
        );
        box(
          x,
          y + bh / 2,
          z + (s * (bd - t)) / 2,
          bw,
          bh,
          t,
          material,
          "storage-side",
        );
      }
    }
    if (lid)
      box(x, y + bh, z, bw + 0.025, 0.025, bd + 0.02, material, "storage-lid");
    box(
      x,
      y + bh * 0.78,
      z + bd / 2 + 0.004,
      bw * 0.24,
      bh * 0.12,
      0.012,
      dark,
      "storage-handle",
    );
  }
  bin(darkX, ah + 0.02, 0, aw * 0.94, ah * 0.32, ad * 0.92, white);
  bin(
    darkX - w * 0.025,
    ah * 1.35,
    -0.02,
    aw * 0.56,
    ah * 0.13,
    ad * 0.7,
    mat("#b8b6a6"),
    false,
  );
  bin(washerX, ah + 0.02, 0, aw * 0.9, ah * 0.19, ad * 0.8, red, false);
  bin(w * 0.415, 0, front * 0.15, w * 0.15, ah * 0.44, ad * 0.68, blue, false);
  bin(
    -w * 0.32,
    h * 0.785,
    -0.02,
    w * 0.3,
    h * 0.105,
    d * 0.72,
    mat("#263634"),
    false,
  );
  bin(
    -w * 0.29,
    ah * 1.23,
    -d * 0.14,
    w * 0.27,
    h * 0.17,
    d * 0.56,
    mat("#927849"),
    false,
  );
  bin(-w * 0.25, ah * 1.73, -d * 0.12, w * 0.25, h * 0.14, d * 0.58, white);
  group.userData.role = "utility-niche";
  return group;
}
