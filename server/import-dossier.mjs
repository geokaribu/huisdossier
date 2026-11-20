import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const key = z.string().trim().min(1).max(200);
const note = z.string().max(10000).default("");
const manifestSchema = z.object({
  assets: z
    .array(
      z.object({
        key,
        name: key,
        kind: z.enum([
          "gebouw",
          "dak",
          "gevel",
          "ruimte",
          "installatie",
          "overig",
        ]),
        description: note,
        roomId: key.nullable().optional(),
      }),
    )
    .default([]),
  documents: z
    .array(
      z.object({
        path: z.string().min(1),
        assetKey: z.string().max(200),
        title: key.optional(),
        category: z.string().max(100).optional(),
        summary: note,
        sourceDate: z.string().max(50).default(""),
        historical: z.boolean().default(false),
        text: z.string().optional(),
      }),
    )
    .default([]),
  tasks: z
    .array(
      z.object({
        key,
        assetKey: key,
        title: key,
        description: note,
        date: z
          .string()
          .refine(
            (value) =>
              value === "" ||
              (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
                !isNaN(Date.parse(value)) &&
                new Date(value).toISOString().slice(0, 10) === value),
            "Invalid date",
          )
          .default(""),
        status: z.enum(["open", "done"]).default("open"),
        state: z.enum(["active", "hold", "verify"]).default("active"),
        owner: z.string().max(200).default(""),
        sourcePath: z.string().optional(),
        sourceDate: z.string().max(50).default(""),
      }),
    )
    .default([]),
});

const hash = (value) => createHash("sha256").update(value).digest("hex");
const mime = (name) =>
  ({
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })[path.extname(name).toLowerCase()] ?? "application/octet-stream";

/** Trusted local import. Originals remain untouched; only private copies enter the app. */
export async function importDossier({
  store,
  directory,
  houseId,
  sourceKey,
  sourceRoot,
  manifest,
}) {
  if (!store.houseExists(houseId)) throw new Error("Unknown house");
  if (!sourceKey || !sourceRoot)
    throw new Error("sourceKey and sourceRoot required");
  manifest = manifestSchema.parse(manifest);
  const uploads = path.join(directory, "uploads");
  await mkdir(uploads, { recursive: true });
  const root = path.resolve(sourceRoot);
  const relative = (file) => {
    const resolved = path.resolve(root, file);
    const rel = path.relative(root, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel))
      throw new Error(`Source outside root: ${file}`);
    return rel.replaceAll("\\", "/");
  };
  const assetId = (key) => `${houseId}:${key}`;
  const recordId = (kind, key) =>
    `import-${hash(`${houseId}\0${sourceKey}\0${kind}\0${key}`).slice(0, 40)}`;
  const report = {
    added: 0,
    updated: 0,
    unchanged: 0,
    preserved: [],
    excluded: [],
    missing: [],
  };
  const items = [];
  for (const asset of manifest.assets ?? []) {
    items.push({
      table: "assets",
      kind: "asset",
      key: asset.key,
      id: assetId(asset.key),
      values: {
        house_id: houseId,
        name: asset.name,
        kind: asset.kind,
        description: asset.description ?? "",
        room_id: asset.roomId ?? null,
      },
    });
  }
  const documentIds = new Map();
  for (const doc of manifest.documents ?? []) {
    if (["archive", "index"].includes(doc.category)) {
      report.excluded.push(doc.path);
      continue;
    }
    const rel = relative(doc.path);
    const id = recordId("document", rel);
    let bytes;
    try {
      bytes = await readFile(path.resolve(root, rel));
    } catch (error) {
      if (error.code === "ENOENT") {
        report.missing.push(rel);
        continue;
      }
      throw error;
    }
    const checksum = hash(bytes);
    documentIds.set(rel, id);
    const stored = `import-${hash(houseId).slice(0, 12)}-${checksum}`;
    // Content-addressed private copy: reruns never overwrite an uploaded original.
    await writeFile(path.join(uploads, stored), bytes, { flag: "wx" }).catch(
      (e) => {
        if (e.code !== "EEXIST") throw e;
      },
    );
    const type = mime(rel);
    const text =
      doc.text ?? (type.startsWith("text/") ? bytes.toString("utf8") : "");
    items.push({
      table: "attachments",
      kind: "document",
      key: rel,
      id,
      values: {
        house_id: houseId,
        asset_id: assetId(doc.assetKey),
        name: doc.title
          ? `${doc.title}${path.extname(rel)}`
          : path.basename(rel),
        type,
        size: bytes.length,
        stored_name: stored,
        metadata: JSON.stringify({
          category: doc.category ?? "document",
          summary: doc.summary ?? "",
          source: rel,
          sourceDate: doc.sourceDate ?? "",
          historical: Boolean(doc.historical),
          checksum,
          sourceKey,
        }),
        text_content: text.slice(0, 2_000_000),
      },
    });
  }
  for (const task of manifest.tasks ?? []) {
    const rel = task.sourcePath ? relative(task.sourcePath) : "";
    items.push({
      table: "tasks",
      kind: "task",
      key: task.key,
      id: recordId("task", task.key),
      values: {
        house_id: houseId,
        asset_id: assetId(task.assetKey),
        title: task.title,
        description: task.description ?? "",
        date: task.date ?? "",
        status: task.status ?? "open",
        metadata: JSON.stringify({
          owner: task.owner ?? "",
          state: task.state ?? "active",
          source: rel,
          sourceDate: task.sourceDate ?? "",
          sourceId: documentIds.get(rel) ?? null,
          ...(task.status === "done" ? { completedAt: task.date ?? "" } : {}),
        }),
      },
    });
  }
  const db = store.db;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const item of items) {
      if (
        item.values.asset_id &&
        !db
          .prepare("SELECT id FROM assets WHERE id=? AND house_id=?")
          .get(item.values.asset_id, houseId)
      )
        throw new Error(
          `Unknown asset for ${item.key}: ${item.values.asset_id}`,
        );
      const current = db
        .prepare(`SELECT * FROM ${item.table} WHERE id=? AND house_id=?`)
        .get(item.id, houseId);
      const prior = db
        .prepare(
          "SELECT snapshot FROM imports WHERE house_id=? AND source_key=? AND kind=? AND item_key=?",
        )
        .get(houseId, sourceKey, item.kind, item.key);
      if (current && !prior) {
        // Existing user or seeded asset: leave it intact and link documents/tasks to it.
        report.preserved.push(item.key);
        continue;
      }
      const keys = Object.keys(item.values);
      if (current) {
        const snapshot = JSON.parse(prior.snapshot);
        const edited = Object.keys(snapshot).some(
          (key) => current[key] !== snapshot[key],
        );
        if (edited) {
          report.preserved.push(item.key);
          continue;
        }
        if (keys.every((key) => current[key] === item.values[key])) {
          report.unchanged++;
          continue;
        }
        db.prepare(
          `UPDATE ${item.table} SET ${keys.map((key) => `${key}=?`).join(",")} WHERE id=? AND house_id=?`,
        ).run(...Object.values(item.values), item.id, houseId);
        report.updated++;
      } else {
        const values = {
          id: item.id,
          ...item.values,
          ...(item.kind !== "asset"
            ? { created_at: new Date().toISOString() }
            : {}),
        };
        db.prepare(
          `INSERT INTO ${item.table} (${Object.keys(values).join(",")}) VALUES (${Object.keys(
            values,
          )
            .map(() => "?")
            .join(",")})`,
        ).run(...Object.values(values));
        report.added++;
      }
      db.prepare("INSERT OR REPLACE INTO imports VALUES(?,?,?,?,?,?)").run(
        houseId,
        sourceKey,
        item.key,
        item.kind,
        item.id,
        JSON.stringify(item.values),
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return report;
}
