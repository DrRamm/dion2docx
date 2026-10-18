// Release pipeline: build the extension and pack dist/ into a Chrome-installable
// zip (manifest.json at the archive root), named with the manifest version.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distDir = path.join(root, "dist");
const outDir = path.join(root, "release");

// 1. Build dist/.
execFileSync(process.execPath, ["build.mjs"], { cwd: root, stdio: "inherit" });

// 2. Read the version so the zip name matches the manifest.
const manifest = JSON.parse(await readFile(path.join(distDir, "manifest.json"), "utf8"));
const zipName = `dion-chat-docx-${manifest.version}.zip`;
const zipPath = path.join(outDir, zipName);

// 3. Pack dist/ contents with manifest.json at the root of the archive.
await mkdir(outDir, { recursive: true });
await rm(zipPath, { force: true });
execFileSync("zip", ["-r", "-X", zipPath, "."], { cwd: distDir, stdio: "inherit" });

console.log(`\n✔ Release ready: ${path.relative(root, zipPath)}`);
console.log("  Chrome: chrome://extensions → режим разработчика → Load unpacked → распакованная папка.");
