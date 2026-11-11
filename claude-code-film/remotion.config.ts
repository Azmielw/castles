import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setOverwriteOutput(true);
Config.setCodec("h264");
Config.setCrf(17);
Config.setPixelFormat("yuv420p");
// Software WebGL so the Three.js shots render on machines without a GPU too.
Config.setChromiumOpenGlRenderer("swangle");
Config.setConcurrency(4);

// Optional: reuse an already-installed Chrome Headless Shell (CI / sandboxes without download access).
const browser = process.env.REMOTION_BROWSER;
if (browser && existsSync(browser)) Config.setBrowserExecutable(browser);
