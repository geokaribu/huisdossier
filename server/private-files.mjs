import { realpath } from "node:fs/promises";
import path from "node:path";

const canonical = (value) => path.resolve(value).toLowerCase();
const within = (candidate, directory) =>
  candidate === directory || candidate.startsWith(directory + path.sep);

/** Defense before either Vite or production static middleware; API reads stay explicit. */
export function privateFiles({
  root,
  directory,
  catalogPath = path.join(root, "config/houses.json"),
}) {
  const privateDirectories = [
    directory,
    path.join(root, "data"),
    path.join(root, ".git"),
  ];
  const directories = privateDirectories.map(canonical);
  const catalog = canonical(catalogPath);
  const protectedPaths = Promise.all(
    [...privateDirectories, catalogPath].map(async (location) => {
      try {
        return canonical(await realpath(location));
      } catch {
        return canonical(location);
      }
    }),
  );
  return async (req, res, next) => {
    let pathname = req.originalUrl.split("?")[0];
    try {
      for (let n = 0; n < 4; n++) {
        const decoded = decodeURIComponent(pathname);
        if (decoded === pathname) break;
        pathname = decoded;
      }
    } catch {
      return res.status(400).end();
    }
    pathname = pathname.replaceAll("\\", "/");
    // Real API routes read their own allowlisted files. Never exempt a raw URL
    // containing traversal: Vite may later normalize it into a private file path.
    if (
      req.originalUrl.startsWith("/api/") &&
      pathname.startsWith("/api/") &&
      !pathname
        .split("/")
        .some((segment) => segment === "." || segment === "..")
    )
      return next();
    if (
      /\/(?:\.env[^/]*|\.git)(?:\/|$)|\.sqlite(?:-(?:wal|shm))?$/i.test(
        pathname,
      )
    )
      return res.status(404).end();
    const candidate = pathname.startsWith("/@fs/")
      ? path.resolve(pathname.slice(5))
      : path.resolve(root, "." + pathname);
    const targets = [canonical(candidate)];
    const resolved = await protectedPaths;
    try {
      targets.push(canonical(await realpath(candidate)));
    } catch {
      /* SPA/virtual modules need not exist on disk */
    }
    if (
      targets.some(
        (target) =>
          target === catalog ||
          target === resolved.at(-1) ||
          [...directories, ...resolved.slice(0, -1)].some((folder) =>
            within(target, folder),
          ),
      )
    )
      return res.status(404).end();
    next();
  };
}
