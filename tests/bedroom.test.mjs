import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { terraceObject } from "../src/terrace.ts";
import { disposeFurnitureReflection } from "../src/bedroomFurniture.ts";
import { interiorLights, pendantBulbOffsets } from "../src/interiorLights.ts";
import { floorplanForView } from "../src/furnishings.ts";
import { canStand } from "../src/walkthrough.ts";

const item = (id, kind, extra = {}) => ({
  id,
  kind,
  center: [2, 3],
  size: [1.6, 2.1],
  height: 0.62,
  ...extra,
});
const room = {
  id: "sleep",
  name: "Sleep",
  polygon: [
    [0, 0],
    [5, 0],
    [5, 7],
    [0, 7],
  ],
  center: [1, 1],
  color: "#bbbbbb",
};
const base = {
  version: 1,
  ceilingHeight: 2.64,
  outline: room.polygon,
  ceiling: room.polygon,
  rooms: [room],
  spawn: room.center,
  walls: [],
  fixtures: [],
};
function objects(group, role) {
  const out = [];
  group.traverse((o) => {
    if (o.userData.role === role) out.push(o);
  });
  return out;
}
function dispose(group) {
  group.traverse((o) => {
    disposeFurnitureReflection(o);
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      m?.dispose();
  });
}

test("bed has supported bedding and a throw, blocks its footprint, and disappears with loose bedroom furniture", () => {
  const bed = item("bed", "bed");
  const group = terraceObject(bed, true);
  group.updateMatrixWorld(true);
  assert.equal(objects(group, "mattress").length, 1);
  assert.equal(objects(group, "pillow").length, 2);
  assert.equal(objects(group, "bed-throw").length, 1);
  const mattress = new THREE.Box3().setFromObject(
    objects(group, "mattress")[0],
  );
  // Ray through the central duvet must encounter fabric before mattress (no white intersections).
  for (const x of [-0.5, 0, 0.5])
    for (const z of [-0.35, -0.1, 0.2]) {
      const ray = new THREE.Raycaster(
        new THREE.Vector3(2 + x, 1.5, 3 + z),
        new THREE.Vector3(0, -1, 0),
      );
      const hit = ray.intersectObject(group, true)[0];
      assert.ok(["duvet", "bed-throw"].includes(hit.object.userData.role));
      assert.ok(hit.point.y > mattress.max.y);
    }
  const plan = {
    ...base,
    decorations: [
      bed,
      ...[
        "sliding-wardrobe",
        "low-cabinet",
        "laundry-hamper",
        "potted-dracaena",
      ].map((kind) => item(kind, kind)),
    ],
  };
  assert.equal(canStand(plan, bed.center), false);
  const empty = floorplanForView(plan, "unfurnished");
  assert.equal(empty.decorations.length, 0);
  assert.equal(canStand(empty, bed.center), true);
  assert.equal(empty.rooms, plan.rooms);
  dispose(group);
});

test("three-panel wardrobe has exactly one central reflecting surface facing the room, with disposable GPU target", () => {
  const wardrobe = terraceObject(
    item("closet", "sliding-wardrobe", {
      size: [2.4, 0.64],
      height: 2.38,
      rotation: Math.PI / 2,
      panelCount: 3,
      mirrorPanel: 1,
      color: "#353433",
    }),
    true,
  );
  wardrobe.updateMatrixWorld(true);
  assert.equal(objects(wardrobe, "wardrobe-panel").length, 3);
  const mirrors = objects(wardrobe, "wardrobe-mirror");
  assert.equal(mirrors.length, 1);
  const mirror = mirrors[0];
  assert.ok(mirror.isReflector);
  assert.ok(Math.abs(mirror.position.x) < 1e-6);
  const normal = new THREE.Vector3(0, 0, 1).transformDirection(
    mirror.matrixWorld,
  );
  assert.ok(normal.x > 0.999);
  let released = false;
  mirror.getRenderTarget().addEventListener("dispose", () => (released = true));
  dispose(wardrobe);
  assert.ok(released);
  const exterior = terraceObject(item("closet", "sliding-wardrobe"));
  assert.equal(objects(exterior, "wardrobe-mirror")[0].isReflector, undefined);
  dispose(exterior);
});

test("one authored pendant replaces the room fallback light and stays single in the unfurnished view", () => {
  const lamp = item("lamp", "pendant", {
    size: [0.43, 0.43],
    center: [3, 2],
    base: 1.99,
    height: 0.65,
    bulbs: 1,
    shade: true,
    solid: false,
    fixed: true,
    light: { color: "#ffd79a", intensity: 8, distance: 5 },
  });
  const plan = { ...base, decorations: [item("bed", "bed"), lamp] };
  for (const variant of [plan, floorplanForView(plan, "unfurnished")]) {
    const lights = interiorLights(variant);
    assert.equal(lights.children.length, 1);
    assert.equal(lights.children[0].userData.componentId, "lamp");
    assert.deepEqual(lights.children[0].position.toArray(), [3, 2.045, 2]);
    const visual = terraceObject(lamp);
    const bulbs = [];
    visual.traverse((o) => {
      if (o.userData.indoorBulb) bulbs.push(o);
    });
    assert.equal(bulbs.length, 1);
    assert.ok(
      Math.abs(
        bulbs[0].position.y + lamp.base - lights.children[0].position.y,
      ) < 1e-6,
    );
    dispose(visual);
    lights.children[0].shadow.dispose();
  }
  assert.deepEqual(
    pendantBulbOffsets({ ...lamp, bulbs: undefined }),
    [-0.129, 0.129],
  );
  assert.equal(interiorLights({ ...base, decorations: [] }).children.length, 1);
});
