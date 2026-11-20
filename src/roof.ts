import * as THREE from "three";
import type { HouseAppearance, Point } from "./types";

/** Photo-derived roof parts. Dimensions are private profile data, never a house-specific mesh. */
export function recessedRoof(
  profile: HouseAppearance,
  origin: Point,
  roofMap?: THREE.Texture,
) {
  const r = profile.roof!,
    recess = r.recess!;
  const group = new THREE.Group();
  const width = Math.hypot(
    profile.front.right[0] - profile.front.left[0],
    profile.front.right[1] - profile.front.left[1],
  );
  const ux = (profile.front.right[0] - profile.front.left[0]) / width,
    uy = (profile.front.right[1] - profile.front.left[1]) / width;
  const normal = [uy, -ux],
    rise = r.top - profile.front.top;
  const world = (x: number, y: number, out: number) =>
    new THREE.Vector3(
      profile.front.left[0] + ux * x + normal[0] * out - origin[0],
      y - origin[2],
      -(profile.front.left[1] + uy * x + normal[1] * out - origin[1]),
    );
  const slope = (x: number, t: number, out = 0) =>
    world(x, profile.front.top + rise * t, -r.inset * t + out);
  const mat = (color: string, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    });
  const zinc = new THREE.MeshStandardMaterial({
    color: roofMap ? "#ffffff" : profile.materials.roof,
    map: roofMap ?? null,
    roughness: 0.67,
    metalness: 0.22,
    side: THREE.DoubleSide,
  });
  const flashing = mat("#9aa9ac", 0.57, 0.35),
    frame = mat("#4d606c", 0.5, 0.18),
    seal = mat("#39464b", 0.7),
    glass = mat("#6f8b98", 0.24, 0.3),
    plaster = mat("#d3d1c0", 0.92),
    timber = mat("#b28d59", 0.85),
    deck = mat("#aaa997", 0.95),
    rail = mat("#aeb9b4", 0.5, 0.45);
  function mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    role: string,
  ) {
    geometry.computeVertexNormals();
    const result = new THREE.Mesh(geometry, material);
    result.castShadow = true;
    result.receiveShadow = true;
    result.userData = { role, isTarget: true, surfaceType: "RoofSurface" };
    group.add(result);
    return result;
  }
  function quad(
    points: THREE.Vector3[],
    material: THREE.Material,
    role: string,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 1, 2, 0, 2, 3].flatMap((i) => points[i].toArray()),
        3,
      ),
    );
    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2),
    );
    return mesh(geo, material, role);
  }
  function bar(
    a: THREE.Vector3,
    b: THREE.Vector3,
    thickness: number,
    material: THREE.Material,
    role: string,
  ) {
    const result = mesh(
      new THREE.CylinderGeometry(
        thickness / 2,
        thickness / 2,
        a.distanceTo(b),
        8,
      ),
      material,
      role,
    );
    result.position.copy(a).add(b).multiplyScalar(0.5);
    result.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    return result;
  }
  const a = (width - recess.width) / 2,
    b = (width + recess.width) / 2;
  const holes = [
    { x: a, w: recess.width, lo: recess.bottomT, hi: recess.topT },
    ...(r.windows ?? []).map((w) => ({
      x: w.across,
      w: w.width,
      lo: w.bottomT,
      hi: w.topT,
    })),
  ];
  // Triangulate the zinc plane with genuine holes for windows and the recessed balcony.
  const shape = new THREE.Shape([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(width, 0),
    new THREE.Vector2(width, 1),
    new THREE.Vector2(0, 1),
  ]);
  for (const h of holes)
    shape.holes.push(
      new THREE.Path([
        new THREE.Vector2(h.x, h.lo),
        new THREE.Vector2(h.x, h.hi),
        new THREE.Vector2(h.x + h.w, h.hi),
        new THREE.Vector2(h.x + h.w, h.lo),
      ]),
    );
  const geo = new THREE.ShapeGeometry(shape),
    pos = geo.getAttribute("position"),
    uv = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      t = pos.getY(i),
      p = slope(x, t);
    pos.setXYZ(i, p.x, p.y, p.z);
    uv.push(x / 0.48, (t * rise) / 1.4);
  }
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  mesh(geo, zinc, "roof-slope");
  // Raised standing seams stop at the holes instead of running across the glazing.
  for (let x = 0.16; x < width; x += 0.48) {
    let cursor = 0;
    for (const h of holes
      .filter((h) => x > h.x && x < h.x + h.w)
      .sort((a, b) => a.lo - b.lo)) {
      if (h.lo > cursor)
        bar(
          slope(x, cursor, 0.012),
          slope(x, h.lo, 0.012),
          0.012,
          flashing,
          "zinc-seam",
        );
      cursor = h.hi;
    }
    if (cursor < 1)
      bar(
        slope(x, cursor, 0.012),
        slope(x, 1, 0.012),
        0.012,
        flashing,
        "zinc-seam",
      );
  }
  bar(slope(0, 1, 0.02), slope(width, 1, 0.02), 0.045, flashing, "ridge-cap");
  for (const w of r.windows ?? []) {
    const padX = 0.055,
      padT = 0.055 / rise;
    // Individual flashing strips surround each opening; there is no painted-on window.
    quad(
      [
        slope(w.across - padX, w.bottomT - padT, 0.025),
        slope(w.across + w.width + padX, w.bottomT - padT, 0.025),
        slope(w.across + w.width + padX, w.bottomT, 0.025),
        slope(w.across - padX, w.bottomT, 0.025),
      ],
      flashing,
      "window-flashing",
    );
    quad(
      [
        slope(w.across - padX, w.topT, 0.025),
        slope(w.across + w.width + padX, w.topT, 0.025),
        slope(w.across + w.width + padX, w.topT + padT, 0.025),
        slope(w.across - padX, w.topT + padT, 0.025),
      ],
      flashing,
      "window-flashing",
    );
    for (const x of [w.across - padX, w.across + w.width])
      quad(
        [
          slope(x, w.bottomT, 0.025),
          slope(x + padX, w.bottomT, 0.025),
          slope(x + padX, w.topT, 0.025),
          slope(x, w.topT, 0.025),
        ],
        flashing,
        "window-flashing",
      );
    const corners = [
      slope(w.across, w.bottomT, 0.055),
      slope(w.across + w.width, w.bottomT, 0.055),
      slope(w.across + w.width, w.topT, 0.055),
      slope(w.across, w.topT, 0.055),
    ];
    quad(corners, glass, "roof-window-glass");
    for (let i = 0; i < 4; i++) {
      bar(corners[i], corners[(i + 1) % 4], 0.065, seal, "roof-window-frame");
      bar(
        corners[i].clone().add(new THREE.Vector3(0, 0.008, 0)),
        corners[(i + 1) % 4].clone().add(new THREE.Vector3(0, 0.008, 0)),
        0.027,
        flashing,
        "roof-window-edge",
      );
    }
    bar(
      slope(w.across, w.topT - 0.018, 0.07),
      slope(w.across + w.width, w.topT - 0.018, 0.07),
      0.04,
      frame,
      "window-vent",
    );
  }
  const bottom = profile.front.top + rise * recess.bottomT,
    top = profile.front.top + rise * recess.topT,
    frontOut = -r.inset * recess.bottomT;
  const back = (x: number, y: number, out = 0) =>
    world(x, y, -recess.depth + out);
  for (const x of [a, b])
    quad(
      [
        slope(x, recess.bottomT),
        slope(x, recess.topT),
        back(x, top),
        back(x, bottom),
      ],
      plaster,
      "balcony-cheek",
    );
  quad(
    [slope(a, recess.topT), slope(b, recess.topT), back(b, top), back(a, top)],
    zinc,
    "balcony-soffit",
  );
  quad(
    [
      world(a, bottom, frontOut),
      world(b, bottom, frontOut),
      back(b, bottom),
      back(a, bottom),
    ],
    deck,
    "balcony-deck",
  );
  quad(
    [back(a, bottom), back(b, bottom), back(b, top), back(a, top)],
    plaster,
    "balcony-back",
  );
  const doorA = a + 0.1,
    doorB = b - 0.1,
    doorTop = Math.min(top - 0.09, bottom + 2.2);
  quad(
    [
      back(doorA, bottom + 0.05, 0.02),
      back(doorB, bottom + 0.05, 0.02),
      back(doorB, doorTop, 0.02),
      back(doorA, doorTop, 0.02),
    ],
    glass,
    "balcony-door",
  );
  for (const x of [doorA, doorA + (doorB - doorA) * 0.34, doorB])
    bar(
      back(x, bottom + 0.03, 0.055),
      back(x, doorTop, 0.055),
      0.055,
      frame,
      "balcony-door-frame",
    );
  for (const y of [bottom + 0.03, doorTop])
    bar(
      back(doorA, y, 0.055),
      back(doorB, y, 0.055),
      0.055,
      frame,
      "balcony-door-frame",
    );
  // A tan vertical screen is visible below the wooden awning in the supplied close-up.
  for (let x = doorA + (doorB - doorA) * 0.38; x < doorB - 0.025; x += 0.045)
    bar(
      back(x, bottom + 0.1, 0.08),
      back(x, doorTop - 0.08, 0.08),
      0.041,
      timber,
      "timber-screen",
    );
  const out = frontOut + 0.08,
    railTop = bottom + recess.railingHeight;
  for (const y of [bottom + 0.06, railTop])
    bar(
      world(a - 0.02, y, out),
      world(b + 0.02, y, out),
      0.035,
      rail,
      "balcony-rail",
    );
  for (let x = a; x <= b + 0.001; x += recess.width / 10)
    bar(
      world(x, bottom + 0.04, out),
      world(x, railTop, out),
      0.018,
      rail,
      "balcony-baluster",
    );
  for (const x of [a, b]) {
    bar(
      world(x, railTop, out),
      back(x, railTop, 0.08),
      0.035,
      rail,
      "balcony-side-rail",
    );
    for (let t = 0.2; t < 1; t += 0.2) {
      const z = out + (-recess.depth + 0.08 - out) * t;
      bar(
        world(x, bottom + 0.04, z),
        world(x, railTop, z),
        0.018,
        rail,
        "balcony-side-baluster",
      );
    }
  }
  if (r.awningWidth) {
    const left = (width - r.awningWidth) / 2,
      right = (width + r.awningWidth) / 2,
      y = doorTop + 0.04,
      caseOut = frontOut + 0.12;
    for (let z = caseOut - 0.4; z <= caseOut; z += 0.035)
      bar(world(left, y, z), world(right, y, z), 0.035, timber, "awning-slat");
    for (const z of [caseOut - 0.4, caseOut]) {
      bar(
        world(left, y + 0.04, z),
        world(right, y + 0.04, z),
        0.09,
        timber,
        "awning-case",
      );
    }
    for (const x of [left, right])
      bar(
        world(x, y - 0.18, caseOut - 0.3),
        world(x, y, caseOut),
        0.025,
        frame,
        "awning-support",
      );
  }
  return group;
}
