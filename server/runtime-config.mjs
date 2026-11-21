import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const label = z.string().trim().min(1).max(200);
const houseSchema = z
  .object({
    id,
    name: label,
    address: label,
    postcode: label,
    city: label,
    query: label.optional(),
    country: z.enum(["NL", "BE"]).optional(),
    provider: z.enum(["bag", "vlaanderen", "none"]).default("bag"),
    vboId: z
      .string()
      .regex(/^\d{16}$/)
      .optional(),
    rd: z.tuple([z.number().finite(), z.number().finite()]).optional(),
    starterAssets: z
      .array(
        z
          .object({
            slug: id,
            name: label,
            description: z.string().max(10000),
            roomId: id.optional(),
            kind: z
              .enum([
                "gebouw",
                "dak",
                "gevel",
                "ruimte",
                "installatie",
                "overig",
              ])
              .default("installatie"),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .superRefine((house, context) => {
    if (house.provider !== "none" && !house.rd)
      context.addIssue({
        code: "custom",
        path: ["rd"],
        message: "Gebouwimport vereist broncoördinaten.",
      });
    if (house.provider === "bag" && !house.vboId)
      context.addIssue({
        code: "custom",
        path: ["vboId"],
        message: "BAG-import vereist een verblijfsobject-ID.",
      });
    if (
      (house.provider === "bag" && house.country === "BE") ||
      (house.provider === "vlaanderen" && house.country === "NL")
    )
      context.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Land en gebouwbron spreken elkaar tegen.",
      });
    const slugs = new Set(["building", "roof", "facade", "inbox"]);
    for (const [index, asset] of house.starterAssets.entries()) {
      if (slugs.has(asset.slug))
        context.addIssue({
          code: "custom",
          path: ["starterAssets", index, "slug"],
          message: "Onderdeelsleutel is dubbel of gereserveerd.",
        });
      slugs.add(asset.slug);
    }
  })
  .transform((house) => ({
    ...house,
    query: house.query || `${house.address}, ${house.postcode} ${house.city}`,
  }));
export const houseCatalogSchema = z
  .array(houseSchema)
  .min(1)
  .superRefine((houses, context) => {
    const ids = new Set();
    for (const [index, house] of houses.entries()) {
      if (ids.has(house.id))
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Dossier-ID komt meer dan één keer voor.",
        });
      ids.add(house.id);
    }
  });

export function runtimePaths(root, env = process.env) {
  const absolute = (value, fallback, name) => {
    if (!value) return path.join(root, fallback);
    if (!path.isAbsolute(value))
      throw new Error(`${name} moet een absoluut pad zijn.`);
    return path.normalize(value);
  };
  return {
    root,
    directory: absolute(
      env.HUISDOSSIER_DATA_DIR,
      "data",
      "HUISDOSSIER_DATA_DIR",
    ),
    modelDirectory: absolute(
      env.HUISDOSSIER_MODELS_DIR,
      "public/data",
      "HUISDOSSIER_MODELS_DIR",
    ),
    catalogPath: absolute(
      env.HUISDOSSIER_HOUSES_FILE,
      "config/houses.json",
      "HUISDOSSIER_HOUSES_FILE",
    ),
  };
}

export async function loadRuntimeConfig(root, env = process.env) {
  let installation = null;
  if (env.HUISDOSSIER_INSTALLATION) {
    if (!path.isAbsolute(env.HUISDOSSIER_INSTALLATION))
      throw new Error("HUISDOSSIER_INSTALLATION moet een absoluut pad zijn.");
    const descriptor = z
      .object({
        version: z.literal(1),
        catalog: label,
        data: label,
        models: label,
        port: z.number().int().min(1024).max(65535).default(4173),
      })
      .strict()
      .parse(JSON.parse(await readFile(env.HUISDOSSIER_INSTALLATION, "utf8")));
    const base = path.dirname(env.HUISDOSSIER_INSTALLATION);
    installation = {
      ...descriptor,
      catalog: path.resolve(base, descriptor.catalog),
      data: path.resolve(base, descriptor.data),
      models: path.resolve(base, descriptor.models),
    };
  }
  const paths = runtimePaths(root, {
    ...env,
    HUISDOSSIER_HOUSES_FILE:
      env.HUISDOSSIER_HOUSES_FILE || installation?.catalog,
    HUISDOSSIER_DATA_DIR: env.HUISDOSSIER_DATA_DIR || installation?.data,
    HUISDOSSIER_MODELS_DIR: env.HUISDOSSIER_MODELS_DIR || installation?.models,
  });
  let raw;
  try {
    raw = JSON.parse(await readFile(paths.catalogPath, "utf8"));
  } catch (error) {
    throw new Error(`Dossierconfiguratie niet leesbaar: ${paths.catalogPath}`, {
      cause: error,
    });
  }
  const result = houseCatalogSchema.safeParse(raw);
  if (!result.success)
    throw new Error(
      `Ongeldige dossierconfiguratie in ${paths.catalogPath}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  const port = Number(env.PORT ?? installation?.port ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("PORT moet een geheel getal tussen 0 en 65535 zijn.");
  return { ...paths, port, houses: result.data };
}
