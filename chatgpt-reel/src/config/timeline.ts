// ⏱️ التوقيت — كل الأرقام بالثواني.
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_SECONDS = 60;

export const SCENES = {
  hook: { start: 0, end: 6 },
  intro: { start: 6, end: 14 },
  prompt: { start: 14, end: 25 },
  uses: { start: 25, end: 39 },
  advanced: { start: 39, end: 51 },
  outro: { start: 51, end: 60 },
} as const;

export type SceneId = keyof typeof SCENES;
export const TRANSITION_FRAMES = 12;
export const f = (seconds: number) => Math.round(seconds * FPS);
