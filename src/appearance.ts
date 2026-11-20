import * as THREE from "three";
import type { HouseAppearance, Point, Surface } from "./types";
import { recessedRoof } from "./roof.ts";

export function frontFrame(profile: HouseAppearance) {
  const { left, right } = profile.front;
  const width = Math.hypot(right[0] - left[0], right[1] - left[1]);
  const u: [number, number] = [
    (right[0] - left[0]) / width,
    (right[1] - left[1]) / width,
  ];
  const normal: [number, number] = [u[1], -u[0]];
  return { u, normal, width };
}

export function isFrontSurface(surface: Surface, profile: HouseAppearance) {
  if (surface.type !== "WallSurface") return false;
  const { normal } = frontFrame(profile);
  return surface.rings
    .flat()
    .every(
      (p) =>
        Math.abs(
          (p[0] - profile.front.left[0]) * normal[0] +
            (p[1] - profile.front.left[1]) * normal[1],
        ) < 0.07,
    );
}

export function projectFront(
  geometry: THREE.BufferGeometry,
  profile: HouseAppearance,
  origin: Point,
) {
  const { u, width } = frontFrame(profile);
  const positions = geometry.getAttribute("position");
  const uv = [];
  for (let i = 0; i < positions.count; i++) {
    const rdX = positions.getX(i) + origin[0],
      rdY = -positions.getZ(i) + origin[1],
      height = positions.getY(i) + origin[2];
    uv.push(
      ((rdX - profile.front.left[0]) * u[0] +
        (rdY - profile.front.left[1]) * u[1]) /
        width,
      (height - profile.front.bottom) /
        (profile.front.top - profile.front.bottom),
    );
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

/** Orthophoto projection uses its exact RD bounding box; north is image-up. */
export function projectAerial(
  geometry: THREE.BufferGeometry,
  profile: NonNullable<HouseAppearance["aerial"]>,
  origin: Point,
) {
  const [xmin, ymin, xmax, ymax] = profile.bbox;
  const positions = geometry.getAttribute("position"),
    uv = [];
  for (let i = 0; i < positions.count; i++)
    uv.push(
      (positions.getX(i) + origin[0] - xmin) / (xmax - xmin),
      (-positions.getZ(i) + origin[1] - ymin) / (ymax - ymin),
    );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

/** Source-independent, approximate stucco and zinc materials. No invented windows. */
export function materialTextures() {
  const stucco = document.createElement("canvas");
  stucco.width = 256;
  stucco.height = 256;
  const wall = stucco.getContext("2d")!;
  wall.fillStyle = "#eeeae3";
  wall.fillRect(0, 0, 256, 256);
  let seed = 17;
  for (let i = 0; i < 14000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const x = seed % 256;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const y = seed % 256;
    wall.fillStyle = i % 2 ? "rgba(70,60,50,.035)" : "rgba(255,255,255,.15)";
    wall.fillRect(x, y, 1, 1);
  }
  const roof = document.createElement("canvas");
  roof.width = 256;
  roof.height = 256;
  const metal = roof.getContext("2d")!;
  metal.fillStyle = "#839199";
  metal.fillRect(0, 0, 256, 256);
  metal.fillStyle = "#6d7c86";
  metal.fillRect(0, 0, 3, 256);
  metal.fillStyle = "#b5bfc0";
  metal.fillRect(3, 0, 2, 256);
  metal.strokeStyle = "rgba(46,61,71,.18)";
  metal.lineWidth = 1;
  metal.beginPath();
  metal.moveTo(0, 255);
  metal.lineTo(256, 255);
  metal.stroke();
  const stuccoMap = new THREE.CanvasTexture(stucco),
    roofMap = new THREE.CanvasTexture(roof);
  for (const texture of [stuccoMap, roofMap]) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
  }
  return { stuccoMap, roofMap };
}

export function projectMaterial(
  geometry: THREE.BufferGeometry,
  profile: HouseAppearance,
  origin: Point,
  roof: boolean,
) {
  const { u, normal } = frontFrame(profile);
  const positions = geometry.getAttribute("position");
  const uv = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) + origin[0] - profile.front.left[0],
      y = -positions.getZ(i) + origin[1] - profile.front.left[1];
    uv.push(
      (x * u[0] + y * u[1]) / (roof ? 0.55 : 2),
      roof ? (x * normal[0] + y * normal[1]) / 1.5 : positions.getY(i) / 2,
    );
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}

export function facadeDetails(
  profile: HouseAppearance,
  origin: Point,
  surfaces: Surface[],
  roofMap?: THREE.Texture,
) {
  const group = new THREE.Group();
  const { u, normal, width } = frontFrame(profile);
  const metal = new THREE.MeshStandardMaterial({
    color: "#596b7a",
    roughness: 0.65,
    metalness: 0.25,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#b9b7aa",
    roughness: 0.9,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#596d73",
    roughness: 0.3,
    metalness: 0.2,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: profile.materials.plinth,
    roughness: 0.95,
  });
  function box(
    start: Point,
    w: number,
    h: number,
    depth: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), material);
    mesh.position.set(
      start[0] - origin[0],
      start[2] - origin[2],
      -(start[1] - origin[1]),
    );
    mesh.rotation.y = Math.atan2(u[1], u[0]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }
  const point = (across: number, z: number, out: number): Point => [
    profile.front.left[0] + u[0] * across + normal[0] * out,
    profile.front.left[1] + u[1] * across + normal[1] * out,
    z,
  ];
  box(
    point(width / 2, profile.front.top - 0.04, 0.035),
    width + 0.12,
    0.14,
    0.2,
    metal,
  );
  box(
    point(width / 2, profile.front.bottom + 0.12, 0.025),
    width,
    0.24,
    0.055,
    dark,
  );
  // Small brackets follow the cornice visible in the supplied front photos.
  for (let x = 0.2; x < width; x += 0.54) {
    if (profile.roof?.recess) {
      const start = point(x, profile.front.top - 0.06, 0.19),
        end = point(x, profile.front.top - 0.36, 0.015);
      const from = new THREE.Vector3(
          start[0] - origin[0],
          start[2] - origin[2],
          -(start[1] - origin[1]),
        ),
        to = new THREE.Vector3(
          end[0] - origin[0],
          end[2] - origin[2],
          -(end[1] - origin[1]),
        );
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.065, from.distanceTo(to), 0.07),
        metal,
      );
      support.position.copy(from).add(to).multiplyScalar(0.5);
      support.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        to.sub(from).normalize(),
      );
      support.castShadow = true;
      group.add(support);
    } else
      box(point(x, profile.front.top - 0.15, 0.1), 0.065, 0.19, 0.29, metal);
  }
  // A thin rainwater pipe is visible at the left edge of the front.
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.035,
      0.035,
      profile.front.top - profile.front.bottom,
      12,
    ),
    metal,
  );
  const pipePosition = point(
    0.035,
    (profile.front.top + profile.front.bottom) / 2,
    0.08,
  );
  pipe.position.set(
    pipePosition[0] - origin[0],
    pipePosition[2] - origin[2],
    -(pipePosition[1] - origin[1]),
  );
  group.add(pipe);
  const dormer =
    profile.dormerSurface === undefined
      ? undefined
      : surfaces[profile.dormerSurface];
  if (profile.roof?.recess) {
    group.add(recessedRoof(profile, origin, roofMap));
  } else if (profile.roof) {
    const r = profile.roof;
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      map: roofMap,
      roughness: 0.73,
      metalness: 0.12,
      side: THREE.DoubleSide,
    });
    const a = (width - r.dormerWidth) / 2,
      b = (width + r.dormerWidth) / 2;
    const roofPoint = (x: number, t: number) =>
      point(
        x,
        profile.front.top + (r.top - profile.front.top) * t,
        -r.inset * t,
      );
    function quad(
      points: Point[],
      material: THREE.Material,
      kind = "RoofSurface",
    ) {
      const geometry = new THREE.BufferGeometry();
      const coordinates = [0, 1, 2, 0, 2, 3].flatMap((i) => [
        points[i][0] - origin[0],
        points[i][2] - origin[2],
        -(points[i][1] - origin[1]),
      ]);
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(coordinates, 3),
      );
      geometry.computeVertexNormals();
      projectMaterial(geometry, profile, origin, true);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.surfaceType = kind;
      group.add(mesh);
    }
    quad(
      [roofPoint(0, 0), roofPoint(a, 0), roofPoint(a, 1), roofPoint(0, 1)],
      roofMaterial,
    );
    quad(
      [
        roofPoint(b, 0),
        roofPoint(width, 0),
        roofPoint(width, 1),
        roofPoint(b, 1),
      ],
      roofMaterial,
    );
    const t =
      (r.dormerBottom - profile.front.top) / (r.top - profile.front.top);
    quad(
      [roofPoint(a, 0), roofPoint(b, 0), roofPoint(b, t), roofPoint(a, t)],
      roofMaterial,
    );
    const front = (x: number, z: number, out = 0) =>
      point(x, z, -r.dormerInset + out);
    for (const x of [a, b])
      quad(
        [
          roofPoint(x, t),
          front(x, r.dormerBottom),
          front(x, r.top),
          roofPoint(x, 1),
        ],
        roofMaterial,
        "WallSurface",
      );
    quad(
      [
        front(a, r.top + 0.025),
        front(b, r.top + 0.025),
        roofPoint(b, 1),
        roofPoint(a, 1),
      ],
      roofMaterial,
    );
    const h = r.top - r.dormerBottom - 0.14,
      w = r.dormerWidth;
    box(
      front(width / 2, r.dormerBottom + h / 2, 0.04),
      w - 0.1,
      h,
      0.055,
      glass,
    );
    for (const x of [a + 0.025, width / 2, b - 0.025])
      box(
        front(x, r.dormerBottom + h / 2, 0.085),
        0.055,
        h + 0.08,
        0.08,
        metal,
      );
    for (const z of [
      r.dormerBottom,
      r.dormerBottom + h * 0.78,
      r.dormerBottom + h,
    ])
      box(front(width / 2, z, 0.085), w, 0.055, 0.08, metal);
    box(
      front(width / 2, r.dormerBottom - 0.055, 0.17),
      w + 0.2,
      0.1,
      0.44,
      stone,
    );
    box(
      front(width / 2, r.dormerBottom + 0.7, 0.42),
      w + 0.1,
      0.04,
      0.04,
      metal,
    );
    for (let x = a; x <= b; x += 0.14)
      box(front(x, r.dormerBottom + 0.32, 0.42), 0.018, 0.73, 0.018, metal);
    if (r.awningWidth) {
      const timber = new THREE.MeshStandardMaterial({
        color: "#ad8555",
        roughness: 0.85,
      });
      box(
        front(width / 2, r.top - 0.25, 0.28),
        r.awningWidth,
        0.16,
        0.38,
        timber,
      );
      for (const x of [-r.awningWidth / 2, r.awningWidth / 2])
        box(
          front(width / 2 + x, r.top - 0.37, 0.22),
          0.035,
          0.26,
          0.035,
          metal,
        );
    }
  } else if (dormer) {
    const points = dormer.rings.flat();
    const cx = points.reduce((s, p) => s + p[0] / points.length, 0),
      cy = points.reduce((s, p) => s + p[1] / points.length, 0);
    const minZ = Math.min(...points.map((p) => p[2])),
      maxZ = Math.max(...points.map((p) => p[2]));
    const horizontal = points.map(
      (p) => (p[0] - cx) * u[0] + (p[1] - cy) * u[1],
    );
    const w = Math.max(...horizontal) - Math.min(...horizontal);
    const z0 = minZ + 0.2,
      h = Math.max(0.4, maxZ - minZ - 0.4);
    const p = (across: number, z: number, out: number): Point => [
      cx + u[0] * across + normal[0] * out,
      cy + u[1] * across + normal[1] * out,
      z,
    ];
    box(p(0, z0 + h / 2, 0.025), w * 0.86, h, 0.045, glass);
    for (const x of [-w * 0.46, 0, w * 0.46])
      box(p(x, z0 + h / 2, 0.07), 0.045, h + 0.08, 0.07, metal);
    for (const z of [z0, z0 + h * 0.75, z0 + h])
      box(p(0, z, 0.07), w * 0.94, 0.055, 0.07, metal);
    box(p(0, z0 - 0.05, 0.15), w * 1.15, 0.11, 0.42, stone);
    box(p(0, z0 + 0.7, 0.36), w * 1.05, 0.035, 0.035, metal);
    for (let x = -w / 2; x <= w / 2; x += 0.13)
      box(p(x, z0 + 0.33, 0.36), 0.018, 0.72, 0.018, metal);
  }
  group.userData.approximation = true;
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.userData.isTarget = true;
      object.userData.surfaceType ??= "WallSurface";
    }
  });
  return group;
}
