import { test } from "node:test";
import assert from "node:assert/strict";
import { dossierAttention } from "../src/residentWorkflows.ts";
test("resident checks distinguish overdue dates, archived assignees, legacy owners and the unfiled inbox", () => {
  const dossier = {
    assets: [],
    people: [
      { id: "active", active: true },
      { id: "former", active: false },
    ],
    attachments: [
      { id: "unfiled", assetId: "one:inbox" },
      { id: "filed", assetId: "one:roof" },
    ],
    tasks: [
      { id: "late", status: "open", date: "2026-11-01", assigneeId: "active" },
      {
        id: "former",
        status: "open",
        date: "",
        assigneeId: "former",
        owner: "Old name",
      },
      { id: "legacy", status: "open", date: "", owner: "An external company" },
      { id: "unassigned", status: "open", date: "2026-12-01" },
      { id: "done", status: "done", date: "2020-01-01" },
    ],
  };
  const checks = dossierAttention(dossier, "2026-11-20");
  assert.deepEqual(
    checks.overdue.map((t) => t.id),
    ["late"],
  );
  assert.deepEqual(
    checks.unassigned.map((t) => t.id),
    ["former", "unassigned"],
  );
  assert.deepEqual(
    checks.inbox.map((f) => f.id),
    ["unfiled"],
  );
});
