import { test } from "node:test";
import assert from "node:assert/strict";
import { floorplanForView } from "../src/furnishings.ts";
import { canStand } from "../src/walkthrough.ts";
import { utilityNiche } from "../src/utilityNiche.ts";

test("unfurnished views retain the house, fixed fittings and stable IDs while clearing movable collisions", () => {
  const item = (id, kind, center, extra = {}) => ({
    id,
    kind,
    center,
    size: [0.8, 0.8],
    height: 0.8,
    ...extra,
  });
  const plan = {
    version: 1,
    label: "Synthetic house",
    source: "Test",
    description: "One shared plan",
    ceilingHeight: 2.6,
    outline: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    ceiling: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    spawn: [1, 1],
    walls: [],
    rooms: [
      {
        id: "living",
        name: "Living room",
        polygon: [
          [0, 0],
          [10, 0],
          [10, 10],
          [0, 10],
        ],
        center: [1, 1],
        color: "#eeeeee",
      },
    ],
    fixtures: [
      { kind: "toilet", center: [7, 7], size: [0.5, 0.7], height: 0.8 },
      { kind: "closet", center: [6, 2], size: [0.7, 1], height: 2 },
      {
        kind: "closet",
        center: [9, 5],
        size: [0.7, 1],
        height: 2,
        fixed: true,
      },
    ],
    decorations: [
      item("sofa", "sofa", [3, 3]),
      item("table", "patio-table", [4, 4]),
      item("fridge", "fridge", [5, 5]),
      item("cabinet", "kitchen-cabinet", [8, 8]),
      item("niche", "utility-niche", [9, 1], { height: 2.5 }),
      item("built-in-bench", "armchair", [8, 3], { fixed: true }),
      item("loose-shelf", "wall-shelf", [6, 6], { fixed: false }),
    ],
  };
  const snapshot = structuredClone(plan);
  const empty = floorplanForView(plan, "unfurnished");
  assert.deepEqual(plan, snapshot);
  assert.equal(floorplanForView(plan, "furnished"), plan);
  assert.equal(empty.rooms, plan.rooms);
  assert.equal(empty.walls, plan.walls);
  assert.deepEqual(empty.fixtures, [plan.fixtures[0], plan.fixtures[2]]);
  assert.equal(canStand(plan, [6, 2]), false);
  assert.equal(canStand(empty, [6, 2]), true);
  assert.equal(canStand(empty, [9, 5]), false);
  assert.deepEqual(
    empty.decorations.map((d) => d.id),
    ["cabinet", "niche", "built-in-bench"],
  );
  assert.equal(canStand(plan, [3, 3]), false);
  assert.equal(canStand(empty, [3, 3]), true);
  assert.equal(canStand(empty, [7, 7]), false);
  assert.equal(canStand(empty, [8, 8]), false);
  assert.equal(empty.decorations.find((d) => d.id === "niche").contents, false);
  const roles = (group) => {
    const names = [];
    group.traverse((o) => {
      if (o.userData.role) names.push(o.userData.role);
    });
    return names;
  };
  const furnished = utilityNiche(
    plan.decorations.find((d) => d.id === "niche"),
  );
  const unfurnished = utilityNiche(
    empty.decorations.find((d) => d.id === "niche"),
  );
  assert.ok(roles(furnished).includes("washing-machine"));
  assert.ok(roles(unfurnished).includes("stair-soffit"));
  assert.ok(roles(unfurnished).includes("utility-shelf"));
  assert.ok(
    !roles(unfurnished).some((r) => /washer|machine|appliance|storage/.test(r)),
  );
  for (const group of [furnished, unfurnished])
    group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
});
