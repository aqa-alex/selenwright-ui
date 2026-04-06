import { readdirSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

console.log(`Checked ${files.length} JavaScript modules`);

