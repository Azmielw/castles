// Design dimensions and absolute scene timing. Replace the examples with approved scenes.
export const W = 1080, H = 1920, FPS = 30;
export const scenes = [
  { id: 'example', start: 0, end: 2 },
  { id: 'arabic-example', start: 2, end: 7 },
  { id: 'explainer-example', start: 7, end: 18.5 },   // explainer-reel kit demo (lib/kit.js)
];
export const DURATION = scenes.at(-1).end;
// Arabic display font for the example scene. Download it first: python <skill>/scripts/get_fonts.py "Kufam"
// Falls back to a system font if the file is missing (check the still: fallback shapes are wrong for branding).
export const ARABIC_FONT = { family: 'Kufam', urls: ['/assets/fonts/Kufam/Kufam[wght].ttf'] };
