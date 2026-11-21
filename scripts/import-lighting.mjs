import { withInstallationLock } from "../server/installation-lock.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readLighting, lightingProfileSchema } from "../server/lighting.mjs";
import { activeLightMasts } from "./lighting-source.mjs";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";
const root = fileURLToPath(new URL("../", import.meta.url)),
  { houses: configs, directory } = await loadRuntimeConfig(root),
  house = configs.find((h) => h.id === process.argv[2]);
if (!house) throw new Error("Geef een woning-ID uit config/houses.json mee.");
if (house.provider !== "bag")
  throw new Error(
    "Lichtimport ondersteunt alleen de Nederlandse BAG/BGT-bron; voor dit dossier is geen passende lichtimporter beschikbaar.",
  );
await withInstallationLock(directory, async () => {
  const radius = 50,
    [x, y] = house.rd;
  const url = `https://api.pdok.nl/lv/bgt/ogc/v1/collections/paal/items?bbox=${x - radius},${y - radius},${x + radius},${y + radius}&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/28992&crs=http://www.opengis.net/def/crs/EPSG/0/28992&limit=1000&f=json`;
  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`${r.status}: ${url}`);
    return r.json();
  }
  const features = [],
    seen = new Set();
  let next = url;
  while (next && !seen.has(next)) {
    if (seen.size >= 20)
      throw new Error("Paginering onvolledig; import gestopt.");
    seen.add(next);
    const r = await json(next);
    features.push(...r.features);
    next = r.links?.find((l) => l.rel === "next")?.href;
  }
  if (next) throw new Error("Cyclische paginering; import gestopt.");
  const active = activeLightMasts(features, house.rd, radius);
  const vbo = await json(
      `https://api.pdok.nl/kadaster/bag/ogc/v2/collections/verblijfsobject/items?identificatie=${house.vboId}&f=json`,
    ),
    point = vbo.features.find(
      (f) => f.properties.identificatie === house.vboId,
    )?.geometry;
  if (point?.type !== "Point" || Math.abs(point.coordinates[0]) > 180)
    throw new Error("Geen geverifieerde WGS84-locatie.");
  const old = await readLighting(directory, house.id),
    lamps = [...active.values()]
      .sort(
        (a, b) =>
          Math.hypot(
            a.geometry.coordinates[0] - x,
            a.geometry.coordinates[1] - y,
          ) -
          Math.hypot(
            b.geometry.coordinates[0] - x,
            b.geometry.coordinates[1] - y,
          ),
      )
      .map((f, i) => ({
        id: f.properties.lokaal_id,
        label: `Lichtmast ${i + 1}`,
        rd: f.geometry.coordinates.slice(0, 2),
        sourceType: f.properties.plus_type ?? f.properties.type,
        armatureType: null,
        sourceDate: f.properties.lv_publicatiedatum ?? null,
        scenario: old?.lamps.find((l) => l.id === f.properties.lokaal_id)
          ?.scenario ?? {
          height: 4.5,
          lumens: 1500,
          kelvin: 2700,
          distribution: "point",
        },
      }));
  const profile = {
    version: 1,
    latitude: point.coordinates[1],
    longitude: point.coordinates[0],
    timeZone: "Europe/Amsterdam",
    source: {
      url,
      attribution: `BGT via PDOK / Kadaster; bronhouders: ${[...new Set(active.map((f) => f.properties.bronhouder).filter(Boolean))].join(", ") || "zie bronobjecten"}`,
      license: "CC0 1.0",
      fetchedAt: new Date().toISOString(),
      note: "Actieve BGT-lichtmastposities binnen 50 m; vervallen versies verwijderd. BGT bevat hier geen armatuurmodel, lichthoogte, lumen, kleurtemperatuur, IES/LDT-curve of dimschema. Alle lampparameters zijn instelbare scenarioaannamen. Hoogte is relatief aan het benaderde straatniveau bij de woning; geen ingemeten z-positie.",
    },
    lamps,
  };
  lightingProfileSchema.parse(profile);
  const folder = path.join(directory, "lighting", house.id);
  await fs.mkdir(folder, { recursive: true });
  if (old)
    await fs.writeFile(
      path.join(folder, "previous.json"),
      JSON.stringify(old, null, 2),
    );
  await fs.writeFile(
    path.join(folder, "import.tmp"),
    JSON.stringify(profile, null, 2) + "\n",
  );
  await fs.writeFile(
    path.join(folder, "bgt-source.json"),
    JSON.stringify(
      {
        url,
        fetchedAt: profile.source.fetchedAt,
        features: [...active.values()],
      },
      null,
      2,
    ),
  );
  await fs.rename(
    path.join(folder, "import.tmp"),
    path.join(folder, "profile.json"),
  );
  console.log(
    `${lamps.length} actieve lichtmastposities geïmporteerd; armaturen en lichtwaarden onbekend.`,
  );
});
