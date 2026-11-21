import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { informationForRoom, readableUnits } from "../src/information.ts";
import { informationSchema } from "../server/information.mjs";
import { readFloorplan, clientFloorplan } from "../server/floorplan.mjs";
import { createApp } from "../server/app.mjs";

const item = {
  id: "height",
  title: "Hoogte",
  value: "2,64 m",
  text: "Alleen deze ruimte heeft een bronmaat.",
  topic: "dimensions",
  status: "source",
  roomIds: ["living"],
  source: "Indicatieve testtekening",
};
const plan = {
  version: 1,
  label: "Test",
  source: "Original source",
  description: "Original description",
  ceilingHeight: 2.64,
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  ceiling: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ],
  spawn: [1, 1],
  rooms: [
    {
      id: "living",
      name: "Testkamer",
      polygon: [
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
      ],
      center: [2, 2],
      color: "#eeeeee",
    },
  ],
  walls: [],
  fixtures: [],
  information: [item],
};

test("room information prioritizes its own items and preserves shared limits without leaking other rooms", () => {
  const shared = { ...item, id: "accuracy", roomIds: undefined };
  const other = { ...item, id: "other", roomIds: ["kitchen"] };
  const records = [shared, other, item];
  assert.deepEqual(informationForRoom(records, "living"), [item, shared]);
  assert.deepEqual(informationForRoom(records, "kitchen"), [other, shared]);
  assert.deepEqual(records, [shared, other, item]);
});

test("readable sentences preserve decimals, dates and the full source content", () => {
  const text =
    "Hoogte 2,64 m en wanddikte 0.10 m. Bron van 20-11-2026. Niet ingemeten.";
  const units = readableUnits(text);
  assert.equal(units.join(" "), text);
  assert.ok(units.some((unit) => unit.includes("0.10 m")));
  assert.equal(units.length, 3);
});

test("structured information rejects duplicate identities and unsupported provenance labels", () => {
  assert.equal(informationSchema.safeParse([item, item]).success, false);
  assert.equal(
    informationSchema.safeParse([{ ...item, status: "verified" }]).success,
    false,
  );
  assert.equal(informationSchema.safeParse([item]).success, true);
});

test("profile API and export preserve structured facts, original sources and room references", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "huisdossier-information-"),
  );
  const folder = path.join(directory, "floorplans/test-house");
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "plan.json"), JSON.stringify(plan));
  const { app, store } = createApp({
    directory,
    houses: [{ id: "test-house", name: "Test" }],
    root: process.cwd(),
    modelDirectory: path.join(directory, "models"),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/houses/test-house`;
    const read = await readFloorplan(directory, "test-house");
    assert.deepEqual(read.information, [item]);
    assert.deepEqual(clientFloorplan(read, "test-house").information, [item]);
    const response = await fetch(base + "/floorplan");
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).information, [item]);
    const exported = await (await fetch(base + "/export")).json();
    assert.deepEqual(exported.floorplan.information, [item]);
    assert.equal(exported.floorplan.source, plan.source);
    assert.equal(exported.floorplan.description, plan.description);
    await writeFile(
      path.join(folder, "plan.json"),
      JSON.stringify({
        ...plan,
        information: [{ ...item, roomIds: ["missing"] }],
      }),
    );
    await assert.rejects(
      readFloorplan(directory, "test-house"),
      /onbekende ruimte/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.db.close();
    await rm(directory, { recursive: true, force: true });
  }
});
