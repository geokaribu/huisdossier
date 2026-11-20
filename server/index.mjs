import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const houses = JSON.parse(
  await readFile(path.join(root, "config/houses.json"), "utf8"),
);
const directory = process.env.HUISDOSSIER_DATA_DIR ?? path.join(root, "data");
const { app } = createApp({ directory, houses, root });
const server = createServer(app);
const port = Number(process.env.PORT ?? 4173);
if (process.argv.includes("--production")) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, ws: { server } },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
server.listen(port, "127.0.0.1", () =>
  console.log(`Huisdossier is klaar: http://127.0.0.1:${port}`),
);
