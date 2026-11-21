import { mkdir, writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

export async function writeJsonAtomic(file, value) {
  const temporary = file + "." + randomUUID() + ".tmp";
  await mkdir(path.dirname(file), { recursive: true });
  try {
    await writeFile(temporary, JSON.stringify(value), { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
