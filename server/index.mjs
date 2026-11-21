import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.mjs";
import { loadRuntimeConfig } from "./runtime-config.mjs";
import { lockInstallation } from "./installation-lock.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const { houses, directory, modelDirectory, catalogPath, port } =
  await loadRuntimeConfig(root);
const release = await lockInstallation(directory);
const { app, store } = createApp({
  directory,
  houses,
  root,
  modelDirectory,
  catalogPath,
});
const server = createServer(app);
if (process.argv.includes("--production")) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      ws: { server },
      fs: {
        deny: [
          ".env",
          ".env.*",
          "*.{crt,pem,key,p12,pfx,cer,der}",
          ".npmrc",
          ".yarnrc.yml",
          "**/.git/**",
          directory.replaceAll("\\", "/") + "/**",
          catalogPath.replaceAll("\\", "/"),
        ],
      },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Huisdossier is klaar: http://127.0.0.1:${server.address().port}`,
  ),
);
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  store.close();
  await release();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
server.on("error", async (error) => {
  console.error(error.message);
  store.close();
  await release();
  process.exit(1);
});
