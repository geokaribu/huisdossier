import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { recessedRoof } from "../src/roof.ts";
import { exteriorShell } from "../src/exteriorShell.ts";
import { mainShellLayout, mainShellRoof } from "../src/houseFrame.ts";
import { rearExterior, flatRoofDetails } from "../src/houseEnvelope.ts";
import { projectMaterial } from "../src/appearance.ts";
import { contextBuildings } from "../src/lightingScene.ts";
import { contextCutaway } from "../src/contextCutaway.ts";

const profile = {
  version: 1,
  label: "Synthetic",
  description: "Synthetic",
  attribution: "Test",
  generated: false,
  front: {
    left: [0, 0],
    right: [4, 0],
    bottom: 0,
    top: 6,
    texture: "test.png",
  },
  materials: { wall: "#eeeecc", roof: "#889999", plinth: "#555555" },
  shell: { rearSurface: 0, hiddenSurfaceIndices: [0], attribution: "Test" },
  roof: {
    top: 9.4,
    inset: 1.5,
    hiddenSurfaceIndices: [],
    dormerWidth: 1.4,
    dormerInset: 0.4,
    dormerBottom: 6.5,
    awningWidth: 1.3,
    recess: {
      width: 1.36,
      bottomT: 0.14,
      topT: 0.86,
      depth: 1.6,
      railingHeight: 0.96,
    },
    windows: [],
  },
  rear: {
    anchor: [0, 0],
    scale: [1, 1],
    shellStartZ: -6.2,
    roofThickness: 0.2,
    junctionTop: 3.1,
    hiddenSurfaceIndices: [],
    attribution: "Test",
    portalId: "patio",
    outsideRoomId: "garden",
  },
  flatRoof: { surface: 1, edgeHeight: 0.1, fixtures: [] },
};
// Both rear-wall bottom height and plan/RD seam are deliberately non-level/misaligned.
const surfaces = [
  {
    type: "WallSurface",
    rings: [
      [
        [0.2, 6.1, 3.4],
        [4.3, 6, 3.8],
        [4.3, 6, 9.5],
        [0.2, 6.1, 9.5],
      ],
    ],
  },
  {
    type: "RoofSurface",
    rings: [
      [
        [0, 1.4, 9.5],
        [4, 1.4, 9.5],
        [4.3, 6, 9.5],
        [0.2, 6.1, 9.5],
      ],
    ],
  },
];
const plan = {
  version: 1,
  label: "Test",
  source: "Test",
  description: "Test",
  ceilingHeight: 2.64,
  outline: [
    [0, -10],
    [4, -10],
    [4, 0],
    [0, 0],
  ],
  ceiling: [
    [0, -9],
    [4, -9],
    [4, 0],
    [0, 0],
  ],
  spawn: [2, -7],
  rooms: [],
  walls: [],
  fixtures: [],
  decorations: [],
};
const meshes = (group, role) =>
  group
    .getObjectsByProperty("type", "Mesh")
    .filter((m) => m.userData.role === role);
const ends = (m) => {
  const h = m.geometry.parameters.height / 2;
  return [new THREE.Vector3(0, -h, 0), new THREE.Vector3(0, h, 0)].map((p) =>
    p.applyMatrix4(m.matrixWorld),
  );
};
const ray = (from, dir) =>
  new THREE.Raycaster(
    new THREE.Vector3(...from),
    new THREE.Vector3(...dir).normalize(),
  );

test("an intervening neighbor is cut from the camera view while remaining a shadow caster", () => {
  const house = new THREE.Mesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.MeshStandardMaterial(),
  );
  const context = new THREE.Group(),
    neighbor = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 2),
      new THREE.MeshStandardMaterial(),
    );
  neighbor.position.z = 5;
  neighbor.castShadow = true;
  context.add(neighbor);
  house.updateMatrixWorld(true);
  context.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 0, 10);
  const reveal = contextCutaway(context, () => [house]);
  assert.equal(reveal(camera, new THREE.Vector3()), true);
  assert.equal(neighbor.castShadow, true);
  assert.equal(neighbor.material.clipShadows, false);
  const plane = neighbor.material.clippingPlanes[0];
  assert.ok(plane.distanceToPoint(neighbor.position) < 0);
  assert.equal(house.material.clippingPlanes, null);
  camera.position.set(10, 0, 0);
  assert.equal(reveal(camera, new THREE.Vector3()), false);
  assert.ok(plane.distanceToPoint(neighbor.position) > 0);
});

test("side-wall texture coordinates retain a physical horizontal scale instead of collapsing onto the facade axis", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 0.02, 0, -6, 0.02, 4, -6, 0, 0, 0, 0.02, 4, -6, 0, 4, 0],
      3,
    ),
  );
  projectMaterial(geometry, profile, [0, 0, 0], false);
  const uv = geometry.attributes.uv;
  assert.ok(Math.abs(Math.abs(uv.getX(1) - uv.getX(0)) - 3) < 1e-6);
});

test("inside shadow casters use the repaired shell and extension rather than obsolete BAG roof faces", () => {
  const p = structuredClone(profile);
  p.shell.hiddenSurfaceIndices = [0, 1];
  const oldSurfaces = structuredClone(surfaces);
  for (const vertex of oldSurfaces[1].rings[0]) vertex[2] = 10.7;
  oldSurfaces[0].rings[0][2][2] = 10.7;
  oldSurfaces[0].rings[0][3][2] = 10.7;
  const data = { buildings: [{ target: true, surfaces: oldSurfaces }] };
  const group = contextBuildings(data, [0, 0, 0], new THREE.Matrix4(), 2.665, {
    appearance: p,
    plan,
  });
  const own = group.children.find((o) => o.userData.upperFloor),
    positions = own.geometry.attributes.position;
  const heights = Array.from({ length: positions.count }, (_, i) =>
    positions.getY(i),
  );
  assert.ok(
    Math.abs(Math.max(...heights) - 9.5) < 1e-6,
    "only the new 9.4 m roof and 0.1 m rim should survive, not the old 10.7 m BAG top",
  );
  assert.ok(
    heights.some((y) => Math.abs(y - 2.84) < 1e-6),
    "the repaired low roof is a shadow caster",
  );
});

test("awning brackets terminate against the upper roof skin and join the canopy crossbar", () => {
  const roof = recessedRoof(profile, [0, 0, 0]);
  roof.updateMatrixWorld(true);
  const skin = meshes(roof, "roof-slope")[0],
    normal = new THREE.Vector3(0, 1.5 / 3.4, 1).normalize();
  for (const mount of meshes(roof, "awning-mount"))
    for (const point of ends(mount)) {
      const probe = new THREE.Raycaster(point, normal.clone().negate());
      const hit = probe.intersectObject(skin)[0];
      assert.ok(
        hit && hit.distance < 0.025,
        "mount must touch actual zinc skin rather than a lower-edge offset",
      );
    }
  const cases = meshes(roof, "awning-case").map(
    (m) => new THREE.Line3(...ends(m)),
  );
  for (const bracket of meshes(roof, "awning-support")) {
    const [foot, tip] = ends(bracket),
      mounts = meshes(roof, "awning-mount").flatMap(ends);
    assert.ok(mounts.some((p) => p.distanceTo(foot) < 1e-6));
    assert.ok(
      cases.some(
        (line) =>
          line
            .closestPointToPoint(tip, true, new THREE.Vector3())
            .distanceTo(tip) < 1e-6,
      ),
    );
  }
});

test("balcony corner posts bear on a solid deck and side rails reach the back wall", () => {
  const roof = recessedRoof(profile, [0, 0, 0]);
  roof.updateMatrixWorld(true);
  const deck = meshes(roof, "balcony-deck")[0];
  for (const post of meshes(roof, "balcony-post")) {
    const foot = ends(post)[0],
      probe = ray([foot.x, foot.y + 0.01, foot.z], [0, -1, 0]);
    const hit = probe.intersectObject(deck)[0];
    assert.ok(hit && Math.abs(hit.point.y - foot.y) < 1e-6);
  }
  assert.equal(meshes(roof, "balcony-deck-edge").length, 4);
  for (const rail of meshes(roof, "balcony-side-rail"))
    assert.ok(Math.abs(ends(rail)[1].z + 1.6) < 1e-6);
});

test("main roof ridge, side walls and roof edge use exactly the same perimeter", () => {
  const before = JSON.stringify(surfaces),
    layout = mainShellLayout(profile, [0, 0, 0], surfaces);
  const shell = exteriorShell(profile, [0, 0, 0], surfaces);
  shell.updateMatrixWorld(true);
  const flat = meshes(shell, "main-flat-roof")[0],
    position = flat.geometry.attributes.position;
  const footing = meshes(shell, "main-foundation")[0];
  for (const point of [
    [0.01, 0.2, -1],
    [3.99, 0.2, -1],
    [0.025, 0.2, -2],
  ]) {
    const hit = ray(point, [0, -1, 0]).intersectObject(footing)[0];
    assert.ok(
      hit && Math.abs(hit.point.y) < 1e-6,
      "base must follow the side-wall kink as well as the rear corners",
    );
  }
  for (const ridge of [layout.ridgeLeft, layout.ridgeRight])
    assert.ok(
      Array.from({ length: position.count }, (_, i) =>
        new THREE.Vector3().fromBufferAttribute(position, i),
      ).some((p) => p.distanceTo(ridge) < 1e-6),
    );
  const edge = flatRoofDetails(profile, [0, 0, 0], surfaces);
  edge.updateMatrixWorld(true);
  for (const mesh of meshes(edge, "flat-roof-edge"))
    assert.ok(Math.abs(mesh.position.y - (9.4 + 0.05)) < 1e-6);
  const source = mainShellRoof(profile, [0, 0, 0], surfaces);
  assert.ok(source.rings[0].every((p) => p[2] === 9.4));
  assert.equal(JSON.stringify(surfaces), before);
});

test("rear extension closes the registration seam and the sloping BAG lower edge without a fixed-height gap", () => {
  const before = JSON.stringify(plan),
    rear = rearExterior(profile, [0, 0, 0], plan, false, () => {}, surfaces);
  const scene = new THREE.Group();
  scene.add(exteriorShell(profile, [0, 0, 0], surfaces), rear.group);
  scene.updateMatrixWorld(true);
  for (let i = 1; i < 20; i++) {
    const t = i / 20,
      x = 0.2 + 4.1 * t,
      seam = 3.4 + 0.4 * t;
    for (const dy of [-0.03, -0.001, 0.001, 0.03]) {
      const hits = ray([x, seam + dy, -10], [0, 0, 1]).intersectObject(
        scene,
        true,
      );
      const role = hits[0]?.object.userData.role;
      assert.equal(role, dy < 0 ? "extension-junction" : "main-rear-wall");
    }
  }
  const junction = meshes(rear.group, "extension-junction")[0],
    p = junction.geometry.attributes.position;
  const top = [...Array(p.count)].map((_, i) => p.getY(i));
  assert.ok(
    top.some((y) => Math.abs(y - 3.8) < 1e-6) &&
      top.some((y) => Math.abs(y - 3.4) < 1e-6),
  );
  assert.equal(
    meshes(rear.group, "extension-roof-edge").length,
    0,
    "a separate coplanar roof-edge cap must not remain",
  );
  const slab = meshes(rear.group, "extension-roof")[0];
  const hits = ray([2, 5, -7], [0, -1, 0]).intersectObject(slab);
  assert.ok(Math.abs(hits[0].point.y - 2.84) < 1e-6);
  assert.equal(JSON.stringify(plan), before);
});
