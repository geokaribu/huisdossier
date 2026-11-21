import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initializeInstallation } from "../server/installation-init.mjs";

try {
  const [directory, option, input] = process.argv.slice(2);
  if (!directory || (option && (option !== "--catalog" || !input)))
    throw new Error(
      "Gebruik: npm run customer:init -- <klantmap> [--catalog <catalogus.json>]",
    );
  let houses;
  if (input) houses = JSON.parse(await readFile(path.resolve(input), "utf8"));
  else {
    const prompt = createInterface({ input: stdin, output: stdout });
    try {
      const address = (await prompt.question("Adres: ")).trim();
      const city = (await prompt.question("Plaats: ")).trim();
      const postcode = (await prompt.question("Postcode: ")).trim();
      const name =
        (await prompt.question("Naam van het huisboek: ")).trim() || address;
      const proposed = address
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      const id =
        (await prompt.question(`Vaste dossier-ID [${proposed}]: `)).trim() ||
        proposed;
      houses = [
        {
          id,
          name,
          address,
          city,
          postcode,
          provider: "none",
          starterAssets: [],
        },
      ];
    } finally {
      prompt.close();
    }
  }
  const descriptor = await initializeInstallation({
    root: fileURLToPath(new URL("../", import.meta.url)),
    directory,
    houses,
  });
  console.log(
    `Klantinstallatie aangemaakt: ${descriptor}\nPas woningen en startonderdelen aan in houses.json. Er is nog geen 3D-model; het huisboek is al bruikbaar.\nStart: npm run customer -- "${path.resolve(directory)}" start`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
