import { createReadStream, readFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  apiOnlyMode,
  consoleStreamPath,
  demoMode,
  host,
  port,
  target,
} from "./server/config.mjs";
import { withSecurityHeaders } from "./server/security.mjs";
import { mimeTypes, resolveStaticFile, resolveStaticRootDir } from "./server/static.mjs";
import { resolveApiRoute, resolveUpgradeHandler } from "./server/api-routes.mjs";
import { handleApi } from "./server/api-proxy.mjs";
import { handleConsoleStream } from "./server/console-hub.mjs";
import { handleLiveLogStream } from "./server/live-log-relay.mjs";
import { handleWebSocketProxyUpgrade } from "./server/ws-proxy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;

const staticRootDir = resolveStaticRootDir();


const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);

  if (requestUrl.pathname === consoleStreamPath) {
    handleConsoleStream(req, res);
    return;
  }

  if (requestUrl.pathname.startsWith("/api/logs/live/")) {
    handleLiveLogStream(req, res, requestUrl);
    return;
  }

  const route = resolveApiRoute(requestUrl);

  if (route) {
    await handleApi(req, res, route, requestUrl);
    return;
  }

  if (resolveUpgradeHandler(requestUrl)) {
    res.writeHead(426, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Upgrade Required");
    return;
  }

  if (apiOnlyMode) {
    res.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const filePath = resolveStaticFile(staticRootDir, requestUrl.pathname);
  if (!filePath) {
    res.writeHead(404, withSecurityHeaders({ "Content-Type": "text/plain; charset=utf-8" }));
    res.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  res.writeHead(200, withSecurityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  }));

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
});

server.on("upgrade", (req, socket, head) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const buildUpstreamUrl = resolveUpgradeHandler(requestUrl);

  if (!buildUpstreamUrl) {
    socket.destroy();
    return;
  }

  handleWebSocketProxyUpgrade(req, socket, head, buildUpstreamUrl);
});

server.listen(port, host, () => {
  const packageJson = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
  console.log(`${packageJson.name} listening on http://${host}:${port}`);
  console.log(apiOnlyMode ? "Static mode: disabled (API proxy only)" : `Static root: ${path.relative(rootDir, staticRootDir) || "."}`);
  console.log(demoMode ? "Demo mode: serving built-in demo data" : `Proxy target: ${target}`);
});
