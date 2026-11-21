import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  writeFile,
  readFile,
  access,
  mkdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { initializeInstallation } from "../server/installation-init.mjs";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";
import { checkInstallation } from "../server/installation-check.mjs";
import { lockInstallation } from "../server/installation-lock.mjs";
import {
  backupInstallation,
  restoreInstallation,
} from "../server/installation-backup.mjs";
import { createStore } from "../server/store.mjs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const house = {
  id: "new-house",
  name: "Nieuw huisboek",
  address: "Voorbeeldstraat 1",
  city: "Voorbeeldstad",
  postcode: "1000 AA",
  provider: "none",
  starterAssets: [
    {
      slug: "living",
      name: "Woonkamer",
      kind: "ruimte",
      description: "Volgens bewoners",
      roomId: "living",
    },
  ],
};

test("imports share the installation lock and cannot change a stopped snapshot during maintenance", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "huisdossier-import-lock-"));
  const root = fileURLToPath(new URL("../", import.meta.url));
  let unlock;
  try {
    const descriptor = await initializeInstallation({
      root,
      directory: path.join(parent, "customer"),
      houses: [
        {
          ...house,
          provider: "bag",
          vboId: "0000000000000001",
          rd: [100000, 400000],
        },
      ],
    });
    const config = await loadRuntimeConfig(root, {
      HUISDOSSIER_INSTALLATION: descriptor,
    });
    unlock = await lockInstallation(config.directory);
    const manifest = path.join(parent, "manifest.json");
    await writeFile(manifest, "{}");
    const env = { ...process.env, HUISDOSSIER_INSTALLATION: descriptor };
    for (const name of [
      "HUISDOSSIER_DATA_DIR",
      "HUISDOSSIER_HOUSES_FILE",
      "HUISDOSSIER_MODELS_DIR",
    ])
      delete env[name];
    for (const [script, args] of [
      ["import-house.mjs", [house.id]],
      ["import-lighting.mjs", [house.id]],
      ["import-dossier.mjs", [house.id, parent, manifest]],
    ]) {
      await assert.rejects(
        promisify(execFile)(
          process.execPath,
          [path.join(root, "scripts", script), ...args],
          { env, timeout: 15000 },
        ),
        (error) => {
          assert.match(error.stderr, /nog actief/);
          return true;
        },
      );
    }
    await assert.rejects(
      access(path.join(config.directory, "huisdossier.sqlite")),
      { code: "ENOENT" },
    );
  } finally {
    await unlock?.();
    await rm(parent, { recursive: true, force: true });
  }
});

// Intent: customer configuration is separate from code; stable links and resident edits survive restart.
test("a new customer starts without a model and retains edits and room links independently from another customer", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "huisdossier-customer-"));
  const stores = [];
  try {
    const root = path.join(parent, "code");
    await mkdir(root);
    const directory = path.join(parent, "customer");
    const descriptor = await initializeInstallation({
      root,
      directory,
      houses: [house],
    });
    const env = { HUISDOSSIER_INSTALLATION: descriptor };
    const config = await loadRuntimeConfig(root, env);
    assert.equal(config.directory, path.join(directory, "data"));
    assert.equal(config.port, 4173);
    assert.equal((await checkInstallation(root, env)).ready, true);
    let store = createStore(config.directory, config.houses);
    stores.push(store);
    assert.equal(
      store
        .dossier(house.id)
        .assets.find((asset) => asset.id === "new-house:living").roomId,
      "living",
    );
    store.updateAsset(house.id, "new-house:living", {
      name: "Eigen naam",
      description: "Eigen notitie",
      roomId: null,
      position: null,
    });
    store.close();
    store = createStore(config.directory, config.houses);
    stores.push(store);
    assert.equal(store.asset(house.id, "new-house:living").name, "Eigen naam");
    assert.equal(
      store
        .dossier(house.id)
        .assets.find((asset) => asset.id === "new-house:living").roomId,
      null,
    );
    store.close();
    await assert.rejects(
      initializeInstallation({ root, directory, houses: [house] }),
      { code: "EEXIST" },
    );
    await assert.rejects(
      initializeInstallation({
        root,
        directory: path.join(root, "customer"),
        houses: [house],
      }),
      /buiten de codecheckout/,
    );
    const second = await initializeInstallation({
      root,
      directory: path.join(parent, "second"),
      houses: [{ ...house, id: "second-house" }],
    });
    const other = await loadRuntimeConfig(root, {
      HUISDOSSIER_INSTALLATION: second,
    });
    const otherStore = createStore(other.directory, other.houses);
    stores.push(otherStore);
    assert.equal(otherStore.asset(house.id, "new-house:living"), undefined);
    otherStore.close();
  } finally {
    for (const store of stores) {
      try {
        store.close();
      } catch {}
    }
    await rm(parent, { recursive: true, force: true });
  }
});

// Intent: backups include every private original and can be restored without overwriting an installation.
test("offline installation backup restores database, uploads, profiles and secrets with checksum verification and exclusive locking", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "huisdossier-backup-"));
  try {
    const root = path.join(parent, "code");
    await mkdir(root);
    const descriptor = await initializeInstallation({
      root,
      directory: path.join(parent, "customer"),
      houses: [house],
    });
    const config = await loadRuntimeConfig(root, {
      HUISDOSSIER_INSTALLATION: descriptor,
    });
    const store = createStore(config.directory, config.houses);
    const taskId = store.addTask(house.id, {
      assetId: "new-house:living",
      title: "Bewaarde klus",
      description: "Originele informatie",
      date: "",
    });
    store.close();
    await mkdir(path.join(config.directory, "uploads"));
    await writeFile(
      path.join(config.directory, "uploads", "original"),
      "Immutable original",
    );
    await writeFile(
      path.join(config.directory, "assistant-config.json"),
      '{"apiKey":"synthetic-test-key"}',
    );
    const unlock = await lockInstallation(config.directory);
    await assert.rejects(lockInstallation(config.directory), /nog actief/);
    await assert.rejects(
      backupInstallation(config, path.join(parent, "blocked")),
      /nog actief/,
    );
    await unlock();
    const backup = path.join(parent, "backup");
    const result = await backupInstallation(config, backup);
    assert.ok(result.files >= 5);
    await assert.rejects(access(path.join(backup, "data/.server-lock.json")), {
      code: "ENOENT",
    });
    await assert.rejects(backupInstallation(config, backup), {
      code: "EEXIST",
    });
    await assert.rejects(
      backupInstallation(config, path.join(config.directory, "backup")),
      /buiten de bronmappen/,
    );
    const target = path.join(parent, "restored");
    await restoreInstallation(backup, target, root);
    const restored = await loadRuntimeConfig(root, {
      HUISDOSSIER_INSTALLATION: path.join(target, "installation.json"),
    });
    const restoredStore = createStore(restored.directory, restored.houses);
    assert.ok(
      restoredStore.dossier(house.id).tasks.some((task) => task.id === taskId),
    );
    restoredStore.close();
    assert.equal(
      await readFile(path.join(restored.directory, "uploads/original"), "utf8"),
      "Immutable original",
    );
    assert.equal(
      await readFile(
        path.join(restored.directory, "assistant-config.json"),
        "utf8",
      ),
      '{"apiKey":"synthetic-test-key"}',
    );
    await assert.rejects(restoreInstallation(backup, target, root), {
      code: "EEXIST",
    });
    await writeFile(path.join(backup, "data/uploads/original"), "Corrupted");
    await assert.rejects(
      restoreInstallation(backup, path.join(parent, "corrupt-restore"), root),
      /controlesommen/,
    );
    await assert.rejects(access(path.join(parent, "corrupt-restore")), {
      code: "ENOENT",
    });
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});
