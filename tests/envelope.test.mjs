import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  frontRelief,
  planToExterior,
  rearFootprint,
  rearExterior,
  flatRoofDetails,
} from "../src/houseEnvelope.ts";

const profile = {
  version: 1,
  label: "Synthetic house",
  description: "Test only",
  attribution: "Synthetic",
  generated: false,
  front: {
    left: [100, 200],
    right: [104, 200],
    bottom: 2,
    top: 8,
    texture: "front.png",
  },
  materials: { wall: "#eeeecc", roof: "#888888", plinth: "#555555" },
  frontOpenings: [
    {
      id: "window",
      kind: "window",
      x: 0.4,
      width: 1,
      bottom: 1,
      height: 2,
      split: 2.1,
    },
    {
      id: "door",
      kind: "door",
      x: 2.5,
      width: 1,
      bottom: 0.05,
      height: 3,
      split: 2.3,
    },
  ],
  rear: {
    portalId: "patio",
    outsideRoomId: "outside",
    anchor: [-0.2, 0.1],
    scale: [1.1, 0.9],
    shellStartZ: -5,
    roofThickness: 0.2,
    junctionTop: 3.7,
    hiddenSurfaceIndices: [],
    attribution: "Approximate test registration",
  },
};
const plan = {
  version: 1,
  label: "Synthetic floor",
  source: "Synthetic",
  description: "A rear room and patio",
  ceilingHeight: 2.64,
  outline: [
    [0, -9],
    [4, -9],
    [4, 0],
    [0, 0],
  ],
  ceiling: [
    [0, -7],
    [4, -7],
    [4, 0],
    [0, 0],
  ],
  spawn: [2, -4],
  rooms: [
    {
      id: "outside",
      name: "Patio",
      center: [2, -8],
      polygon: [
        [0, -9],
        [4, -9],
        [4, -7],
        [0, -7],
      ],
      color: "#ccccbb",
      outside: true,
    },
  ],
  fixtures: [],
  decorations: [],
  walls: [
    {
      a: [4, -9],
      b: [4, -7],
      thickness: 0.12,
      height: 2.64,
      outsideRoomId: "outside",
      finish: { color: "#deddd2", texture: "stucco" },
      openings: [],
    },
    {
      a: [0, -7],
      b: [4, -7],
      thickness: 0.2,
      openings: [
        {
          offset: 0.5,
          width: 3,
          sill: 0,
          height: 2.34,
          kind: "door",
          joinery: {
            id: "patio",
            label: "Patio doors",
            fixedLeft: 0.6,
            insideColor: "#eeeecc",
            outsideColor: "#526371",
            openAngle: 90,
            defaultOpen: true,
          },
        },
      ],
    },
  ],
};

test("front relief preserves genuine openings, recessed photo panels and projecting sills", () => {
  const front = frontRelief(profile, [100, 200, 2], null, null);
  front.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0.8, 1.5, 2),
    new THREE.Vector3(0, 0, -1),
  );
  const roles = ray
    .intersectObject(front, true)
    .map((hit) => hit.object.userData.role);
  assert.ok(roles.includes("front-window-glass"));
  assert.ok(!roles.includes("front-plaster"));
  const pane = front
    .getObjectsByProperty("type", "Mesh")
    .find((m) => m.userData.role === "front-window-glass");
  assert.ok(pane.position.z < -0.05);
  const sill = front
    .getObjectsByProperty("type", "Mesh")
    .find((m) => m.userData.role === "projecting-window-sill");
  assert.ok(sill.position.z > 0);
});

test("one explicit registration maps the same floor plan onto RD/NAP without changing source data", () => {
  const before = JSON.stringify(plan),
    matrix = planToExterior(profile, [100, 200, 2]);
  const front = new THREE.Vector3(-0.2, 0, 0.1).applyMatrix4(matrix);
  assert.ok(front.length() < 1e-10);
  const rearPoint = new THREE.Vector3(1, 1.6, -10).applyMatrix4(matrix);
  assert.ok(Math.abs(rearPoint.x - 1.32) < 1e-10);
  assert.ok(Math.abs(rearPoint.z + 9.09) < 1e-10);
  assert.equal(rearPoint.y, 1.6);
  const clipped = rearFootprint(plan.ceiling, -5);
  assert.ok(clipped.every((p) => p[1] <= -5));
  assert.equal(clipped.length, 4);
  const result = rearExterior(profile, [100, 200, 2], plan, false);
  result.group.updateMatrixWorld(true);
  const meshes = [];
  result.group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      meshes.push(o);
      assert.ok(
        [...o.geometry.getAttribute("position").array].every(Number.isFinite),
      );
      assert.equal(o.userData.isTarget, true);
    }
  });
  assert.ok(meshes.some((m) => m.userData.role === "extension-roof"));
  assert.ok(
    meshes.some((m) => m.userData.role === "terrace-boundary"),
    "bare patio walls remain part of the exterior without climbing plants",
  );
  assert.ok(
    result.group
      .getObjectsByProperty("type", "Group")
      .some((g) => g.userData.joineryId === "patio"),
  );
  assert.equal(JSON.stringify(plan), before);
});

test("flat-roof fixtures are placed in the facade frame and do not alter the BAG roof", () => {
  const surfaces = [
      {
        type: "RoofSurface",
        rings: [
          [
            [100, 198, 10],
            [104, 198, 10],
            [104, 194, 10],
            [100, 194, 10],
          ],
        ],
      },
    ],
    before = JSON.stringify(surfaces);
  const model = flatRoofDetails(
    {
      ...profile,
      flatRoof: {
        surface: 0,
        edgeHeight: 0.1,
        fixtures: [
          {
            id: "vent",
            kind: "vent",
            across: 1,
            depth: 3,
            width: 0.2,
            length: 0.2,
            height: 0.3,
          },
        ],
      },
    },
    [100, 200, 2],
    surfaces,
  );
  const vent = model
    .getObjectsByProperty("type", "Mesh")
    .find((m) => m.userData.role === "roof-vent");
  assert.ok(vent);
  model.updateMatrixWorld(true);
  const position = vent.getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(position.x - 1) < 1e-9);
  assert.ok(Math.abs(position.z + 3) < 1e-9);
  assert.ok(position.y > 8);
  assert.equal(JSON.stringify(surfaces), before);
});
