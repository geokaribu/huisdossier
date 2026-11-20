import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.mjs";
import { importDossier } from "../server/import-dossier.mjs";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../server/store.mjs";

test("version-one dossiers migrate without losing existing records", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dossier-v1-"));
  const db = new DatabaseSync(path.join(directory, "huisdossier.sqlite"));
  db.exec(`CREATE TABLE migrations(version INTEGER PRIMARY KEY); INSERT INTO migrations VALUES(1);
    CREATE TABLE houses(id TEXT PRIMARY KEY,name TEXT NOT NULL); INSERT INTO houses VALUES('legacy','Legacy');
    CREATE TABLE assets(id TEXT PRIMARY KEY,house_id TEXT,name TEXT,kind TEXT,description TEXT,position TEXT);
    INSERT INTO assets VALUES('original','legacy','Mijn toestel','installatie','Eigen notities','[1,2,3]');
    CREATE TABLE attachments(id TEXT PRIMARY KEY,house_id TEXT,asset_id TEXT,name TEXT,type TEXT,size INTEGER,stored_name TEXT,created_at TEXT);
    INSERT INTO attachments VALUES('file','legacy','original','bewijs.txt','text/plain',10,'original-file','2026-01-01');
    CREATE TABLE tasks(id TEXT PRIMARY KEY,house_id TEXT,asset_id TEXT,title TEXT,description TEXT,date TEXT,status TEXT,created_at TEXT);
    INSERT INTO tasks VALUES('task','legacy','original','Eerder uitgevoerd','Eigen historie','2026-01-01','done','2026-01-01');`);
  db.close();
  const store = createStore(directory, [{ id: "legacy", name: "Legacy" }]);
  try {
    const dossier = store.dossier("legacy");
    assert.equal(
      dossier.assets.find((a) => a.id === "original").description,
      "Eigen notities",
    );
    assert.deepEqual(
      dossier.assets.find((a) => a.id === "original").position,
      [1, 2, 3],
    );
    assert.equal(dossier.attachments[0].id, "file");
    assert.equal(dossier.tasks[0].status, "done");
    store.updateAsset("legacy", "original", {
      name: "Mijn toestel",
      description: "Eigen notities",
      position: [1, 2, 3],
      roomId: "study",
    });
    store.updateAsset("legacy", "original", {
      name: "Mijn toestel",
      description: "Aanvulling",
      position: [1, 2, 3],
    });
    assert.equal(
      store.dossier("legacy").assets.find((a) => a.id === "original").roomId,
      "study",
    );
    store.updateAsset("legacy", "original", {
      name: "Mijn toestel",
      description: "Aanvulling",
      position: null,
      roomId: null,
    });
    assert.equal(
      store.dossier("legacy").assets.find((a) => a.id === "original").roomId,
      null,
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("local dossier imports preserve originals, edits and house isolation; text search and task planning work", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "dossier-import-"));
  const sourceRoot = path.join(directory, "source");
  await mkdir(sourceRoot);
  const source = path.join(sourceRoot, "manual.md");
  await writeFile(
    source,
    "# Ventilatie\n\nOnderhoud door Voorbeeldservice. Uniek-MODEL-42, geen vervangdatum bekend.",
  );
  await writeFile(path.join(sourceRoot, "scan.pdf"), "%PDF-1.4\n% fixture");
  const { app, store } = createApp({
    directory,
    houses: [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ],
    root: fileURLToPath(new URL("../", import.meta.url)),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  const send = (url, body, method = "PATCH") =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const manifest = {
    assets: [
      {
        key: "room:study",
        name: "Werkruimte",
        kind: "ruimte",
        roomId: "study",
        description: "Huidige indeling",
      },
    ],
    documents: [
      {
        path: source,
        assetKey: "room:study",
        title: "Handleiding",
        category: "maintenance",
        summary: "Te controleren cyclus",
        historical: true,
      },
      {
        path: "scan.pdf",
        assetKey: "room:study",
        category: "legal",
        text: "Afgesproken op de vergadering",
      },
      { path: "not-bought.md", assetKey: "room:study", category: "archive" },
    ],
    tasks: [
      {
        key: "check",
        assetKey: "room:study",
        title: "Beurt bevestigen",
        date: "",
        owner: "Bewoner",
        state: "verify",
        sourcePath: source,
        status: "open",
      },
    ],
  };
  const run = () =>
    importDossier({
      store,
      directory,
      houseId: "one",
      sourceKey: "fixture",
      sourceRoot,
      manifest,
    });
  try {
    let result = await run();
    assert.equal(result.added, 4);
    assert.equal(result.excluded.length, 1);
    result = await run();
    assert.equal(result.unchanged, 4);
    let dossier = store.dossier("one");
    assert.equal(dossier.attachments.length, 2);
    assert.equal(
      dossier.assets.find((a) => a.roomId === "study").name,
      "Werkruimte",
    );
    const document = dossier.attachments.find(
      (f) => f.name === "Handleiding.md",
    );
    assert.equal(document.historical, true);
    assert.equal(document.readable, true);
    assert.ok(!("text_content" in document));
    let response = await fetch(`${base}/one/search?q=uniek-model-42`);
    assert.deepEqual(
      (await response.json()).map((f) => f.id),
      [document.id],
    );
    assert.deepEqual(
      (
        await (
          await fetch(`${base}/one/search?q=uniek-model-42%20Voorbeeldservice`)
        ).json()
      ).map((f) => f.id),
      [document.id],
    );
    assert.equal(
      (await (await fetch(`${base}/two/search?q=uniek-model-42`)).json())
        .length,
      0,
    );
    assert.equal(
      (await fetch(`${base}/two/files/${document.id}/text`)).status,
      404,
    );
    assert.match(
      (await (await fetch(`${base}/one/files/${document.id}/text`)).json())
        .text,
      /Uniek-MODEL/,
    );
    const pdf = dossier.attachments.find((f) => f.type === "application/pdf");
    response = await fetch(`${base}/one/files/${pdf.id}?preview=1`);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), "inline");
    response = await fetch(`${base}/one/files/${document.id}`);
    assert.match(response.headers.get("content-disposition"), /^attachment/);
    const task = dossier.tasks[0];
    assert.equal(task.date, "");
    assert.equal(task.sourceId, document.id);
    response = await send(`/one/tasks/${task.id}`, { status: "done" });
    assert.equal(response.status, 200);
    let saved = store.dossier("one").tasks[0];
    assert.equal(saved.owner, "Bewoner");
    assert.match(saved.completedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(saved.state, "verify");
    assert.equal(saved.date, "");
    response = await send(`/one/tasks/${task.id}`, { date: "2027-02-31" });
    assert.equal(response.status, 400);
    response = await send(`/one/tasks/${task.id}`, { assetId: "two:building" });
    assert.equal(response.status, 404);
    response = await send(`/one/tasks/${task.id}`, {
      date: "2027-03-01",
      owner: "Samen",
      state: "active",
    });
    assert.equal(response.status, 200);
    response = await send(`/one/files/${document.id}`, {
      assetId: "one:building",
      category: "history",
      summary: "Eigen aanvulling",
    });
    assert.equal(response.status, 200);
    manifest.tasks[0].title = "Gewijzigde brontaak";
    await writeFile(source, "Nieuwe bron, andere tekst");
    result = await run();
    assert.ok(result.preserved.includes("check"));
    assert.ok(result.preserved.includes("manual.md"));
    saved = store.dossier("one").tasks[0];
    assert.equal(saved.status, "done");
    assert.equal(saved.title, "Beurt bevestigen");
    assert.equal(saved.owner, "Samen");
    assert.equal(
      store.dossier("one").attachments.find((f) => f.id === document.id)
        .summary,
      "Eigen aanvulling",
    );
    assert.match(
      (await (await fetch(`${base}/one/files/${document.id}/text`)).json())
        .text,
      /Uniek-MODEL/,
    );
    // A text upload becomes searchable without changing its original download bytes.
    const form = new FormData();
    form.set(
      "file",
      new Blob(["Bewonersnotitie trefwoord-Plataan"]),
      "notitie.txt",
    );
    response = await fetch(`${base}/one/assets/one:building/files`, {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 201);
    assert.equal(
      (await (await fetch(`${base}/one/search?q=plataan`)).json()).length,
      1,
    );
    // Invalid imports roll back every database row, and source traversal is rejected.
    const count = store.dossier("one").assets.length;
    await assert.rejects(() =>
      importDossier({
        store,
        directory,
        houseId: "one",
        sourceKey: "bad",
        sourceRoot,
        manifest: {
          assets: [{ key: "invalid", name: "Invalid", kind: "room" }],
        },
      }),
    );
    await assert.rejects(
      () =>
        importDossier({
          store,
          directory,
          houseId: "one",
          sourceKey: "bad",
          sourceRoot,
          manifest: {
            tasks: [
              {
                key: "invalid",
                assetKey: "building",
                title: "Invalid",
                date: "2027-02-31",
              },
            ],
          },
        }),
      /Invalid date/,
    );
    await assert.rejects(
      () =>
        importDossier({
          store,
          directory,
          houseId: "one",
          sourceKey: "bad",
          sourceRoot,
          manifest: {
            assets: [{ key: "bad", name: "Bad", kind: "ruimte" }],
            documents: [{ path: "scan.pdf", assetKey: "missing" }],
          },
        }),
      /Unknown asset/,
    );
    assert.equal(store.dossier("one").assets.length, count);
    await assert.rejects(
      () =>
        importDossier({
          store,
          directory,
          houseId: "one",
          sourceKey: "bad",
          sourceRoot,
          manifest: {
            documents: [{ path: "../outside.md", assetKey: "building" }],
          },
        }),
      /outside root/,
    );
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
