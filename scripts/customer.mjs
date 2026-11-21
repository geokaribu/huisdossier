import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const [directory, command = "start", ...args] = process.argv.slice(2);
const commands = {
  start: ["server/index.mjs", "--production"],
  dev: ["server/index.mjs"],
  check: ["scripts/check-installation.mjs"],
  "import:house": ["scripts/import-house.mjs"],
  "import:dossier": ["scripts/import-dossier.mjs"],
  "import:lighting": ["scripts/import-lighting.mjs"],
  backup: ["scripts/installation-backup.mjs", "backup"],
  restore: ["scripts/installation-backup.mjs", "restore"],
};
if (!directory || !commands[command]) {
  console.error(
    "Gebruik: npm run customer -- <klantmap> <start|dev|check|import:house|import:dossier|import:lighting|backup|restore> [argumenten]",
  );
  process.exitCode = 1;
} else {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const env = {
    ...process.env,
    HUISDOSSIER_INSTALLATION: path.resolve(directory, "installation.json"),
  };
  // The explicitly chosen customer wins over any leftover legacy shell settings.
  for (const name of [
    "HUISDOSSIER_HOUSES_FILE",
    "HUISDOSSIER_DATA_DIR",
    "HUISDOSSIER_MODELS_DIR",
  ])
    delete env[name];
  const child = spawn(
    process.execPath,
    [
      ...commands[command].map((part, index) =>
        index === 0 ? path.join(root, part) : part,
      ),
      ...args,
    ],
    { cwd: root, env, stdio: "inherit", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
