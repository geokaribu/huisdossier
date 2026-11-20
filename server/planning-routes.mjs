import { createHash } from "node:crypto";
import { z } from "zod";
import { personSchema } from "./management-routes.mjs";
import { problem } from "./management.mjs";

// RFC 5545 TEXT escaping and content lines. Fold on code points, never UTF-8 bytes.
export const calendarText = (value) =>
  String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
export function foldCalendarLine(line) {
  let result = "",
    current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char, "utf8") > 75) {
      result += current + "\r\n";
      current = " ";
    }
    current += char;
  }
  return result + current;
}
const nextDay = (date) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10).replaceAll("-", "");
};
export function maintenanceCalendar({
  house,
  dossier,
  installationId,
  alarmDays = 0,
  now = new Date(),
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Geokari//Huisdossier//NL",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${calendarText(`${house.name} · onderhoud`)}`,
  ];
  for (const task of dossier.tasks.filter(
    (task) => task.status === "open" && task.date,
  )) {
    const asset = dossier.assets.find((asset) => asset.id === task.assetId);
    const person = dossier.people?.find(
      (person) => person.id === task.assigneeId,
    );
    const description = [
      task.description,
      `Onderdeel: ${asset?.name ?? "Onbekend"}`,
      `Verantwoordelijke: ${person?.name ?? task.owner ?? "Niet gekozen"}`,
      task.state === "hold"
        ? "Status: wacht op"
        : task.state === "verify"
          ? "Status: controleren"
          : "Status: open",
      "Dit is een momentopname uit Huisdossier. Wijzigingen en afrondingen worden niet automatisch overgenomen.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const uid = createHash("sha256")
      .update(`${installationId}/${house.id}/${task.id}`)
      .digest("hex");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@huisdossier.local`,
      `DTSTAMP:${now.toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
      `DTSTART;VALUE=DATE:${task.date.replaceAll("-", "")}`,
      task.date === "9999-12-31"
        ? "DURATION:P1D"
        : `DTEND;VALUE=DATE:${nextDay(task.date)}`,
      `SUMMARY:${calendarText(task.title)}`,
      `DESCRIPTION:${calendarText(description)}`,
      `LOCATION:${calendarText([house.address, house.city, asset?.name].filter(Boolean).join(" · "))}`,
      "CLASS:PRIVATE",
      "TRANSP:TRANSPARENT",
    );
    if (alarmDays)
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `TRIGGER:-PT${alarmDays * 24 - 9}H`,
        `DESCRIPTION:${calendarText(task.title)}`,
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldCalendarLine).join("\r\n") + "\r\n";
}

export function planningRoutes(app, { store, houses }) {
  const linkSchema = z
    .object({
      personId: z.string().min(1).max(200).optional(),
      person: personSchema.optional(),
      label: z.string().trim().max(200).default(""),
      notes: z.string().trim().max(5000).default(""),
    })
    .refine(
      (data) => Boolean(data.personId) !== Boolean(data.person),
      "Kies een bestaande of nieuwe persoon.",
    );
  app.post("/api/houses/:houseId/assets/:assetId/contacts", (req, res) => {
    const personId = store.saveContactLink(
      req.params.houseId,
      req.params.assetId,
      linkSchema.parse(req.body),
    );
    res.status(201).json({ personId });
  });
  app.delete(
    "/api/houses/:houseId/assets/:assetId/contacts/:personId",
    (req, res) => {
      store.removeContactLink(
        req.params.houseId,
        req.params.assetId,
        req.params.personId,
      );
      res.json({ ok: true });
    },
  );
  app.get("/api/houses/:houseId/calendar.ics", (req, res) => {
    const query = z
      .object({
        assignee: z.string().max(200).optional(),
        task: z.string().max(200).optional(),
        alarm: z.enum(["0", "1", "7"]).default("0"),
      })
      .parse(req.query);
    const dossier = store.dossier(req.params.houseId);
    if (
      query.assignee &&
      query.assignee !== "unassigned" &&
      !dossier.people.some((person) => person.id === query.assignee)
    )
      throw problem("Persoon niet gevonden bij deze woning.", 404);
    if (query.task && !dossier.tasks.some((task) => task.id === query.task))
      throw problem("Melding niet gevonden.", 404);
    dossier.tasks = dossier.tasks.filter(
      (task) =>
        (!query.task || task.id === query.task) &&
        (!query.assignee ||
          (query.assignee === "unassigned"
            ? !task.assigneeId
            : task.assigneeId === query.assignee)),
    );
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="huisdossier-onderhoud.ics"',
    );
    res.send(
      maintenanceCalendar({
        house: houses.find((house) => house.id === req.params.houseId),
        dossier,
        installationId: store.installationId,
        alarmDays: Number(query.alarm),
      }),
    );
  });
}
