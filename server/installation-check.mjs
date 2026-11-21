import { access } from "node:fs/promises";
import path from "node:path";
import { loadRuntimeConfig } from "./runtime-config.mjs";
import { readFloorplan, floorplanTextureNames } from "./floorplan.mjs";
import { readAppearance } from "./appearance.mjs";
import { readLighting } from "./lighting.mjs";
import { readModel } from "./model.mjs";

/** Read-only preflight. No database creation, seeding, downloads or inferred geometry. */
export async function checkInstallation(root, env = process.env) {
  const config = await loadRuntimeConfig(root, env);
  const dossiers = [];
  for (const house of config.houses) {
    const checks = [];
    const check = async (name, action, optional = false) => {
      try {
        const result = await action();
        checks.push({
          name,
          status: result === null ? "absent" : "ok",
          required: !optional,
        });
        return result;
      } catch (error) {
        checks.push({
          name,
          status: "error",
          required: !optional,
          message:
            error.code === "ENOENT" ? "Bestand ontbreekt." : error.message,
        });
        return null;
      }
    };
    await check(
      "Buitenmodel",
      async () => {
        try {
          return await readModel(config.modelDirectory, house.id);
        } catch (error) {
          if (error.code === "ENOENT" && house.provider === "none") return null;
          throw error;
        }
      },
      house.provider === "none",
    );
    const plan = await check(
      "Plattegrond",
      () => readFloorplan(config.directory, house.id),
      true,
    );
    if (plan)
      await check("Kamerkoppelingen", async () => {
        for (const asset of house.starterAssets)
          if (
            asset.roomId &&
            !plan.rooms.some((room) => room.id === asset.roomId)
          )
            throw new Error(
              `Startonderdeel ${asset.slug} verwijst naar een onbekende ruimte.`,
            );
        return true;
      });
    if (plan)
      await check(
        "Plattegrondtexturen",
        async () => {
          for (const name of floorplanTextureNames(plan))
            await access(
              path.join(config.directory, "floorplans", house.id, name),
            );
          return true;
        },
        true,
      );
    const appearance = await check(
      "Gevelafwerking",
      () => readAppearance(config.directory, house.id),
      true,
    );
    if (appearance)
      await check(
        "Geveltexturen",
        async () => {
          for (const name of [
            appearance.front.texture,
            ...(appearance.aerial ? [appearance.aerial.texture] : []),
          ])
            await access(
              path.join(config.directory, "appearance", house.id, name),
            );
          return true;
        },
        true,
      );
    await check(
      "Lichtomgeving",
      () => readLighting(config.directory, house.id),
      true,
    );
    dossiers.push({
      id: house.id,
      checks,
      ready: checks.every((c) => c.status !== "error"),
    });
  }
  return {
    catalogPath: config.catalogPath,
    directory: config.directory,
    modelDirectory: config.modelDirectory,
    ready: dossiers.every((d) => d.ready),
    hostedReady: false,
    limits: [
      "Controle van lokale configuratie en gekoppelde modelbestanden; geen volledige integriteits- of beveiligingsaudit.",
      "Geen persoonlijke aanmelding, toegangsrechten of gedeelde hosting ingericht.",
      "Dossier en export werken zonder buitenmodel. Een bronmodel ontbreekt bewust bij provider none; een ontbrekend verwacht bronmodel is een opleverfout. Ongeldige optionele profielen worden gerapporteerd.",
    ],
    dossiers,
  };
}
