import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { terraceObject } from "../src/terrace.ts";
import { floorplanForView } from "../src/furnishings.ts";
import {
  floorplanTextureNames,
  clientFloorplan,
} from "../server/floorplan.mjs";

test("a private artwork uses upright full-canvas UVs, remains recessed inside solid mouldings and clears in the empty view", () => {
  const item = {
    id: "art",
    kind: "picture-frame",
    center: [2, 3],
    size: [0.8, 0.055],
    height: 1.12,
    base: 1.1,
    rotation: -Math.PI / 2,
    solid: false,
    artwork: {
      texture: "painting.png",
      attribution: "Synthetic source",
      generated: true,
    },
  };
  const texture = new THREE.Texture(),
    group = terraceObject(item, false, new Map([["painting.png", texture]]));
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 1.66, 3),
    new THREE.Vector3(1, 0, 0),
  );
  const hits = ray.intersectObject(group, true);
  assert.equal(hits[0].object.userData.role, "artwork-canvas");
  assert.equal(hits[0].object.material.map, texture);
  assert.ok(Math.abs(hits[0].uv.x - 0.5) < 1e-5);
  assert.ok(Math.abs(hits[0].uv.y - 0.5) < 1e-5);
  // All four sides must hit continuous mouldings in front of the recessed canvas.
  for (const [y, z] of [
    [1.12, 3],
    [2.2, 3],
    [1.66, 2.62],
    [1.66, 3.38],
  ]) {
    const hit = new THREE.Raycaster(
      new THREE.Vector3(0, y, z),
      new THREE.Vector3(1, 0, 0),
    ).intersectObject(group, true)[0];
    assert.equal(hit.object.userData.role, "frame-moulding");
    assert.ok(hit.distance < hits[0].distance);
  }
  const plan = { walls: [], rooms: [], fixtures: [], decorations: [item] };
  assert.deepEqual(floorplanTextureNames(plan), ["painting.png"]);
  assert.equal(
    clientFloorplan(plan, "sample").decorations[0].artwork.texture,
    "/api/houses/sample/floorplan/textures/painting.png",
  );
  assert.equal(item.artwork.texture, "painting.png");
  assert.deepEqual(floorplanForView(plan, "unfurnished").decorations, []);
  group.traverse((o) => {
    o.geometry?.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      m?.dispose();
  });
  texture.dispose();
});
