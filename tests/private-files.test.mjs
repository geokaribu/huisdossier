import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { request as httpRequest } from "node:http";
import { createServer as createViteServer } from "vite";
import { createApp } from "../server/app.mjs";

// Intent: AGENTS.md private installation data must only be exposed by scoped API routes.
test("Vite cannot serve private keys, databases or external catalogs through raw and encoded file URLs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "huisdossier-private-files-"));
  const directory = path.join(root, "data");
  await mkdir(directory);
  const catalog = path.join(root, "customer.json");
  await writeFile(catalog, '["synthetic private catalog"]');
  await writeFile(
    path.join(directory, "assistant-config.json"),
    '{"apiKey":"fake-key-for-isolated-test"}',
  );
  await writeFile(path.join(root, "visible.txt"), "Public fixture");
  const { app, store } = createApp({
    root,
    directory,
    catalogPath: catalog,
    houses: [{ id: "test-house", name: "Synthetic" }],
  });
  const vite = await createViteServer({
    root,
    configFile: false,
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  app.use(vite.middlewares);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const pathname of [
      "/%61pi/../data/assistant-config.json",
      "/%61pi/%2e%2e/data/assistant-config.json",
    ]) {
      const status = await new Promise((resolve, reject) => {
        const request = httpRequest(
          base + "/",
          { path: pathname },
          (response) => {
            response.resume();
            resolve(response.statusCode);
          },
        );
        request.on("error", reject);
        request.end();
      });
      assert.equal(status, 404, pathname);
    }
    for (const url of [
      "/data/assistant-config.json",
      "/data/huisdossier.sqlite",
      "/%64ata/assistant-config.json?raw",
      "/%2564ata/assistant-config.json",
      "/customer.json",
      "/@fs/" +
        path.join(directory, "assistant-config.json").replaceAll("\\", "/"),
      "/@fs/" + catalog.replaceAll("\\", "/"),
    ])
      assert.equal((await fetch(base + url)).status, 404, url);
    assert.equal(
      await (await fetch(base + "/visible.txt")).text(),
      "Public fixture",
    );
    assert.equal(
      (await fetch(base + "/api/houses/test-house/dossier")).status,
      200,
    );
  } finally {
    await vite.close();
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(root, { recursive: true, force: true });
  }
});
