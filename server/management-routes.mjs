import { z } from "zod";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import path from "node:path";
import { problem, calendarToday } from "./management.mjs";

const text = z.string().trim().min(1).max(200);
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Kies een geldige datum.",
  );
export const personSchema = z.object({
  name: text,
  role: z.enum(["resident", "helper", "professional"]).default("resident"),
  email: z.union([z.email(), z.literal("")]).default(""),
  phone: z.string().trim().max(60).default(""),
  active: z.boolean().default(true),
  company: z.string().trim().max(200).optional(),
  specialty: z.string().trim().max(200).optional(),
  website: z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).optional(),
  notes: z.string().trim().max(5000).optional(),
});
const planSchema = z.object({
  assetId: text,
  title: text,
  description: z.string().trim().max(10000).default(""),
  firstDate: calendarDate,
  intervalMonths: z.number().int().min(1).max(120),
  assigneeId: z.string().max(200).nullable().default(null),
});

export function managementRoutes(app, { store, upload, directory }) {
  app.get("/api/houses/:houseId/management", (req, res) =>
    res.json(store.management(req.params.houseId)),
  );
  app.post("/api/houses/:houseId/people", (req, res) =>
    res.status(201).json({
      id: store.addPerson(req.params.houseId, personSchema.parse(req.body)),
    }),
  );
  app.patch("/api/houses/:houseId/people/:id", (req, res) => {
    store.updatePerson(
      req.params.houseId,
      req.params.id,
      personSchema.parse(req.body),
    );
    res.json({ ok: true });
  });
  app.post("/api/houses/:houseId/maintenance-plans", (req, res) => {
    const data = planSchema.parse(req.body);
    if (!store.asset(req.params.houseId, data.assetId))
      throw problem("Kies een onderdeel van deze woning.", 404);
    res.status(201).json({ id: store.addPlan(req.params.houseId, data) });
  });
  app.patch("/api/houses/:houseId/maintenance-plans/:id", (req, res) => {
    if (Object.hasOwn(req.body ?? {}, "active")) {
      const data = z.object({ active: z.boolean() }).strict().parse(req.body);
      store.setPlanActive(req.params.houseId, req.params.id, data.active);
    } else {
      const data = planSchema.parse(req.body);
      if (!store.asset(req.params.houseId, data.assetId))
        throw problem("Kies een onderdeel van deze woning.", 404);
      store.updatePlan(req.params.houseId, req.params.id, data);
    }
    res.json({ ok: true });
  });
  const entrySchema = z.object({
    requestId: z.uuid(),
    kind: z.enum(["task", "note", "file", "completed"]),
    title: text,
    description: z.string().trim().max(10000).default(""),
    assetId: text,
    recordedById: z.string().max(200).default(""),
    assigneeId: z.string().max(200).default(""),
    date: z.union([calendarDate, z.literal("")]).default(""),
    category: z.string().max(100).default("observations"),
    costCents: z.preprocess(
      (value) =>
        value === undefined || value === "" ? undefined : Number(value),
      z.number().int().min(0).max(100000000).optional(),
    ),
  });
  app.post(
    "/api/houses/:houseId/entries",
    upload.single("file"),
    async (req, res, next) => {
      const written = [];
      if (req.file) written.push(req.file.path);
      let committed = false;
      try {
        const house = req.params.houseId,
          data = entrySchema.parse(req.body);
        const fingerprint = createHash("sha256")
          .update(JSON.stringify(data))
          .update(
            req.file
              ? JSON.stringify([req.file.originalname, req.file.mimetype])
              : "",
          )
          .update(req.file ? await readFile(req.file.path) : "")
          .digest("hex");
        const known = store.entry(house, data.requestId, fingerprint);
        if (known) {
          for (const file of written) await unlink(file).catch(() => {});
          return res.json(known);
        }
        if (!store.asset(house, data.assetId))
          throw problem("Kies een onderdeel van deze woning.", 404);
        store.validatePerson(house, data.recordedById);
        store.validatePerson(house, data.assigneeId);
        if (data.kind === "file" && !req.file)
          throw problem("Kies een foto of document.");
        if (data.kind === "note" && !data.description)
          throw problem("Schrijf op wat je wilt onthouden.");
        if (data.kind === "completed" && (!data.date || !data.description))
          throw problem("Vul in wat er is gedaan en op welke datum.");
        if (data.kind === "completed" && data.date > calendarToday())
          throw problem("Uitgevoerd onderhoud kan niet in de toekomst liggen.");
        let noteFile;
        if (data.kind === "note") {
          const filename = randomUUID(),
            content = `${data.title}\n\n${data.description}\n`;
          const location = path.join(directory, "uploads", filename);
          await writeFile(location, content, "utf8");
          written.push(location);
          noteFile = {
            filename,
            originalname: `${data.title.replace(/[\\/:*?"<>|]/g, "-")}.txt`,
            mimetype: "text/plain",
            size: Buffer.byteLength(content),
            content,
          };
        }
        let content = "";
        if (req.file) {
          req.file.originalname = Buffer.from(
            req.file.originalname,
            "latin1",
          ).toString("utf8");
          if (/\.(md|txt|csv)$/i.test(req.file.originalname))
            content = (await readFile(req.file.path, "utf8")).slice(
              0,
              2_000_000,
            );
        }
        let reused = false;
        const result = store.transaction(() => {
          // Retried requests create one entry even if the previous HTTP response was lost.
          const existing = store.entry(house, data.requestId, fingerprint);
          if (existing) {
            reused = true;
            return existing;
          }
          let taskId = null;
          const fileIds = [];
          if (data.kind === "task" || data.kind === "completed")
            taskId = store.addTask(house, {
              ...data,
              ...(data.kind !== "completed" ? { costCents: undefined } : {}),
              owner: "",
              state: "active",
              status: data.kind === "completed" ? "done" : "open",
              completedOn: data.date,
              result: data.kind === "completed" ? data.description : "",
            });
          const metadata = {
            summary: data.description,
            category: data.category,
            recordedById: data.recordedById || null,
            ...(taskId ? { taskId } : {}),
          };
          if (noteFile)
            fileIds.push(
              store.addAttachment(
                house,
                data.assetId,
                noteFile,
                noteFile.content,
                metadata,
              ),
            );
          if (req.file) {
            const ext = path.extname(req.file.originalname);
            fileIds.push(
              store.addAttachment(
                house,
                data.assetId,
                {
                  ...req.file,
                  originalname:
                    data.kind === "file"
                      ? data.title.toLowerCase().endsWith(ext.toLowerCase())
                        ? data.title
                        : `${data.title}${ext}`
                      : req.file.originalname,
                },
                content,
                metadata,
              ),
            );
          }
          const record = { assetId: data.assetId, taskId, fileIds };
          store.rememberEntry(house, data.requestId, record, fingerprint);
          store.activity(
            house,
            taskId ? "task" : "file",
            taskId ?? fileIds[0],
            `${data.kind === "completed" ? "Uitgevoerd onderhoud" : data.kind === "task" ? "Melding" : data.kind === "note" ? "Notitie" : "Bestand"} toegevoegd: ${data.title}`,
          );
          return record;
        });
        committed = true;
        if (reused)
          for (const file of written) await unlink(file).catch(() => {});
        res.status(reused ? 200 : 201).json(result);
      } catch (error) {
        if (!committed)
          for (const file of written) await unlink(file).catch(() => {});
        next(error);
      }
    },
  );
}
