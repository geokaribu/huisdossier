import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { createApp } from "../server/app.mjs";
import { isFrontSurface, projectFront } from "../src/appearance.ts";

const profile = {
  version: 1,
  label: "Test appearance",
  description: "Visual reconstruction",
  attribution: "User reference",
  generated: true,
  front: {
    left: [0, 0],
    right: [4, 0],
    bottom: 0,
    top: 6,
    texture: "front-facade.png",
  },
  materials: { wall: "#ffffff", roof: "#889999", plinth: "#555555" },
};
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
