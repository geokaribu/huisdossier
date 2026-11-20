import { fileURLToPath } from "node:url";
import { checkInstallation } from "../server/installation-check.mjs";

try {
  const report = await checkInstallation(
    fileURLToPath(new URL("../", import.meta.url)),
  );
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(report, null, 2));
  else {
    console.log(
      `Configuratie: ${report.catalogPath}\nPrivéopslag: ${report.directory}\nModellen: ${report.modelDirectory}`,
    );
    for (const dossier of report.dossiers) {
      console.log(
        `\n${dossier.id}: ${dossier.ready ? "lokale bestanden in orde" : "actie nodig"}`,
      );
      for (const check of dossier.checks)
        console.log(
          `  ${check.name}: ${check.status === "ok" ? "in orde" : check.status === "absent" ? "niet ingericht (optioneel)" : check.message}`,
        );
    }
    console.log(`\n${report.limits.join("\n")}`);
  }
  if (!report.ready) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
