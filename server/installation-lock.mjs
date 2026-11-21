import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const filename = (directory) => path.join(directory, ".server-lock.json");
export async function assertInstallationStopped(directory) {
  let lock;
  try {
    lock = JSON.parse(await readFile(filename(directory), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw new Error(
      "Installatieslot is ongeldig; controleer eerst of de server gestopt is.",
    );
  }
  if (!Number.isInteger(lock.pid) || lock.pid < 1)
    throw new Error("Installatieslot bevat geen geldig proces.");
  try {
    process.kill(lock.pid, 0);
  } catch (error) {
    if (error.code === "ESRCH") {
      await unlink(filename(directory));
      return;
    }
    throw new Error("Kan niet vaststellen of de installatie gestopt is.");
  }
  throw new Error(
    "Deze installatie is nog actief. Stop de server vóór back-up, herstel of een tweede start.",
  );
}
export async function lockInstallation(directory) {
  await mkdir(directory, { recursive: true });
  const token = randomUUID();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(filename(directory), "wx", 0o600);
      try {
        await handle.writeFile(
          JSON.stringify({
            pid: process.pid,
            token,
            startedAt: new Date().toISOString(),
          }),
        );
      } finally {
        await handle.close();
      }
      return async () => {
        try {
          const current = JSON.parse(
            await readFile(filename(directory), "utf8"),
          );
          if (current.token === token) await unlink(filename(directory));
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      await assertInstallationStopped(directory);
    }
  }
  throw new Error("Een ander proces start deze installatie.");
}
export async function withInstallationLock(directory, action) {
  const release = await lockInstallation(directory);
  try {
    return await action();
  } finally {
    await release();
  }
}
