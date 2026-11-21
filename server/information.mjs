import { z } from "zod";

export const informationSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(100),
      title: z.string().min(1).max(160),
      value: z.string().max(120).optional(),
      text: z.string().min(1).max(1600),
      topic: z.enum([
        "dimensions",
        "layout",
        "finishes",
        "furnishing",
        "sources",
        "accuracy",
      ]),
      status: z.enum(["source", "resident", "approximate", "unknown"]),
      source: z.string().max(500).optional(),
      roomIds: z.array(z.string().min(1)).max(100).optional(),
      assetKinds: z.array(z.string().min(1)).max(20).optional(),
    }),
  )
  .max(300)
  .superRefine((items, ctx) => {
    const ids = new Set();
    items.forEach((item, index) => {
      if (ids.has(item.id))
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: "Informatiesleutel is dubbel.",
        });
      ids.add(item.id);
    });
  });
