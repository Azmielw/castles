import { continueRender, delayRender, staticFile } from "remotion";
import { theme } from "./theme";

const AR = "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F";
const LAT = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F, U+2190-21FF, U+2212";

const faces = [
  { family: theme.fonts.display, file: "readex-pro-arabic-700-normal.woff2", weight: "700", range: AR },
  { family: theme.fonts.display, file: "readex-pro-latin-700-normal.woff2", weight: "700", range: LAT },
  { family: theme.fonts.body, file: "ibm-plex-sans-arabic-arabic-500-normal.woff2", weight: "500", range: AR },
  { family: theme.fonts.body, file: "ibm-plex-sans-arabic-latin-500-normal.woff2", weight: "500", range: LAT },
  { family: theme.fonts.mono, file: "jetbrains-mono-latin-500-normal.woff2", weight: "500", range: LAT },
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map((f) =>
      new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format("woff2")`, {
        weight: f.weight,
        unicodeRange: f.range,
      })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error(e);
      continueRender(handle);
    });
}
