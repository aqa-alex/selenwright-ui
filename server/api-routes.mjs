import { target } from "./config.mjs";

export const apiRoutes = new Map([
  ["/api/config", { accept: "application/json", upstream: "/config" }],
  ["/api/downloads", { accept: "application/json", upstream: "/downloads/?json" }],
  ["/api/history/settings", { accept: "application/json", upstream: "/history/settings" }],
  ["/api/meta", { type: "meta" }],
  ["/api/status", { accept: "application/json", upstream: "/status" }],
  ["/api/logs", { accept: "application/json", upstream: "/logs/?json" }],
  ["/api/videos", { accept: "application/json", upstream: "/video/?json" }],
  ["/api/browsers/discovered", { accept: "application/json", upstream: "/browsers/discovered" }],
  ["/api/browsers/adopt", { accept: "application/json", upstream: "/browsers/adopt" }],
  ["/api/browsers/dismiss", { accept: "application/json", upstream: "/browsers/dismiss" }],
  ["/api/browsers/rescan", { accept: "application/json", upstream: "/browsers/rescan" }],
  ["/api/stack/status", { accept: "application/json", upstream: "/stack/status" }],
  ["/api/stack/pull", { accept: "application/json", upstream: "/stack/pull", timeoutMs: 150_000 }],
  ["/api/stack/recreate", { accept: "application/json", upstream: "/stack/recreate", timeoutMs: 150_000 }],
  ["/api/stack/check-updates", { accept: "application/json", upstream: "/stack/check-updates", timeoutMs: 15_000 }],
  ["/api/stack/update", { accept: "application/json", upstream: "/stack/update", timeoutMs: 150_000 }],
  ["/api/whoami", { accept: "application/json", upstream: "/whoami" }],
  ["/api/login", { accept: "application/json", upstream: "/login" }],
  ["/api/logout", { accept: "application/json", upstream: "/logout" }],
  // Admin-managed API token endpoints. buildUpstreamUrl is used instead of a
  // static `upstream:` so `?owner=` (list/filter, bulk revoke) is forwarded.
  ["/api/admin/tokens", {
    accept: "application/json",
    buildUpstreamUrl: (requestUrl) => new URL(`/api/admin/tokens${requestUrl.search}`, target),
  }],
  ["/api/admin/users", {
    accept: "application/json",
    buildUpstreamUrl: (requestUrl) => new URL(`/api/admin/users${requestUrl.search}`, target),
  }],
]);

export function encodePathSegment(value) {
  try {
    return encodeURIComponent(decodeURIComponent(value));
  } catch {
    return encodeURIComponent(value);
  }
}

export function encodePathPreservingSlashes(value) {
  return String(value || "")
    .split("/")
    .filter(Boolean)
    .map((segment) => encodePathSegment(segment))
    .join("/");
}

export function buildUpstreamVncUrl(requestUrl) {
  const rawSessionPath = requestUrl.pathname.slice("/api/vnc/".length);
  const encodedSessionPath = encodePathPreservingSlashes(rawSessionPath);
  return new URL(`/vnc/${encodedSessionPath}${requestUrl.search}`, target);
}

export function buildUpstreamLogFileUrl(requestUrl) {
  const rawFilename = requestUrl.pathname.slice("/api/logs/file/".length);
  const encodedFilename = encodePathSegment(rawFilename);
  return new URL(`/logs/${encodedFilename}${requestUrl.search}`, target);
}

export function buildUpstreamLiveLogUrl(requestUrl) {
  const rawSessionId = requestUrl.pathname.slice("/api/logs/live/".length);
  const encodedSessionId = encodePathSegment(rawSessionId);
  return new URL(`/logs/${encodedSessionId}${requestUrl.search}`, target);
}

export function buildUpstreamDownloadFileUrl(requestUrl) {
  const rawPath = requestUrl.pathname.slice("/api/downloads/file/".length);
  const encodedPath = encodePathPreservingSlashes(rawPath);
  return new URL(`/downloads/${encodedPath}${requestUrl.search}`, target);
}

export function buildUpstreamVideoFileUrl(requestUrl) {
  const rawFilename = requestUrl.pathname.slice("/api/video/".length);
  const encodedFilename = encodePathSegment(rawFilename);
  return new URL(`/video/${encodedFilename}${requestUrl.search}`, target);
}

export function buildUpstreamClipboardUrl(requestUrl) {
  const rawSessionId = requestUrl.pathname.slice("/api/clipboard/".length);
  const encodedSessionId = encodePathSegment(rawSessionId);
  return new URL(`/clipboard/${encodedSessionId}${requestUrl.search}`, target);
}

export function resolveApiRoute(requestUrl) {
  const route = apiRoutes.get(requestUrl.pathname);
  if (route) {
    return route;
  }

  if (requestUrl.pathname.startsWith("/api/sessions/")) {
    const rawSessionId = requestUrl.pathname.slice("/api/sessions/".length);
    if (!rawSessionId) {
      return {
        error: {
          message: "Session id is required",
          statusCode: 400,
        },
      };
    }

    return {
      sessionId: rawSessionId,
      type: "terminate-session",
    };
  }

  if (requestUrl.pathname.startsWith("/api/logs/file/")) {
    const rawFilename = requestUrl.pathname.slice("/api/logs/file/".length);
    if (!rawFilename) {
      return {
        error: {
          message: "Log filename is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "text/plain",
      buildUpstreamUrl: () => buildUpstreamLogFileUrl(requestUrl),
    };
  }

  if (requestUrl.pathname.startsWith("/api/downloads/file/")) {
    const rawPath = requestUrl.pathname.slice("/api/downloads/file/".length);
    if (!rawPath) {
      return {
        error: {
          message: "Download path is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "application/octet-stream",
      buildUpstreamUrl: () => buildUpstreamDownloadFileUrl(requestUrl),
    };
  }

  if (requestUrl.pathname.startsWith("/api/video/")) {
    const rawFilename = requestUrl.pathname.slice("/api/video/".length);
    if (!rawFilename) {
      return {
        error: {
          message: "Video filename is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "application/octet-stream",
      buildUpstreamUrl: () => buildUpstreamVideoFileUrl(requestUrl),
    };
  }

  if (requestUrl.pathname.startsWith("/api/admin/tokens/")) {
    const rawTokenId = requestUrl.pathname.slice("/api/admin/tokens/".length);
    if (!rawTokenId || rawTokenId.includes("/")) {
      return {
        error: {
          message: "Token id is required",
          statusCode: 400,
        },
      };
    }

    const encodedTokenId = encodePathSegment(rawTokenId);
    return {
      accept: "application/json",
      buildUpstreamUrl: (url) =>
        new URL(`/api/admin/tokens/${encodedTokenId}${url.search}`, target),
    };
  }

  if (requestUrl.pathname.startsWith("/api/clipboard/")) {
    const rawSessionId = requestUrl.pathname.slice("/api/clipboard/".length);
    if (!rawSessionId) {
      return {
        error: {
          message: "Session id is required",
          statusCode: 400,
        },
      };
    }

    return {
      accept: "text/plain",
      buildUpstreamUrl: () => buildUpstreamClipboardUrl(requestUrl),
    };
  }

  return null;
}

export function resolveUpgradeHandler(requestUrl) {
  if (requestUrl.pathname.startsWith("/api/vnc/")) {
    return buildUpstreamVncUrl;
  }

  if (requestUrl.pathname.startsWith("/api/logs/live/")) {
    return buildUpstreamLiveLogUrl;
  }

  return null;
}
