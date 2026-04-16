import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { createLogger, defineConfig } from "vite";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const apiTarget =
  process.env.SELENWRIGHT_API_TARGET ||
  `http://${host}:${port + 1}`;

const logger = createLogger();
const originalError = logger.error.bind(logger);
logger.error = (msg, opts) => {
  if (typeof msg === "string" && msg.includes("ws proxy")) return;
  originalError(msg, opts);
};

export default defineConfig({
  customLogger: logger,
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
