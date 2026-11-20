import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHouseId,
  resolveHousePage,
  housePageUrl,
  readWorkspaceSelection,
  workspaceSelectionUrl,
} from "../src/houseSelection.ts";
test("house links restore the requested house and page independently of remembered selection, and reject unknown IDs", () => {
  const houses = [{ id: "first" }, { id: "second" }],
    url = "http://127.0.0.1:4173/";
  assert.equal(resolveHouseId(houses, url, "second"), "second");
  assert.equal(resolveHouseId(houses, url + "?house=first", "second"), "first");
  assert.equal(
    resolveHouseId(houses, url + "?house=missing", "second"),
    "first",
  );
  assert.equal(resolveHouseId([], url, null), "");
  assert.equal(resolveHousePage(url + "?house=second&page=model"), "model");
  assert.equal(resolveHousePage(url + "?page=unrecognised"), "dossier");
  const next = housePageUrl(url + "?filter=keep#anchor", "second", "files");
  assert.equal(next, "/?filter=keep&house=second&page=files#anchor");
  assert.equal(resolveHouseId(houses, new URL(next, url).href, null), "second");
});
test("workspace links preserve a resident's selected part and filters while rejecting another house's component IDs", () => {
  const base = "http://127.0.0.1:4173/?house=first&page=tasks",
    assets = [{ id: "first:roof" }];
  const state = {
    part: "first:roof",
    scope: "first:roof",
    category: "",
    query: "dak & goot",
    status: "hold",
  };
  const link = new URL(
    workspaceSelectionUrl(base, "first", "tasks", state),
    base,
  ).href;
  assert.deepEqual(readWorkspaceSelection(link, assets), state);
  const other = readWorkspaceSelection(link, [{ id: "second:roof" }]);
  assert.equal(other.part, "");
  assert.equal(other.scope, "");
  assert.equal(
    readWorkspaceSelection(base + "&status=unknown", assets).status,
    "open",
  );
  const source = new URL(
    workspaceSelectionUrl(link, "first", "sources", state),
    base,
  );
  assert.equal(source.searchParams.has("q"), false);
  assert.equal(source.searchParams.has("scope"), false);
});
