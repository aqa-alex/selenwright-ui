import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const apiTarget =
  process.env.SELENWRIGHT_API_TARGET ||
  "http://127.0.0.1:4174";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        vnc: path.resolve(__dirname, "vnc.html"),
      },
    },
  },
  plugins: [vue()],
  server: {
    host,
    port,
    proxy: {
      "/api": {
        changeOrigin: false,
        target: apiTarget,
        ws: true,
      },
    },
    strictPort: true,
  },
});
