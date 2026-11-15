// Global SFX cues (seconds). Hits are placed ~2 frames early so they feel synced.
export type Cue = { at: number; file: "whoosh" | "pop" | "click" | "thump" | "shimmer" | "buzz"; vol?: number };

export const cues: Cue[] = [
  // hook: repeated prompt bubbles, then the turn
  ...[0.07, 0.53, 0.87, 1.13, 1.33, 1.5].map((t) => ({ at: Math.max(0, t - 0.06), file: "pop" as const, vol: 0.5 })),
  { at: 3.3, file: "thump", vol: 0.8 },
  // intro: Skills reveal
  { at: 5.84, file: "thump", vol: 0.9 },
  { at: 5.86, file: "shimmer", vol: 0.7 },
  // anatomy: folder, typing, helper folders
  { at: 11.72, file: "pop", vol: 0.5 },
  { at: 12.7, file: "click", vol: 0.5 },
  { at: 13.8, file: "click", vol: 0.4 },
  { at: 15.1, file: "click", vol: 0.4 },
  { at: 17.0, file: "click", vol: 0.4 },
  { at: 19.75, file: "pop", vol: 0.5 },
  { at: 19.92, file: "pop", vol: 0.4 },
  // how: cards, request, match
  { at: 24.4, file: "click", vol: 0.35 },
  { at: 27.55, file: "pop", vol: 0.6 },
  { at: 29.0, file: "whoosh", vol: 0.35 },
  { at: 30.35, file: "shimmer", vol: 0.7 },
  // install
  { at: 36.65, file: "click", vol: 0.45 },
  { at: 39.05, file: "pop", vol: 0.6 },
  { at: 41.75, file: "click", vol: 0.4 },
  { at: 42.45, file: "pop", vol: 0.45 },
  { at: 43.65, file: "shimmer", vol: 0.5 },
  // tip 1: danger line
  { at: 50.33, file: "buzz", vol: 0.7 },
  // tip 2: grid, harmful dots, fly-out
  { at: 55.35, file: "whoosh", vol: 0.3 },
  { at: 58.05, file: "buzz", vol: 0.6 },
  { at: 58.85, file: "whoosh", vol: 0.5 },
  // outro
  { at: 64.25, file: "thump", vol: 0.7 },
  { at: 64.28, file: "shimmer", vol: 0.5 },
];
