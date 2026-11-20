import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { stairsFixture, stairUnderside } from "../src/stairs.ts";
import { canStand } from "../src/walkthrough.ts";
import { floorplanForView } from "../src/furnishings.ts";

test("raised stairs leave space below, and headroom collisions follow the low and high ends", () => {
  const f = {
    kind: "stairs",
    center: [2, 2],
    size: [1, 2],
    base: 1.2,
    height: 1.44,
  };
  const mesh = stairsFixture(
    f,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(mesh);
  assert.ok(bounds.min.y >= 1.2 - 1e-5, "no ground-filled stair wedge");
  for (const z of [-0.8, 0, 0.8]) {
    const ray = new THREE.Raycaster(
        new THREE.Vector3(2, 0, 2 + z),
        new THREE.Vector3(0, 1, 0),
      ),
      first = ray.intersectObject(mesh, true)[0];
    assert.ok(Math.abs(first.point.y - stairUnderside(f, z)) < 1e-5);
  }
  const plan = {
    outline: [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ],
    walls: [],
    fixtures: [f],
    decorations: [],
  };
  assert.ok(canStand(plan, [2, 1.2]));
  assert.ok(!canStand(plan, [2, 2.8]));
  const ordinary = { ...plan, fixtures: [{ ...f, base: 0, height: 2.64 }] };
  assert.ok(
    !canStand(ordinary, [2, 1.2]),
    "ordinary ground stairs still block",
  );
});

test("empty under-stair storage keeps its sloping casing but permits standing only with headroom", () => {
  const plan = {
    outline: [
      [0, 0],
      [6, 0],
      [6, 6],
      [0, 6],
    ],
    walls: [],
    fixtures: [],
    decorations: [
      {
        id: "laundry",
        kind: "utility-niche",
        center: [3, 3],
        size: [2, 1],
        height: 2.5,
        solid: true,
      },
    ],
  };
  const empty = floorplanForView(plan, "unfurnished");
  assert.equal(empty.decorations[0].contents, false);
  assert.ok(!canStand(plan, [2.5, 3]), "machines occupy the furnished bay");
  assert.ok(
    canStand(empty, [2.5, 3]),
    "empty high end remains usable inside the house",
  );
  assert.ok(!canStand(empty, [3.6, 3]), "low sloping ceiling blocks standing");
  assert.ok(!canStand(empty, [2.5, 2.52]), "fixed back wall remains solid");
  assert.ok(!canStand(empty, [2.02, 3]), "fixed end wall remains solid");
});
