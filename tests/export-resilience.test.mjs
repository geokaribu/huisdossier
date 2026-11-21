import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";

test("dossier and complete record export survive absent model and malformed optional profiles", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "huisdossier-resilience-"),
  );
  const houses = [{ id: "test-house", name: "Test", address: "Teststraat 1" }];
  const { app, store } = createApp({
    directory,
    houses,
    root: process.cwd(),
    modelDirectory: path.join(directory, "models"),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/houses/test-house`;
  try {
    await mkdir(path.join(directory, "floorplans/test-house"), {
      recursive: true,
    });
    await writeFile(
      path.join(directory, "floorplans/test-house/plan.json"),
      "{invalid",
    );
    const response = await fetch(base + "/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Testdak", kind: "dak", description: "" }),
    });
    assert.equal(response.status, 201);
    const asset = await response.json();
    assert.equal((await fetch(base + "/dossier")).status, 200);
    const exportResponse = await fetch(base + "/export");
    assert.equal(exportResponse.status, 200);
    assert.equal(exportResponse.headers.get("X-Huisdossier-Export-Warnings"), "model,floorplan");
    const exported = await exportResponse.json();
    assert.equal(exported.house.id, "test-house");
    assert.equal(exported.model, null);
    assert.equal(exported.floorplan, null);
    assert.ok(exported.dossier.assets.some((a) => a.id === asset.id));
    assert.deepEqual(
      exported.exportWarnings.map((w) => w.resource),
      ["model", "floorplan"],
    );
    assert.deepEqual(exported.floorplanFiles, []);
    assert.equal(exported.lighting, null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
