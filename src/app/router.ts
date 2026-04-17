import { defineComponent, h } from "vue";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import LoginPage from "./pages/LoginPage.vue";
import { useIdentityStore } from "./stores/identity";

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
  | "api-tokens"
  | "login"
  | "not-found";

export interface ParsedRoute {
  name: RouteName;
  sessionId?: string;
}

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  /** Item is only shown when the current identity is admin. */
  adminOnly?: boolean;
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
      { href: "/settings/api-tokens", icon: "key", label: "API Tokens", adminOnly: true },
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
  if (pathname === "/settings/api-tokens") {
    return { name: "api-tokens" };
  }
  if (pathname === "/login") {
    return { name: "login" };
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
    name: "api-tokens",
    path: "/settings/api-tokens",
  },
  {
    component: LoginPage,
    name: "login",
    path: "/login",
  },
  {
    component: RouteAnchor,
    name: "not-found",
    path: "/:pathMatch(.*)*",
  },
];

export function createConsoleRouter() {
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });

  router.beforeEach(async (to) => {
    const identity = useIdentityStore();
    if (!identity.loaded) {
      await identity.load();
    }
    if (identity.requiresLogin && to.name !== "login") {
      return { name: "login" };
    }
    if (!identity.requiresLogin && to.name === "login") {
      return { name: "sessions" };
    }
  });

  return router;
}
