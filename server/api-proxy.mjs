import {
  demoMode,
  target,
  terminateAttemptTimeoutMs,
  upstreamArtifactTimeoutMs,
  upstreamRequestTimeoutMs,
} from "./config.mjs";
import { withSecurityHeaders } from "./security.mjs";
import {
  fetchWithTimeout,
  isUpstreamTimeoutError,
  readRequestBody,
  readUpstreamArrayBufferWithTimeout,
  readUpstreamTextWithTimeout,
  sendJson,
  truncateBodyPreview,
} from "./http-utils.mjs";
import { buildDemoConsoleSnapshot } from "./demo.mjs";
import { encodePathSegment } from "./api-routes.mjs";

export async function handleApi(req, res, route, requestUrl) {
  if (route.error) {
    sendJson(res, route.error.statusCode, {
      error: "bad_request",
      message: route.error.message,
    });
    return;
  }

  if (route.type === "meta") {
    sendJson(res, 200, { target: demoMode ? "demo" : target });
    return;
  }

  if (route.type === "terminate-session") {
    await handleSessionTerminate(req, res, route, requestUrl);
    return;
  }

  try {
    if (demoMode && route.upstream) {
      const demoSnapshot = buildDemoConsoleSnapshot();
      const demoRoutes = {
        "/config": demoSnapshot.config.value,
        "/status": demoSnapshot.status.value,
        "/logs/?json": demoSnapshot.logs.value,
        "/video/?json": demoSnapshot.videos.value,
        "/downloads/?json": demoSnapshot.downloads.value,
        "/history/settings": demoSnapshot.historySettings.value,
        "/whoami": { user: "demo", isAdmin: true, authMode: "none", authenticated: true },
      };
      const demoData = demoRoutes[route.upstream];
      if (demoData !== undefined) {
        sendJson(res, 200, demoData);
        return;
      }
    }

    const upstreamUrl = route.buildUpstreamUrl
      ? route.buildUpstreamUrl(requestUrl)
      : new URL(route.upstream, target);
    const requestBody = await readRequestBody(req);
    const requestHeaders = { accept: route.accept || "application/json" };
    const timeoutMs = resolveProxyTimeoutMs(route);
    if (req.headers["content-type"]) {
      requestHeaders["content-type"] = req.headers["content-type"];
    }
    if (req.headers["authorization"]) {
      requestHeaders["authorization"] = req.headers["authorization"];
    }
    if (req.headers["cookie"]) {
      requestHeaders["cookie"] = req.headers["cookie"];
    }
    const upstreamResponse = await fetchWithTimeout(
      upstreamUrl,
      {
        body: requestBody.length && req.method !== "GET" && req.method !== "HEAD" ? requestBody : undefined,
        headers: requestHeaders,
        method: req.method || "GET",
      },
      timeoutMs,
      `${req.method || "GET"} ${upstreamUrl.pathname}`,
    );

    const contentType =
      upstreamResponse.headers.get("content-type") ||
      (route.accept === "text/plain" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8");

    const expectsJson = (route.accept || "").includes("application/json");
    if (expectsJson && !contentType.toLowerCase().includes("application/json")) {
      const body = await readUpstreamTextWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      );
      // Auth failures on upstream are plain-text ("Unauthorized" / "Forbidden")
      // from net/http's http.Error. Preserve the original status code so the
      // browser-side 401 handler can trigger the session-expired redirect
      // instead of seeing an opaque 502 upstream-contract error.
      if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
        sendJson(res, upstreamResponse.status, {
          error: upstreamResponse.status === 401 ? "unauthorized" : "forbidden",
          message: truncateBodyPreview(body) || (upstreamResponse.status === 401 ? "Unauthorized" : "Forbidden"),
        });
        return;
      }
      sendJson(res, 502, {
        error: "upstream_contract_error",
        message: `Expected application/json from ${upstreamUrl.pathname}, got ${contentType || "unknown content-type"}: ${truncateBodyPreview(body)}`,
        target,
      });
      return;
    }

    const responseHeaders = withSecurityHeaders({
      "Content-Type": contentType,
    });
    const setCookieValues = upstreamResponse.headers.getSetCookie?.() ?? [];
    for (const value of setCookieValues) {
      if (!responseHeaders["set-cookie"]) {
        responseHeaders["set-cookie"] = [];
      }
      responseHeaders["set-cookie"].push(value);
    }
    res.writeHead(upstreamResponse.status, responseHeaders);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    if (contentType.startsWith("text/") || contentType.includes("json") || contentType.includes("javascript")) {
      const text = await readUpstreamTextWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      );
      res.end(text);
      return;
    }

    const buffer = Buffer.from(
      await readUpstreamArrayBufferWithTimeout(
        upstreamResponse,
        timeoutMs,
        `${req.method || "GET"} ${upstreamUrl.pathname} response`,
      ),
    );
    res.end(buffer);
  } catch (error) {
    if (error instanceof Error && error.code === "REQUEST_TOO_LARGE") {
      sendJson(res, 413, {
        error: "request_too_large",
        message: error.message,
      });
      return;
    }
    sendJson(res, isUpstreamTimeoutError(error) ? 504 : 502, {
      error: isUpstreamTimeoutError(error) ? "upstream_timeout" : "upstream_unavailable",
      message: error instanceof Error ? error.message : "Failed to reach Selenwright target",
      target,
    });
  }
}

async function handleSessionTerminate(req, res, route, requestUrl) {
  if ((req.method || "GET").toUpperCase() !== "DELETE") {
    res.writeHead(405, withSecurityHeaders({ Allow: "DELETE", "Content-Type": "application/json; charset=utf-8" }));
    res.end(JSON.stringify({ error: "method_not_allowed", message: "Use DELETE to terminate a session." }));
    return;
  }

  const protocol = (requestUrl.searchParams.get("protocol") || "").toLowerCase();
  if (protocol !== "selenium" && protocol !== "playwright") {
    sendJson(res, 400, {
      error: "bad_request",
      message: "Query parameter `protocol` must be either `selenium` or `playwright`.",
    });
    return;
  }

  const encodedSessionId = encodePathSegment(route.sessionId);
  const upstreamPath = protocol === "playwright"
    ? `/playwright/session/${encodedSessionId}`
    : `/wd/hub/session/${encodedSessionId}`;
  const upstreamUrl = new URL(upstreamPath, target);

  const upstreamHeaders = {
    accept: "application/json, text/plain;q=0.9, */*;q=0.1",
  };
  if (req.headers["authorization"]) {
    upstreamHeaders.authorization = req.headers["authorization"];
  }
  if (req.headers["cookie"]) {
    upstreamHeaders.cookie = req.headers["cookie"];
  }

  try {
    const upstreamResponse = await fetchWithTimeout(
      upstreamUrl,
      {
        headers: upstreamHeaders,
        method: "DELETE",
      },
      terminateAttemptTimeoutMs,
      `DELETE ${upstreamUrl.pathname}`,
    );
    const responseText =
      upstreamResponse.status === 204
        ? ""
        : await readUpstreamTextWithTimeout(
            upstreamResponse,
            terminateAttemptTimeoutMs,
            `DELETE ${upstreamUrl.pathname} response`,
          );
    const message = extractUpstreamResponseMessage(responseText);

    if (upstreamResponse.ok) {
      sendJson(res, 200, {
        message: message || "Session terminated",
        ok: true,
        sessionId: route.sessionId,
      });
      return;
    }

    sendJson(res, 502, {
      error: "session_terminate_failed",
      message: message || `Unable to terminate session (${upstreamResponse.status}).`,
      sessionId: route.sessionId,
    });
  } catch (error) {
    sendJson(res, 502, {
      error: "session_terminate_failed",
      message: error instanceof Error ? error.message : "Failed to reach upstream target",
      sessionId: route.sessionId,
    });
  }
}

function resolveProxyTimeoutMs(route) {
  if (route?.timeoutMs) {
    return route.timeoutMs;
  }

  if (route?.accept === "application/octet-stream" || route?.accept === "text/plain") {
    return upstreamArtifactTimeoutMs;
  }

  return upstreamRequestTimeoutMs;
}

function extractUpstreamResponseMessage(responseText) {
  const trimmed = String(responseText || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    const payload = JSON.parse(trimmed);
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.reason === "string" && payload.reason.trim()) {
        return payload.reason.trim();
      }
    }
  } catch {
  }

  return truncateBodyPreview(trimmed);
}
