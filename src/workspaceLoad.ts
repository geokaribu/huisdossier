import type {
  Dossier,
  HouseData,
  HouseAppearance,
  Floorplan,
  LightingEnvironment,
} from "./types";

export interface VisualResources {
  model: HouseData | null;
  appearance: HouseAppearance | null;
  floorplan: Floorplan | null;
  lighting: LightingEnvironment | null;
}
export type ResourceName = keyof VisualResources;
export const resourceLabels: Record<ResourceName, string> = {
  model: "Gebouwmodel",
  appearance: "Gevelafwerking",
  floorplan: "Interieur",
  lighting: "Lichtsimulatie",
};

/** Required records become usable without waiting for optional rendering resources. */
export async function loadWorkspace(
  get: <T>(url: string) => Promise<T>,
  base: string,
  onDossier: (records: Dossier) => void,
  onResource: <K extends ResourceName>(
    name: K,
    value: VisualResources[K],
  ) => void,
  onFailure: (name: ResourceName | "dossier", error: unknown) => void,
) {
  await Promise.allSettled([
    get<Dossier>(`${base}/dossier`)
      .then(onDossier)
      .catch((error) => onFailure("dossier", error)),
    ...(["model", "appearance", "floorplan", "lighting"] as const).map(
      async (name) => {
        try {
          onResource(
            name,
            await get<VisualResources[typeof name]>(`${base}/${name}`),
          );
        } catch (error) {
          onFailure(name, error);
        }
      },
    ),
  ]);
}
