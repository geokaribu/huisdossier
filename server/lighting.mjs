import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
export const lampScenario = z.object({
  height: z.number().min(2).max(15),
  lumens: z.number().min(0).max(20000),
  kelvin: z.number().min(1800).max(6500),
  distribution: z.enum(["point", "downward"]),
});
export const lightingProfileSchema = z.object({
  version: z.literal(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timeZone: z.literal("Europe/Amsterdam"),
  source: z.object({
    url: z.string().url(),
    attribution: z.string(),
    license: z.string(),
    fetchedAt: z.string(),
    note: z.string(),
  }),
  lamps: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        rd: z.tuple([z.number().finite(), z.number().finite()]),
        sourceType: z.string(),
        armatureType: z.string().nullable(),
        sourceDate: z.string().nullable(),
        scenario: lampScenario,
      }),
    )
    .max(100),
});
export async function readLighting(directory, id) {
  try {
    return lightingProfileSchema.parse(
      JSON.parse(
        await readFile(
          path.join(directory, "lighting", id, "profile.json"),
          "utf8",
        ),
      ),
    );
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}
const writes = new Map();
export function saveLampScenario(directory, id, lampId, input) {
  const scenario = lampScenario.parse(input),
    folder = path.join(directory, "lighting", id);
  const pending = (writes.get(folder) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const profile = await readLighting(directory, id),
        lamp = profile?.lamps.find((l) => l.id === lampId);
      if (!lamp) return false;
      lamp.scenario = scenario;
      await mkdir(folder, { recursive: true });
      const temp = path.join(folder, "profile.tmp");
      await writeFile(temp, JSON.stringify(profile, null, 2) + "\n");
      await rename(temp, path.join(folder, "profile.json"));
      return true;
    });
  writes.set(folder, pending);
  pending
    .finally(() => {
      if (writes.get(folder) === pending) writes.delete(folder);
    })
    .catch(() => {});
  return pending;
}
