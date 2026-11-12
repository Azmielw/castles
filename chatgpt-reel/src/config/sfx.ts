// 🔊 المؤثرات — [الثانية، الملف، المستوى]
export type Cue = readonly [at: number, file: string, volume: number];

export const SFX: readonly Cue[] = [
  // 1 hook — light lines rush in, assemble, burst
  [0.3, "riser", 0.45], [0.6, "whoosh", 0.45], [1.1, "swish", 0.35], [1.6, "swish", 0.35], [2.2, "glitch", 0.25],
  [2.45, "shimmer", 0.45], [3.0, "impact", 0.85], [3.05, "burst", 0.45], [3.5, "whoosh", 0.4], [3.95, "pop", 0.3], [4.3, "pop", 0.35],
  // 2 intro — phone, login tap, chat, highlight, typing
  [5.75, "whoosh", 0.55], [6.05, "impact", 0.5], [8.13, "click", 0.55], [8.55, "swish", 0.4], [9.95, "whoosh", 0.4], [10.6, "shimmer", 0.4],
  [11.35, "tick", 0.5], [11.65, "tick", 0.5], [11.95, "tick", 0.5], [12.2, "pop", 0.45],
  // 3 prompt
  [13.75, "whoosh", 0.55], [14.35, "swish", 0.4], [14.9, "tick", 0.45], [15.2, "tick", 0.45], [15.9, "swish", 0.45],
  [16.5, "pop", 0.4], [17.0, "pop", 0.4], [17.5, "pop", 0.4], [18.0, "pop", 0.45], [19.6, "glitch", 0.25],
  [20.1, "click", 0.4], [20.6, "click", 0.4], [21.1, "click", 0.4], [22.6, "shimmer", 0.55], [22.75, "impact", 0.5],
  // 4 uses — one hit per icon
  [24.75, "whoosh", 0.55], [25.05, "impact", 0.6], [25.5, "pop", 0.5], [27.45, "pop", 0.5], [29.4, "pop", 0.5], [31.3, "pop", 0.5],
  [33.25, "pop", 0.5], [35.2, "pop", 0.5], [27.2, "swish", 0.35], [29.15, "swish", 0.35], [31.05, "swish", 0.35], [33.0, "swish", 0.35],
  [34.95, "swish", 0.35], [36.9, "swish", 0.35], [37.2, "shimmer", 0.5],
  // 5 advanced — + menu, upload, scan, voice, files
  [38.75, "whoosh", 0.55], [39.05, "impact", 0.55], [39.87, "click", 0.55], [41.07, "click", 0.55], [41.4, "swish", 0.4],
  [42.07, "glitch", 0.3], [42.4, "riser", 0.3], [43.4, "pop", 0.4], [43.7, "pop", 0.4], [44.0, "pop", 0.4], [44.6, "shimmer", 0.35],
  [44.6, "whoosh", 0.45], [47.3, "whoosh", 0.5], [47.6, "pop", 0.35], [47.9, "pop", 0.35], [48.2, "pop", 0.35], [48.4, "shimmer", 0.4],
  // 6 outro
  [50.75, "whoosh", 0.55], [51.2, "riser", 0.5], [53.5, "impact", 0.9], [53.55, "burst", 0.55], [54.9, "shimmer", 0.4], [57.1, "impact", 0.45], [57.2, "shimmer", 0.45],
];
