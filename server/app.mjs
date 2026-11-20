import express from "express";
import multer from "multer";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createStore } from "./store.mjs";
import { floorplanForView } from "../src/furnishings.ts";
import {
  readFloorplan,
  clientFloorplan,
  floorplanTextureNames,
  exportFloorplanFiles,
} from "./floorplan.mjs";
import {
  appearanceDirectory,
  readAppearance,
  exportAppearance,
} from "./appearance.mjs";

const text = z.string().trim().min(1).max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Ongeldige datum",
  );
const taskSchema = z.object({
  assetId: text,
  title: text,
  description: z.string().trim().max(10000).default(""),
  date: z.union([date, z.literal("")]).default(""),
  owner: z.string().trim().max(200).default(""),
  state: z.enum(["active", "hold", "verify"]).default("active"),
});
const assetSchema = z.object({
  name: text,
  kind: z.enum(["gebouw", "dak", "gevel", "ruimte", "installatie", "overig"]),
  description: z.string().trim().max(10000).default(""),
  roomId: text.nullable().optional(),
});
const updateSchema = z.object({
  name: text,
  description: z.string().trim().max(10000),
  position: z
    .tuple([z.number().finite(), z.number().finite(), z.number().finite()])
    .nullable(),
  roomId: text.nullable().optional(),
});

export function createApp({ directory, houses, root }) {
  const app = express();
  const store = createStore(directory, houses);
  const uploadDir = path.join(directory, "uploads");
  mkdirSync(uploadDir, { recursive: true });
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    // Loopback-only server, plus Host/Origin checks against DNS rebinding and cross-site writes.
    const hostname = req.hostname;
    if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname))
      return res.status(403).json({ error: "Alleen lokaal toegankelijk." });
    const origin = req.get("origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`)
      return res.status(403).json({ error: "Ongeldige herkomst." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "100kb" }));
  app.get("/api/houses", (_req, res) => res.json(houses));
  app.use("/api/houses/:houseId", (req, res, next) => {
    if (!store.houseExists(req.params.houseId))
      return res.status(404).json({ error: "Woning niet gevonden." });
    next();
  });
  app.get("/api/houses/:houseId/dossier", (req, res) =>
    res.json(store.dossier(req.params.houseId)),
  );
  app.get("/api/houses/:houseId/floorplan", async (req, res) => {
    const view = z
      .enum(["furnished", "unfurnished"])
      .parse(req.query.view ?? "furnished");
    const plan = await readFloorplan(directory, req.params.houseId);
    res.json(
      clientFloorplan(
        plan ? floorplanForView(plan, view) : null,
        req.params.houseId,
      ),
    );
  });
  app.get("/api/houses/:houseId/floorplan/textures/:file", async (req, res) => {
    const plan = await readFloorplan(directory, req.params.houseId);
    if (!floorplanTextureNames(plan).includes(req.params.file))
      return res.status(404).json({ error: "Textuur niet gevonden." });
    res.sendFile(
      path.join(directory, "floorplans", req.params.houseId, req.params.file),
    );
  });
  app.post("/api/houses/:houseId/assets", (req, res) => {
    const data = assetSchema.parse(req.body);
    const id = store.addAsset(req.params.houseId, data);
    res.status(201).json({ id });
  });
  app.patch("/api/houses/:houseId/assets/:id", (req, res) => {
    if (!store.asset(req.params.houseId, req.params.id))
      return res.status(404).json({ error: "Onderdeel niet gevonden." });
    store.updateAsset(
      req.params.houseId,
      req.params.id,
      updateSchema.parse(req.body),
    );
    res.json({ ok: true });
  });
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req, _file, cb) => cb(null, randomUUID()),
    }),
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  });
  app.post(
    "/api/houses/:houseId/assets/:assetId/files",
    (req, res, next) => {
      if (!store.asset(req.params.houseId, req.params.assetId))
        return res.status(404).json({ error: "Onderdeel niet gevonden." });
      next();
    },
    upload.single("file"),
    async (req, res, next) => {
      if (!req.file)
        return res.status(400).json({ error: "Kies een bestand." });
      try {
        // Multer decodes multipart names as latin1; browsers submit UTF-8.
        req.file.originalname = Buffer.from(
          req.file.originalname,
          "latin1",
        ).toString("utf8");
        const id = store.addAttachment(
          req.params.houseId,
          req.params.assetId,
          req.file,
          /\.(md|txt|csv)$/i.test(req.file.originalname)
            ? (await readFile(req.file.path, "utf8")).slice(0, 2_000_000)
            : "",
        );
        res.status(201).json({ id });
      } catch (error) {
        await unlink(req.file.path).catch(() => {});
        next(error);
      }
    },
  );
  app.get("/api/houses/:houseId/search", (req, res) => {
    const query = z
      .string()
      .trim()
      .max(200)
      .parse(req.query.q ?? "");
    res.json(query ? store.searchFiles(req.params.houseId, query) : []);
  });
  app.get("/api/houses/:houseId/files/:id/text", (req, res) => {
    const file = store.file(req.params.houseId, req.params.id);
    if (!file) return res.status(404).json({ error: "Bestand niet gevonden." });
    res.json({ text: file.text_content });
  });
  app.patch("/api/houses/:houseId/files/:id", (req, res) => {
    const data = z
      .object({
        assetId: text,
        category: z.string().trim().max(100),
        summary: z.string().trim().max(10000),
      })
      .parse(req.body);
    if (!store.asset(req.params.houseId, data.assetId))
      return res.status(404).json({ error: "Onderdeel niet gevonden." });
    if (!store.updateAttachment(req.params.houseId, req.params.id, data))
      return res.status(404).json({ error: "Bestand niet gevonden." });
    res.json({ ok: true });
  });
  app.get("/api/houses/:houseId/files/:id", (req, res) => {
    const file = store.file(req.params.houseId, req.params.id);
    if (!file) return res.status(404).json({ error: "Bestand niet gevonden." });
    const location = path.join(uploadDir, file.stored_name);
    if (file.type === "application/pdf" && req.query.preview === "1") {
      res
        .type("application/pdf")
        .set("Content-Disposition", "inline")
        .sendFile(location);
    } else if (
      [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
      ].includes(file.type) &&
      req.query.download !== "1"
    ) {
      res.type(file.type).sendFile(location);
    } else res.download(location, file.name);
  });
  app.post("/api/houses/:houseId/tasks", (req, res) => {
    const data = taskSchema.parse(req.body);
    if (!store.asset(req.params.houseId, data.assetId))
      return res.status(404).json({ error: "Onderdeel niet gevonden." });
    res.status(201).json({ id: store.addTask(req.params.houseId, data) });
  });
  app.patch("/api/houses/:houseId/tasks/:id", (req, res) => {
    const data = z
      .object({
        assetId: text.optional(),
        title: text.optional(),
        description: z.string().trim().max(10000).optional(),
        date: z.union([date, z.literal("")]).optional(),
        owner: z.string().trim().max(200).optional(),
        state: z.enum(["active", "hold", "verify"]).optional(),
        status: z.enum(["open", "done"]).optional(),
      })
      .refine((v) => Object.keys(v).length > 0)
      .parse(req.body);
    if (data.assetId && !store.asset(req.params.houseId, data.assetId))
      return res.status(404).json({ error: "Onderdeel niet gevonden." });
    if (!store.updateTask(req.params.houseId, req.params.id, data))
      return res.status(404).json({ error: "Melding niet gevonden." });
    res.json({ ok: true });
  });
  app.get("/api/houses/:houseId/appearance", async (req, res) => {
    const profile = await readAppearance(directory, req.params.houseId);
    res.json(
      profile
        ? {
            ...profile,
            ...(profile.aerial
              ? {
                  aerial: {
                    ...profile.aerial,
                    texture: `/api/houses/${req.params.houseId}/appearance/${profile.aerial.texture}`,
                  },
                }
              : {}),
            front: {
              ...profile.front,
              texture: `/api/houses/${req.params.houseId}/appearance/${profile.front.texture}`,
            },
          }
        : null,
    );
  });
  app.get("/api/houses/:houseId/appearance/:file", async (req, res) => {
    const profile = await readAppearance(directory, req.params.houseId);
    if (
      !profile ||
      ![profile.front.texture, profile.aerial?.texture].includes(
        req.params.file,
      )
    )
      return res.status(404).json({ error: "Gevelbeeld niet gevonden." });
    res.sendFile(
      path.join(
        appearanceDirectory(directory, req.params.houseId),
        req.params.file,
      ),
    );
  });
  app.get("/api/houses/:houseId/export", async (req, res) => {
    const houseId = req.params.houseId;
    const model = JSON.parse(
      await readFile(path.join(root, "public/data", `${houseId}.json`), "utf8"),
    );
    const files = [];
    for (const file of store.allFiles(houseId))
      files.push({
        id: file.id,
        name: file.name,
        type: file.type,
        metadata: JSON.parse(file.metadata),
        text: file.text_content,
        base64: (
          await readFile(path.join(uploadDir, file.stored_name))
        ).toString("base64"),
      });
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${houseId}-huisdossier.json"`,
    );
    const plan = await readFloorplan(directory, houseId);
    res.json({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      model,
      dossier: store.dossier(houseId),
      files,
      appearance: await exportAppearance(directory, houseId),
      floorplan: plan,
      floorplanVariants: plan
        ? {
            furnished: plan,
            unfurnished: floorplanForView(plan, "unfurnished"),
          }
        : null,
      floorplanFiles: await exportFloorplanFiles(directory, houseId),
    });
  });
  // Preserve API 404 semantics rather than serving the SPA for a mistyped endpoint.
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Niet gevonden." }),
  );
  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: "Controleer de ingevulde velden.",
        details: error.issues.map((i) => i.message),
      });
    if (error instanceof multer.MulterError)
      return res.status(400).json({
        error:
          error.code === "LIMIT_FILE_SIZE"
            ? "Het bestand mag maximaal 25 MB zijn."
            : "Het bestand kon niet worden toegevoegd.",
      });
    console.error(error);
    res.status(500).json({ error: "Opslaan is niet gelukt. Probeer opnieuw." });
  });
  return { app, store };
}
