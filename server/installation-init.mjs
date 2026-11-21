import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { houseCatalogSchema } from "./runtime-config.mjs";

export const installationDescriptor = {
  version: 1,
  catalog: "houses.json",
  data: "data",
  models: "models",
  port: 4173,
};
export async function initializeInstallation({ root, directory, houses }) {
  const catalog = houseCatalogSchema.parse(houses);
  const target = path.resolve(directory),
    code = path.resolve(root);
  const relative = path.relative(code, target);
  if (
    !relative ||
    (!relative.startsWith(".." + path.sep) &&
      !path.isAbsolute(relative) &&
      !relative.startsWith("data" + path.sep))
  )
    throw new Error(
      "Bewaar klantgegevens buiten de codecheckout of in een eigen submap onder data.",
    );
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target); // Refuse existing installations; never overwrite a customer.
  try {
    await mkdir(path.join(target, "data"));
    await mkdir(path.join(target, "models"));
    await writeFile(
      path.join(target, "houses.json"),
      JSON.stringify(catalog, null, 2) + "\n",
    );
    await writeFile(
      path.join(target, "installation.json"),
      JSON.stringify(installationDescriptor, null, 2) + "\n",
    );
    await writeFile(path.join(target, ".gitignore"), "*\n");
  } catch (error) {
    // Only this newly created, resolved directory is eligible for rollback.
    if (path.dirname(target) === path.resolve(path.dirname(directory)))
      await rm(target, { recursive: true, force: true });
    throw error;
  }
  return path.join(target, "installation.json");
}
