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
    shell: z
      .object({
        rearSurface: z.number().int().nonnegative(),
        hiddenSurfaceIndices: z.array(z.number().int().nonnegative()),
        attribution: z.string(),
      })
      .optional(),
    hiddenSurfaceIndices: z.array(z.number().int().nonnegative()).optional(),
    frontOpenings: z
      .array(
        z.object({
          id: z.string(),
          kind: z.enum(["window", "door"]),
          x: z.number().nonnegative(),
          width: z.number().positive(),
          bottom: z.number().nonnegative(),
          height: z.number().positive(),
          split: z.number().positive(),
          tilt: z.number().min(0).max(0.5).optional(),
        }),
      )
      .max(30)
      .optional(),
    rear: z
      .object({
        portalId: z.string().min(1),
        outsideRoomId: z.string().min(1),
        anchor: point,
        scale: z.tuple([
          z.number().positive().max(2),
          z.number().positive().max(2),
        ]),
        shellStartZ: z.number().finite(),
        roofThickness: z.number().positive().max(0.8),
        junctionTop: z.number().positive(),
        hiddenSurfaceIndices: z.array(z.number().int().nonnegative()),
        attribution: z.string(),
      })
      .optional(),
    flatRoof: z
      .object({
        surface: z.number().int().nonnegative(),
        edgeHeight: z.number().positive().max(0.5),
        fixtures: z
          .array(
            z.object({
              id: z.string(),
              kind: z.enum(["vent", "rooflight"]),
              across: z.number().nonnegative(),
              depth: z.number().positive(),
              width: z.number().positive(),
              length: z.number().positive(),
              height: z.number().positive().max(2),
            }),
          )
          .max(30),
      })
      .optional(),
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
        nativeResolutionMetres: z.number().positive().optional(),
        captureDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        sourceUrl: z.string().url().optional(),
        license: z.string().optional(),
        metadataNote: z.string().optional(),
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
        recess: z
          .object({
            width: z.number().positive(),
            bottomT: z.number().min(0).max(1),
            topT: z.number().min(0).max(1),
            depth: z.number().positive(),
            railingHeight: z.number().positive().max(1.5),
          })
          .refine((r) => r.topT > r.bottomT, "Balkonopening heeft geen hoogte")
          .optional(),
        windows: z
          .array(
            z
              .object({
                across: z.number().nonnegative(),
                width: z.number().positive(),
                bottomT: z.number().min(0).max(1),
                topT: z.number().min(0).max(1),
              })
              .refine((w) => w.topT > w.bottomT, "Dakraam heeft geen hoogte"),
          )
          .max(20)
          .optional(),
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
  )
  .superRefine((p, ctx) => {
    const width = Math.hypot(
      p.front.right[0] - p.front.left[0],
      p.front.right[1] - p.front.left[1],
    );
    const openingHeight = p.front.top - p.front.bottom;
    for (const opening of p.frontOpenings ?? [])
      if (
        opening.x + opening.width > width ||
        opening.bottom + opening.height > openingHeight ||
        opening.split <= opening.bottom ||
        opening.split >= opening.bottom + opening.height
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Gevelopening valt buiten de gevel of heeft een ongeldige tussendorpel",
        });
    if (!p.roof) return;
    if (p.roof.top <= p.front.top)
      ctx.addIssue({ code: "custom", message: "Dak ligt onder de goot" });
    const recess = p.roof.recess;
    const holes = [
      ...(recess
        ? [
            {
              x: (width - recess.width) / 2,
              w: recess.width,
              a: recess.bottomT,
              b: recess.topT,
            },
          ]
        : []),
      ...(p.roof.windows ?? []).map((w) => ({
        x: w.across,
        w: w.width,
        a: w.bottomT,
        b: w.topT,
      })),
    ];
    if (
      recess &&
      (recess.width >= width || recess.depth <= p.roof.inset * recess.topT)
    )
      ctx.addIssue({
        code: "custom",
        message: "Balkon moet binnen het dak en achter het dakvlak liggen",
      });
    for (let i = 0; i < holes.length; i++) {
      const a = holes[i];
      if (a.x < 0 || a.x + a.w > width)
        ctx.addIssue({
          code: "custom",
          message: "Dakopening valt buiten de dakbreedte",
        });
      for (let j = 0; j < i; j++) {
        const b = holes[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.a < b.b && a.b > b.a)
          ctx.addIssue({ code: "custom", message: "Dakopeningen overlappen" });
      }
    }
  });

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
