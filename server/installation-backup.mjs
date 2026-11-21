import {
  cp,
  mkdir,
  readFile,
  writeFile,
  readdir,
  lstat,
  rm,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { installationDescriptor } from "./installation-init.mjs";
import { lockInstallation } from "./installation-lock.mjs";
import { houseCatalogSchema } from "./runtime-config.mjs";

const inside = (target, root) => {
  const relative = path.relative(root, target);
  return (
    !relative ||
    (!relative.startsWith(".." + path.sep) && !path.isAbsolute(relative))
  );
};
const json = async (file, value) =>
  writeFile(file, JSON.stringify(value, null, 2) + "\n", {
    flag: "wx",
    mode: 0o600,
  });
async function inventory(directory, prefix = "") {
  const result = [];
  for (const entry of await readdir(path.join(directory, prefix), {
    withFileTypes: true,
  })) {
    if (entry.name === ".server-lock.json") continue;
    const relative = path.posix.join(prefix, entry.name);
    const location = path.join(directory, relative);
    if ((await lstat(location)).isSymbolicLink())
      throw new Error(
        "Symbolische koppelingen zijn niet toegestaan in een installatieback-up.",
      );
    if (entry.isDirectory())
      result.push(...(await inventory(directory, relative)));
    else if (entry.isFile() && relative !== "backup.json") {
      const hash = createHash("sha256");
      for await (const buffer of createReadStream(location))
        hash.update(buffer);
      result.push({ path: relative, sha256: hash.digest("hex") });
    }
  }
  return result.sort((a, b) => a.path.localeCompare(b.path));
}
async function checkDatabase(directory) {
  const file = path.join(directory, "huisdossier.sqlite");
  try {
    await lstat(file);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const values = db.prepare("PRAGMA integrity_check").all();
    if (values.some((row) => Object.values(row)[0] !== "ok"))
      throw new Error("De database-integriteitscontrole is mislukt.");
  } finally {
    db.close();
  }
}
function checkDestination(destination, config) {
  const target = path.resolve(destination);
  for (const source of [
    config.directory,
    config.modelDirectory,
    path.dirname(config.catalogPath),
  ])
    if (inside(target, path.resolve(source)))
      throw new Error("Bewaar de back-up buiten de bronmappen.");
  if (
    inside(target, path.resolve(config.root)) &&
    !inside(target, path.join(config.root, "data"))
  )
    throw new Error("Privéback-ups horen buiten de codecheckout.");
  return target;
}
async function copyOptional(source, target) {
  try {
    await lstat(source);
  } catch (error) {
    if (error.code === "ENOENT") {
      await mkdir(target);
      return;
    }
    throw error;
  }
  await inventory(source); // Reject links before copying private trees.
  await cp(source, target, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (file) => path.basename(file) !== ".server-lock.json",
  });
}
export async function backupInstallation(config, destination) {
  const target = checkDestination(destination, config);
  const release = await lockInstallation(config.directory);
  let created = false;
  try {
    await checkDatabase(config.directory);
    await mkdir(path.dirname(target), { recursive: true });
    await mkdir(target); // Exclusive reservation: existing destinations are never overwritten.
    created = true;
    await copyOptional(config.directory, path.join(target, "data"));
    await copyOptional(config.modelDirectory, path.join(target, "models"));
    await json(path.join(target, "houses.json"), config.houses);
    await json(path.join(target, "installation.json"), {
      ...installationDescriptor,
      port: config.port || 4173,
    });
    await writeFile(path.join(target, ".gitignore"), "*\n");
    const files = await inventory(target);
    await json(path.join(target, "backup.json"), {
      version: 1,
      createdAt: new Date().toISOString(),
      files,
    });
    return { directory: target, files: files.length };
  } catch (error) {
    if (
      created &&
      target === path.resolve(destination) &&
      path.dirname(target) !== target
    )
      await rm(target, { recursive: true, force: true });
    throw error;
  } finally {
    await release();
  }
}
export async function restoreInstallation(source, destination, root) {
  const backup = path.resolve(source),
    target = path.resolve(destination);
  if (inside(target, backup) || inside(backup, target))
    throw new Error("Herstelmap en back-upmap moeten gescheiden blijven.");
  if (
    inside(target, path.resolve(root)) &&
    !inside(target, path.join(root, "data"))
  )
    throw new Error(
      "Herstel klantgegevens buiten de codecheckout of onder data.",
    );
  const manifest = JSON.parse(
    await readFile(path.join(backup, "backup.json"), "utf8"),
  );
  if (manifest.version !== 1 || !Array.isArray(manifest.files))
    throw new Error("Onbekende back-upversie.");
  const actual = await inventory(backup);
  if (JSON.stringify(actual) !== JSON.stringify(manifest.files))
    throw new Error(
      "De back-up is onvolledig of gewijzigd; controlesommen komen niet overeen.",
    );
  houseCatalogSchema.parse(
    JSON.parse(await readFile(path.join(backup, "houses.json"), "utf8")),
  );
  const descriptor = JSON.parse(
    await readFile(path.join(backup, "installation.json"), "utf8"),
  );
  if (
    descriptor.version !== 1 ||
    descriptor.catalog !== "houses.json" ||
    descriptor.data !== "data" ||
    descriptor.models !== "models"
  )
    throw new Error("De back-up bevat geen draagbare installatie.");
  await checkDatabase(path.join(backup, "data"));
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(target);
  try {
    await cp(backup, target, {
      recursive: true,
      force: false,
      errorOnExist: true,
      filter: (file) =>
        path.resolve(file) !== path.join(backup, "backup.json") &&
        path.basename(file) !== ".server-lock.json",
    });
    if (JSON.stringify(await inventory(target)) !== JSON.stringify(actual))
      throw new Error(
        "De herstelde bestanden komen niet overeen met de back-up.",
      );
    return { directory: target, files: actual.length };
  } catch (error) {
    if (target === path.resolve(destination) && path.dirname(target) !== target)
      await rm(target, { recursive: true, force: true });
    throw error;
  }
}
