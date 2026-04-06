export const navGroups = [
  {
    title: "Console",
    items: [
      { href: "/sessions", icon: "sessions", label: "Sessions" },
      { href: "/artifacts/videos", icon: "videos", label: "Videos" },
      { href: "/artifacts/logs", icon: "logs", label: "Logs" },
      { href: "/artifacts/downloads", icon: "downloads", label: "Downloads" },
    ],
  },
  {
    title: "Runtime",
    items: [
      { href: "/browsers", icon: "browsers", label: "Browsers" },
      { href: "/configuration", icon: "configuration", label: "Configuration" },
      { href: "/system", icon: "system", label: "System" },
      { href: "/settings", icon: "settings", label: "Settings" },
    ],
  },
];

export function buildSessionPath(sessionId) {
  return `/sessions/${sessionId}`;
}

export function navigate(pathname, { replace = false } = {}) {
  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", pathname);
  window.dispatchEvent(new CustomEvent("selenwright:navigate"));
}

export function parseRoute(pathname) {
  if (pathname === "/") {
    return { name: "sessions" };
  }
  if (pathname.startsWith("/sessions/")) {
    return { name: "session-detail", sessionId: pathname.replace("/sessions/", "") };
  }
  if (pathname === "/sessions") {
    return { name: "sessions" };
  }
  if (pathname === "/artifacts/videos") {
    return { name: "videos" };
  }
  if (pathname === "/artifacts/logs") {
    return { name: "logs" };
  }
  if (pathname === "/artifacts/downloads") {
    return { name: "downloads" };
  }
  if (pathname === "/browsers") {
    return { name: "browsers" };
  }
  if (pathname === "/configuration") {
    return { name: "configuration" };
  }
  if (pathname === "/system") {
    return { name: "system" };
  }
  if (pathname === "/settings") {
    return { name: "settings" };
  }
  return { name: "not-found" };
}

