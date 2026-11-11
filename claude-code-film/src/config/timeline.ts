// ⏱️ التوقيت — كل الأرقام بالثواني. غيّر بداية/نهاية أي مشهد من هنا.
export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION_SECONDS = 75;

export const SCENES = {
  hook: { start: 0, end: 8 },
  claude: { start: 8, end: 18 },
  workflow: { start: 18, end: 32 },
  magic: { start: 32, end: 47 },
  technology: { start: 47, end: 60 },
  montage: { start: 60, end: 70 },
  outro: { start: 70, end: 75 },
} as const;

export type SceneId = keyof typeof SCENES;

/** Frames each scene overlaps the next one while the transition plays. */
export const TRANSITION_FRAMES = 14;

export const f = (seconds: number) => Math.round(seconds * FPS);
export const sceneFrames = (id: SceneId) => f(SCENES[id].end - SCENES[id].start);
