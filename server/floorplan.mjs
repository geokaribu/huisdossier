import path from "node:path";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const point = z.tuple([
  z.number().finite().min(-100).max(100),
  z.number().finite().min(-100).max(100),
]);
const polygon = z.array(point).min(3).max(100);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
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
          height: z.number().positive().max(5).optional(),
          openings: z
            .array(
              z.object({
                offset: z.number().nonnegative(),
                width: z.number().positive(),
                sill: z.number().nonnegative(),
                height: z.number().positive(),
                kind: z.enum(["door", "window"]),
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
        size: point,
        height: z.number().positive().max(3),
      }),
    )
    .max(100),
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
