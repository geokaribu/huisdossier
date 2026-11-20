import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../server/app.mjs";
import { createStore } from "../server/store.mjs";
import { maintenanceCalendar } from "../server/planning-routes.mjs";
import {
  planningGroups,
  reminderTasks,
  shiftDay,
  recordedCosts,
  parseCost,
} from "../src/planning.ts";

test("planning retains overdue snoozed and waiting work, including month/year and DST boundaries", () => {
  const tasks = [
    {
      id: "late",
      title: "Dak",
      status: "open",
      date: "2026-10-01",
      remindOn: "2026-11-23",
      assigneeId: "one",
    },
    {
      id: "today",
      title: "Ketel",
      status: "open",
      date: "2026-11-20",
      state: "hold",
      assigneeId: "one",
    },
    {
      id: "soon",
      title: "Goot",
      status: "open",
      date: "2026-11-27",
      remindOn: "2026-11-20",
    },
    { id: "later", title: "Rookmelder", status: "open", date: "2027-01-01" },
    { id: "unknown", title: "Kies datum", status: "open", date: "" },
    { id: "done", title: "Klaar", status: "done", date: "2026-01-01" },
  ];
  const groups = planningGroups(tasks, "2026-11-20");
  assert.deepEqual(
    groups.overdue.map((t) => t.id),
    ["late"],
  );
  assert.deepEqual(
    groups.soon.map((t) => t.id),
    ["today", "soon"],
  );
  assert.deepEqual(
    groups.later.map((t) => t.id),
    ["later"],
  );
  assert.deepEqual(
    groups.unscheduled.map((t) => t.id),
    ["unknown"],
  );
  assert.deepEqual(
    reminderTasks(tasks, "2026-11-20", 7).map((t) => t.id),
    ["today", "soon"],
  );
  assert.deepEqual(
    reminderTasks(tasks, "2026-11-23", 0, "one").map((t) => t.id),
    ["late", "today"],
  );
  assert.deepEqual(
    reminderTasks(tasks, "2026-11-20", 7, "unassigned").map((t) => t.id),
    ["soon"],
  );
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
  assert.equal(shiftDay("2028-02-28", 1), "2028-02-29");
  assert.equal(shiftDay("2026-03-28", 1), "2026-03-29");
});

test("actual costs distinguish unknown from free work and never count estimates or other years", () => {
  assert.equal(parseCost("125,50"), 12550);
  assert.equal(parseCost("0"), 0);
  assert.equal(parseCost(" "), null);
  assert.equal(parseCost("1.01"), 101);
  for (const value of ["-10", "1,001", "1.000,00", "NaN", "1000000,01", "1e3"])
    assert.throws(() => parseCost(value));
  assert.deepEqual(
    recordedCosts(
      [
        {
          status: "done",
          completedAt: "2026-03-01T12:00:00Z",
          costCents: 12550,
        },
        { status: "done", completedAt: "2026-03-01T12:00:00Z", costCents: 0 },
        { status: "done", completedAt: "2026-03-01T12:00:00Z" },
        { status: "open", completedAt: "2026-03-01T12:00:00Z", costCents: 999 },
        { status: "done", completedAt: "2025-03-01T12:00:00Z", costCents: 999 },
      ],
      "2026",
    ),
    { cents: 12550, known: 2, total: 3 },
  );
});

test("calendar is private, folded by UTF-8 byte length, injection-safe, all-day and stable per installation", () => {
  const task = {
    id: "task",
    title: "Dak, regen; € é 🏠 ".repeat(10) + "\nEND:VEVENT\nBEGIN:VEVENT",
    description: "Regel één\r\nregel twee\\drie",
    status: "open",
    date: "2028-02-29",
    assetId: "roof",
    assigneeId: "p",
  };
  const input = {
    house: { id: "house", name: "Ons huis", address: "Straat 1" },
    installationId: "installation",
    dossier: {
      assets: [{ id: "roof", name: "Dak" }],
      people: [{ id: "p", name: "Dakwerker" }],
      tasks: [
        task,
        { ...task, id: "done", status: "done" },
        { ...task, id: "no-date", date: "" },
      ],
    },
    alarmDays: 1,
    now: new Date("2026-11-20T12:30:00Z"),
  };
  const ics = maintenanceCalendar(input);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(!ics.replaceAll("\r\n", "").includes("\n"));
  assert.ok(!ics.includes("�"));
  const unfolded = ics.replace(/\r\n /g, "");
  assert.equal(unfolded.match(/^BEGIN:VEVENT$/gm)?.length, 1);
  assert.match(unfolded, /SUMMARY:Dak\\, regen\\; € é 🏠/);
  assert.match(unfolded, /\\nEND:VEVENT\\nBEGIN:VEVENT/);
  assert.match(
    unfolded,
    /DTSTART;VALUE=DATE:20280229\r\nDTEND;VALUE=DATE:20280301/,
  );
  assert.match(unfolded, /TRIGGER:-PT15H/);
  assert.match(unfolded, /CLASS:PRIVATE/);
  assert.ok(!unfolded.includes("ATTENDEE"));
  const uid = (text) => text.replace(/\r\n /g, "").match(/^UID:(.*)$/m)[1];
  assert.equal(
    uid(ics),
    uid(
      maintenanceCalendar({
        ...input,
        now: new Date("2027-01-01"),
        dossier: { ...input.dossier, tasks: [{ ...task, date: "2027-02-01" }] },
      }),
    ),
  );
  assert.notEqual(
    uid(ics),
    uid(maintenanceCalendar({ ...input, installationId: "other" })),
  );
  assert.ok(
    !maintenanceCalendar({ ...input, alarmDays: 0 }).includes("VALARM"),
  );
  assert.match(
    maintenanceCalendar({
      ...input,
      dossier: { ...input.dossier, tasks: [{ ...task, date: "9999-12-31" }] },
    }),
    /DURATION:P1D/,
  );
});

test("contacts, costs, snoozes and calendars persist with strict house boundaries and atomic contact creation", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huis-planning-"));
  const root = path.join(directory, "root"),
    houses = [
      { id: "one", name: "One" },
      { id: "two", name: "Two" },
    ];
  await mkdir(path.join(root, "public", "data"), { recursive: true });
  await writeFile(
    path.join(root, "public", "data", "one.json"),
    JSON.stringify({ house: { id: "one" }, buildings: [] }),
  );
  const { app, store } = createApp({ directory, root, houses });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/houses`;
  const send = (url, body, method = "POST") =>
    fetch(base + url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const get = async (url) => (await fetch(base + url)).json();
  const installation = store.installationId;
  let id, taskId;
  try {
    let response = await send("/one/assets/one:roof/contacts", {
      person: {
        name: "Dakteam",
        role: "professional",
        company: "Dakbedrijf",
        specialty: "Zink",
        email: "dak@example.org",
        phone: "+32 123",
        website: "https://example.org",
        notes: "Klantnummer 42",
      },
      label: "Dakwerker",
      notes: "Offerte gevraagd",
    });
    assert.equal(response.status, 201);
    id = (await response.json()).personId;
    let dossier = await get("/one/dossier");
    assert.equal(dossier.people[0].company, "Dakbedrijf");
    assert.equal(dossier.contactLinks[0].notes, "Offerte gevraagd");
    assert.equal((await get("/two/dossier")).contactLinks.length, 0);
    response = await send("/two/assets/two:roof/contacts", { personId: id });
    assert.equal(response.status, 400);
    response = await send("/one/assets/two:roof/contacts", {
      person: { name: "Should not exist" },
    });
    assert.equal(response.status, 404);
    assert.equal((await get("/one/dossier")).people.length, 1);
    response = await send("/one/assets/one:roof/contacts", {
      person: { name: "Dakteam" },
    });
    assert.equal(response.status, 409);
    for (const website of [
      "javascript:alert(1)",
      "file:///private",
      "ftp://example.org",
    ]) {
      response = await send("/one/people", { name: "Wrong", website });
      assert.equal(response.status, 400);
    }
    response = await send("/one/assets/one:roof/contacts", {
      personId: id,
      label: "Inspectie",
      notes: "Bel eerst",
    });
    assert.equal(response.status, 201);
    assert.equal((await get("/one/dossier")).contactLinks.length, 1);
    await send(
      `/one/people/${id}`,
      { name: "Dakteam", role: "professional", active: false },
      "PATCH",
    );
    dossier = await get("/one/dossier");
    assert.equal(dossier.people[0].website, "https://example.org");
    assert.equal(dossier.contactLinks.length, 1);
    response = await send("/one/assets/one:facade/contacts", { personId: id });
    assert.equal(response.status, 400);
    response = await send("/one/assets/one:roof/contacts", {
      personId: id,
      label: "Historisch contact",
    });
    assert.equal(response.status, 201);
    await send(
      `/one/people/${id}`,
      { name: "Dakteam", active: true, role: "professional" },
      "PATCH",
    );
    response = await send("/one/tasks", {
      title: "Dakinspectie",
      assetId: "one:roof",
      date: "2027-01-31",
      assigneeId: id,
    });
    taskId = (await response.json()).id;
    response = await send(
      `/one/tasks/${taskId}`,
      { remindOn: "2027-02-07" },
      "PATCH",
    );
    assert.equal(response.status, 200);
    let task = (await get("/one/dossier")).tasks[0];
    assert.equal(task.date, "2027-01-31");
    assert.equal(task.remindOn, "2027-02-07");
    for (const body of [
      { remindOn: "2027-02-30" },
      { costCents: -1 },
      { costCents: 1.5 },
      { costCents: 100000001 },
    ])
      assert.equal(
        (await send(`/one/tasks/${taskId}`, body, "PATCH")).status,
        400,
      );
    assert.equal(
      (await send(`/two/tasks/${taskId}`, { remindOn: null }, "PATCH")).status,
      404,
    );
    response = await fetch(`${base}/one/calendar.ics?assignee=${id}&alarm=7`);
    assert.equal(
      response.headers.get("content-type"),
      "text/calendar; charset=utf-8",
    );
    const ics = await response.text();
    assert.match(ics, /SUMMARY:Dakinspectie/);
    assert.match(ics, /DTSTART;VALUE=DATE:20270131/);
    assert.match(ics, /TRIGGER:-PT159H/);
    assert.equal(
      (await fetch(`${base}/two/calendar.ics?assignee=${id}`)).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/two/calendar.ics?task=${taskId}`)).status,
      404,
    );
    assert.equal(
      (await fetch(`${base}/one/calendar.ics?alarm=99`)).status,
      400,
    );
    assert.ok(
      !(
        await (
          await fetch(`${base}/one/calendar.ics?assignee=unassigned`)
        ).text()
      ).includes("BEGIN:VEVENT"),
    );
    response = await send(
      `/one/tasks/${taskId}`,
      {
        status: "done",
        completedOn: "2026-11-20",
        result: "Alles nagezien",
        costCents: 12550,
        remindOn: null,
      },
      "PATCH",
    );
    assert.equal(response.status, 200);
    assert.ok(
      !(await (await fetch(`${base}/one/calendar.ics`)).text()).includes(
        "BEGIN:VEVENT",
      ),
    );
    const exported = await get("/one/export");
    assert.equal(exported.dossier.contactLinks[0].personId, id);
    assert.equal(exported.dossier.tasks[0].costCents, 12550);
    const body = () => {
      const form = new FormData();
      for (const [key, value] of Object.entries({
        requestId: entryId,
        kind: "completed",
        title: "Gratis onderhoud",
        description: "Zelf gecontroleerd",
        date: "2026-11-20",
        assetId: "one:roof",
        costCents: "0",
      }))
        form.set(key, value);
      return form;
    };
    const entryId = crypto.randomUUID();
    response = await fetch(`${base}/one/entries`, {
      method: "POST",
      body: body(),
    });
    assert.equal(response.status, 201);
    const record = await response.json();
    response = await fetch(`${base}/one/entries`, {
      method: "POST",
      body: body(),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).taskId, record.taskId);
    assert.equal(
      (await get("/one/dossier")).tasks.find(
        (task) => task.id === record.taskId,
      ).costCents,
      0,
    );
    assert.equal(
      (await send(`/two/assets/one:roof/contacts/${id}`, undefined, "DELETE"))
        .status,
      404,
    );
    assert.equal(
      (await send(`/one/assets/one:roof/contacts/${id}`, undefined, "DELETE"))
        .status,
      200,
    );
    assert.equal((await get("/one/dossier")).people.length, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    store.close();
  }
  const reopened = createStore(directory, houses);
  try {
    assert.equal(reopened.installationId, installation);
    assert.equal(
      reopened.dossier("one").tasks.find((t) => t.id === taskId).costCents,
      12550,
    );
    assert.equal(
      reopened.dossier("one").people.find((p) => p.id === id).company,
      "Dakbedrijf",
    );
  } finally {
    reopened.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("version-three contact records survive the additive migration", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "huis-v3-"));
  const houses = [{ id: "one", name: "One", residents: ["Bewoner"] }];
  const original = createStore(directory, houses);
  const personId = original.addPerson("one", {
    name: "Bestaand contact",
    role: "professional",
    email: "test@example.org",
    phone: "123",
    active: true,
  });
  original.close();
  const db = new DatabaseSync(path.join(directory, "huisdossier.sqlite"));
  db.exec(
    "DROP TABLE asset_contacts; DROP TABLE installation; ALTER TABLE people DROP COLUMN details; DELETE FROM migrations WHERE version=4;",
  );
  db.close();
  const migrated = createStore(directory, houses);
  try {
    assert.equal(
      migrated.people("one").find((p) => p.id === personId).phone,
      "123",
    );
    assert.deepEqual(migrated.contactLinks("one"), []);
    assert.ok(migrated.installationId);
  } finally {
    migrated.close();
    await rm(directory, { recursive: true, force: true });
  }
});
