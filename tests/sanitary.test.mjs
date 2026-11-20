import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { wallSanitary } from "../src/sanitary.ts";
import { wallCoatings } from "../src/wallCoatings.ts";
import { floorplanForView } from "../src/furnishings.ts";
import { canStand } from "../src/walkthrough.ts";

test("wall-hung fittings retain a floor gap and a genuinely recessed basin", () => {
  const base = {
    center: [0, 0],
    size: [0.4, 0.28],
    height: 0.85,
    mounting: "wall",
    rotation: 0,
  };
  const basin = wallSanitary({ ...base, kind: "basin" });
  basin.updateMatrixWorld(true);
  const first = new THREE.Raycaster(
    new THREE.Vector3(0, 1.2, 0),
    new THREE.Vector3(0, -1, 0),
  ).intersectObject(basin, true)[0];
  assert.ok(
    first.point.y < 0.82 && first.point.y > 0.74,
    "the ray must enter the recessed bowl",
  );
  const toilet = wallSanitary({
    ...base,
    size: [0.4, 0.54],
    height: 0.45,
    kind: "toilet",
    rotation: Math.PI,
  });
  const bounds = new THREE.Box3().setFromObject(toilet);
  assert.ok(bounds.min.y > 0.14, "no floor pedestal");
  assert.ok(
    toilet.children.some((o) => o.userData.role === "closed-toilet-lid"),
  );
  assert.ok(toilet.children.some((o) => o.userData.role === "flush-plate"));
  for (const group of [basin, toilet])
    group.traverse((o) => {
      if (!o.geometry) return;
      const position = o.geometry.getAttribute("position");
      assert.ok(Array.from(position.array).every(Number.isFinite));
      o.geometry.dispose();
      o.material.dispose();
    });
});

test("fixed casings survive empty views and rotated sanitary collisions follow their geometry", () => {
  const fixture = {
    kind: "basin",
    mounting: "wall",
    rotation: Math.PI / 2,
    center: [2, 2],
    size: [0.8, 0.2],
    height: 0.85,
  };
  const plan = {
    outline: [
      [0, 0],
      [5, 0],
      [5, 5],
      [0, 5],
    ],
    walls: [],
    fixtures: [fixture],
    decorations: [
      {
        id: "casing",
        kind: "built-in",
        center: [4, 4],
        size: [0.5, 0.2],
        height: 1.2,
      },
    ],
  };
  assert.ok(!canStand(plan, [2, 2.35], 0.05));
  assert.ok(canStand(plan, [2.35, 2], 0.05));
  const empty = floorplanForView(plan, "unfurnished");
  assert.deepEqual(empty.fixtures, plan.fixtures);
  assert.deepEqual(empty.decorations, plan.decorations);
});

test("colored skirting stops at a doorway and is absent on lintels", () => {
  const wall = {
    a: [0, 0],
    b: [4, 0],
    thickness: 0.1,
    openings: [],
    coatings: [
      {
        side: "positive",
        from: 0,
        to: 4,
        color: "#225566",
        skirtingColor: "#333333",
      },
    ],
  };
  const scene = new THREE.Group();
  for (const [a, b, lo, hi] of [
    [0, 1, 0, 2.6],
    [1, 2, 2.1, 2.6],
    [2, 4, 0, 2.6],
  ])
    scene.add(wallCoatings(wall, a, b, lo, hi));
  scene.updateMatrixWorld(true);
  const ray = (x) =>
    new THREE.Raycaster(
      new THREE.Vector3(x, 0.04, 1),
      new THREE.Vector3(0, 0, -1),
    ).intersectObject(scene, true)[0];
  assert.equal(ray(0.5).object.material.color.getHexString(), "333333");
  assert.equal(ray(1.5), undefined);
  const skirts = [];
  scene.traverse((o) => {
    if (o.userData.role === "wall-skirting") skirts.push(o);
  });
  assert.equal(skirts.length, 2);
});
