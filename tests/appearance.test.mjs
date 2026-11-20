import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createApp } from "../server/app.mjs";
import { isFrontSurface, projectFront } from "../src/appearance.ts";
import { recessedRoof } from "../src/roof.ts";

const profile = {
  version: 1,
  label: "Test appearance",
  description: "Visual reconstruction",
  attribution: "User reference",
  generated: true,
  aerial: {
    texture: "aerial.jpg",
    bbox: [0, 0, 10, 10],
    attribution: "Synthetic aerial",
    url: "https://example.com/wms",
    fetchedAt: "2026-11-20T00:00:00.000Z",
  },
  front: {
    left: [0, 0],
    right: [4, 0],
    bottom: 0,
    top: 6,
    texture: "front-facade.png",
  },
  materials: { wall: "#ffffff", roof: "#889999", plinth: "#555555" },
  roof: {
    hiddenSurfaceIndices: [],
    top: 9.4,
    inset: 1.5,
    dormerWidth: 1.36,
    dormerInset: 0.4,
    dormerBottom: 6.5,
    awningWidth: 1.3,
    recess: {
      width: 1.36,
      bottomT: 0.14,
      topT: 0.86,
      depth: 1.6,
      railingHeight: 0.96,
    },
    windows: [
      { across: 0.3, width: 0.8, bottomT: 0.43, topT: 0.81 },
      { across: 2.9, width: 0.8, bottomT: 0.43, topT: 0.81 },
    ],
  },
};
test("photo-derived roof has two glazed holes and a genuine recess behind the zinc plane", () => {
  const roof = recessedRoof(profile, [0, 0, 0]);
  roof.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const rolesAt = (x, t) => {
    ray.set(new THREE.Vector3(x, 6 + 3.4 * t, 1), new THREE.Vector3(0, 0, -1));
    return ray
      .intersectObject(roof, true)
      .map((hit) => hit.object.userData.role);
  };
  for (const x of [0.7, 3.3]) {
    const roles = rolesAt(x, 0.62);
    assert.ok(roles.includes("roof-window-glass"));
    assert.ok(!roles.includes("roof-slope"));
  }
  const middle = rolesAt(2, 0.55);
  assert.ok(middle.includes("balcony-back"));
  assert.ok(!middle.includes("roof-slope"));
  assert.ok(rolesAt(0.12, 0.3).includes("roof-slope"));
  roof.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      assert.ok(
        [...object.geometry.getAttribute("position").array].every(
          Number.isFinite,
        ),
      );
      assert.equal(object.userData.surfaceType, "RoofSurface");
      object.geometry.dispose();
    }
  });
});
test("one facade projection remains continuous across separate wall surfaces and excludes side walls", () => {
  const front = {
    type: "WallSurface",
    rings: [
      [
        [0, 0, 0],
        [2, 0, 0],
        [2, 0, 6],
        [0, 0, 6],
      ],
    ],
  };
  const side = {
    type: "WallSurface",
    rings: [
      [
        [0, 0, 0],
        [0, 5, 0],
        [0, 5, 6],
        [0, 0, 6],
      ],
    ],
  };
  assert.equal(isFrontSurface(front, profile), true);
  assert.equal(isFrontSurface(side, profile), false);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 2, 0, 0, 2, 6, 0, 4, 6, 0], 3),
  );
  projectFront(geometry, profile, [0, 0, 0]);
  assert.deepEqual(
    [...geometry.getAttribute("uv").array],
    [0, 0, 0.5, 0, 0.5, 1, 1, 1],
  );
  geometry.dispose();
});
test("appearance and original texture are private, isolated per house and included in exports", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "huisdossier-appearance-"),
  );
  const root = fileURLToPath(new URL("../", import.meta.url));
  const assetDir = path.join(directory, "appearance", "koekoekstraat-17");
  await mkdir(assetDir, { recursive: true });
  await writeFile(path.join(assetDir, "profile.json"), JSON.stringify(profile));
  await writeFile(
    path.join(assetDir, "front-facade.png"),
    Buffer.from("test-texture-content"),
  );
  await writeFile(
    path.join(assetDir, "aerial.jpg"),
    Buffer.from("test-aerial-content"),
  );
  const { app, store } = createApp({
    directory,
    houses: [
      { id: "koekoekstraat-17", name: "Home" },
      { id: "other", name: "Other" },
    ],
    root,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  try {
    const response = await fetch(base + "/koekoekstraat-17/appearance");
    const model = await response.json();
    assert.equal(model.generated, true);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(
      model.front.texture,
      "/api/houses/koekoekstraat-17/appearance/front-facade.png",
    );
    assert.equal(
      await (
        await fetch(
          `http://127.0.0.1:${server.address().port}` + model.front.texture,
        )
      ).text(),
      "test-texture-content",
    );
    assert.equal(await (await fetch(base + "/other/appearance")).json(), null);
    assert.equal(
      await (
        await fetch(
          `http://127.0.0.1:${server.address().port}` + model.aerial.texture,
        )
      ).text(),
      "test-aerial-content",
    );
    assert.equal(
      (await fetch(base + "/other/appearance/aerial.jpg")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/other/appearance/front-facade.png")).status,
      404,
    );
    assert.equal(
      (await fetch(base + "/koekoekstraat-17/appearance/profile.json")).status,
      404,
    );
    const exported = await (
      await fetch(base + "/koekoekstraat-17/export")
    ).json();
    assert.deepEqual(exported.appearance.profile, profile);
    assert.equal(
      Buffer.from(exported.appearance.files[0].base64, "base64").toString(),
      "test-texture-content",
    );
    assert.equal(
      Buffer.from(exported.appearance.files[1].base64, "base64").toString(),
      "test-aerial-content",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
