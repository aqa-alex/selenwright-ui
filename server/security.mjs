const baseSecurityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

const htmlContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self'",
  // Vue injects scoped <style> tags at runtime; inline styles remain permitted.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export function withSecurityHeaders(headers = {}) {
  const contentType = headers["Content-Type"] || headers["content-type"] || "";
  const merged = { ...baseSecurityHeaders, ...headers };
  if (/html/i.test(contentType) && !merged["Content-Security-Policy"]) {
    merged["Content-Security-Policy"] = htmlContentSecurityPolicy;
  }
  return merged;
}
