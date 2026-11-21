import { withInstallationLock } from "../server/installation-lock.mjs";
import { writeFile, mkdir } from "node:fs/promises";
import { modelSchema } from "../server/model.mjs";
import { writeJsonAtomic } from "../server/atomic-json.mjs";
import path from "node:path";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";
import { fileURLToPath } from "node:url";
import {
  containsPoint,
  interiorPoint,
  numberValue,
  extrudeFootprint,
} from "./flemish-geometry.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const {
  houses: configs,
  directory,
  modelDirectory,
} = await loadRuntimeConfig(root);
const config = configs.find((c) => c.id === process.argv[2]);
if (!config || config.provider !== "vlaanderen")
  throw Error("Kies een Vlaamse woning uit de configuratie.");
await withInstallationLock(directory, async () => {
  async function json(url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error(`${r.status}: ${url}`);
    return r.json();
  }
  const geocodeUrl = `https://geo.api.vlaanderen.be/geolocation/v4/Location?q=${encodeURIComponent(config.query)}`;
  const locations = (await json(geocodeUrl)).LocationResult;
  const address = locations.find(
    (a) =>
      a.FormattedAddress ===
      `${config.address}, ${config.postcode} ${config.city}`,
  );
  if (!address) throw Error("Exact adres niet bevestigd; import gestopt.");
  const point = [address.Location.X_Lambert72, address.Location.Y_Lambert72],
    radius = 50;
  const grbUrl = new URL("https://geo.api.vlaanderen.be/GRB/wfs");
  for (const [k, v] of Object.entries({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "GRB:GBG",
    outputFormat: "application/json",
    srsName: "EPSG:31370",
    bbox: `${point[0] - radius},${point[1] - radius},${point[0] + radius},${point[1] + radius},EPSG:31370`,
  }))
    grbUrl.searchParams.set(k, v);
  const collection = await json(grbUrl);
  if (
    collection.numberMatched &&
    Number(collection.numberMatched) > collection.features.length
  )
    throw Error("Onvolledige gebouwselectie; import gestopt.");
  const features = collection.features.filter(
    (f) => f.geometry.type === "Polygon",
  );
  const matches = features.filter((f) =>
    containsPoint(point, f.geometry.coordinates),
  );
  if (matches.length !== 1)
    throw Error("Adres ligt niet in precies één GRB-gebouw; import gestopt.");
  const target = matches[0],
    heightUrls = [];
  async function heightAt(p, oidn) {
    const url = new URL("https://geo.api.vlaanderen.be/3DGRB/wms");
    for (const [k, v] of Object.entries({
      SERVICE: "WMS",
      VERSION: "1.3.0",
      REQUEST: "GetFeatureInfo",
      LAYERS: "GRBGEBL1D2",
      QUERY_LAYERS: "GRBGEBL1D2",
      CRS: "EPSG:31370",
      BBOX: `${p[0] - 1},${p[1] - 1},${p[0] + 1},${p[1] + 1}`,
      WIDTH: 101,
      HEIGHT: 101,
      I: 50,
      J: 50,
      INFO_FORMAT: "application/geo+json",
      FEATURE_COUNT: 10,
    }))
      url.searchParams.set(k, v);
    heightUrls.push(url.href);
    const result = await json(url),
      f = result.features.find(
        (f) => String(f.properties.GRB_OIDN) === String(oidn),
      );
    return f?.properties ?? null;
  }
  const targetHeight = await heightAt(point, target.properties.OIDN);
  if (
    !targetHeight ||
    String(targetHeight.HNRLABEL) !== String(address.Housenumber) ||
    targetHeight.STRAATNM !== address.Thoroughfarename
  )
    throw Error("3D GRB-adres/gebouwrelatie niet bevestigd; import gestopt.");
  const heights = new Map([[target.id, targetHeight]]),
    omitted = [];
  for (let start = 0; start < features.length; start += 6)
    await Promise.all(
      features
        .slice(start, start + 6)
        .filter((f) => f.id !== target.id)
        .map(async (f) => {
          try {
            const h = await heightAt(
              interiorPoint(f.geometry.coordinates),
              f.properties.OIDN,
            );
            if (h) heights.set(f.id, h);
            else omitted.push(f.properties.OIDN);
          } catch {
            omitted.push(f.properties.OIDN);
          }
        }),
    );
  const buildings = features
    .filter((f) => heights.has(f.id))
    .flatMap((f) => {
      const h = heights.get(f.id),
        ground = numberValue(h.H_DTM_GEM),
        height = numberValue(h.HN_P99);
      if (height <= 0 || height > 100) {
        if (f.id === target.id)
          throw Error("Geen geldige hoogte voor doelgebouw");
        omitted.push(f.properties.OIDN);
        return [];
      }
      return [
        {
          id: `BE.GRB.Gbg.${f.properties.OIDN}`,
          target: f.id === target.id,
          surfaces: extrudeFootprint(f.geometry.coordinates, ground, height),
          attributes: {
            ...f.properties,
            ...h,
            height,
            heightMethod: "HN_P99",
            model: "LoD1",
            footprintDate: f.properties.OPNDATUM,
          },
        },
      ];
    });
  const output = {
    house: {
      id: config.id,
      name: config.name,
      address: config.address,
      postcode: config.postcode,
      city: config.city,
      country: "BE",
      rd: point,
      registry: {
        name: "Vlaamse geolocatiedienst en GRB",
        addressId: String(address.ID),
        buildingId: `Gbg ${target.properties.OIDN}`,
        url: geocodeUrl,
      },
    },
    source: {
      fetchedAt: new Date().toISOString(),
      title: "3D GRB · Vlaanderen",
      credit: "GRB / DHMV II · Digitaal Vlaanderen",
      detailLevel: "LoD 1 · afgeleid volumemodel",
      heightSource: `DHMV II · LiDAR ${targetHeight.DATUM_LID}`,
      crs: "EPSG:31370 (Belgische Lambert 72) + TAW",
      description:
        "De officiële adreslocatie ligt in deze GRB-contour; het GRB-objectnummer is ook in de 3D GRB-hoogtebron gecontroleerd. Gebouwvolumes volgen de GRB-contour en de P99-hoogte uit DHMV II. LoD 1 toont een vlak bovenvlak en reconstrueert de werkelijke dakvorm, ramen, deuren en binnenindeling niet. Contour en hoogtebron hebben verschillende opnamedata; latere verbouwingen kunnen ontbreken.",
      attribution:
        "Bron: Grootschalig Referentie Bestand Vlaanderen, Digitaal Vlaanderen; DHMV II, Digitaal Vlaanderen; Vlaamse geolocatiedienst.",
      license: "Open data · bronvermelding Digitaal Vlaanderen",
      infoUrl:
        "https://www.vlaanderen.be/digitaal-vlaanderen/onze-diensten-en-platformen/basiskaart-vlaanderen-grb/3d-grb",
      urls: [geocodeUrl, grbUrl.href, heightUrls[0]],
      contextOmittedWithoutMatchingHeight: omitted,
      contextCount: buildings.length - 1,
    },
    buildings,
  };
  await mkdir(modelDirectory, { recursive: true });
  await writeJsonAtomic(
    path.join(modelDirectory, `${config.id}.json`),
    modelSchema.parse(output),
  );
  await mkdir(path.join(directory, "imports", config.id), { recursive: true });
  await writeFile(
    path.join(directory, "imports", config.id, "source.json"),
    JSON.stringify(
      { address, footprint: target, height: targetHeight, heightUrls, omitted },
      null,
      2,
    ),
  );
  console.log(
    `Geïmporteerd: ${config.address}; GRB ${target.properties.OIDN}; hoogte ${targetHeight.HN_P99} m; ${buildings.length} brongebouwen.`,
  );
});
