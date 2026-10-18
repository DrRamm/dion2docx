import { build, context } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

// Static assets copied as-is.
await cp("src/manifest.json", `${outdir}/manifest.json`);
await cp("src/popup.html", `${outdir}/popup.html`);
await cp("src/offscreen.html", `${outdir}/offscreen.html`);

const options = {
  entryPoints: {
    content: "src/content.js",
    popup: "src/popup.js",
    background: "src/background.js",
    offscreen: "src/offscreen.js",
  },
  outdir,
  bundle: true,
  format: "iife",
  target: "chrome120",
  sourcemap: false,
  logLevel: "info",
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log("watching...");
} else {
  await build(options);
}
