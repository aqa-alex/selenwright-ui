import { maxRequestBodyBytes } from "./config.mjs";
import { withSecurityHeaders } from "./security.mjs";

export function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, withSecurityHeaders({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  }));
  res.end(JSON.stringify(payload));
}

export function formatTimeoutMs(timeoutMs) {
  return timeoutMs % 1000 === 0 ? `${timeoutMs / 1000}s` : `${timeoutMs}ms`;
}

export function createUpstreamTimeoutError(contextLabel, timeoutMs, cause) {
  const error = new Error(`${contextLabel} timed out after ${formatTimeoutMs(timeoutMs)}.`);
  error.cause = cause;
  error.code = "UPSTREAM_TIMEOUT";
  return error;
}

export function isUpstreamTimeoutError(error) {
  return Boolean(error) && typeof error === "object" && error.code === "UPSTREAM_TIMEOUT";
}

export async function fetchWithTimeout(resource, options = {}, timeoutMs, contextLabel) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createUpstreamTimeoutError(contextLabel, timeoutMs, error);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function withTimeout(promise, timeoutMs, contextLabel) {
  let timer = 0;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(createUpstreamTimeoutError(contextLabel, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export async function readRequestBody(req) {
  const contentLength = Number(req.headers["content-length"]);
  if (Number.isFinite(contentLength) && contentLength > maxRequestBodyBytes) {
    const error = new Error(`Request body exceeds ${maxRequestBodyBytes} bytes`);
    error.code = "REQUEST_TOO_LARGE";
    throw error;
  }

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBodyBytes) {
      const error = new Error(`Request body exceeds ${maxRequestBodyBytes} bytes`);
      error.code = "REQUEST_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function truncateBodyPreview(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "<empty body>";
  }
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}
