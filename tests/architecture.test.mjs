import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { architectureGeometry } from "../src/planArchitecture.ts";
import { canStand, moveInside } from "../src/walkthrough.ts";

const wall = (a, b, extra = {}) => ({
  a,
  b,
  thickness: 0.2,
  openings: [],
  ...extra,
});
const meshFor = (walls, skirting = false) => {
  const mesh = new THREE.Mesh(architectureGeometry(walls, 2.64, skirting), [
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  ]);
  mesh.updateMatrixWorld(true);
  return mesh;
};
const hit = (mesh, from, direction) =>
  new THREE.Raycaster(
    new THREE.Vector3(...from),
    new THREE.Vector3(...direction).normalize(),
  ).intersectObject(mesh)[0];

test("architectural unions close miters and remove internal T-junction faces", () => {
  const walls = [
      wall([0, 0], [3, 0]),
      wall([0, 0], [0, 3]),
      wall([1, 0], [1, 3]),
    ],
    mesh = meshFor(walls);
  const corner = hit(mesh, [-0.05, 1, -1], [0, 0, 1]);
  assert.ok(corner);
  assert.ok(
    Math.abs(corner.point.z + 0.1) < 1e-5,
    "outside corner must reach the miter",
  );
  const exit = hit(mesh, [1, 1, -0.05], [0, 0, 1]);
  assert.ok(exit);
  assert.ok(
    Math.abs(exit.point.z - 3) < 1e-5,
    "no hidden internal end face at the T junction",
  );
  const geometry = mesh.geometry,
    position = geometry.getAttribute("position"),
    normal = geometry.getAttribute("normal");
  for (let i = 0; i < position.count; i++) {
    assert.ok(
      [position.getX(i), position.getY(i), position.getZ(i)].every(
        Number.isFinite,
      ),
    );
    assert.ok(
      Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) <
        1e-5,
    );
  }
  assert.equal(geometry.boundingSphere.radius < 5, true);
});

test("a closed wet-room partition blocks sight and walking while its hall door stays usable", () => {
  const walls = [
      wall([2, 2], [4, 2]),
      wall([2, 2], [2, 4], {
        openings: [
          { offset: 0.5, width: 0.9, sill: 0, height: 2.12, kind: "door" },
        ],
      }),
      wall([2, 4], [4, 4]),
      wall([4, 2], [4, 4]),
    ],
    mesh = meshFor(walls);
  for (const x of [2.15, 2.5, 3, 3.5, 3.95])
    for (const y of [0.02, 1.62, 2.63]) {
      assert.ok(
        hit(mesh, [x, y, 1], [0, 0, 1]),
        "partition is solid to the ceiling",
      );
      assert.ok(
        hit(mesh, [x, y, 3], [0, 0, -1]),
        "both sides of partition render",
      );
    }
  assert.ok(
    Math.abs(hit(mesh, [1, 1.62, 2.95], [1, 0, 0]).point.x - 3.9) < 1e-5,
    "hall opening is clear; first hit is opposite wall",
  );
  const skirting = meshFor(walls, true);
  assert.ok(
    hit(skirting, [1, 0.045, 2.95], [1, 0, 0]).point.x > 3.8,
    "no plinth across a doorway",
  );
  const plan = {
    outline: [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ],
    walls,
    fixtures: [],
    decorations: [],
  };
  assert.equal(canStand(plan, [3, 2]), false);
  assert.ok(moveInside(plan, [3, 1], [0, 2])[1] < 2);
  assert.ok(moveInside(plan, [1, 2.95], [2, 0])[0] > 2.5);
});

test("openings remain correct when supplied out of order and diagonal joins stay bounded", () => {
  const openings = [
      { offset: 2, width: 0.8, sill: 0, height: 2.1, kind: "door" },
      { offset: 0.4, width: 0.8, sill: 0.8, height: 1.2, kind: "window" },
    ],
    w = wall([0, 0], [4, 0], { openings }),
    walls = [w, wall([4, 0], [5, 1])],
    mesh = meshFor(walls);
  assert.equal(hit(mesh, [2.4, 1, -1], [0, 0, 1]), undefined);
  assert.equal(hit(mesh, [0.8, 1, -1], [0, 0, 1]), undefined);
  assert.ok(hit(mesh, [0.8, 0.4, -1], [0, 0, 1]));
  assert.ok(hit(mesh, [2.4, 2.5, -1], [0, 0, 1]));
  assert.deepEqual(w.openings, openings);
  assert.ok(mesh.geometry.boundingSphere.radius < 4);
});
