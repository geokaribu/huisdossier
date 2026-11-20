import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const point = z.tuple([z.number().finite(), z.number().finite()]);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const filename = z.string().regex(/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/);
const schema = z
  .object({
    version: z.literal(1),
    label: z.string(),
    description: z.string(),
    attribution: z.string(),
    generated: z.boolean(),
    aerial: z
      .object({
        texture: filename,
        bbox: z.tuple([
          z.number().finite(),
          z.number().finite(),
          z.number().finite(),
          z.number().finite(),
        ]),
        attribution: z.string(),
        url: z.string().url(),
        fetchedAt: z.string(),
      })
      .refine(
        (a) => a.bbox[2] > a.bbox[0] && a.bbox[3] > a.bbox[1],
        "Ongeldig luchtfotobereik",
      )
      .optional(),
    front: z.object({
      left: point,
      right: point,
      bottom: z.number().finite(),
      top: z.number().finite(),
      texture: filename,
    }),
    materials: z.object({ wall: color, roof: color, plinth: color }),
    dormerSurface: z.number().int().nonnegative().optional(),
    roof: z
      .object({
        hiddenSurfaceIndices: z.array(z.number().int().nonnegative()),
        top: z.number().finite(),
        inset: z.number().positive(),
        dormerWidth: z.number().positive(),
        dormerInset: z.number().positive(),
        dormerBottom: z.number().finite(),
        awningWidth: z.number().positive().optional(),
      })
      .optional(),
  })
  .refine(
    (p) =>
      p.front.top > p.front.bottom &&
      Math.hypot(
        p.front.right[0] - p.front.left[0],
        p.front.right[1] - p.front.left[1],
      ) > 0.1,
    "Ongeldige gevelafmetingen",
  );

export function appearanceDirectory(directory, houseId) {
  return path.join(directory, "appearance", houseId);
}

export async function readAppearance(directory, houseId) {
  try {
    return schema.parse(
      JSON.parse(
        await readFile(
          path.join(appearanceDirectory(directory, houseId), "profile.json"),
          "utf8",
        ),
      ),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function exportAppearance(directory, houseId) {
  const profile = await readAppearance(directory, houseId);
  if (!profile) return null;
  return {
    profile,
    files: await Promise.all(
      [
        profile.front.texture,
        ...(profile.aerial ? [profile.aerial.texture] : []),
      ].map(async (name) => ({
        name,
        base64: (
          await readFile(
            path.join(appearanceDirectory(directory, houseId), name),
          )
        ).toString("base64"),
      })),
    ),
  };
}
