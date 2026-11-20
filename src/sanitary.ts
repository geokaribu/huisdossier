import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { Floorplan } from "./types";

/** Local +Z is the front; placement and mounting are supplied by the private plan. */
export function wallSanitary(f: Floorplan["fixtures"][number]) {
  const group = new THREE.Group(),
    [w, d] = f.size,
    h = f.height;
  group.position.set(f.center[0], 0, f.center[1]);
  group.rotation.y = f.rotation ?? 0;
  const ceramic = new THREE.MeshStandardMaterial({
      color: "#f6f5ef",
      roughness: 0.24,
    }),
    chrome = new THREE.MeshStandardMaterial({
      color: "#b9c5c8",
      metalness: 0.85,
      roughness: 0.24,
    }),
    gap = new THREE.MeshStandardMaterial({ color: "#3a4040", roughness: 0.8 });
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    role: string,
  ) {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    o.userData.role = role;
    group.add(o);
    return o;
  }
  function box(
    x: number,
    y: number,
    z: number,
    bw: number,
    bh: number,
    bd: number,
    mat: THREE.Material,
    role: string,
  ) {
    return mesh(
      new RoundedBoxGeometry(
        bw,
        bh,
        bd,
        3,
        Math.min(0.012, bw / 5, bh / 5, bd / 5),
      ),
      mat,
      x,
      y,
      z,
      role,
    );
  }
  function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, role: string) {
    const o = mesh(
      new THREE.CylinderGeometry(r, r, a.distanceTo(b), 16),
      chrome,
      0,
      0,
      0,
      role,
    );
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
  }
  if (f.kind === "toilet") {
    const points = [
      new THREE.Vector2(0, h - 0.27),
      new THREE.Vector2(0.11, h - 0.25),
      new THREE.Vector2(0.17, h - 0.18),
      new THREE.Vector2(0.195, h - 0.08),
      new THREE.Vector2(0.19, h - 0.035),
    ];
    const bowl = mesh(
      new THREE.LatheGeometry(points, 40),
      ceramic,
      0,
      0,
      0.012,
      "wall-hung-bowl",
    );
    bowl.scale.set(w / 0.4, 1, d / 0.4);
    box(
      0,
      h - 0.12,
      -d * 0.4,
      w * 0.66,
      0.19,
      d * 0.36,
      ceramic,
      "toilet-wall-connection",
    );
    const seam = mesh(
      new THREE.SphereGeometry(1, 40, 16),
      gap,
      0,
      h - 0.022,
      0.012,
      "seat-gap",
    );
    seam.scale.set(w * 0.485, 0.012, d * 0.485);
    const lid = mesh(
      new THREE.SphereGeometry(1, 40, 20),
      ceramic,
      0,
      h,
      0.012,
      "closed-toilet-lid",
    );
    lid.scale.set(w * 0.49, 0.022, d * 0.49);
    box(0, 1.02, -d * 0.55, w * 0.65, 0.135, 0.016, ceramic, "flush-plate");
    for (const [x, width] of [
      [-w * 0.13, w * 0.23],
      [w * 0.17, w * 0.16],
    ])
      box(
        x,
        1.02,
        -d * 0.55 + 0.009,
        width,
        0.085,
        0.006,
        ceramic,
        "flush-button",
      );
  } else {
    const outer = new THREE.Shape([
        new THREE.Vector2(-w / 2, -d / 2),
        new THREE.Vector2(w / 2, -d / 2),
        new THREE.Vector2(w / 2, d / 2),
        new THREE.Vector2(-w / 2, d / 2),
      ]),
      iw = w * 0.78,
      id = d * 0.62,
      cz = -d * 0.07;
    outer.holes.push(
      new THREE.Path([
        new THREE.Vector2(-iw / 2, cz - id / 2),
        new THREE.Vector2(-iw / 2, cz + id / 2),
        new THREE.Vector2(iw / 2, cz + id / 2),
        new THREE.Vector2(iw / 2, cz - id / 2),
      ]),
    );
    const rim = mesh(
      new THREE.ExtrudeGeometry(outer, { depth: 0.035, bevelEnabled: false }),
      ceramic,
      0,
      h - 0.035,
      0,
      "basin-rim",
    );
    rim.rotation.x = -Math.PI / 2;
    // A real recessed bowl, rather than a metal rectangle covering the ceramic top.
    const top = [
        [-iw / 2, -cz - id / 2],
        [iw / 2, -cz - id / 2],
        [iw / 2, -cz + id / 2],
        [-iw / 2, -cz + id / 2],
      ],
      bottom = top.map(([x, z]) => [x * 0.7, z * 0.65]);
    const vertices: number[] = [];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      for (const [a, y] of [
        [top[i], h],
        [top[j], h],
        [bottom[j], h - 0.085],
        [top[i], h],
        [bottom[j], h - 0.085],
        [bottom[i], h - 0.085],
      ] as [number[], number][])
        vertices.push(a[0], y, a[1]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.computeVertexNormals();
    const bowlMat = ceramic.clone();
    bowlMat.side = THREE.DoubleSide;
    mesh(geo, bowlMat, 0, 0, 0, "basin-bowl");
    box(
      0,
      h - 0.09,
      -cz * 0.65,
      iw * 0.7,
      0.018,
      id * 0.65,
      ceramic,
      "basin-bottom",
    );
    box(
      0,
      h - 0.065,
      -d * 0.44,
      w,
      0.13,
      d * 0.12,
      ceramic,
      "basin-wall-connection",
    );
    const drain = mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.004, 20),
      chrome,
      0,
      h - 0.078,
      -cz * 0.65,
      "basin-drain",
    );
    drain.castShadow = false;
    rod(
      new THREE.Vector3(0, h - 0.1, 0),
      new THREE.Vector3(0, h - 0.33, 0),
      0.018,
      "basin-siphon",
    );
    rod(
      new THREE.Vector3(0, h - 0.33, 0),
      new THREE.Vector3(0, h - 0.33, -d * 0.52),
      0.018,
      "basin-waste-pipe",
    );
    const tapX = -w * 0.3,
      tapZ = -d * 0.34;
    rod(
      new THREE.Vector3(tapX, h, tapZ),
      new THREE.Vector3(tapX, h + 0.16, tapZ),
      0.012,
      "basin-tap",
    );
    rod(
      new THREE.Vector3(tapX, h + 0.14, tapZ),
      new THREE.Vector3(tapX, h + 0.14, tapZ + 0.095),
      0.012,
      "basin-spout",
    );
    rod(
      new THREE.Vector3(tapX, h + 0.16, tapZ),
      new THREE.Vector3(tapX + 0.05, h + 0.16, tapZ),
      0.006,
      "basin-lever",
    );
  }
  return group;
}
