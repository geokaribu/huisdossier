import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  spatialAsset,
  visibleSpatialHit,
  selectionOutline,
  SpatialTap,
} from "../src/spatialSelection.ts";

const assets = [
  { id: "office:roof", kind: "dak", name: "Dak" },
  { id: "office:facade", kind: "gevel", name: "Gevel" },
  { id: "office:building", kind: "gebouw", name: "Gebouw" },
  {
    id: "stable-room-id",
    kind: "ruimte",
    roomId: "meeting-room",
    name: "Vergaderruimte",
  },
  { id: "equipment-id", kind: "installatie", name: "Installatie" },
];
const mesh = (type = "RoofSurface") => {
  const object = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  object.userData = { isTarget: true, surfaceType: type };
  return object;
};

test("spatial identity follows semantic surfaces, explicit assets and rooms instead of changing mesh indices", () => {
  const roof = mesh();
  roof.userData.surfaceIndex = 90;
  assert.equal(spatialAsset(roof, "office", assets).id, "office:roof");
  roof.userData.surfaceIndex = 2;
  assert.equal(spatialAsset(roof, "office", assets).id, "office:roof");
  assert.equal(
    spatialAsset(mesh("WallSurface"), "office", assets).id,
    "office:facade",
  );
  assert.equal(
    spatialAsset(mesh("GroundSurface"), "office", assets).id,
    "office:building",
  );
  assert.equal(spatialAsset(roof, "other-house", assets), undefined);
  const room = new THREE.Group();
  room.userData.roomId = "meeting-room";
  room.add(roof);
  assert.equal(spatialAsset(roof, "office", assets).id, "stable-room-id");
  roof.userData.assetId = "equipment-id";
  assert.equal(spatialAsset(roof, "office", assets).id, "equipment-id");
  roof.userData.assetId = "not-in-this-dossier";
  assert.equal(spatialAsset(roof, "office", assets), undefined);
  room.userData.isTarget = false;
  roof.userData.assetId = "equipment-id";
  assert.equal(spatialAsset(roof, "office", assets), undefined);
});

test("ray picking respects hidden parents and clipped surfaces while visible neighbours prevent selecting the house behind", () => {
  const scene = new THREE.Group(),
    neighbour = mesh(),
    roof = mesh();
  neighbour.position.z = 2;
  neighbour.userData.isTarget = false;
  scene.add(neighbour, roof);
  scene.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 5),
    new THREE.Vector3(0, 0, -1),
  );
  let hit = visibleSpatialHit(ray.intersectObject(scene, true));
  assert.equal(hit.object, neighbour);
  assert.equal(spatialAsset(hit.object, "office", assets), undefined);
  neighbour.visible = false;
  assert.equal(
    visibleSpatialHit(ray.intersectObject(scene, true)).object,
    roof,
  );
  neighbour.visible = true;
  neighbour.material.clippingPlanes = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -1),
  ];
  assert.equal(
    visibleSpatialHit(ray.intersectObject(scene, true)).object,
    roof,
  );
  scene.visible = false;
  assert.equal(visibleSpatialHit(ray.intersectObject(scene, true)), undefined);
});

test("selection outlines include visible reconstruction meshes in world space without mutating source buffers or materials", () => {
  const parent = new THREE.Group();
  parent.position.set(7, 2, 3);
  const roof = mesh(),
    detail = mesh(),
    facade = mesh("WallSurface"),
    hidden = mesh();
  hidden.visible = false;
  parent.add(roof, detail, facade, hidden);
  const color = roof.material.color.getHex();
  let sourceDisposed = false;
  roof.geometry.addEventListener("dispose", () => (sourceDisposed = true));
  const outline = selectionOutline(
    [roof, detail, facade, hidden],
    "office",
    assets,
    "office:roof",
  );
  assert.equal(outline.children.length, 2);
  assert.equal(outline.children[0].position.x, 7);
  for (const edge of outline.children) {
    assert.notEqual(edge.geometry, roof.geometry);
    edge.geometry.dispose();
    edge.material.dispose();
  }
  assert.equal(sourceDisposed, false);
  assert.equal(roof.material.color.getHex(), color);
  assert.equal(
    selectionOutline([roof], "another-house", assets, "office:roof").children
      .length,
    0,
  );
});

test("spatial taps reject rotation, a drag back to origin, context clicks, cancelled gestures and two-finger zoom", () => {
  const tap = new SpatialTap(),
    event = (pointerId = 1, clientX = 10, button = 0) => ({
      pointerId,
      clientX,
      clientY: 10,
      button,
    });
  tap.down(event());
  assert.equal(tap.up(event()), true);
  tap.down(event());
  tap.move(event(1, 30));
  assert.equal(tap.up(event()), false);
  tap.down(event(1, 10, 2));
  assert.equal(tap.up(event(1, 10, 2)), false);
  tap.down(event());
  tap.cancel(event());
  assert.equal(tap.up(event()), false);
  tap.down(event());
  tap.down(event(2));
  assert.equal(tap.up(event(2)), false);
  assert.equal(tap.up(event()), false);
  tap.down(event());
  assert.equal(tap.up(event(1, 12)), true);
});
