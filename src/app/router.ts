import { defineComponent, h } from "vue";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

export type RouteName =
  | "sessions"
  | "session-detail"
  | "videos"
  | "logs"
  | "downloads"
  | "browsers"
  | "configuration"
  | "system"
  | "settings"
  | "not-found";

export interface ParsedRoute {
  name: RouteName;
  sessionId?: string;
}

export interface NavItem {
  href: string;
  icon: string;
  label: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
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

export function buildSessionPath(sessionId: string): string {
  return `/sessions/${encodeURIComponent(sessionId)}`;
}

export function parseRoute(pathname: string): ParsedRoute {
  if (pathname === "/" || pathname === "/sessions") {
    return { name: "sessions" };
  }
  if (pathname.startsWith("/sessions/")) {
    const raw = pathname.slice("/sessions/".length);
    let sessionId = raw;
    try {
      sessionId = decodeURIComponent(raw);
    } catch {
    }
    return {
      name: "session-detail",
      sessionId,
    };
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

const RouteAnchor = defineComponent({
  name: "RouteAnchor",
  render() {
    return h("div", {
      "aria-hidden": "true",
      style: "display:none",
    });
  },
});

const routes: RouteRecordRaw[] = [
  {
    component: RouteAnchor,
    name: "sessions",
    path: "/",
  },
  {
    component: RouteAnchor,
    name: "sessions-list",
    path: "/sessions",
  },
  {
    component: RouteAnchor,
    name: "session-detail",
    path: "/sessions/:sessionId",
  },
  {
    component: RouteAnchor,
    name: "videos",
    path: "/artifacts/videos",
  },
  {
    component: RouteAnchor,
    name: "logs",
    path: "/artifacts/logs",
  },
  {
    component: RouteAnchor,
    name: "downloads",
    path: "/artifacts/downloads",
  },
  {
    component: RouteAnchor,
    name: "browsers",
    path: "/browsers",
  },
  {
    component: RouteAnchor,
    name: "configuration",
    path: "/configuration",
  },
  {
    component: RouteAnchor,
    name: "system",
    path: "/system",
  },
  {
    component: RouteAnchor,
    name: "settings",
    path: "/settings",
  },
  {
    component: RouteAnchor,
    name: "not-found",
    path: "/:pathMatch(.*)*",
  },
];

export function createConsoleRouter() {
  return createRouter({
    history: createWebHistory(),
    routes,
  });
}
