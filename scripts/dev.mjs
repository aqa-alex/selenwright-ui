import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const publicHost = process.env.HOST || "127.0.0.1";
const publicPort = Number(process.env.PORT || 4173);
const apiHost = process.env.SELENWRIGHT_DEV_API_HOST || "127.0.0.1";
const apiPort = Number(process.env.SELENWRIGHT_DEV_API_PORT || publicPort + 1);
const apiTarget = `http://${apiHost}:${apiPort}`;

const children = new Set();
let shuttingDown = false;
const apiEnv = {
  ...process.env,
  HOST: apiHost,
  PORT: String(apiPort),
  SELENWRIGHT_API_ONLY: "true",
};

if (typeof process.env.DEMO_MODE === "string") {
  apiEnv.DEMO_MODE = process.env.DEMO_MODE;
}

const apiProcess = spawnProcess(process.execPath, ["server.mjs"], {
  ...apiEnv,
});

const viteCliPath = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");
const viteProcess = spawnProcess(process.execPath, [
  viteCliPath,
  "--host",
  publicHost,
  "--port",
  String(publicPort),
  "--strictPort",
], {
  ...process.env,
  HOST: publicHost,
  PORT: String(publicPort),
  SELENWRIGHT_API_TARGET: apiTarget,
});

console.log(`Selenwright dev UI on http://${publicHost}:${publicPort}`);
console.log(`Selenwright dev API on ${apiTarget}`);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => shutdown(0));
}

apiProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shutdown(typeof code === "number" ? code : 1, signal);
});

viteProcess.on("exit", (code, signal) => {
  if (shuttingDown) {
    return;
  }
  shutdown(typeof code === "number" ? code : 1, signal);
});

function spawnProcess(command, args, env) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });
  children.add(child);
  child.on("exit", () => {
    children.delete(child);
  });
  return child;
}

function shutdown(exitCode, signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  for (const child of children) {
    if (child.killed) {
      continue;
    }
    child.kill(signal || "SIGTERM");
  }

  setTimeout(() => {
    process.exit(exitCode);
  }, 50);
}
