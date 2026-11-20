import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/app.mjs";
import { canStand, moveInside } from "../src/walkthrough.ts";
import { projectAerial } from "../src/appearance.ts";
import * as THREE from "three";

const plan = {
  version: 1,
  label: "Test floor",
  source: "Synthetic fixture",
  description: "Two rooms and an open door",
  ceilingHeight: 2.64,
  outline: [
    [0, 0],
    [6, 0],
    [6, 5],
    [0, 5],
  ],
  ceiling: [
    [0, 0],
    [6, 0],
    [6, 5],
    [0, 5],
  ],
  spawn: [1, 2.5],
  rooms: [],
  fixtures: [],
  walls: [
    {
      a: [3, 0],
      b: [3, 5],
      thickness: 0.12,
      openings: [
        {
          offset: 2,
          width: 1,
          sill: 0,
          height: 2.1,
          kind: "door",
          frameColor: "#eee9df",
        },
      ],
    },
  ],
};

test("walking passes through doorways, slides along walls and cannot tunnel through them", () => {
  assert.deepEqual(
    moveInside(plan, [1, 2.5], [4, 0]).map((n) => +n.toFixed(3)),
    [5, 2.5],
  );
  const stopped = moveInside(plan, [1, 1], [4, 0]);
  assert.ok(stopped[0] < 2.79 && stopped[0] > 2.7);
  const slide = moveInside(plan, [2.7, 0.5], [1, 1]);
  assert.ok(slide[0] < 2.79 && slide[1] > 1.49);
  assert.equal(canStand(plan, [3, 1]), false);
  assert.equal(canStand(plan, [3, 2.5]), true);
  assert.equal(canStand(plan, [0.05, 2]), false);
  assert.ok(moveInside(plan, [1, 2.5], [-50, 0])[0] > 0.15);
  const withWindow = {
    ...plan,
    walls: [
      {
        ...plan.walls[0],
        openings: [
          { offset: 2, width: 1, sill: 0.8, height: 1.4, kind: "window" },
        ],
      },
    ],
  };
  assert.equal(canStand(withWindow, [3, 2.5]), false);
});

test("roof orthophoto projection keeps north at image-top in RD coordinates", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([0, 0, 0, 10, 0, -20, 5, 7, -10], 3),
  );
  projectAerial(geometry, { bbox: [100, 200, 110, 220] }, [100, 200, 0]);
  assert.deepEqual(
    [...geometry.getAttribute("uv").array],
    [0, 0, 1, 1, 0.5, 0.5],
  );
  geometry.dispose();
});

const joinery = {
  id: "patio",
  label: "Terrasdeuren",
  fixedLeft: 0.2,
  insideColor: "#f0eee5",
  outsideColor: "#526371",
  openAngle: 90,
  defaultOpen: true,
};

test("glazed doors block when closed; fixed glass and outward-open leaves remain solid", () => {
  const patio = {
    ...plan,
    walls: [
      {
        ...plan.walls[0],
        openings: [{ ...plan.walls[0].openings[0], joinery }],
      },
    ],
  };
  assert.equal(canStand(patio, [3, 2.5]), true);
  assert.equal(canStand(patio, [3, 2.5], 0.16, { patio: false }), false);
  assert.equal(canStand(patio, [3, 2.08]), false);
  assert.equal(canStand(patio, [3.3, 2.2]), false);
  assert.equal(canStand(patio, [3.3, 3]), false);
  assert.ok(moveInside(patio, [1, 2.5], [4, 0], { patio: false })[0] < 2.8);
  assert.ok(moveInside(patio, [1, 2.5], [4, 0], { patio: true })[0] > 4.9);
});

test("terrace furniture uses its rotated footprint and decorative pots do not block walking", () => {
  const furnished = {
    ...plan,
    walls: [],
    decorations: [
      {
        id: "chair",
        kind: "patio-chair",
        center: [4, 2.5],
        size: [0.5, 1],
        height: 1,
        rotation: Math.PI / 2,
      },
    ],
  };
  assert.equal(canStand(furnished, [4.4, 2.5]), false);
  assert.equal(canStand(furnished, [4, 3]), true);
  const decorative = {
    ...furnished,
    decorations: [{ ...furnished.decorations[0], solid: false }],
  };
  assert.equal(canStand(decorative, [4, 2.5]), true);
});

test("private floor plans remain isolated per house and are retained in a dossier export", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huisdossier-interior-"));
  const folder = path.join(directory, "floorplans", "koekoekstraat-17");
  await mkdir(folder, { recursive: true });
  const savedPlan = {
    ...plan,
    rooms: [
      {
        id: "entry",
        name: "Entry",
        polygon: plan.outline,
        center: [1, 1],
        color: "#eeeeee",
        floorColor: "#eee9df",
        viewFov: 100,
      },
    ],
    walls: [
      {
        ...plan.walls[0],
        finish: { color: "#eeeecc", texture: "stucco" },
        coatings: [
          {
            side: "positive",
            from: 0,
            to: 5,
            color: "#eee9df",
            lower: { color: "#a04e36", height: 1.18, railColor: "#89432f" },
          },
        ],
        climber: { top: 2, coverage: 0.8, trellis: true },
        openings: [{ ...plan.walls[0].openings[0], joinery }],
      },
    ],
    decorations: [
      {
        id: "table",
        kind: "patio-table",
        center: [5, 4],
        size: [0.8, 0.8],
        height: 0.7,
        solid: true,
      },
      {
        id: "utility",
        kind: "utility-niche",
        center: [5, 1],
        size: [1.5, 0.6],
        height: 2.5,
        rotation: -Math.PI / 2,
        solid: true,
      },
    ],
  };
  await writeFile(path.join(folder, "plan.json"), JSON.stringify(savedPlan));
  const { app, store } = createApp({
    directory,
    houses: [
      { id: "koekoekstraat-17", name: "Test" },
      { id: "other", name: "Other" },
    ],
    root: fileURLToPath(new URL("../", import.meta.url)),
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  try {
    const response = await fetch(`${base}/koekoekstraat-17/floorplan`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), savedPlan);
    assert.equal(await (await fetch(`${base}/other/floorplan`)).json(), null);
    assert.equal((await fetch(`${base}/missing/floorplan`)).status, 404);
    assert.equal(
      (await fetch(`${base}/koekoekstraat-17/floorplan/plan.json`)).status,
      404,
    );
    const exported = await (
      await fetch(`${base}/koekoekstraat-17/export`)
    ).json();
    assert.deepEqual(exported.floorplan, savedPlan);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
