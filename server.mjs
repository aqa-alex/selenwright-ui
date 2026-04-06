import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const target = process.env.SELENWRIGHT_TARGET || "http://localhost:4444";
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const apiRoutes = new Map([
  ["/api/meta", { type: "meta" }],
  ["/api/status", { upstream: "/status" }],
  ["/api/logs", { upstream: "/logs/?json" }],
  ["/api/videos", { upstream: "/video/?json" }],
]);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function resolveStaticFile(urlPath) {
  const trimmedPath = urlPath === "/" ? "/index.html" : urlPath;
  const decoded = decodeURIComponent(trimmedPath);
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolutePath = path.join(rootDir, normalized);

  if (!absolutePath.startsWith(rootDir)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  if (!path.extname(absolutePath)) {
    return path.join(rootDir, "index.html");
  }

  return null;
}

async function handleApi(req, res, route) {
  if (route.type === "meta") {
    sendJson(res, 200, { target });
    return;
  }

  try {
    const upstreamUrl = new URL(route.upstream, target);
    const upstreamResponse = await fetch(upstreamUrl, {
      headers: { accept: "application/json" },
      method: "GET",
    });

    const text = await upstreamResponse.text();
    res.writeHead(upstreamResponse.status, {
      "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: "upstream_unavailable",
      message: error instanceof Error ? error.message : "Failed to reach Selenwright target",
      target,
    });
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const route = apiRoutes.get(requestUrl.pathname);

  if (route) {
    await handleApi(req, res, route);
    return;
  }

  const filePath = resolveStaticFile(requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  res.writeHead(200, { "Content-Type": contentType });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(`${packageJson.name} listening on http://${host}:${port}`);
  console.log(`Proxy target: ${target}`);
});
