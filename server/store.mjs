import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

export function createStore(directory, houses) {
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, "huisdossier.sqlite"));
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS houses (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assets (id TEXT PRIMARY KEY, house_id TEXT NOT NULL REFERENCES houses(id), name TEXT NOT NULL, kind TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', position TEXT);
    CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, house_id TEXT NOT NULL REFERENCES houses(id), asset_id TEXT NOT NULL REFERENCES assets(id), name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL, stored_name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, house_id TEXT NOT NULL REFERENCES houses(id), asset_id TEXT NOT NULL REFERENCES assets(id), title TEXT NOT NULL, description TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('open','done')), created_at TEXT NOT NULL);
    INSERT OR IGNORE INTO migrations VALUES (1);`);
  if (!db.prepare("SELECT 1 FROM migrations WHERE version=2").get()) {
    db.exec(`BEGIN;
      ALTER TABLE assets ADD COLUMN room_id TEXT;
      ALTER TABLE attachments ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE attachments ADD COLUMN text_content TEXT NOT NULL DEFAULT '';
      ALTER TABLE tasks ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}';
      CREATE TABLE imports (house_id TEXT NOT NULL, source_key TEXT NOT NULL, item_key TEXT NOT NULL, kind TEXT NOT NULL, record_id TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(house_id,source_key,kind,item_key));
      INSERT INTO migrations VALUES(2); COMMIT;`);
  }
  const seed = db.prepare("INSERT OR IGNORE INTO houses VALUES (?, ?)");
  for (const house of houses) {
    seed.run(house.id, house.name);
    const add = db.prepare(
      "INSERT OR IGNORE INTO assets (id,house_id,name,kind,description,position) VALUES (?, ?, ?, ?, ?, ?)",
    );
    add.run(
      `${house.id}:building`,
      house.id,
      "Het gebouw",
      "gebouw",
      "Het buitenmodel van deze woning uit open gebouwdata. Aanvullende afwerking en binnenindeling hebben eigen bronnen.",
      null,
    );
    add.run(
      `${house.id}:roof`,
      house.id,
      "Het dak",
      "dak",
      "Dakvlakken uit het gebouwmodel. Detailniveau, materiaal, toestand en onderhoud nog aan te vullen.",
      null,
    );
    add.run(
      `${house.id}:facade`,
      house.id,
      "De gevel",
      "gevel",
      "Gevelvlakken uit het gebouwmodel. Ramen en deuren zijn nog niet afzonderlijk gemodelleerd.",
      null,
    );
    for (const { slug, name, description } of house.starterAssets ?? [])
      add.run(
        `${house.id}:${slug}`,
        house.id,
        name,
        "installatie",
        description,
        null,
      );
  }
  const assetRow = (r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    description: r.description,
    roomId: r.room_id ?? null,
    position: r.position ? JSON.parse(r.position) : null,
    locationStatus: r.position
      ? "Aangewezen door bewoner"
      : "Nog niet geplaatst",
  });
  const attachmentRow = (r) => ({
    id: r.id,
    assetId: r.asset_id,
    name: r.name,
    type: r.type,
    size: r.size,
    createdAt: r.created_at,
    ...JSON.parse(r.metadata),
    readable: Boolean(r.text_content),
    url: `/api/houses/${r.house_id}/files/${r.id}`,
  });
  const taskRow = (r) => ({
    id: r.id,
    assetId: r.asset_id,
    title: r.title,
    description: r.description,
    date: r.date,
    status: r.status,
    createdAt: r.created_at,
    ...JSON.parse(r.metadata),
  });
  return {
    db,
    houseExists: (id) =>
      Boolean(db.prepare("SELECT id FROM houses WHERE id=?").get(id)),
    asset: (houseId, id) =>
      db
        .prepare("SELECT * FROM assets WHERE house_id=? AND id=?")
        .get(houseId, id),
    dossier(houseId) {
      return {
        assets: db
          .prepare("SELECT * FROM assets WHERE house_id=? ORDER BY rowid")
          .all(houseId)
          .map(assetRow),
        attachments: db
          .prepare(
            "SELECT * FROM attachments WHERE house_id=? ORDER BY created_at DESC",
          )
          .all(houseId)
          .map(attachmentRow),
        tasks: db
          .prepare(
            "SELECT * FROM tasks WHERE house_id=? ORDER BY CASE WHEN date='' THEN 1 ELSE 0 END, date, created_at DESC",
          )
          .all(houseId)
          .map(taskRow),
      };
    },
    addAsset(houseId, data) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO assets (id,house_id,name,kind,description,room_id) VALUES (?,?,?,?,?,?)",
      ).run(
        id,
        houseId,
        data.name,
        data.kind,
        data.description,
        data.roomId ?? null,
      );
      return id;
    },
    updateAsset(houseId, id, data) {
      db.prepare(
        "UPDATE assets SET name=?,description=?,position=?,room_id=CASE WHEN ?=1 THEN ? ELSE room_id END WHERE house_id=? AND id=?",
      ).run(
        data.name,
        data.description,
        data.position ? JSON.stringify(data.position) : null,
        data.roomId === undefined ? 0 : 1,
        data.roomId ?? null,
        houseId,
        id,
      );
    },
    addAttachment(houseId, assetId, file, textContent = "") {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO attachments (id,house_id,asset_id,name,type,size,stored_name,created_at,text_content) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        houseId,
        assetId,
        file.originalname,
        file.mimetype,
        file.size,
        file.filename,
        new Date().toISOString(),
        textContent,
      );
      return id;
    },
    file: (houseId, id) =>
      db
        .prepare("SELECT * FROM attachments WHERE house_id=? AND id=?")
        .get(houseId, id),
    allFiles: (houseId) =>
      db.prepare("SELECT * FROM attachments WHERE house_id=?").all(houseId),
    updateAttachment(houseId, id, data) {
      const file = db
        .prepare("SELECT * FROM attachments WHERE house_id=? AND id=?")
        .get(houseId, id);
      if (!file) return 0;
      const metadata = {
        ...JSON.parse(file.metadata),
        category: data.category,
        summary: data.summary,
      };
      return db
        .prepare(
          "UPDATE attachments SET asset_id=?,metadata=? WHERE house_id=? AND id=?",
        )
        .run(data.assetId, JSON.stringify(metadata), houseId, id).changes;
    },
    searchFiles(houseId, query) {
      const needle = query.trim().toLocaleLowerCase("nl-NL");
      const terms = needle.split(/\s+/);
      // A small local dossier: normalize in JS for Unicode accents/case, keep text out of list responses.
      return db
        .prepare(
          "SELECT a.*,s.name AS asset_name FROM attachments a JOIN assets s ON a.asset_id=s.id WHERE a.house_id=?",
        )
        .all(houseId)
        .flatMap((r) => {
          const meta = JSON.parse(r.metadata);
          const haystack = `${r.name}\n${r.asset_name}\n${meta.category ?? ""}\n${meta.summary ?? ""}\n${r.text_content}`;
          const normalized = haystack.toLocaleLowerCase("nl-NL");
          const index = normalized.indexOf(terms[0]);
          return !terms.every((term) => normalized.includes(term))
            ? []
            : [
                {
                  id: r.id,
                  snippet: haystack
                    .slice(Math.max(0, index - 65), index + needle.length + 155)
                    .replace(/\s+/g, " "),
                },
              ];
        });
    },
    addTask(houseId, data) {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO tasks (id,house_id,asset_id,title,description,date,status,created_at,metadata) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        houseId,
        data.assetId,
        data.title,
        data.description,
        data.date,
        "open",
        new Date().toISOString(),
        JSON.stringify({
          owner: data.owner ?? "",
          state: data.state ?? "active",
        }),
      );
      return id;
    },
    updateTask(houseId, id, data) {
      const current = db
        .prepare("SELECT * FROM tasks WHERE house_id=? AND id=?")
        .get(houseId, id);
      if (!current) return 0;
      const meta = JSON.parse(current.metadata);
      if (data.status === "done" && current.status !== "done")
        meta.completedAt = new Date().toISOString();
      if (data.status === "open" && current.status !== "open")
        delete meta.completedAt;
      for (const field of ["owner", "state"])
        if (data[field] !== undefined) meta[field] = data[field];
      return db
        .prepare(
          "UPDATE tasks SET asset_id=?,title=?,description=?,date=?,status=?,metadata=? WHERE house_id=? AND id=?",
        )
        .run(
          data.assetId ?? current.asset_id,
          data.title ?? current.title,
          data.description ?? current.description,
          data.date ?? current.date,
          data.status ?? current.status,
          JSON.stringify(meta),
          houseId,
          id,
        ).changes;
    },
    close() {
      db.close();
    },
  };
}
