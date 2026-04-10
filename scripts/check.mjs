import { readdirSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildConsoleDatasetFromSnapshot } from "../src/data/service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const directories = ["src", "scripts"];
const files = ["server.mjs"];

function collectJsFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(absolutePath);
      continue;
    }
    if (absolutePath.endsWith(".js") || absolutePath.endsWith(".mjs")) {
      files.push(path.relative(rootDir, absolutePath));
    }
  }
}

for (const directory of directories) {
  collectJsFiles(path.join(rootDir, directory));
}

for (const file of files) {
  execFileSync(process.execPath, ["--check", path.join(rootDir, file)], {
    stdio: "inherit",
  });
}

function buildStatusSnapshot(rawSession) {
  return {
    fetchedAt: "2026-04-10T10:00:00.000Z",
    status: {
      ok: true,
      value: {
        browsers: {
          chrome: {
            latest: {
              default: {
                count: 1,
                sessions: [rawSession],
              },
            },
          },
        },
        pending: 0,
        queued: 0,
        total: 1,
        used: 1,
        value: {
          message: "Ready",
          ready: true,
        },
      },
    },
  };
}

const activeSession = buildConsoleDatasetFromSnapshot(
  buildStatusSnapshot({
    caps: { version: "latest" },
    id: "active-session",
    started: "2026-04-10T09:59:00.000Z",
    vnc: true,
  }),
).sessions[0];

assert.equal(activeSession.status, "running");
assert.equal(activeSession.artifacts.liveLogs, true);
assert.equal(activeSession.artifacts.logs, true);

const explicitStatusSession = buildConsoleDatasetFromSnapshot(
  buildStatusSnapshot({
    caps: { version: "latest" },
    id: "explicit-status-session",
    started: "2026-04-10T09:59:00.000Z",
    status: "Failed",
  }),
).sessions[0];

assert.equal(explicitStatusSession.status, "failed");
assert.equal(explicitStatusSession.artifacts.liveLogs, false);

console.log(`Checked ${files.length} JavaScript modules`);
