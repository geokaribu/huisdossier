import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { hingedDoor } from "../src/hingedDoor.ts";
import { canStand, moveInside, openDoorLeaves } from "../src/walkthrough.ts";
import { floorplanForView } from "../src/furnishings.ts";

const config = {
  id: "wet-room-door",
  label: "Wet room door",
  color: "#eee9df",
  hinge: "end",
  swing: "negative",
  openAngle: 90,
  defaultOpen: false,
};
const opening = {
  offset: 0.4,
  width: 0.8,
  sill: 0,
  height: 2.12,
  kind: "door",
  door: config,
};
const wall = { a: [2, 1], b: [2, 4], thickness: 0.1, openings: [opening] };
const plan = {
  outline: [
    [0, 0],
    [5, 0],
    [5, 5],
    [0, 5],
  ],
  rooms: [],
  walls: [wall],
  fixtures: [],
  decorations: [],
};
function dispose(group) {
  group.traverse((o) => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      m?.dispose();
  });
}

test("a closed opaque wet-room door blocks sight and walking; opening it restores the hall passage in both furnishing views", () => {
  const model = hingedDoor(wall, opening, config);
  for (const view of ["furnished", "unfurnished"]) {
    const variant = floorplanForView(plan, view);
    assert.equal(variant.walls[0].openings[0].door.id, config.id);
    assert.equal(canStand(variant, [2, 1.8]), false);
    assert.ok(moveInside(variant, [1.4, 1.8], [1.3, 0])[0] < 1.8);
    assert.equal(
      canStand(variant, [2, 1.8], 0.16, { [config.id]: true }),
      true,
    );
    assert.ok(
      moveInside(variant, [1.4, 1.8], [1.3, 0], { [config.id]: true })[0] > 2.5,
    );
    model.setOpen(false);
    model.group.updateMatrixWorld(true);
    for (const direction of [-1, 1]) {
      const hit = new THREE.Raycaster(
        new THREE.Vector3(2 - direction, 1.4, 1.8),
        new THREE.Vector3(direction, 0, 0),
      ).intersectObject(model.group, true)[0];
      assert.equal(hit.object.userData.role, "door-leaf");
    }
    model.setOpen(true);
    model.group.updateMatrixWorld(true);
    assert.equal(
      new THREE.Raycaster(
        new THREE.Vector3(1, 1.4, 1.8),
        new THREE.Vector3(1, 0, 0),
      ).intersectObject(model.group, true).length,
      0,
    );
    const [a, b] = openDoorLeaves(wall, { [config.id]: true })[0];
    assert.equal(
      canStand(variant, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], 0.16, {
        [config.id]: true,
      }),
      false,
    );
  }
  dispose(model.group);
});

test("both hinges and swing sides share the same rendered leaf endpoints and plan collision on a diagonal wall", () => {
  for (const hinge of ["start", "end"])
    for (const swing of ["positive", "negative"]) {
      const c = { ...config, hinge, swing },
        o = { ...opening, door: c },
        w = { ...wall, a: [1, 1], b: [3, 2.5], openings: [o] };
      const model = hingedDoor(w, o, c);
      model.setOpen(true);
      model.group.updateMatrixWorld(true);
      let leaf;
      model.group.traverse((mesh) => {
        if (mesh.userData.role === "door-leaf") leaf = mesh;
      });
      const dir = hinge === "start" ? 1 : -1;
      const actual = [-1, 1].map((end) =>
        leaf.localToWorld(
          new THREE.Vector3((end * dir * (o.width - 0.05)) / 2, 0, 0),
        ),
      );
      const expected = openDoorLeaves(w, { [c.id]: true })[0];
      for (let i = 0; i < 2; i++)
        assert.ok(
          Math.hypot(
            actual[i].x - expected[i][0],
            actual[i].z - expected[i][1],
          ) < 1e-6,
        );
      dispose(model.group);
    }
});
