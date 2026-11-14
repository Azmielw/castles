# Remotion — LowerThird

Transparent name/title lower third, 1920×1080 @ 30fps. Length follows the props
(`outSec` + exit + 0.5s tail).

```bash
cd remotion && npm install        # first time only
npx remotion render LowerThird out/lower.mov \
    --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le \
    --props='{"name":"Lior Kolnik","title":"Product, Eve Security","inSec":0.3,"outSec":4.0}'
# or a transparent WebM: --codec=vp8 --pixel-format=yuva420p
npx remotion studio               # live preview
```

- `src/theme.ts` — colors, fonts, easings, timing (edit here, not in components)
- `src/scenes/LowerThird.tsx` — the animation
- Fonts are bundled in `public/fonts/` (Space Grotesk 700, Inter 500), so rendering needs no network.
