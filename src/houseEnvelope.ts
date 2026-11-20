import * as THREE from "three";
import type {
  HouseAppearance,
  Floorplan,
  Point,
  PlanPoint,
  PlanWall,
  Surface,
} from "./types";
import { frontFrame } from "./appearance.ts";
import {
  facadeTransform,
  planToExterior,
  mainShellLayout,
  mainShellRoof,
} from "./houseFrame.ts";
export { facadeTransform, planToExterior } from "./houseFrame.ts";
import { wallCoatings, loadCoatingTextures } from "./wallCoatings.ts";
import { loadArtworkTextures } from "./framedArtwork.ts";
import {
  architectureGeometry,
  filledSlabGeometry,
} from "./planArchitecture.ts";
import {
  glazedDoors,
  terraceObject,
  climbingPlants,
  pavingTexture,
  wallFinish,
} from "./terrace.ts";

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  role: string,
  angle = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = angle;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.role = role;
  parent.add(mesh);
  return mesh;
}
function floor(
  parent: THREE.Object3D,
  points: PlanPoint[],
  height: number,
  material: THREE.Material,
  role: string,
) {
  const shape = new THREE.Shape(
      points.map(([x, z]) => new THREE.Vector2(x, -z)),
    ),
    mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = height;
  mesh.receiveShadow = true;
  mesh.userData.role = role;
  parent.add(mesh);
  return mesh;
}
function mark(group: THREE.Object3D, type = "WallSurface") {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.userData.isTarget = true;
      o.userData.surfaceType ??= type;
    }
  });
}
export function frontRelief(
  profile: HouseAppearance,
  origin: Point,
  photo: THREE.Texture | null,
  stucco: THREE.Texture | null,
) {
  const group = new THREE.Group();
  group.applyMatrix4(facadeTransform(profile, origin));
  const { width } = frontFrame(profile),
    height = profile.front.top - profile.front.bottom;
  const wall = new THREE.MeshStandardMaterial({
    color: "#f4f0e7",
    map: stucco,
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const blue = new THREE.MeshStandardMaterial({
    color: "#526371",
    roughness: 0.58,
  });
  const reveal = new THREE.MeshStandardMaterial({
    color: "#c1c0b5",
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#b8b7a6",
    roughness: 0.94,
  });
  const image = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: photo,
    roughness: 0.6,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const outline = new THREE.Shape([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(width, 0),
    new THREE.Vector2(width, height),
    new THREE.Vector2(0, height),
  ]);
  for (const o of profile.frontOpenings ?? [])
    outline.holes.push(
      new THREE.Path([
        new THREE.Vector2(o.x, o.bottom),
        new THREE.Vector2(o.x, o.bottom + o.height),
        new THREE.Vector2(o.x + o.width, o.bottom + o.height),
        new THREE.Vector2(o.x + o.width, o.bottom),
      ]),
    );
  const geometry = new THREE.ShapeGeometry(outline);
  const pos = geometry.getAttribute("position"),
    uv = [];
  for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) / 2, pos.getY(i) / 2);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  const face = new THREE.Mesh(geometry, wall);
  face.castShadow = true;
  face.receiveShadow = true;
  face.userData.role = "front-plaster";
  group.add(face);
  function photoPanel(
    parent: THREE.Object3D,
    x: number,
    bottom: number,
    w: number,
    h: number,
    offset: number,
    role: string,
  ) {
    const geo = new THREE.PlaneGeometry(w, h);
    geo.setAttribute(
      "uv",
      new THREE.Float32BufferAttribute(
        [
          x / width,
          (bottom + h) / height,
          (x + w) / width,
          (bottom + h) / height,
          x / width,
          bottom / height,
          (x + w) / width,
          bottom / height,
        ],
        2,
      ),
    );
    const pane = new THREE.Mesh(geo, image);
    pane.position.set(x + w / 2, bottom + h / 2, offset);
    pane.userData.role = role;
    parent.add(pane);
    return pane;
  }
  for (const o of profile.frontOpenings ?? []) {
    // Real 14 cm reveals and projecting sills replace the flat facade photograph.
    for (const x of [o.x, o.x + o.width])
      box(
        group,
        x,
        o.bottom + o.height / 2,
        -0.075,
        0.028,
        o.height,
        0.16,
        reveal,
        "front-reveal",
      );
    for (const y of [o.bottom, o.bottom + o.height])
      box(
        group,
        o.x + o.width / 2,
        y,
        -0.075,
        o.width,
        0.025,
        0.16,
        reveal,
        "front-reveal",
      );
    for (const x of [o.x + 0.032, o.x + o.width - 0.032])
      box(
        group,
        x,
        o.bottom + o.height / 2,
        -0.01,
        0.064,
        o.height,
        0.115,
        blue,
        "front-jamb",
      );
    for (const y of [o.bottom + 0.035, o.split, o.bottom + o.height - 0.035])
      box(
        group,
        o.x + o.width / 2,
        y,
        -0.005,
        o.width,
        0.065,
        0.125,
        blue,
        "front-rail",
      );
    photoPanel(
      group,
      o.x + 0.058,
      o.bottom + 0.06,
      o.width - 0.116,
      o.split - o.bottom - 0.09,
      -0.087,
      o.kind === "door" ? "front-door-panel" : "front-window-glass",
    );
    const upper = photoPanel(
      group,
      o.x + 0.058,
      o.split + 0.035,
      o.width - 0.116,
      o.bottom + o.height - o.split - 0.095,
      -0.087,
      "front-transom",
    );
    if (o.tilt) {
      const pivot = new THREE.Group();
      pivot.position.set(o.x + o.width / 2, o.bottom + o.height, -0.02);
      group.add(pivot);
      upper.position.sub(pivot.position);
      group.remove(upper);
      pivot.add(upper);
      pivot.rotation.x = -o.tilt;
    }
    if (o.kind === "window")
      box(
        group,
        o.x + o.width / 2,
        o.bottom - 0.065,
        0.07,
        o.width + 0.14,
        0.115,
        0.32,
        stone,
        "projecting-window-sill",
      );
    else {
      box(
        group,
        o.x + o.width / 2,
        o.bottom - 0.02,
        0.035,
        o.width + 0.06,
        0.06,
        0.24,
        stone,
        "front-threshold",
      );
      box(
        group,
        o.x + o.width / 2,
        o.bottom + 0.36,
        -0.002,
        o.width - 0.23,
        0.04,
        0.06,
        blue,
        "door-panel-moulding",
      );
      const knob = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 14, 10),
        new THREE.MeshStandardMaterial({
          color: "#aaa898",
          metalness: 0.7,
          roughness: 0.25,
        }),
      );
      knob.position.set(o.x + 0.14, o.bottom + 1.22, 0.09);
      group.add(knob);
    }
  }
  mark(group);
  return group;
}

export function flatRoofDetails(
  profile: HouseAppearance,
  origin: Point,
  surfaces: Surface[],
) {
  const group = new THREE.Group(),
    r = profile.flatRoof;
  if (!r) return group;
  const source =
    mainShellRoof(profile, origin, surfaces) ?? surfaces[r.surface];
  if (!source) return group;
  const rim = new THREE.MeshStandardMaterial({
    color: "#b5b9b4",
    metalness: 0.3,
    roughness: 0.65,
  });
  const curb = new THREE.MeshStandardMaterial({
    color: "#747d7d",
    metalness: 0.3,
    roughness: 0.6,
  });
  for (const ring of source.rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        from = new THREE.Vector3(
          a[0] - origin[0],
          a[2] - origin[2] + r.edgeHeight / 2,
          -(a[1] - origin[1]),
        ),
        to = new THREE.Vector3(
          b[0] - origin[0],
          b[2] - origin[2] + r.edgeHeight / 2,
          -(b[1] - origin[1]),
        );
      if (from.distanceTo(to) < 0.01) continue;
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(from.distanceTo(to), r.edgeHeight, 0.065),
        rim,
      );
      beam.position.copy(from).add(to).multiplyScalar(0.5);
      beam.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
      beam.userData.role = "flat-roof-edge";
      beam.castShadow = true;
      group.add(beam);
    }
  const local = new THREE.Group();
  local.applyMatrix4(facadeTransform(profile, origin));
  group.add(local);
  const roofY =
    source.rings.flat().reduce((s, p) => s + p[2], 0) /
      source.rings.flat().length -
    profile.front.bottom;
  for (const f of r.fixtures) {
    if (f.kind === "vent") {
      box(
        local,
        f.across,
        roofY + 0.025,
        -f.depth,
        f.width * 1.7,
        0.05,
        f.length * 1.7,
        curb,
        "vent-flashing",
      );
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(f.width / 2, f.width * 0.55, f.height, 18),
        rim,
      );
      pipe.position.set(f.across, roofY + f.height / 2, -f.depth);
      pipe.castShadow = true;
      pipe.userData.role = "roof-vent";
      local.add(pipe);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(f.width * 0.72, f.width * 0.8, 0.055, 18),
        rim,
      );
      cap.position.set(f.across, roofY + f.height, -f.depth);
      cap.userData.role = "vent-cap";
      local.add(cap);
    } else {
      box(
        local,
        f.across,
        roofY + f.height / 2,
        -f.depth,
        f.width,
        f.height,
        f.length,
        curb,
        "rooflight-curb",
      );
      box(
        local,
        f.across,
        roofY + f.height,
        -f.depth,
        f.width * 0.86,
        0.035,
        f.length * 0.86,
        new THREE.MeshStandardMaterial({
          color: "#afc0be",
          metalness: 0.25,
          roughness: 0.35,
        }),
        "rooflight-glass",
      );
    }
  }
  mark(group, "RoofSurface");
  return group;
}

/** Clip the known rear living-room footprint at its join with the taller building volume. */
export function rearFootprint(points: PlanPoint[], limit: number): PlanPoint[] {
  const result: PlanPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length],
      ai = a[1] <= limit,
      bi = b[1] <= limit;
    if (ai) result.push([...a]);
    if (ai !== bi) {
      const t = (limit - a[1]) / (b[1] - a[1]);
      result.push([a[0] + t * (b[0] - a[0]), limit]);
    }
  }
  return result;
}

export function rearExterior(
  profile: HouseAppearance,
  origin: Point,
  plan: Floorplan,
  withTextures = true,
  onLoad: () => void = () => {},
  surfaces: Surface[] = [],
) {
  const group = new THREE.Group(),
    textures: THREE.Texture[] = [];
  const paintMaps = withTextures
    ? loadCoatingTextures(plan, onLoad)
    : new Map<string, THREE.Texture>();
  textures.push(...paintMaps.values());
  const artworkMaps = withTextures
    ? loadArtworkTextures(plan, onLoad)
    : new Map<string, THREE.Texture>();
  textures.push(...artworkMaps.values());
  group.applyMatrix4(planToExterior(profile, origin));
  const r = profile.rear!,
    height = plan.ceilingHeight,
    footprint = rearFootprint(plan.ceiling, r.shellStartZ);
  const shell = mainShellLayout(profile, origin, surfaces);
  let junction: [THREE.Vector3, THREE.Vector3] | null = null;
  if (shell) {
    const toPlan = planToExterior(profile, origin)
      .invert()
      .multiply(shell.matrix);
    const left = shell.left.clone().applyMatrix4(toPlan),
      right = shell.right.clone().applyMatrix4(toPlan);
    // Insert the actual rear-wall corners between the two traced cut-line vertices.
    // This makes a short connecting return rather than a crack between two frames.
    const edge = footprint.findIndex(
      (a, i) =>
        Math.abs(a[1] - r.shellStartZ) < 1e-5 &&
        Math.abs(footprint[(i + 1) % footprint.length][1] - r.shellStartZ) <
          1e-5,
    );
    if (edge >= 0) {
      const a = footprint[edge],
        b = footprint[(edge + 1) % footprint.length];
      const ordered = a[0] > b[0] ? [right, left] : [left, right];
      footprint.splice(
        edge + 1,
        0,
        ...ordered.map((v) => [v.x, v.z] as PlanPoint),
      );
      junction = [left, right];
    }
  }
  const plaster = new THREE.MeshStandardMaterial({
    color: "#eeeade",
    roughness: 0.96,
    side: THREE.DoubleSide,
  });
  const cap = new THREE.MeshStandardMaterial({
    color: "#a6aaa2",
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const inner = new THREE.MeshStandardMaterial({
    color:
      plan.rooms.find(
        (room) =>
          !room.outside &&
          room.floorColor &&
          room.polygon.some((p) => p[1] < r.shellStartZ),
      )?.floorColor ?? "#d5c4a7",
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const portal = plan.walls.find((w) =>
    w.openings.some((o) => o.joinery?.id === r.portalId),
  );
  if (portal) {
    const gardenFootprint = rearFootprint(plan.outline, portal.a[1] + 0.12);
    const gardenWalls = plan.walls
      .filter((w) => w.outsideRoomId === r.outsideRoomId)
      .map((w) => ({ ...w, openings: [], height: undefined }));
    const footing = new THREE.Mesh(
      filledSlabGeometry(gardenFootprint, gardenWalls, 0.12),
      [cap, cap],
    );
    footing.position.y = -0.125;
    footing.castShadow = footing.receiveShadow = true;
    footing.userData.role = "terrace-foundation";
    group.add(footing);
  }
  const roomLight = new THREE.PointLight("#fff6e4", 3, 6, 1);
  roomLight.position.set(
    (footprint[0][0] + footprint[1][0]) / 2,
    2.2,
    (footprint[0][1] + r.shellStartZ) / 2,
  );
  group.add(roomLight);
  const wallBatches: {
    walls: PlanWall[];
    lo: number;
    hi: number;
    mat: THREE.Material;
    role: string;
  }[] = [];
  function wall(
    a: PlanPoint,
    b: PlanPoint,
    lo: number,
    hi: number,
    mat = plaster,
    role = "rear-wall",
    thickness = 0.16,
  ) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 0.005 || hi <= lo) return;
    let batch = wallBatches.find(
      (b) => b.lo === lo && b.hi === hi && b.mat === mat && b.role === role,
    );
    if (!batch) {
      batch = { walls: [], lo, hi, mat, role };
      wallBatches.push(batch);
    }
    batch.walls.push({ a, b, thickness, height: hi - lo, openings: [] });
  }
  const roofWalls: PlanWall[] = [];
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i],
      b = footprint[(i + 1) % footprint.length];
    const isPortal =
      portal &&
      Math.abs(a[1] - portal.a[1]) < 0.01 &&
      Math.abs(b[1] - portal.b[1]) < 0.01;
    const sourceWall = plan.walls.find((w) =>
      [w.a, w.b].every(
        (p) =>
          Math.abs(
            (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]),
          ) < 1e-5,
      ),
    );
    const thickness = sourceWall?.thickness ?? 0.16;
    if (!isPortal) wall(a, b, 0, height, plaster, "rear-wall", thickness);
    roofWalls.push({ a, b, thickness, openings: [] });
    if (
      !junction &&
      Math.abs(a[1] - r.shellStartZ) < 0.01 &&
      Math.abs(b[1] - r.shellStartZ) < 0.01
    )
      wall(
        a,
        b,
        height + r.roofThickness,
        r.junctionTop,
        plaster,
        "extension-junction",
      );
  }
  const slab = new THREE.Mesh(
    filledSlabGeometry(footprint, roofWalls, r.roofThickness),
    [cap, plaster],
  );
  slab.position.y = height;
  slab.castShadow = slab.receiveShadow = true;
  slab.userData.role = "extension-roof";
  group.add(slab);
  const foundation = new THREE.Mesh(
    filledSlabGeometry(footprint, roofWalls, 0.12),
    [inner, plaster],
  );
  foundation.position.y = -0.12;
  foundation.castShadow = foundation.receiveShadow = true;
  foundation.userData.role = "rear-room-floor";
  group.add(foundation);
  if (junction) {
    const [a, b] = junction,
      base = height + r.roofThickness;
    const geometry = new THREE.BufferGeometry();
    const points = [b.clone().setY(base), a.clone().setY(base), a, b];
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [0, 1, 2, 0, 2, 3].flatMap((i) => points[i].toArray()),
        3,
      ),
    );
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, plaster);
    mesh.userData.role = "extension-junction";
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (portal) {
    const length = Math.hypot(
        portal.b[0] - portal.a[0],
        portal.b[1] - portal.a[1],
      ),
      at = (t: number): PlanPoint => [
        portal.a[0] + ((portal.b[0] - portal.a[0]) * t) / length,
        portal.a[1] + ((portal.b[1] - portal.a[1]) * t) / length,
      ];
    let end = 0;
    for (const o of [...portal.openings].sort((a, b) => a.offset - b.offset)) {
      wall(
        at(end),
        at(o.offset),
        0,
        height,
        plaster,
        "rear-wall",
        portal.thickness,
      );
      wall(
        at(o.offset),
        at(o.offset + o.width),
        o.height + o.sill,
        height,
        plaster,
        "rear-wall",
        portal.thickness,
      );
      if (o.sill > 0)
        wall(
          at(o.offset),
          at(o.offset + o.width),
          0,
          o.sill,
          plaster,
          "rear-wall",
          portal.thickness,
        );
      if (o.joinery) {
        const doors = glazedDoors(portal, o, {
          ...o.joinery,
          defaultOpen: false,
        });
        group.add(doors.group);
      }
      end = o.offset + o.width;
    }
    wall(at(end), portal.b, 0, height, plaster, "rear-wall", portal.thickness);
  }
  for (const room of plan.rooms.filter((room) => room.id === r.outsideRoomId)) {
    const map =
      withTextures && room.paving
        ? pavingTexture(room.paving.size, room.paving.color)
        : null;
    if (map) textures.push(map);
    floor(
      group,
      room.polygon,
      0,
      new THREE.MeshStandardMaterial({
        color: map ? "#ffffff" : "#a3a49a",
        map,
        roughness: 0.94,
        side: THREE.DoubleSide,
      }),
      "terrace-paving",
    );
  }
  for (const [i, w] of plan.walls.entries())
    if (w.outsideRoomId === r.outsideRoomId || w.climber) {
      const map =
        withTextures && w.finish ? wallFinish(w.finish.texture) : null;
      if (map) textures.push(map);
      wall(
        w.a,
        w.b,
        0,
        w.height ?? 1.08,
        new THREE.MeshStandardMaterial({
          color: w.finish?.color ?? "#eee8d8",
          map,
          roughness: 1,
        }),
        "terrace-boundary",
        w.thickness,
      );
      if (w.climber) group.add(climbingPlants(w, i));
    }
  for (const w of plan.walls)
    if (w.coatings?.length) {
      const dz = w.b[1] - w.a[1],
        length = Math.hypot(w.b[0] - w.a[0], dz);
      if (Math.min(w.a[1], w.b[1]) > r.shellStartZ) continue;
      const cross =
        Math.abs(dz) < 1e-8
          ? 0
          : Math.max(0, Math.min(1, (r.shellStartZ - w.a[1]) / dz)) * length;
      const start = w.a[1] <= r.shellStartZ ? 0 : cross,
        end = w.b[1] <= r.shellStartZ ? length : cross;
      // Paint follows the solid wall intervals, including lintels, rather than covering openings.
      if (w !== portal) {
        let cursor = start;
        for (const o of [...w.openings].sort((a, b) => a.offset - b.offset)) {
          const a = Math.max(start, o.offset),
            b = Math.min(end, o.offset + o.width);
          if (b <= a) continue;
          if (a > cursor)
            group.add(wallCoatings(w, cursor, a, 0, height, paintMaps));
          group.add(wallCoatings(w, a, b, 0, o.sill, paintMaps));
          group.add(
            wallCoatings(w, a, b, o.sill + o.height, height, paintMaps),
          );
          cursor = b;
        }
        if (cursor < end)
          group.add(wallCoatings(w, cursor, end, 0, height, paintMaps));
      }
    }
  for (const batch of wallBatches) {
    const mesh = new THREE.Mesh(
      architectureGeometry(batch.walls, batch.hi - batch.lo),
      [batch.mat, batch.mat],
    );
    mesh.position.y = batch.lo;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.role = batch.role;
    group.add(mesh);
  }
  for (const item of plan.decorations ?? [])
    group.add(terraceObject(item, false, artworkMaps));
  mark(group);
  group.traverse((o) => {
    if (o.userData.role?.includes("roof"))
      o.userData.surfaceType = "RoofSurface";
  });
  return { group, textures };
}
