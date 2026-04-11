import { defineComponent, h } from "vue";
import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

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
