import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.json();
}
function unpack(response, targetId) {
  const features =
    response.features ?? (response.feature ? [response.feature] : []);
  const transform = response.metadata?.transform ?? {
    scale: [1, 1, 1],
    translate: [0, 0, 0],
  };
  return features.map((feature) => {
    const vertices = feature.vertices.map((p) =>
      p.map(
        (v, i) => +(v * transform.scale[i] + transform.translate[i]).toFixed(4),
      ),
    );
    const surfaces = [];
    for (const object of Object.values(feature.CityObjects)) {
      const geometries = object.geometry ?? [];
      const geometry =
        geometries.find((g) => String(g.lod) === "2.2") ??
        geometries.toSorted((a, b) => +b.lod - +a.lod)[0];
      if (!geometry || +geometry.lod < 1) continue;
      // CityJSON Solids contain shells; MultiSurfaces contain surfaces directly.
      const shells =
        geometry.type === "Solid" ? geometry.boundaries : [geometry.boundaries];
      for (let shellIndex = 0; shellIndex < shells.length; shellIndex++) {
        const shell = shells[shellIndex];
        const values =
          geometry.type === "Solid"
            ? geometry.semantics?.values?.[shellIndex]
            : geometry.semantics?.values;
        for (let index = 0; index < shell.length; index++) {
          const rings = shell[index].map((ring) =>
            ring.map((i) => vertices[i]),
          );
          const type =
            geometry.semantics?.surfaces?.[values?.[index]]?.type ??
            "BuildingSurface";
          surfaces.push({ type, rings });
        }
      }
    }
    const main = feature.CityObjects[feature.id];
    return {
      id: feature.id,
      target: feature.id === targetId,
      attributes: main?.attributes ?? {},
      surfaces,
    };
  });
}

const { houses, modelDirectory } = await loadRuntimeConfig(root);
if (!process.argv[2])
  throw new Error(
    "Geef expliciet een dossier-ID mee: npm run import:house -- <id>.",
  );
const config = houses.find((h) => h.id === process.argv[2]);
if (!config)
  throw new Error(
    "Onbekend dossier. Voeg dit eerst toe aan de ingestelde dossierconfiguratie.",
  );
if (config.provider === "vlaanderen") {
  await import("./import-flemish-house.mjs");
  process.exit(0);
}
const bagBase = "https://api.pdok.nl/kadaster/bag/ogc/v2";
const vboUrl = `${bagBase}/collections/verblijfsobject/items?identificatie=${config.vboId}&f=json`;
const vboData = await json(vboUrl);
const vbo = vboData.features.find(
  (f) => f.properties.identificatie === config.vboId,
);
if (!vbo) throw new Error("Verblijfsobject niet gevonden; import gestopt.");
const props = vbo.properties;
if (
  props.openbare_ruimte_naam !== config.address.replace(/ \d+.*$/, "") ||
  props.huisnummer !== Number(config.address.match(/\d+/)?.[0])
)
  throw new Error("Adrescontrole mislukt.");
const pandUrls = props["pand.href"];
if (!Array.isArray(pandUrls) || pandUrls.length !== 1)
  throw new Error(
    "Verblijfsobject heeft niet precies één pand; handmatige selectie vereist.",
  );
const pandUrl = `${pandUrls[0]}?f=json`;
const pand = await json(pandUrl);
const bagPandId = pand.properties.identificatie;
const targetId = `NL.IMBAG.Pand.${bagPandId}`;
const targetUrl = `https://api.3dbag.nl/collections/pand/items/${targetId}`;
const target = await json(targetUrl);
const buildings = new Map(unpack(target, targetId).map((b) => [b.id, b]));
if (!buildings.get(targetId)?.surfaces.length)
  throw new Error("Geen 3D-geometrie voor het geverifieerde pand gevonden.");
const [x, y] = config.rd;
const contextUrl = `https://api.3dbag.nl/collections/pand/items?bbox=${x - 45},${y - 45},${x + 45},${y + 45}&limit=100`;
let next = contextUrl;
const seen = new Set();
while (next && !seen.has(next) && seen.size < 10) {
  seen.add(next);
  const data = await json(next);
  for (const building of unpack(data, targetId))
    if (!buildings.has(building.id)) buildings.set(building.id, building);
  next = data.links?.find((l) => l.rel === "next")?.href;
}
const output = {
  house: {
    id: config.id,
    name: config.name,
    address: config.address,
    postcode: `${props.postcode.slice(0, 4)} ${props.postcode.slice(4)}`,
    city: props.woonplaats_naam,
    bagVboId: config.vboId,
    bagPandId,
    rd: config.rd,
    buildingYear:
      pand.properties.oorspronkelijk_bouwjaar ?? pand.properties.bouwjaar,
    area: props.oppervlakte,
    buildingUnitCount: pand.properties.aantal_verblijfsobjecten,
  },
  source: {
    fetchedAt: new Date().toISOString(),
    attribution:
      "3DBAG door TU Delft 3D geoinformation en 3DGI; BAG via PDOK / Kadaster",
    license: "3DBAG: CC BY 4.0; BAG: Public Domain Mark 1.0",
    urls: [vboUrl, pandUrl, targetUrl, contextUrl],
    model: "LoD 2.2, gereconstrueerde buitenzijde; geen ingemeten interieur",
    crs: "EPSG:7415 (RD New + NAP)",
    contextPaginationComplete: !next,
  },
  buildings: [...buildings.values()],
};
await mkdir(modelDirectory, { recursive: true });
await writeFile(
  path.join(modelDirectory, `${config.id}.json`),
  JSON.stringify(output),
);
console.log(
  `Geïmporteerd: ${output.house.address}; BAG pand ${bagPandId}; ${buildings.size} gebouwen; ${buildings.get(targetId).surfaces.length} pandoppervlakken.`,
);
