import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const point = z.tuple([
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
]);
const polygon = z.array(point).min(3).max(100);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
const positiveSize = z.tuple([
  z.number().positive().max(10),
  z.number().positive().max(10),
]);
const joinery = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fixedLeft: z.number().nonnegative(),
  insideColor: color,
  outsideColor: color,
  openAngle: z.number().min(65).max(100),
  defaultOpen: z.boolean(),
});
const schema = z.object({
  version: z.literal(1),
  label: z.string(),
  source: z.string(),
  description: z.string(),
  ceilingHeight: z.number().min(2).max(5),
  outline: polygon,
  ceiling: polygon,
  spawn: point,
  rooms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        polygon,
        center: point,
        color,
        area: z.number().positive().optional(),
        outside: z.boolean().optional(),
        shared: z.boolean().optional(),
        floor: z.enum(["wood", "tile"]).optional(),
        floorColor: color.optional(),
        floorTiling: z
          .object({ size: z.number().min(0.1).max(2), groutColor: color })
          .optional(),
        paving: z
          .object({ size: z.number().positive().max(2), color })
          .optional(),
        viewYaw: z.number().finite().optional(),
        viewPitch: z.number().min(-1.25).max(1.25).optional(),
        viewFov: z.number().min(45).max(110).optional(),
      }),
    )
    .max(100),
  walls: z
    .array(
      z
        .object({
          a: point,
          b: point,
          thickness: z.number().min(0.04).max(1),
          outsideRoomId: z.string().min(1).optional(),
          height: z.number().positive().max(5).optional(),
          finish: z
            .object({ color, texture: z.enum(["stucco", "brick"]) })
            .optional(),
          coatings: z
            .array(
              z.object({
                side: z.enum(["positive", "negative"]),
                from: z.number().nonnegative(),
                to: z.number().positive(),
                color,
                skirtingColor: color.optional(),
                pattern: z
                  .object({
                    texture: z
                      .string()
                      .regex(/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/),
                    tileSize: positiveSize,
                    attribution: z.string(),
                    generated: z.boolean(),
                  })
                  .optional(),
                lower: z
                  .object({
                    color,
                    height: z.number().positive().max(3),
                    railColor: color,
                  })
                  .optional(),
              }),
            )
            .max(30)
            .optional(),
          climber: z
            .object({
              top: z.number().positive().max(4),
              coverage: z.number().min(0).max(1),
              trellis: z.boolean(),
            })
            .optional(),
          openings: z
            .array(
              z.object({
                offset: z.number().nonnegative(),
                width: z.number().positive(),
                sill: z.number().nonnegative(),
                height: z.number().positive(),
                kind: z.enum(["door", "window"]),
                frameColor: color.optional(),
                joinery: joinery.optional(),
              }),
            )
            .default([]),
        })
        .superRefine((wall, ctx) => {
          const length = Math.hypot(
            wall.b[0] - wall.a[0],
            wall.b[1] - wall.a[1],
          );
          if (length < 0.01)
            ctx.addIssue({ code: "custom", message: "Wand heeft geen lengte" });
          for (const coat of wall.coatings ?? []) {
            if (
              coat.to <= coat.from ||
              coat.to > length + 0.01 ||
              (coat.lower && coat.lower.height >= (wall.height ?? 5))
            )
              ctx.addIssue({
                code: "custom",
                message: "Wandkleur valt buiten de wand",
              });
            for (const other of wall.coatings ?? [])
              if (
                other !== coat &&
                other.side === coat.side &&
                coat.from < other.to &&
                other.from < coat.to
              )
                ctx.addIssue({
                  code: "custom",
                  message: "Wandkleuren overlappen",
                });
          }
          let end = 0;
          for (const opening of wall.openings) {
            if (
              opening.offset < end ||
              opening.offset + opening.width > length + 0.01
            )
              ctx.addIssue({
                code: "custom",
                message: "Openingen overlappen of vallen buiten de wand",
              });
            end = opening.offset + opening.width;
            if (
              opening.joinery &&
              (opening.kind !== "door" ||
                opening.width - opening.joinery.fixedLeft < 0.8 - 1e-6)
            )
              ctx.addIssue({
                code: "custom",
                message: "Glazen deur heeft geen bruikbare doorgang",
              });
          }
        }),
    )
    .max(300),
  fixtures: z
    .array(
      z.object({
        kind: z.enum([
          "counter",
          "sink",
          "hob",
          "toilet",
          "basin",
          "shower",
          "closet",
          "stairs",
        ]),
        center: point,
        size: positiveSize,
        height: z.number().positive().max(3),
        fixed: z.boolean().optional(),
        mounting: z.literal("wall").optional(),
        rotation: z.number().finite().optional(),
        base: z.number().nonnegative().max(3).optional(),
      }),
    )
    .max(100),
  decorations: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum([
          "patio-table",
          "patio-chair",
          "plant-shelf",
          "planter",
          "rain-pipe",
          "sofa",
          "armchair",
          "coffee-table",
          "indoor-plant",
          "utility-niche",
          "barbecue",
          "storage-cabinet",
          "hanging-planter",
          "bookcase",
          "dining-table",
          "dining-chair",
          "fridge",
          "curtain",
          "footstool",
          "pendant",
          "picture-frame",
          "kitchen-run",
          "kitchen-cabinet",
          "wall-shelf",
          "range-cooker",
          "recliner",
          "built-in",
        ]),
        center: point,
        size: positiveSize,
        height: z.number().positive().max(4),
        rotation: z.number().finite().optional(),
        base: z.number().nonnegative().max(3).optional(),
        color: color.optional(),
        plant: z.enum(["flowers", "shrub"]).optional(),
        solid: z.boolean().optional(),
        fixed: z.boolean().optional(),
        contents: z.boolean().optional(),
      }),
    )
    .max(100)
    .optional(),
});

export async function readFloorplan(directory, houseId) {
  try {
    return schema.parse(
      JSON.parse(
        await readFile(
          path.join(directory, "floorplans", houseId, "plan.json"),
          "utf8",
        ),
      ),
    );
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function floorplanTextureNames(plan) {
  return [
    ...new Set(
      (plan?.walls ?? []).flatMap((w) =>
        (w.coatings ?? []).flatMap((c) =>
          c.pattern ? [c.pattern.texture] : [],
        ),
      ),
    ),
  ];
}

export function clientFloorplan(plan, houseId) {
  if (!plan) return null;
  return {
    ...plan,
    walls: plan.walls.map((w) => ({
      ...w,
      ...(w.coatings
        ? {
            coatings: w.coatings.map((c) => ({
              ...c,
              ...(c.pattern
                ? {
                    pattern: {
                      ...c.pattern,
                      texture: `/api/houses/${houseId}/floorplan/textures/${c.pattern.texture}`,
                    },
                  }
                : {}),
            })),
          }
        : {}),
    })),
  };
}

export async function exportFloorplanFiles(directory, houseId) {
  const plan = await readFloorplan(directory, houseId);
  return Promise.all(
    floorplanTextureNames(plan).map(async (name) => ({
      name,
      base64: (
        await readFile(path.join(directory, "floorplans", houseId, name))
      ).toString("base64"),
    })),
  );
}
