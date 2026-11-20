import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { loadRuntimeConfig } from "./runtime-config.mjs";
import { readFloorplan, floorplanTextureNames } from "./floorplan.mjs";
import { readAppearance } from "./appearance.mjs";
import { readLighting } from "./lighting.mjs";

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
    await check("Buitenmodel", async () => {
      const model = JSON.parse(
        await readFile(
          path.join(config.modelDirectory, `${house.id}.json`),
          "utf8",
        ),
      );
      if (model.house?.id !== house.id)
        throw new Error("Model hoort bij een ander dossier.");
      if (
        !Array.isArray(model.buildings) ||
        !model.buildings.some((b) => b.target && b.surfaces?.length)
      )
        throw new Error("Model bevat geen doelgebouw met vlakken.");
      if (
        !model.source?.attribution ||
        !model.source?.license ||
        !model.source?.crs
      )
        throw new Error(
          "Bronvermelding, licentie of coördinatenstelsel ontbreekt.",
        );
      return model;
    });
    const plan = await check(
      "Plattegrond",
      () => readFloorplan(config.directory, house.id),
      true,
    );
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
      "Dossier en export vereisen in deze versie nog een buitenmodel. Ontbrekende optionele profielen zijn toegestaan; ongeldige profielen blokkeren het laden.",
    ],
    dossiers,
  };
}
