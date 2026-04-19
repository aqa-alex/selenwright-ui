import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSecurityHeaders } from "./security.mjs";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(rootDir, "..");
const distDir = path.join(repoRoot, "dist");

export const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

export function resolveStaticRootDir() {
  const explicitRoot = process.env.SELENWRIGHT_STATIC_ROOT;
  if (explicitRoot) {
    return path.resolve(repoRoot, explicitRoot);
  }

  const builtIndexPath = path.join(distDir, "index.html");
  if (existsSync(builtIndexPath)) {
    return distDir;
  }

  return repoRoot;
}

export function serveStaticFile(req, res, staticRootDir, urlPath) {
  const filePath = resolveStaticFile(staticRootDir, urlPath);
  if (!filePath) {
    res.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const contentType = mimeTypes[path.extname(filePath)] || "application/octet-stream";

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  }));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

export function resolveStaticFile(staticRootDir, urlPath) {
  const trimmedPath = urlPath === "/" ? "/index.html" : urlPath;
  let decoded;
  try {
    decoded = decodeURIComponent(trimmedPath);
  } catch {
    return null;
  }
  const absolutePath = path.resolve(staticRootDir, `.${decoded.startsWith("/") ? decoded : `/${decoded}`}`);
  const rootWithSep = staticRootDir.endsWith(path.sep) ? staticRootDir : staticRootDir + path.sep;

  if (absolutePath !== staticRootDir && !absolutePath.startsWith(rootWithSep)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  if (!path.extname(absolutePath)) {
    return path.join(staticRootDir, "index.html");
  }

  return null;
}
