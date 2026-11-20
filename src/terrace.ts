import * as THREE from "three";
import type { GlazedJoinery, PlanDecoration, PlanWall } from "./types";
import { interiorFurniture } from "./interiorFurniture.ts";
import { utilityNiche } from "./utilityNiche.ts";
import { gardenFurniture } from "./gardenFurniture.ts";
import { livingFurniture } from "./livingFurniture.ts";
import { bedroomFurniture } from "./bedroomFurniture.ts";

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: THREE.Material | THREE.Material[],
  angle = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function rod(
  parent: THREE.Object3D,
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8),
    material,
  );
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
const material = (color: string, roughness = 0.8) =>
  new THREE.MeshStandardMaterial({ color, roughness });

/** Both sides use separate paint. Leaf pivots follow the same hinges as walking collisions. */
export function glazedDoors(
  wall: PlanWall,
  opening: PlanWall["openings"][number],
  config: GlazedJoinery,
) {
  const group = new THREE.Group();
  const dx = wall.b[0] - wall.a[0],
    dz = wall.b[1] - wall.a[1],
    length = Math.hypot(dx, dz);
  group.position.set(
    wall.a[0] + (dx * opening.offset) / length,
    opening.sill,
    wall.a[1] + (dz * opening.offset) / length,
  );
  group.rotation.y = -Math.atan2(dz, dx);
  const outside = material(config.outsideColor, 0.55),
    inside = material(config.insideColor, 0.6);
  const paint = [outside, outside, outside, outside, inside, outside];
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#c2d7dc",
    transparent: true,
    opacity: 0.2,
    roughness: 0.12,
    metalness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: "#b4b4a5",
    metalness: 0.65,
    roughness: 0.28,
  });
  const height = opening.height,
    width = opening.width,
    fixed = config.fixedLeft;
  // Deep reveal: white indoors, blue-grey outdoors; a low stone threshold.
  for (const x of [0, width])
    box(group, x, height / 2, 0, 0.075, height, 0.16, paint);
  box(group, width / 2, height, 0, width, 0.075, 0.16, paint);
  box(group, width / 2, 0.015, 0, width, 0.03, 0.22, material("#888e89"));
  function sash(
    parent: THREE.Object3D,
    from: number,
    to: number,
    handles = false,
  ) {
    for (const x of [from + 0.035, to - 0.035])
      box(parent, x, height / 2, 0, 0.07, height, 0.065, paint);
    for (const [y, h] of [
      [0.09, 0.18],
      [height - 0.045, 0.09],
    ])
      box(parent, (from + to) / 2, y, 0, to - from, h, 0.065, paint);
    const pane = box(
      parent,
      (from + to) / 2,
      (height + 0.13) / 2,
      0,
      to - from - 0.14,
      height - 0.26,
      0.012,
      glass,
    );
    pane.castShadow = false;
    if (handles) {
      const x = from < 0 ? from + 0.12 : to - 0.12;
      for (const z of [-0.065, 0.065]) {
        box(parent, x, 0.99, z, 0.035, 0.2, 0.018, steel);
        box(
          parent,
          x + (from < 0 ? 0.04 : -0.04),
          1.01,
          z * 1.4,
          0.12,
          0.022,
          0.025,
          steel,
        );
      }
    }
  }
  if (fixed > 0.05) sash(group, 0, fixed);
  const left = new THREE.Group(),
    right = new THREE.Group(),
    leaf = (width - fixed) / 2;
  left.position.x = fixed;
  right.position.x = width;
  group.add(left, right);
  sash(left, 0, leaf, true);
  sash(right, -leaf, 0, true);
  const setOpen = (open: boolean) => {
    left.rotation.y = open ? THREE.MathUtils.degToRad(config.openAngle) : 0;
    right.rotation.y = open ? -THREE.MathUtils.degToRad(config.openAngle) : 0;
  };
  setOpen(config.defaultOpen);
  group.userData.joineryId = config.id;
  return { group, setOpen };
}

export function pavingTexture(size: number, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  let seed = 134;
  for (let i = 0; i < 15000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillStyle = i % 2 ? "rgba(25,29,24,.07)" : "rgba(255,255,255,.1)";
    ctx.fillRect(seed % 256, (seed >>> 8) % 256, 1, 1);
  }
  ctx.strokeStyle = "#656963";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / size, 1 / size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function wallFinish(texture: "stucco" | "brick") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#e9e4d5";
  ctx.fillRect(0, 0, 256, 256);
  let seed = 31;
  for (let i = 0; i < 12000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    ctx.fillStyle = i % 2 ? "rgba(70,60,43,.07)" : "rgba(255,255,255,.2)";
    ctx.fillRect(seed % 256, (seed >>> 8) % 256, 1, 1);
  }
  if (texture === "brick") {
    ctx.strokeStyle = "#c4c1b3";
    ctx.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
      for (let x = (y / 32) % 2 ? 32 : 0; x < 256; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 32);
        ctx.stroke();
      }
    }
  }
  const result = new THREE.CanvasTexture(canvas);
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.repeat.set(1.5, 1.5);
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
}

export function climbingPlants(wall: PlanWall, index: number) {
  const group = new THREE.Group();
  if (!wall.climber) return group;
  const c = wall.climber,
    length = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  group.position.set(wall.a[0], 0, wall.a[1]);
  group.rotation.y = -Math.atan2(wall.b[1] - wall.a[1], wall.b[0] - wall.a[0]);
  const wood = material("#626950"),
    stems = material("#685b3d");
  const wallHeight = wall.height ?? 1.05;
  if (c.trellis) {
    for (let x = 0; x <= length; x += 0.75)
      box(
        group,
        x,
        (c.top + wallHeight) / 2,
        0,
        0.045,
        c.top - wallHeight,
        0.045,
        wood,
      );
    for (let y = wallHeight + 0.12; y < c.top; y += 0.23)
      box(group, length / 2, y, 0, length, 0.025, 0.025, wood);
  }
  let seed = 197 + index * 83;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const outline = [
    [0, -0.55],
    [-0.18, -0.25],
    [-0.5, -0.15],
    [-0.27, 0.13],
    [-0.31, 0.37],
    [-0.11, 0.29],
    [0, 0.55],
    [0.13, 0.28],
    [0.36, 0.36],
    [0.28, 0.08],
    [0.5, -0.12],
    [0.2, -0.26],
  ];
  const vertices = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    vertices.push(0, 0, 0.025, a[0], a[1], 0, b[0], b[1], 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
  const leaves = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.85,
    side: THREE.DoubleSide,
  });
  const count = Math.round(length * c.top * 125 * c.coverage),
    mesh = new THREE.InstancedMesh(geo, leaves, count),
    dummy = new THREE.Object3D(),
    tint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const x = random() * length,
      y = wallHeight * 0.6 + random() * (c.top - wallHeight * 0.6 + 0.12),
      s = 0.12 + random() * 0.13;
    // Most foliage sits above the low wall; trailing shoots descend over the plaster.
    dummy.position.set(x, y, (random() - 0.3) * 0.25 + 0.08);
    dummy.rotation.set(
      (random() - 0.5) * 0.9,
      (random() - 0.5) * 1.4,
      (random() - 0.5) * 2.8,
    );
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    tint.setHSL(
      0.21 + random() * 0.095,
      0.4 + random() * 0.2,
      0.23 + random() * 0.17,
      THREE.SRGBColorSpace,
    );
    mesh.setColorAt(i, tint);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  for (let i = 0; i < Math.ceil(length * 8); i++) {
    const x = random() * length,
      low = 0.12 + random() * wallHeight,
      high = wallHeight + 0.3 + random() * 0.4;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x, low, 0.075),
      new THREE.Vector3(x + 0.06, high * 0.65, 0.12),
      new THREE.Vector3(x - 0.05, high, 0.1),
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 8, 0.005, 4, false),
      stems,
    );
    group.add(stem);
  }
  return group;
}

/** Reusable objects, parameterized by private positions, sizes and colours. */
export function terraceObject(item: PlanDecoration, reflections = false) {
  if (
    [
      "bed",
      "sliding-wardrobe",
      "low-cabinet",
      "laundry-hamper",
      "potted-dracaena",
    ].includes(item.kind)
  )
    return bedroomFurniture(item, reflections);
  if (item.kind === "built-in") {
    const group = new THREE.Group();
    group.position.set(item.center[0], item.base ?? 0, item.center[1]);
    group.rotation.y = item.rotation ?? 0;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.size[0], item.height, item.size[1]),
      new THREE.MeshStandardMaterial({
        color: item.color ?? "#f0ece3",
        roughness: 0.9,
      }),
    );
    mesh.position.y = item.height / 2;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = "built-in";
    group.add(mesh);
    return group;
  }
  if (
    [
      "bookcase",
      "dining-table",
      "dining-chair",
      "fridge",
      "curtain",
      "footstool",
      "pendant",
      "picture-frame",
      "kitchen-run",
      "kitchen-cabinet",
      "wall-shelf",
      "range-cooker",
      "recliner",
    ].includes(item.kind)
  )
    return livingFurniture(item);
  if (["barbecue", "storage-cabinet", "hanging-planter"].includes(item.kind))
    return gardenFurniture(item);
  if (item.kind === "utility-niche") return utilityNiche(item);
  if (["sofa", "armchair", "coffee-table", "indoor-plant"].includes(item.kind))
    return interiorFurniture(item);
  const group = new THREE.Group();
  group.position.set(item.center[0], item.base ?? 0, item.center[1]);
  group.rotation.y = item.rotation ?? 0;
  const [w, d] = item.size,
    h = item.height,
    wood = material(item.color ?? "#ae8455"),
    black = material("#303b3d", 0.55),
    fabric = material("#5b6062"),
    pot = material(item.color ?? "#a58a63");
  if (item.kind === "patio-table") {
    // Circular edge and individually cut timber slats, with folding crossed legs.
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(w / 2 - 0.018, 0.021, 8, 64),
      wood,
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = h;
    group.add(rim);
    for (let z = -d / 2 + 0.045; z < d / 2 - 0.02; z += 0.055) {
      const half = Math.sqrt(Math.max(0, (w / 2 - 0.026) ** 2 - z * z));
      box(group, 0, h, z, half * 2, 0.035, 0.049, wood);
    }
    for (const z of [-d * 0.29, d * 0.29]) {
      rod(
        group,
        new THREE.Vector3(-w * 0.34, 0.025, z),
        new THREE.Vector3(w * 0.3, h - 0.05, z),
        0.018,
        wood,
      );
      rod(
        group,
        new THREE.Vector3(w * 0.34, 0.025, z),
        new THREE.Vector3(-w * 0.3, h - 0.05, z),
        0.018,
        wood,
      );
      box(group, 0, 0.025, z, w * 0.76, 0.035, 0.045, wood);
    }
    box(group, 0, 0.18, 0, 0.035, 0.035, d * 0.65, wood);
  } else if (item.kind === "patio-chair") {
    const seat = 0.43,
      back = h - seat;
    box(group, 0, seat, -d * 0.02, w * 0.85, 0.025, d * 0.66, fabric);
    const rest = box(
      group,
      0,
      seat + back / 2,
      d * 0.25,
      w * 0.85,
      back,
      0.027,
      fabric,
    );
    rest.rotation.x = 0.15;
    for (const x of [-w * 0.47, w * 0.47]) {
      rod(
        group,
        new THREE.Vector3(x, 0.025, -d * 0.34),
        new THREE.Vector3(x, seat + 0.23, d * 0.28),
        0.017,
        black,
      );
      rod(
        group,
        new THREE.Vector3(x, 0.025, d * 0.4),
        new THREE.Vector3(x, seat + 0.16, -d * 0.3),
        0.017,
        black,
      );
      box(group, x, seat + 0.21, 0, 0.055, 0.035, d * 0.8, black);
      rod(
        group,
        new THREE.Vector3(x, seat - 0.03, d * 0.22),
        new THREE.Vector3(x, h, d * 0.35),
        0.015,
        black,
      );
    }
    for (let y = seat + 0.13; y < h; y += 0.16)
      box(
        group,
        0,
        y,
        d * 0.25 + (y - seat) * 0.15,
        w * 0.84,
        0.008,
        0.03,
        black,
      );
  } else if (item.kind === "plant-shelf") {
    for (const x of [-w / 2, w / 2])
      box(group, x, h / 2, 0, 0.045, h, 0.065, wood);
    for (let y = 0.08; y < h; y += h / 4) {
      box(group, 0, y, 0, w, 0.035, d, wood);
      box(group, 0, y + 0.075, d / 2, w, 0.11, 0.02, wood);
      for (const x of [-w * 0.24, w * 0.24]) {
        const p = new THREE.Mesh(
          new THREE.CylinderGeometry(0.065, 0.045, 0.11, 12),
          material(y < h * 0.5 ? "#b16b43" : "#aaa27d"),
        );
        p.position.set(x, y + 0.075, 0);
        group.add(p);
      }
    }
  } else if (item.kind === "rain-pipe") {
    rod(
      group,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, h, 0),
      w / 2,
      material(item.color ?? "#7c817d", 0.6),
    );
    for (const y of [0.35, h - 0.25])
      box(group, 0, y, 0.02, w * 1.4, 0.025, w * 1.2, black);
  } else if (item.kind === "planter") {
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(w / 2, w * 0.35, h, 20),
      pot,
    );
    vase.position.y = h / 2;
    vase.castShadow = true;
    group.add(vase);
    const soil = new THREE.Mesh(
      new THREE.CircleGeometry(w * 0.44, 20),
      material("#514536"),
    );
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = h + 0.003;
    group.add(soil);
    const green = material("#557846"),
      flower = material("#a9a7df", 0.6);
    for (let i = 0; i < (item.plant === "flowers" ? 17 : 9); i++) {
      const a = i * 2.4,
        x = Math.cos(a) * w * 0.3,
        z = Math.sin(a) * d * 0.3,
        y = h + 0.07 + (i % 4) * 0.035;
      rod(
        group,
        new THREE.Vector3(x, h, z),
        new THREE.Vector3(x, y, z),
        0.004,
        green,
      );
      const foliage = new THREE.Mesh(
        new THREE.SphereGeometry(w * 0.14, 7, 5),
        green,
      );
      foliage.position.set(x, y - 0.025, z);
      foliage.scale.set(1, 0.5, 1);
      group.add(foliage);
      if (item.plant === "flowers")
        for (let j = 0; j < 5; j++) {
          const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.023, 6, 4),
            flower,
          );
          petal.scale.set(1, 0.35, 1);
          petal.position.set(
            x + Math.cos(j * 1.256) * 0.025,
            y,
            z + Math.sin(j * 1.256) * 0.025,
          );
          group.add(petal);
        }
    }
  }
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}
