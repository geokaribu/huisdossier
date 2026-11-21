import test from "node:test";
import assert from "node:assert/strict";
import { latestHousePhoto } from "../src/housePhotos.ts";

const file = (id, category, type, createdAt, assetId = "house:kitchen") => ({
  id,
  category,
  type,
  createdAt,
  assetId,
  name: id,
  url: `/files/${id}`,
  size: 12,
});

test("home photos require an explicit choice, excluding scans and unsupported formats", () => {
  const chosen = file("chosen", "photos", "image/jpeg", "2026-11-01");
  const files = [
    chosen,
    file("bill", "finance", "image/png", "2026-11-21"),
    file("scan", undefined, "image/jpeg", "2026-11-22"),
    file("pdf", "photos", "application/pdf", "2026-11-23"),
    file("svg", "photos", "image/svg+xml", "2026-11-24"),
  ];
  assert.equal(latestHousePhoto(files), chosen);
  assert.equal(latestHousePhoto(files.slice(1)), undefined);
});

test("the newest chosen photo stays with its part without reordering the collection", () => {
  const kitchen = file("kitchen", "photos", "image/webp", "2026-11-20");
  const living = file(
    "living",
    "photos",
    "image/png",
    "2026-11-21",
    "house:living",
  );
  const files = [kitchen, living];
  assert.equal(latestHousePhoto(files), living);
  assert.equal(latestHousePhoto(files, "house:kitchen"), kitchen);
  assert.equal(latestHousePhoto(files, "other:room"), undefined);
  assert.deepEqual(files, [kitchen, living]);
});
