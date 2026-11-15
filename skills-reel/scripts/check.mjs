// Bundle once, render a list of frames as half-size PNGs for visual review.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
import fs from "node:fs";
const frames = process.argv.slice(2).map(Number);
const headless = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const browserExecutable = fs.existsSync(headless) ? headless : null;
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "SkillsReel", browserExecutable });
fs.mkdirSync("out/check", { recursive: true });
for (const frame of frames) {
  await renderStill({ serveUrl, composition, frame, output: `out/check/f${String(frame).padStart(4, "0")}.png`, scale: 0.5, browserExecutable, overwrite: true });
  process.stdout.write(`${frame} `);
}
console.log("done");
