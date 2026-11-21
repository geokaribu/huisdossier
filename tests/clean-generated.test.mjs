import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
  access,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { cleanGenerated } from "../scripts/clean-generated.mjs";

test("cleanup removes generated captures only, keeps the working installation and refuses links", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "huisdossier-clean-"));
  const root = path.join(parent, "workspace"),
    outside = path.join(parent, "outside");
  try {
    await mkdir(root);
    await mkdir(outside);
    for (const name of [
      "data",
      "node_modules",
      "dist",
      ".playwright-mcp",
      "test-results",
    ]) {
      await mkdir(path.join(root, name));
      await writeFile(path.join(root, name, "keep.txt"), "test");
    }
    await writeFile(path.join(root, "huisdossier-preview.png"), "capture");
    const preview = await cleanGenerated(root);
    assert.equal(preview.applied, false);
    assert.equal(preview.files, 3);
    await access(path.join(root, "huisdossier-preview.png"));
    const result = await cleanGenerated(root, { apply: true });
    assert.equal(result.bytes, 15);
    for (const name of ["data", "node_modules", "dist"])
      assert.equal(
        await readFile(path.join(root, name, "keep.txt"), "utf8"),
        "test",
      );
    await assert.rejects(access(path.join(root, "test-results")), {
      code: "ENOENT",
    });
    await writeFile(path.join(outside, "private.txt"), "preserve");
    await symlink(
      outside,
      path.join(root, ".playwright-mcp"),
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(cleanGenerated(root, { apply: true }), /koppelingen/);
    assert.equal(
      await readFile(path.join(outside, "private.txt"), "utf8"),
      "preserve",
    );
  } finally {
    // Both absolute paths were created under this unique test parent.
    await rm(parent, { recursive: true, force: true });
  }
});
