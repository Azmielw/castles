import { continueRender, delayRender, staticFile } from "remotion";
import { theme } from "./theme";

const faces = [
  { family: theme.fonts.display, file: "fonts/space-grotesk-latin-700-normal.woff2", weight: "700" },
  { family: theme.fonts.body, file: "fonts/inter-latin-500-normal.woff2", weight: "500" },
];

if (typeof document !== "undefined") {
  const handle = delayRender("Loading fonts");
  Promise.all(
    faces.map((f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, { weight: f.weight });
      return face.load().then((loaded) => document.fonts.add(loaded));
    }),
  )
    .then(() => continueRender(handle))
    .catch((err) => {
      console.error(err);
      continueRender(handle);
    });
}
