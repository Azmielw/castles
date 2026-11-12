import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Fonts are bundled in public/fonts so renders never depend on the network.
const face = (family: string, file: string, weight: string) => loadFont({ family, url: staticFile(`fonts/${file}`), weight });

const ARABIC = "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200E";
const faceAr = (family: string, file: string, weight: string) =>
  loadFont({ family, url: staticFile(`fonts/${file}`), weight, unicodeRange: ARABIC });

export const fontsReady = Promise.all([
  ...["400", "600", "800"].flatMap((w) => [
    faceAr("Alexandria", `alexandria-arabic-${w}-normal.woff2`, w),
    face("Alexandria Latin", `alexandria-latin-${w}-normal.woff2`, w),
  ]),
  ...["400", "500", "700"].flatMap((w) => [
    faceAr("IBM Plex Sans Arabic", `ibm-plex-sans-arabic-arabic-${w}-normal.woff2`, w),
    face("Plex Latin", `ibm-plex-sans-arabic-latin-${w}-normal.woff2`, w),
  ]),
  face("Space Grotesk", "space-grotesk-latin-500-normal.woff2", "500"),
  face("Space Grotesk", "space-grotesk-latin-700-normal.woff2", "700"),
  face("JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2", "400"),
  face("JetBrains Mono", "jetbrains-mono-latin-700-normal.woff2", "700"),
]);
