import { Config } from "@remotion/cli/config";
import fs from "node:fs";

Config.setEntryPoint("src/index.ts");

// Opaque reel: JPEG frames are faster than PNG.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);

// In sandboxes where Remotion can't download its browser, use a preinstalled headless shell.
const headless = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
if (fs.existsSync(headless)) Config.setBrowserExecutable(headless);
