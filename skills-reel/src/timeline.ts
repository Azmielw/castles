// Scene start/end in seconds. Everything else derives frames from fps.
export const scenes = [
  { id: "hook", from: 0, to: 5.5 },
  { id: "intro", from: 5.5, to: 11.5 },
  { id: "anatomy", from: 11.5, to: 24 },
  { id: "how", from: 24, to: 35.5 },
  { id: "install", from: 35.5, to: 47 },
  { id: "tip1", from: 47, to: 54.5 },
  { id: "tip2", from: 54.5, to: 62 },
  { id: "outro", from: 62, to: 68.5 },
] as const;

export type SceneId = (typeof scenes)[number]["id"];
export const TOTAL_SEC = scenes[scenes.length - 1].to;
export const sceneOf = (id: SceneId) => scenes.find((s) => s.id === id)!;
