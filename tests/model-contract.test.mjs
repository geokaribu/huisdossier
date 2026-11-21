import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readModel } from "../server/model.mjs";
import { checkInstallation } from "../server/installation-check.mjs";
import { createApp } from "../server/app.mjs";

test("a deliberately model-free customer returns an absent resource, while expected or malformed models remain errors", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "huisdossier-no-model-"));
  const { app, store } = createApp({
    root,
    directory: path.join(root, "private"),
    houses: [
      { id: "empty", name: "Empty", provider: "none" },
      { id: "expected", name: "Expected", provider: "bag" },
    ],
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  try {
    const response = await fetch(base + "/empty/model");
    assert.equal(response.status, 200);
    assert.equal(await response.json(), null);
    const exported = await (await fetch(base + "/empty/export")).json();
    assert.equal(exported.model, null);
    assert.ok(
      !exported.exportWarnings.some((warning) => warning.resource === "model"),
    );
    assert.equal((await fetch(base + "/expected/model")).status, 404);
    await mkdir(path.join(root, "public/data"), { recursive: true });
    await writeFile(
      path.join(root, "public/data/empty.json"),
      JSON.stringify({
        house: { id: "empty" },
        source: { attribution: "Fixture", license: "Test" },
      }),
    );
    assert.notEqual((await fetch(base + "/empty/model")).status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});

// Intent: an installation marked ready has a model the API/export reader can actually load.
test("model delivery and installation preflight enforce the same geometry and source contract", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "huisdossier-model-contract-"),
  );
  try {
    const directory = path.join(root, "models");
    await mkdir(directory);
    const catalogPath = path.join(root, "houses.json");
    await writeFile(
      catalogPath,
      JSON.stringify([
        {
          id: "one",
          name: "Test",
          address: "Voorbeeldstraat 1",
          city: "Voorbeeldstad",
          postcode: "1000 AA",
          provider: "none",
        },
      ]),
    );
    const model = {
      house: { id: "one", address: "Voorbeeldstraat 1", rd: [1, 2] },
      source: {
        attribution: "Fixture",
        license: "Test",
        fetchedAt: "2026-11-21",
        urls: [],
        crs: "Synthetic CRS",
      },
      buildings: [
        {
          id: "building",
          target: true,
          attributes: {},
          surfaces: [
            {
              type: "RoofSurface",
              rings: [
                [
                  [0, 0, 3],
                  [2, 0, 3],
                  [0, 2, 3],
                ],
              ],
            },
          ],
        },
      ],
    };
    const env = {
      HUISDOSSIER_HOUSES_FILE: catalogPath,
      HUISDOSSIER_MODELS_DIR: directory,
    };
    for (const candidate of [
      model,
      { ...model, buildings: [{ target: true, surfaces: [{}] }] },
      { ...model, source: { ...model.source, crs: undefined } },
      { ...model, house: { ...model.house, id: "other" } },
    ]) {
      await writeFile(
        path.join(directory, "one.json"),
        JSON.stringify(candidate),
      );
      const report = await checkInstallation(root, env);
      if (candidate === model) {
        assert.equal(report.ready, true);
        assert.deepEqual(await readModel(directory, "one"), model);
      } else {
        assert.equal(report.ready, false);
        await assert.rejects(readModel(directory, "one"));
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
