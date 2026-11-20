import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../server/app.mjs";
import { nextMaintenanceDate, calendarToday } from "../server/management.mjs";
import { createStore } from "../server/store.mjs";
import { randomUUID } from "node:crypto";

test("fixed calendar maintenance clamps month ends, restores the anchor day and skips missed cycles", () => {
  assert.equal(
    nextMaintenanceDate("2024-01-31", 1, "2024-01-31"),
    "2024-02-29",
  );
  assert.equal(
    nextMaintenanceDate("2024-01-31", 1, "2024-02-29"),
    "2024-03-31",
  );
  assert.equal(
    nextMaintenanceDate("2024-02-29", 12, "2025-03-01"),
    "2026-02-28",
  );
  assert.throws(() => nextMaintenanceDate("2024-01-01", 0, "2024-01-01"));
  assert.equal(calendarToday(new Date("2026-11-20T23:30:00Z")), "2026-11-21");
});
test("people, entries and recurring work persist, are house-scoped and retain evidence through completion and retries", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huis-management-"));
  const root = path.join(directory, "app-root");
  await mkdir(path.join(root, "public", "data"), { recursive: true });
  await writeFile(
    path.join(root, "public", "data", "one.json"),
    JSON.stringify({ house: { id: "one" }, buildings: [] }),
  );
  const { app, store } = createApp({
    directory,
    root,
    houses: [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ],
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  const send = (url, body, method = "POST") =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const get = async (house) => (await fetch(`${base}/${house}/dossier`)).json();
  try {
    let response = await send("/one/people", { name: "Bewoner Een" });
    assert.equal(response.status, 201);
    const person = (await response.json()).id;
    response = await send("/one/people", { name: "bewoner een" });
    assert.equal(response.status, 409);
    response = await send(`/two/people/${person}`, { name: "Wrong" }, "PATCH");
    assert.equal(response.status, 404);
    response = await send("/two/maintenance-plans", {
      assetId: "two:roof",
      title: "Check",
      intervalMonths: 12,
      firstDate: "2024-01-31",
      assigneeId: person,
    });
    assert.equal(response.status, 400);
    response = await send("/one/maintenance-plans", {
      assetId: "one:roof",
      title: "Goot controleren",
      intervalMonths: 1,
      firstDate: "2024-01-31",
      assigneeId: person,
    });
    assert.equal(response.status, 201);
    const plan = (await response.json()).id;
    const before = (await get("one")).tasks[0];
    assert.equal(before.assigneeId, person);
    response = await send(
      `/one/tasks/${before.id}`,
      {
        status: "done",
        completedOn: "2024-02-29",
        result: "Goot is schoon",
        completedById: person,
      },
      "PATCH",
    );
    assert.equal(response.status, 200);
    let dossier = await get("one");
    assert.equal(dossier.tasks.length, 2);
    const next = dossier.tasks.find((t) => t.status === "open");
    assert.equal(next.date, "2024-03-31");
    const done = dossier.tasks.find((t) => t.status === "done");
    assert.equal(done.result, "Goot is schoon");
    assert.equal(done.completedAt, "2024-02-29T12:00:00.000Z");
    await send(`/one/tasks/${before.id}`, { status: "done" }, "PATCH");
    assert.equal((await get("one")).tasks.length, 2);
    response = await send(
      `/one/tasks/${before.id}`,
      { status: "open" },
      "PATCH",
    );
    assert.equal(response.status, 409);
    await send(`/one/maintenance-plans/${plan}`, { active: false }, "PATCH");
    await send(
      `/one/tasks/${next.id}`,
      { status: "done", completedOn: "2024-04-01" },
      "PATCH",
    );
    assert.equal((await get("one")).tasks.length, 2);
    await send(
      `/one/people/${person}`,
      { name: "Bewoner Een", active: false },
      "PATCH",
    );
    await send(`/one/maintenance-plans/${plan}`, { active: true }, "PATCH");
    dossier = await get("one");
    assert.equal(dossier.tasks.length, 3);
    assert.equal(
      dossier.tasks.find((t) => t.status === "open").assigneeId,
      null,
    );
    const requestId = randomUUID(),
      body = () => {
        const f = new FormData();
        for (const [k, v] of Object.entries({
          requestId,
          kind: "note",
          title: "Meting bewaren",
          description: "Handmatig 42 procent",
          assetId: "one:inbox",
        }))
          f.set(k, v);
        return f;
      };
    const pair = await Promise.all([
      fetch(`${base}/one/entries`, { method: "POST", body: body() }),
      fetch(`${base}/one/entries`, { method: "POST", body: body() }),
    ]);
    assert.ok(pair.every((r) => r.ok));
    const results = await Promise.all(pair.map((r) => r.json()));
    assert.deepEqual(results[0], results[1]);
    assert.equal((await get("one")).attachments.length, 1);
    assert.equal((await readdir(path.join(directory, "uploads"))).length, 1);
    assert.equal((await get("two")).attachments.length, 0);
    assert.equal((await get("two")).people.length, 0);
    const changed = body();
    changed.set("description", "Other text with reused key");
    response = await fetch(`${base}/one/entries`, {
      method: "POST",
      body: changed,
    });
    assert.equal(response.status, 409);
    const invalid = new FormData();
    for (const [k, v] of Object.entries({
      requestId: randomUUID(),
      kind: "file",
      title: "No cross-house",
      assetId: "two:roof",
    }))
      invalid.set(k, v);
    invalid.set(
      "file",
      new Blob(["private"], { type: "text/plain" }),
      "proof.txt",
    );
    response = await fetch(`${base}/one/entries`, {
      method: "POST",
      body: invalid,
    });
    assert.equal(response.status, 404);
    assert.equal((await readdir(path.join(directory, "uploads"))).length, 1);
    assert.ok(store.management("one").activity.length > 0);
    const exported = await (await fetch(`${base}/one/export`)).json();
    assert.equal(exported.management.people[0].name, "Bewoner Een");
    assert.equal(exported.management.plans.length, 1);
    assert.ok(exported.management.activity.length > 0);
    assert.match(
      Buffer.from(exported.files[0].base64, "base64").toString("utf8"),
      /Handmatig 42 procent/,
    );
    const activeTask = (await get("one")).tasks.find(
      (t) => t.status === "open",
    );
    const edit = await send(
      `/one/maintenance-plans/${plan}`,
      {
        assetId: "one:facade",
        title: "Nieuwe afspraak",
        description: "Gewijzigde instructie",
        intervalMonths: 6,
        firstDate: "2027-01-31",
        assigneeId: null,
      },
      "PATCH",
    );
    assert.equal(edit.status, 200);
    const edited = (await get("one")).tasks.find((t) => t.id === activeTask.id);
    assert.equal(edited.date, "2027-01-31");
    assert.equal(edited.assetId, "one:facade");
    const reopened = createStore(directory, [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ]);
    try {
      assert.equal(
        reopened.management("one").plans[0].title,
        "Nieuwe afspraak",
      );
      assert.equal(reopened.people("one")[0].active, false);
      assert.equal(reopened.dossier("one").attachments.length, 1);
    } finally {
      reopened.close();
    }
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
