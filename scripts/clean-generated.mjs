import { readdir, lstat, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const generated = (name) =>
  name === ".playwright-mcp" ||
  name === "test-results" ||
  /^huisdossier-[^/\\]+\.png$/i.test(name);

async function bytes(location) {
  const stat = await lstat(location);
  if (stat.isSymbolicLink())
    throw new Error(`Geen koppelingen opruimen: ${location}`);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory())
    throw new Error(`Onbekend bestandstype: ${location}`);
  let total = 0;
  for (const name of await readdir(location))
    total += await bytes(path.join(location, name));
  return total;
}

// Only known, direct children of this checkout are eligible. Private data, dependencies
// and the production build stay available; links are never followed or deleted.
export async function cleanGenerated(root, { apply = false } = {}) {
  const workspace = await realpath(path.resolve(root));
  const targets = [];
  for (const name of await readdir(workspace)) {
    if (!generated(name)) continue;
    const location = path.resolve(workspace, name);
    if (path.dirname(location) !== workspace)
      throw new Error("Doel ligt buiten de werkmap.");
    targets.push({ location, bytes: await bytes(location) });
  }
  // Inspect every target first; a suspicious link prevents the entire cleanup.
  if (apply)
    for (const target of targets)
      await rm(target.location, { recursive: true, force: false });
  return {
    applied: apply,
    files: targets.length,
    bytes: targets.reduce((sum, target) => sum + target.bytes, 0),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply"))
    throw new Error("Gebruik: npm run clean -- [--apply]");
  const result = await cleanGenerated(
    fileURLToPath(new URL("../", import.meta.url)),
    { apply: args.includes("--apply") },
  );
  console.log(
    `${result.applied ? "Opgeruimd" : "Voorbeeld, nog niets verwijderd"}: ${result.files} tijdelijke paden, ${(result.bytes / 1048576).toFixed(2)} MB.`,
  );
}
