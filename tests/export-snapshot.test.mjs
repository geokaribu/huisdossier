import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server/app.mjs";

// Intent: a completed export contains metadata and original bytes from one dossier snapshot.
test("an upload completed while export reads files does not enter only half of the exported snapshot", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "huisdossier-export-snapshot-"),
  );
  const { app, store } = createApp({
    root,
    directory: path.join(root, "private"),
    houses: [{ id: "one", name: "Synthetic house" }],
  });
  await writeFile(path.join(root, "private/uploads/first"), "First original");
  await writeFile(path.join(root, "private/uploads/second"), "Second original");
  const attachment = (filename) => ({
    originalname: filename + ".txt",
    filename,
    mimetype: "text/plain",
    size: 14,
  });
  const firstId = store.addAttachment("one", "one:inbox", attachment("first"));
  const original = store.allFiles.bind(store);
  let added;
  store.allFiles = (house) => {
    const rows = original(house);
    queueMicrotask(() => {
      added = store.addAttachment("one", "one:inbox", attachment("second"));
    });
    return rows;
  };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/houses/one/export`,
    );
    assert.equal(response.status, 200);
    const exported = await response.json();
    assert.ok(added);
    assert.equal(store.dossier("one").attachments.length, 2);
    assert.deepEqual(
      exported.dossier.attachments.map((file) => file.id),
      [firstId],
    );
    assert.deepEqual(
      exported.files.map((file) => file.id),
      [firstId],
    );
    assert.equal(
      Buffer.from(exported.files[0].base64, "base64").toString(),
      "First original",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
