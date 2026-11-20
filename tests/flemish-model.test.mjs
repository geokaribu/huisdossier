import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFile } from "node:fs/promises";
import {
  containsPoint,
  interiorPoint,
  extrudeFootprint,
  numberValue,
} from "../scripts/flemish-geometry.mjs";
import { triangulateSurface } from "../src/geometry.ts";
test("Flemish footprints extrude with correct roof/ground orientation and preserve courtyards", () => {
  const polygon = [
    [
      [0, 0],
      [0, 8],
      [8, 8],
      [8, 0],
      [0, 0],
    ],
    [
      [3, 3],
      [5, 3],
      [5, 5],
      [3, 5],
      [3, 3],
    ],
  ];
  assert.equal(containsPoint([4, 4], polygon), false);
  assert.equal(containsPoint([1, 1], polygon), true);
  assert.ok(containsPoint(interiorPoint(polygon), polygon));
  const surfaces = extrudeFootprint(polygon, 38.78, 8.96);
  const roof = surfaces.find((s) => s.type === "RoofSurface"),
    floor = surfaces.find((s) => s.type === "GroundSurface");
  for (const [surface, sign] of [
    [roof, 1],
    [floor, -1],
  ]) {
    const geo = triangulateSurface(surface, [0, 0, 38.78]);
    for (let i = 0; i < geo.attributes.normal.count; i++)
      assert.ok(geo.attributes.normal.getY(i) * sign > 0.99);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    mesh.updateMatrixWorld(true);
    assert.equal(
      new THREE.Raycaster(
        new THREE.Vector3(4, 20, -4),
        new THREE.Vector3(0, -1, 0),
      ).intersectObject(mesh).length,
      0,
    );
    geo.dispose();
    mesh.material.dispose();
  }
  assert.equal(numberValue("8,96"), 8.96);
  assert.throws(() => extrudeFootprint(polygon, 0, 0));
  assert.throws(() => numberValue("onbekend"));
});
test("the imported Flemish target has one verified GRB identity, bounded source geometry and honest source labels", async () => {
  const model = JSON.parse(
    await readFile(
      new URL("../public/data/balleistraat-57.json", import.meta.url),
      "utf8",
    ),
  );
  const target = model.buildings.filter((b) => b.target);
  assert.equal(target.length, 1);
  assert.equal(target[0].id, `BE.GRB.Gbg.${target[0].attributes.GRB_OIDN}`);
  assert.ok(
    containsPoint(
      model.house.rd,
      target[0].surfaces.find((s) => s.type === "RoofSurface").rings,
    ),
  );
  assert.equal(model.house.bagPandId, undefined);
  assert.match(model.source.detailLevel, /LoD 1/);
  assert.match(model.source.crs, /31370/);
  assert.ok(model.source.heightSource.includes(target[0].attributes.DATUM_LID));
  for (const building of model.buildings)
    for (const surface of building.surfaces) {
      const geo = triangulateSurface(surface, [...model.house.rd, 38.78]);
      assert.ok(geo);
      assert.ok(
        geo.boundingSphere === null ||
          Number.isFinite(geo.boundingSphere.radius),
      );
      assert.ok([...geo.attributes.position.array].every(Number.isFinite));
      geo.dispose();
    }
});
