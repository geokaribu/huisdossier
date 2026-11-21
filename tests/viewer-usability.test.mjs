import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { nudgeCamera, zoomCamera } from "../src/viewerNavigation.ts";
import { loadWorkspace } from "../src/workspaceLoad.ts";

test("camera buttons rotate at constant distance, clamp elevation and pan camera with its target", () => {
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  camera.position.set(0, 5, 10);
  const controls = {
    target: new THREE.Vector3(),
    minPolarAngle: 0.1,
    maxPolarAngle: Math.PI / 2,
    minDistance: 2,
    maxDistance: 20,
    update() {
      camera.lookAt(this.target);
    },
  };
  controls.update();
  const distance = camera.position.distanceTo(controls.target);
  nudgeCamera(camera, controls, 1, 0);
  assert.ok(camera.position.x > 0);
  assert.ok(
    Math.abs(camera.position.distanceTo(controls.target) - distance) < 1e-10,
  );
  for (let n = 0; n < 50; n++) nudgeCamera(camera, controls, 0, -1);
  assert.ok(
    new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    ).phi >= 0.0999,
  );
  const offset = camera.position.clone().sub(controls.target);
  nudgeCamera(camera, controls, 1, 0, true);
  assert.ok(controls.target.length() > 0);
  assert.ok(
    camera.position.clone().sub(controls.target).distanceTo(offset) < 1e-10,
  );
  zoomCamera(camera, controls, 1e-5);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 2) < 1e-10);
  zoomCamera(camera, controls, 1e5);
  assert.ok(Math.abs(camera.position.distanceTo(controls.target) - 20) < 1e-10);
});

test("records become usable before slow visual resources; failed optional resources do not suppress other results", async () => {
  let resolveModel;
  const model = new Promise((resolve) => {
    resolveModel = resolve;
  });
  const records = { assets: [{ id: "roof" }], tasks: [], attachments: [] };
  const results = {},
    failures = [];
  let ready = false;
  const pending = loadWorkspace(
    async (url) => {
      if (url.endsWith("/dossier")) return records;
      if (url.endsWith("/model")) return model;
      if (url.endsWith("/lighting")) throw Error("Malformed optional profile");
      return null;
    },
    "/test",
    (value) => {
      assert.equal(value, records);
      ready = true;
    },
    (name, value) => {
      results[name] = value;
    },
    (name) => failures.push(name),
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ready, true);
  assert.deepEqual(failures, ["lighting"]);
  assert.equal(results.floorplan, null);
  assert.equal("model" in results, false);
  resolveModel({ buildings: [] });
  await pending;
  assert.deepEqual(results.model, { buildings: [] });
});

test("required dossier failures are reported distinctly from optional model failures", async () => {
  const failures = [];
  await loadWorkspace(
    async () => {
      throw Error("Offline");
    },
    "/test",
    () => assert.fail("Unavailable dossier"),
    () => assert.fail("Unavailable resource"),
    (name) => failures.push(name),
  );
  assert.deepEqual(
    new Set(failures),
    new Set(["dossier", "model", "floorplan", "appearance", "lighting"]),
  );
});
