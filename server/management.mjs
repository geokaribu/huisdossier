import { randomUUID } from "node:crypto";

export function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
export const calendarToday = (now = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
export function nextMaintenanceDate(anchor, months, after) {
  const [year, month, day] = anchor.split("-").map(Number);
  if (!Number.isInteger(months) || months < 1 || months > 120)
    throw problem("Kies een interval van 1 tot 120 maanden.");
  for (let n = 1; n < 2400; n++) {
    const first = new Date(Date.UTC(year, month - 1 + n * months, 1));
    const last = new Date(
      Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const value = new Date(
      Date.UTC(
        first.getUTCFullYear(),
        first.getUTCMonth(),
        Math.min(day, last),
      ),
    )
      .toISOString()
      .slice(0, 10);
    if (value > after) return value;
  }
  throw problem("De volgende onderhoudsdatum kon niet worden berekend.");
}

export function createManagement(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY, house_id TEXT NOT NULL REFERENCES houses(id), name TEXT NOT NULL, normalized_name TEXT NOT NULL,
    role TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(house_id,normalized_name));
    CREATE TABLE IF NOT EXISTS maintenance_plans (
    id TEXT PRIMARY KEY,house_id TEXT NOT NULL REFERENCES houses(id),asset_id TEXT NOT NULL REFERENCES assets(id),title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',interval_months INTEGER NOT NULL,anchor_date TEXT NOT NULL,next_date TEXT NOT NULL,
    assignee_id TEXT,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS activity (
    id TEXT PRIMARY KEY,house_id TEXT NOT NULL REFERENCES houses(id),kind TEXT NOT NULL,record_id TEXT NOT NULL,
    label TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS entries (
    house_id TEXT NOT NULL REFERENCES houses(id),request_id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(house_id,request_id));
    INSERT OR IGNORE INTO migrations VALUES(3);`);
  const personRow = (r) => ({
    id: r.id,
    name: r.name,
    role: r.role,
    email: r.email,
    phone: r.phone,
    active: Boolean(r.active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  const planRow = (r) => ({
    id: r.id,
    assetId: r.asset_id,
    title: r.title,
    description: r.description,
    intervalMonths: r.interval_months,
    anchorDate: r.anchor_date,
    nextDate: r.next_date,
    assigneeId: r.assignee_id,
    active: Boolean(r.active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });
  const person = (house, id) =>
    id
      ? db
          .prepare("SELECT * FROM people WHERE house_id=? AND id=?")
          .get(house, id)
      : null;
  const validatePerson = (house, id, allowInactive = false) => {
    if (!id) return null;
    const found = person(house, id);
    if (!found || (!allowInactive && !found.active))
      throw problem("Kies een actieve persoon van deze woning.");
    return found;
  };
  const activity = (house, kind, id, label) =>
    db
      .prepare("INSERT INTO activity VALUES(?,?,?,?,?,?)")
      .run(randomUUID(), house, kind, id, label, new Date().toISOString());
  const transaction = (work) => {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };
  const people = (house) =>
    db
      .prepare(
        "SELECT * FROM people WHERE house_id=? ORDER BY active DESC,created_at,id",
      )
      .all(house)
      .map(personRow);
  const normalize = (name) =>
    name
      .normalize("NFKC")
      .toLocaleLowerCase("nl-NL")
      .replace(/\s+/g, " ")
      .trim();
  const pending = (house, planId) =>
    db
      .prepare(
        "SELECT * FROM tasks WHERE house_id=? AND status='open' AND json_extract(metadata,'$.planId')=?",
      )
      .get(house, planId);
  const issue = (plan) => {
    if (!plan.active || pending(plan.house_id, plan.id)) return;
    const id = randomUUID(),
      owner = person(plan.house_id, plan.assignee_id);
    db.prepare(
      "INSERT INTO tasks(id,house_id,asset_id,title,description,date,status,created_at,metadata) VALUES(?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      plan.house_id,
      plan.asset_id,
      plan.title,
      plan.description,
      plan.next_date,
      "open",
      new Date().toISOString(),
      JSON.stringify({
        owner: owner?.active ? owner.name : "",
        assigneeId: owner?.active ? owner.id : null,
        state: "active",
        planId: plan.id,
      }),
    );
    activity(plan.house_id, "task", id, `Onderhoud klaargezet: ${plan.title}`);
  };
  return {
    people,
    person,
    validatePerson,
    activity,
    transaction,
    management(house) {
      return {
        people: people(house),
        plans: db
          .prepare(
            "SELECT * FROM maintenance_plans WHERE house_id=? ORDER BY active DESC,next_date",
          )
          .all(house)
          .map(planRow),
        activity: db
          .prepare(
            "SELECT id,kind,record_id AS recordId,label,created_at AS createdAt FROM activity WHERE house_id=? ORDER BY rowid DESC LIMIT 40",
          )
          .all(house),
      };
    },
    addPerson(house, data) {
      return transaction(() => {
        if (
          db
            .prepare(
              "SELECT 1 FROM people WHERE house_id=? AND normalized_name=?",
            )
            .get(house, normalize(data.name))
        )
          throw problem(
            "Deze naam staat al bij deze woning. Bewerk of activeer de bestaande persoon.",
            409,
          );
        const id = randomUUID(),
          now = new Date().toISOString();
        db.prepare("INSERT INTO people VALUES(?,?,?,?,?,?,?,?,?,?)").run(
          id,
          house,
          data.name,
          normalize(data.name),
          data.role,
          data.email,
          data.phone,
          Number(data.active ?? true),
          now,
          now,
        );
        activity(house, "person", id, `Persoon toegevoegd: ${data.name}`);
        return id;
      });
    },
    updatePerson(house, id, data) {
      return transaction(() => {
        const current = person(house, id);
        if (!current) throw problem("Persoon niet gevonden.", 404);
        const collision = db
          .prepare(
            "SELECT id FROM people WHERE house_id=? AND normalized_name=? AND id<>?",
          )
          .get(house, normalize(data.name), id);
        if (collision)
          throw problem("Deze naam staat al bij deze woning.", 409);
        db.prepare(
          "UPDATE people SET name=?,normalized_name=?,role=?,email=?,phone=?,active=?,updated_at=? WHERE house_id=? AND id=?",
        ).run(
          data.name,
          normalize(data.name),
          data.role,
          data.email,
          data.phone,
          Number(data.active),
          new Date().toISOString(),
          house,
          id,
        );
        activity(
          house,
          "person",
          id,
          `${data.active ? "Persoon bijgewerkt" : "Persoon gearchiveerd"}: ${data.name}`,
        );
      });
    },
    addPlan(house, data) {
      return transaction(() => {
        validatePerson(house, data.assigneeId);
        const id = randomUUID(),
          now = new Date().toISOString();
        db.prepare(
          "INSERT INTO maintenance_plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          house,
          data.assetId,
          data.title,
          data.description,
          data.intervalMonths,
          data.firstDate,
          data.firstDate,
          data.assigneeId || null,
          1,
          now,
          now,
        );
        const plan = db
          .prepare("SELECT * FROM maintenance_plans WHERE id=?")
          .get(id);
        issue(plan);
        activity(
          house,
          "plan",
          id,
          `Onderhoudsafspraak toegevoegd: ${data.title}`,
        );
        return id;
      });
    },
    setPlanActive(house, id, active) {
      return transaction(() => {
        const plan = db
          .prepare("SELECT * FROM maintenance_plans WHERE house_id=? AND id=?")
          .get(house, id);
        if (!plan) throw problem("Onderhoudsafspraak niet gevonden.", 404);
        db.prepare(
          "UPDATE maintenance_plans SET active=?,updated_at=? WHERE house_id=? AND id=?",
        ).run(Number(active), new Date().toISOString(), house, id);
        if (active) issue({ ...plan, active: 1 });
        activity(
          house,
          "plan",
          id,
          `${active ? "Onderhoudsafspraak hervat" : "Onderhoudsafspraak gepauzeerd"}: ${plan.title}`,
        );
      });
    },
    updatePlan(house, id, data) {
      return transaction(() => {
        const plan = db
          .prepare("SELECT * FROM maintenance_plans WHERE house_id=? AND id=?")
          .get(house, id);
        if (!plan) throw problem("Onderhoudsafspraak niet gevonden.", 404);
        const owner = validatePerson(
          house,
          data.assigneeId,
          data.assigneeId === plan.assignee_id,
        );
        const anchor =
          data.firstDate === plan.next_date &&
          data.intervalMonths === plan.interval_months
            ? plan.anchor_date
            : data.firstDate;
        const updated = {
          ...plan,
          title: data.title,
          description: data.description,
          asset_id: data.assetId,
          interval_months: data.intervalMonths,
          anchor_date: anchor,
          next_date: data.firstDate,
          assignee_id: owner?.id ?? null,
        };
        db.prepare(
          "UPDATE maintenance_plans SET title=?,description=?,asset_id=?,interval_months=?,anchor_date=?,next_date=?,assignee_id=?,updated_at=? WHERE house_id=? AND id=?",
        ).run(
          updated.title,
          updated.description,
          updated.asset_id,
          updated.interval_months,
          updated.anchor_date,
          updated.next_date,
          updated.assignee_id,
          new Date().toISOString(),
          house,
          id,
        );
        const open = pending(house, id);
        if (open) {
          const meta = JSON.parse(open.metadata);
          db.prepare(
            "UPDATE tasks SET title=?,description=?,asset_id=?,date=?,metadata=? WHERE house_id=? AND id=?",
          ).run(
            updated.title,
            updated.description,
            updated.asset_id,
            updated.next_date,
            JSON.stringify({
              ...meta,
              owner: owner?.name ?? "",
              assigneeId: owner?.id ?? null,
            }),
            house,
            open.id,
          );
        } else issue(updated);
        activity(
          house,
          "plan",
          id,
          `Onderhoudsafspraak bijgewerkt: ${data.title}`,
        );
      });
    },
    taskPersonMetadata(house, data, current = {}) {
      if (data.assigneeId === undefined)
        return data.owner === undefined ? data : { ...data, assigneeId: null };
      const found = validatePerson(
        house,
        data.assigneeId,
        data.assigneeId === current.assigneeId,
      );
      return {
        ...data,
        owner: found?.name ?? data.owner ?? "",
        assigneeId: found?.id ?? null,
      };
    },
    completedPlan(house, task, after) {
      const meta = JSON.parse(task.metadata);
      if (!meta.planId) return;
      const plan = db
        .prepare("SELECT * FROM maintenance_plans WHERE house_id=? AND id=?")
        .get(house, meta.planId);
      if (!plan) return;
      const next = nextMaintenanceDate(
        plan.anchor_date,
        plan.interval_months,
        after > task.date ? after : task.date,
      );
      db.prepare(
        "UPDATE maintenance_plans SET next_date=?,updated_at=? WHERE house_id=? AND id=?",
      ).run(next, new Date().toISOString(), house, plan.id);
      issue({ ...plan, next_date: next });
    },
    assertReopen(house, task) {
      const meta = JSON.parse(task.metadata);
      if (meta.planId && pending(house, meta.planId))
        throw problem(
          "De volgende onderhoudsbeurt staat al open. Werk die bij om dubbele beurten te voorkomen.",
          409,
        );
    },
    entry(house, key, fingerprint) {
      const row = db
        .prepare("SELECT result FROM entries WHERE house_id=? AND request_id=?")
        .get(house, key);
      if (!row) return null;
      const stored = JSON.parse(row.result);
      if (
        stored.fingerprint &&
        fingerprint &&
        stored.fingerprint !== fingerprint
      )
        throw problem(
          "Deze opslagpoging hoort bij andere invoer. Pas het concept aan en probeer opnieuw.",
          409,
        );
      return stored.result ?? stored;
    },
    rememberEntry(house, key, result, fingerprint) {
      db.prepare("INSERT INTO entries VALUES(?,?,?)").run(
        house,
        key,
        JSON.stringify({ result, fingerprint }),
      );
    },
  };
}
