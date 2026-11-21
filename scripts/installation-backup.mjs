import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadRuntimeConfig } from "../server/runtime-config.mjs";
import {
  backupInstallation,
  restoreInstallation,
} from "../server/installation-backup.mjs";

try {
  const [command, first, second] = process.argv.slice(2);
  const root = fileURLToPath(new URL("../", import.meta.url));
  if (command === "backup" && first && !second) {
    const result = await backupInstallation(
      await loadRuntimeConfig(root),
      path.resolve(first),
    );
    console.log(
      `Installatieback-up bewaard: ${result.directory} (${result.files} bestanden met controlesom). Bewaar deze map privé, ook de AI-instellingen.`,
    );
  } else if (command === "restore" && first && second) {
    const result = await restoreInstallation(first, second, root);
    console.log(
      `Installatie hersteld naar een nieuwe map: ${result.directory} (${result.files} gecontroleerde bestanden). Controleer en start deze map met npm run customer.`,
    );
  } else
    throw new Error(
      "Gebruik: npm run backup -- <nieuwe-back-upmap> of npm run restore -- <back-upmap> <nieuwe-klantmap>. Stop de installatie eerst.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
