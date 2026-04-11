import { createApp } from "vue";
import VncViewerPage from "./vnc/VncViewerPage.vue";

const root = document.getElementById("vnc-app");

if (root instanceof HTMLElement) {
  createApp(VncViewerPage).mount(root);
}
