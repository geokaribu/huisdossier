import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHouseId,
  resolveHousePage,
  housePageUrl,
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
