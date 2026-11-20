import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "../server/store.mjs";
import { importDossier } from "../server/import-dossier.mjs";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const [houseId, sourceRoot, manifestPath, sourceKey = "local-documents"] =
  process.argv.slice(2);
if (!houseId || !sourceRoot || !manifestPath)
  throw new Error(
    "Usage: npm run import:dossier -- <houseId> <sourceRoot> <private-manifest.json> [sourceKey]",
  );
const { directory, houses } = await loadRuntimeConfig(root);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const store = createStore(directory, houses);
try {
  const report = await importDossier({
    store,
    directory,
    houseId,
    sourceKey,
    sourceRoot,
    manifest,
  });
  const reportDirectory = path.join(directory, "imports");
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(
    path.join(reportDirectory, `report-${Date.now()}.json`),
    JSON.stringify(
      {
        houseId,
        sourceKey,
        sourceRoot,
        importedAt: new Date().toISOString(),
        ...report,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  store.close();
}
