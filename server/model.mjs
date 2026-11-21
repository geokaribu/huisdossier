import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const point = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
// Validate without stripping importer-specific source/registry metadata.
export const modelSchema = z
  .object({
    house: z
      .object({
        id: z.string().min(1),
        address: z.string(),
        rd: z.tuple([z.number().finite(), z.number().finite()]),
      })
      .passthrough(),
    source: z
      .object({
        urls: z.array(z.string()),
        fetchedAt: z.string().min(1),
        attribution: z.string().min(1),
        license: z.string().min(1),
        crs: z.string().min(1),
      })
      .passthrough(),
    buildings: z
      .array(
        z
          .object({
            id: z.string(),
            target: z.boolean(),
            attributes: z.record(z.string(), z.unknown()),
            surfaces: z.array(
              z
                .object({
                  type: z.string(),
                  rings: z.array(z.array(point).min(3)).min(1),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      )
      .refine(
        (items) => items.some((item) => item.target && item.surfaces.length),
        "Model bevat geen doelgebouw met vlakken.",
      ),
  })
  .passthrough();

export async function readModel(directory, houseId) {
  const raw = JSON.parse(
    await readFile(path.join(directory, `${houseId}.json`), "utf8"),
  );
  if (raw.house?.id !== houseId)
    throw new Error("Model hoort bij een ander dossier.");
  if (!raw.source?.attribution || !raw.source?.license)
    throw new Error("Bronvermelding of licentie ontbreekt.");
  return modelSchema.parse(raw);
}
