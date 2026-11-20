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
  const seed = db.prepare("INSERT OR IGNORE INTO houses VALUES (?, ?)");
  for (const house of houses) {
    seed.run(house.id, house.name);
    const add = db.prepare(
      "INSERT OR IGNORE INTO assets VALUES (?, ?, ?, ?, ?, ?)",
    );
    add.run(
      `${house.id}:building`,
      house.id,
      "Het gebouw",
      "gebouw",
      "De gereconstrueerde buitenzijde uit 3DBAG. De indeling binnen is nog niet vastgelegd.",
      null,
    );
    add.run(
      `${house.id}:roof`,
      house.id,
      "Het dak",
      "dak",
      "Dakvlakken uit het 3DBAG-model. Materiaal, toestand en onderhoud nog aan te vullen.",
      null,
    );
    add.run(
      `${house.id}:facade`,
      house.id,
      "De gevel",
      "gevel",
      "Gevelvlakken uit het 3DBAG-model. Ramen en deuren zijn nog niet afzonderlijk gemodelleerd.",
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
            "SELECT * FROM tasks WHERE house_id=? ORDER BY date, created_at DESC",
          )
          .all(houseId)
          .map(taskRow),
      };
    },
    addAsset(houseId, data) {
      const id = randomUUID();
      db.prepare("INSERT INTO assets VALUES (?,?,?,?,?,NULL)").run(
        id,
        houseId,
        data.name,
        data.kind,
        data.description,
      );
      return id;
    },
    updateAsset(houseId, id, data) {
      db.prepare(
        "UPDATE assets SET name=?,description=?,position=? WHERE house_id=? AND id=?",
      ).run(
        data.name,
        data.description,
        data.position ? JSON.stringify(data.position) : null,
        houseId,
        id,
      );
    },
    addAttachment(houseId, assetId, file) {
      const id = randomUUID();
      db.prepare("INSERT INTO attachments VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        houseId,
        assetId,
        file.originalname,
        file.mimetype,
        file.size,
        file.filename,
        new Date().toISOString(),
      );
      return id;
    },
    file: (houseId, id) =>
      db
        .prepare("SELECT * FROM attachments WHERE house_id=? AND id=?")
        .get(houseId, id),
    allFiles: (houseId) =>
      db.prepare("SELECT * FROM attachments WHERE house_id=?").all(houseId),
    addTask(houseId, data) {
      const id = randomUUID();
      db.prepare("INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        houseId,
        data.assetId,
        data.title,
        data.description,
        data.date,
        "open",
        new Date().toISOString(),
      );
      return id;
    },
    setTask(houseId, id, status) {
      return db
        .prepare("UPDATE tasks SET status=? WHERE house_id=? AND id=?")
        .run(status, houseId, id).changes;
    },
    close() {
      db.close();
    },
  };
}
