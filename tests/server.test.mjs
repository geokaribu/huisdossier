import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const houses = [
  { id: "koekoekstraat-17", name: "Ons huis" },
  { id: "second-house", name: "Tweede huis" },
];
test("house data, uploads and maintenance survive reopening and remain isolated per house", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huisdossier-test-"));
  let { app, store } = createApp({ directory, houses, root });
  let server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  let base = `http://127.0.0.1:${server.address().port}`;
  const endpoint = "/api/houses/koekoekstraat-17";
  const send = (url, body, method = "POST") =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const result = await send(endpoint + "/assets", {
      name: "Testventilator",
      kind: "installatie",
      description: "Type X",
    });
    assert.equal(result.status, 201);
    const { id } = await result.json();
    let response = await send(
      endpoint + "/assets/" + id,
      {
        name: "Testventilator",
        description: "Type X",
        position: [136707, 456693, 8],
      },
      "PATCH",
    );
    assert.equal(response.status, 200);
    response = await send(endpoint + "/tasks", {
      assetId: id,
      title: "Filter vervangen",
      description: "Jaarlijks",
      date: "2026-12-01",
    });
    assert.equal(response.status, 201);
    const task = await response.json();
    const form = new FormData();
    form.set(
      "file",
      new Blob(["handleiding inhoud"], { type: "text/plain" }),
      "handleiding.txt",
    );
    response = await fetch(base + endpoint + "/assets/" + id + "/files", {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 201);
    const file = await response.json();
    assert.equal(
      await (await fetch(base + endpoint + "/files/" + file.id)).text(),
      "handleiding inhoud",
    );
    const exported = await (await fetch(base + endpoint + "/export")).json();
    assert.equal(exported.schemaVersion, 1);
    assert.equal(exported.model.house.bagPandId, "0344100000021151");
    assert.equal(
      Buffer.from(exported.files[0].base64, "base64").toString(),
      "handleiding inhoud",
    );
    assert.equal(exported.dossier.tasks[0].title, "Filter vervangen");
    assert.equal(
      (await fetch(base + "/api/houses/second-house/files/" + file.id)).status,
      404,
    );
    assert.equal(
      (
        await send("/api/houses/second-house/tasks", {
          assetId: id,
          title: "Cross-house",
          description: "",
          date: "2026-12-01",
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await send(
          "/api/houses/second-house/assets/" + id,
          { name: "Wrong house", description: "", position: null },
          "PATCH",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await send(endpoint + "/tasks", {
          assetId: id,
          title: "",
          date: "2026-02-31",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await fetch(base + endpoint + "/tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://unrelated.example",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(base + "/api/houses/unknown/dossier")).status,
      404,
    );
    assert.equal(
      (await send(endpoint + "/tasks/" + task.id, { status: "done" }, "PATCH"))
        .status,
      200,
    );
    await new Promise((resolve) => server.close(resolve));
    store.close();
    const reopened = createApp({ directory, houses, root });
    app = reopened.app;
    store = reopened.store;
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
    const persisted = await (await fetch(base + endpoint + "/dossier")).json();
    assert.equal(persisted.tasks[0].status, "done");
    assert.deepEqual(
      persisted.assets.find((a) => a.id === id).position,
      [136707, 456693, 8],
    );
    assert.equal(persisted.attachments[0].name, "handleiding.txt");
    assert.equal(
      await (await fetch(base + endpoint + "/files/" + file.id)).text(),
      "handleiding inhoud",
    );
    const other = await (
      await fetch(base + "/api/houses/second-house/dossier")
    ).json();
    assert.equal(other.attachments.length, 0);
    assert.equal(other.tasks.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("imported geometry is attached to verified BAG identifiers and contains finite roof and wall polygons", async () => {
  const data = JSON.parse(
    await readFile(
      path.join(root, "public/data/koekoekstraat-17.json"),
      "utf8",
    ),
  );
  assert.equal(data.house.bagVboId, "0344010000061984");
  assert.equal(data.house.bagPandId, "0344100000021151");
  const targets = data.buildings.filter((b) => b.target);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, `NL.IMBAG.Pand.${data.house.bagPandId}`);
  assert.ok(targets[0].surfaces.some((s) => s.type === "RoofSurface"));
  assert.ok(targets[0].surfaces.some((s) => s.type === "WallSurface"));
  for (const building of data.buildings)
    for (const surface of building.surfaces)
      for (const ring of surface.rings) {
        assert.ok(ring.length >= 3);
        for (const p of ring) {
          assert.equal(p.length, 3);
          assert.ok(p.every(Number.isFinite));
          assert.ok(p[0] > 136000 && p[0] < 137000);
          assert.ok(p[1] > 456000 && p[1] < 457000);
        }
      }
  assert.match(data.source.license, /CC BY 4.0/);
});
