import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  loadRuntimeConfig,
  houseCatalogSchema,
} from "../server/runtime-config.mjs";
import { checkInstallation } from "../server/installation-check.mjs";
import { createStore } from "../server/store.mjs";
import { createApp } from "../server/app.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const house = {
  id: "office-demo",
  name: "Voorbeeldkantoor",
  address: "Voorbeeldstraat 1",
  postcode: "1000 AA",
  city: "Voorbeeldstad",
  query: "Voorbeeldstraat 1 Voorbeeldstad",
  vboId: "0000000000000001",
  rd: [100000, 400000],
  starterAssets: [
    {
      slug: "meeting-room",
      name: "Vergaderruimte",
      description: "In te richten",
      kind: "ruimte",
    },
  ],
};
test("external private catalog controls independent installations and typed starter assets without changing source config", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "huisdossier-runtime-"));
  try {
    const catalog = path.join(root, "private-houses.json"),
      directory = path.join(root, "customer-data");
    await writeFile(catalog, JSON.stringify([house]));
    const env = {
      HUISDOSSIER_HOUSES_FILE: catalog,
      HUISDOSSIER_DATA_DIR: directory,
    };
    const config = await loadRuntimeConfig(root, env);
    assert.equal(config.directory, directory);
    assert.equal(config.houses[0].provider, "bag");
    assert.equal(config.houses[0].starterAssets[0].kind, "ruimte");
    assert.deepEqual(await readdir(root), ["private-houses.json"]);
    let store = createStore(config.directory, config.houses);
    assert.equal(
      store.asset(house.id, `${house.id}:meeting-room`).kind,
      "ruimte",
    );
    store.updateAsset(house.id, `${house.id}:meeting-room`, {
      name: "Eigen naam",
      description: "Eigen tekst",
      position: null,
    });
    store.close();
    store = createStore(config.directory, config.houses);
    assert.equal(
      store.asset(house.id, `${house.id}:meeting-room`).name,
      "Eigen naam",
    );
    store.close();
    await assert.rejects(
      loadRuntimeConfig(root, { ...env, HUISDOSSIER_DATA_DIR: "relative" }),
      /absoluut/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("catalog rejects unsafe identifiers, conflicting providers, duplicate and reserved starter IDs before opening storage", () => {
  for (const candidate of [
    [],
    [{ ...house, id: "../outside" }],
    [house, house],
    [{ ...house, vboId: undefined }],
    [{ ...house, country: "BE" }],
    [{ ...house, provider: "unsupported" }],
    [{ ...house, typo: "ignored?" }],
    [
      {
        ...house,
        starterAssets: [{ slug: "inbox", name: "Override", description: "" }],
      },
    ],
    [
      {
        ...house,
        starterAssets: [...house.starterAssets, ...house.starterAssets],
      },
    ],
  ])
    assert.equal(houseCatalogSchema.safeParse(candidate).success, false);
  assert.equal(
    houseCatalogSchema.safeParse([
      { ...house, provider: "vlaanderen", country: "BE", vboId: undefined },
    ]).success,
    true,
  );
});
test("installation preflight detects missing, mismatched and uncredited models without creating private data", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "huisdossier-preflight-"));
  try {
    const catalog = path.join(root, "houses.json"),
      directory = path.join(root, "untouched-data");
    const env = {
      HUISDOSSIER_HOUSES_FILE: catalog,
      HUISDOSSIER_DATA_DIR: directory,
    };
    await writeFile(catalog, JSON.stringify([house]));
    let report = await checkInstallation(root, env);
    assert.equal(report.ready, false);
    assert.equal(report.hostedReady, false);
    assert.equal(report.dossiers[0].checks[0].status, "error");
    await assert.rejects(readdir(directory), { code: "ENOENT" });
    await mkdir(path.join(root, "public/data"), { recursive: true });
    const model = {
      house: { id: house.id },
      buildings: [{ target: true, surfaces: [{}] }],
      source: {
        attribution: "Test fixture",
        license: "Test only",
        crs: "Test CRS",
      },
    };
    const target = path.join(root, "public/data", `${house.id}.json`);
    await writeFile(target, JSON.stringify(model));
    report = await checkInstallation(root, env);
    assert.equal(report.ready, true);
    assert.equal(report.dossiers[0].checks[1].status, "absent");
    await writeFile(
      target,
      JSON.stringify({ ...model, house: { id: "another-house" } }),
    );
    assert.match(
      (await checkInstallation(root, env)).dossiers[0].checks[0].message,
      /ander dossier/,
    );
    await writeFile(target, JSON.stringify({ ...model, source: {} }));
    assert.match(
      (await checkInstallation(root, env)).dossiers[0].checks[0].message,
      /Bronvermelding/,
    );
    await writeFile(target, JSON.stringify(model));
    await mkdir(path.join(directory, "floorplans", house.id), {
      recursive: true,
    });
    await writeFile(
      path.join(directory, "floorplans", house.id, "plan.json"),
      "{}",
    );
    assert.equal((await checkInstallation(root, env)).ready, false);
    await assert.rejects(readdir(path.join(directory, "uploads")), {
      code: "ENOENT",
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("model API and export use the installation model directory; removing a dossier from config retains data but removes API access", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "huisdossier-product-api-"));
  let store, server;
  const close = async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    server = null;
    store?.close();
    store = null;
  };
  try {
    const directory = path.join(root, "private"),
      modelDirectory = path.join(root, "private-models");
    const removed = { ...house, id: "previous-office", starterAssets: [] };
    store = createStore(directory, [house, removed]);
    const id = store.addTask(removed.id, {
      assetId: `${removed.id}:inbox`,
      title: "Bewaar deze historie",
      description: "",
      date: "",
    });
    store.close();
    store = null;
    await mkdir(modelDirectory);
    const model = {
      house: { id: house.id },
      source: { attribution: "Fixture" },
      buildings: [],
    };
    await writeFile(
      path.join(modelDirectory, `${house.id}.json`),
      JSON.stringify(model),
    );
    const instance = createApp({
      root,
      directory,
      modelDirectory,
      houses: [house],
    });
    store = instance.store;
    server = instance.app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/houses/`;
    assert.deepEqual(
      await (await fetch(base + house.id + "/model")).json(),
      model,
    );
    assert.deepEqual(
      (await (await fetch(base + house.id + "/export")).json()).model,
      model,
    );
    for (const suffix of ["/dossier", "/model", "/export", "/management"])
      assert.equal((await fetch(base + removed.id + suffix)).status, 404);
    assert.equal(store.dossier(removed.id).tasks[0].id, id);
    await close();
  } finally {
    await close();
    await rm(root, { recursive: true, force: true });
  }
});

test("lighting importer rejects a Flemish catalog before fetching or writing into either installation", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "huisdossier-provider-check-"),
  );
  try {
    const catalog = path.join(root, "houses.json"),
      directory = path.join(root, "private");
    await writeFile(
      catalog,
      JSON.stringify([
        { ...house, provider: "vlaanderen", country: "BE", vboId: undefined },
      ]),
    );
    const script = fileURLToPath(
      new URL("../scripts/import-lighting.mjs", import.meta.url),
    );
    await assert.rejects(
      promisify(execFile)(process.execPath, [script, house.id], {
        env: {
          ...process.env,
          HUISDOSSIER_HOUSES_FILE: catalog,
          HUISDOSSIER_DATA_DIR: directory,
        },
        timeout: 10000,
      }),
      (error) => {
        assert.match(error.stderr, /alleen de Nederlandse BAG\/BGT-bron/);
        return true;
      },
    );
    await assert.rejects(readdir(directory), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
