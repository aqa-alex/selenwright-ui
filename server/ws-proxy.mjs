import { createConnection as createNetConnection } from "node:net";
import { connect as createTlsConnection } from "node:tls";
import { allowedOrigins, host, port } from "./config.mjs";
import { isOriginAllowed } from "../server-origin.mjs";
import { formatForwardedHeaderLines } from "../server-ws-auth.mjs";
import { buildUpstreamOrigin } from "./ws-handshake.mjs";

export function createProxySocket(upstreamUrl) {
  const upstreamPort =
    upstreamUrl.port || (upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:" ? 443 : 80);

  if (upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:") {
    return createTlsConnection({
      host: upstreamUrl.hostname,
      port: upstreamPort,
      servername: upstreamUrl.hostname,
    });
  }

  return createNetConnection({
    host: upstreamUrl.hostname,
    port: upstreamPort,
  });
}

function sendUpgradeFailure(socket, statusCode, statusText) {
  if (socket.destroyed) {
    return;
  }

  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function handleWebSocketProxyUpgrade(req, socket, head, buildUpstreamUrl) {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const upgradeHeader = req.headers.upgrade;

  if (upgradeHeader?.toLowerCase() !== "websocket") {
    sendUpgradeFailure(socket, 426, "Upgrade Required");
    return;
  }

  if (!isOriginAllowed(req.headers.origin, req.headers.host, allowedOrigins)) {
    sendUpgradeFailure(socket, 403, "Forbidden");
    return;
  }

  const upstreamUrl = buildUpstreamUrl(requestUrl);
  const upstreamSocket = createProxySocket(upstreamUrl);
  let clientClosed = false;
  let proxyReady = false;

  const upstreamHeaders = [
    `GET ${upstreamUrl.pathname}${upstreamUrl.search} HTTP/1.1`,
    `Host: ${upstreamUrl.host}`,
    "Connection: Upgrade",
    "Upgrade: websocket",
  ];

  upstreamHeaders.push(`origin: ${buildUpstreamOrigin(upstreamUrl)}`);

  for (const headerName of [
    "sec-websocket-key",
    "sec-websocket-version",
    "sec-websocket-extensions",
    "sec-websocket-protocol",
    "user-agent",
  ]) {
    const headerValue = req.headers[headerName];
    if (headerValue) {
      upstreamHeaders.push(`${headerName}: ${headerValue}`);
    }
  }

  upstreamHeaders.push(...formatForwardedHeaderLines(req.headers));
  upstreamHeaders.push("\r\n");

  upstreamSocket.on("error", () => {
    if (!clientClosed && !proxyReady) {
      sendUpgradeFailure(socket, 502, "Bad Gateway");
      return;
    }

    if (!socket.destroyed) {
      socket.destroy();
    }
  });

  const connectEvent =
    upstreamUrl.protocol === "https:" || upstreamUrl.protocol === "wss:"
      ? "secureConnect"
      : "connect";

  upstreamSocket.once(connectEvent, () => {
    proxyReady = true;
    upstreamSocket.write(upstreamHeaders.join("\r\n"));
    if (head.length) {
      upstreamSocket.write(head);
    }
    socket.pipe(upstreamSocket);
    upstreamSocket.pipe(socket);
  });

  socket.on("error", () => {
    clientClosed = true;
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });

  socket.once("close", () => {
    clientClosed = true;
    if (!upstreamSocket.destroyed) {
      upstreamSocket.destroy();
    }
  });

  upstreamSocket.once("close", () => {
    if (!socket.destroyed) {
      socket.destroy();
    }
  });
}
