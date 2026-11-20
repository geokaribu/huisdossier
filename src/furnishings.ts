import type { Floorplan, PlanDecoration } from "./types.ts";

export type FurnishingView = "furnished" | "unfurnished";
const fixedKinds = new Set<PlanDecoration["kind"]>([
  "rain-pipe",
  "utility-niche",
  "kitchen-run",
  "kitchen-cabinet",
  "wall-shelf",
  "range-cooker",
]);

/** Both views derive from one plan: room IDs, finishes and document links stay identical. */
export function floorplanForView(
  plan: Floorplan,
  view: FurnishingView,
): Floorplan {
  if (view === "furnished") return plan;
  return {
    ...plan,
    fixtures: plan.fixtures.filter(
      (item) => item.fixed ?? item.kind !== "closet",
    ),
    decorations: (plan.decorations ?? [])
      .filter((item) => item.fixed ?? fixedKinds.has(item.kind))
      .map((item) =>
        item.kind === "utility-niche" ? { ...item, contents: false } : item,
      ),
  };
}
