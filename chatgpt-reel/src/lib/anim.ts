import { Easing, interpolate, random } from "remotion";

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1),
  outSoft: Easing.bezier(0.22, 0.8, 0.3, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.6, 0, 0.9, 0.2),
  back: Easing.bezier(0.34, 1.56, 0.64, 1),
  linear: (t: number) => t,
};

/** 0→1 progress between two frames, clamped and eased. */
export const prog = (frame: number, start: number, end: number, easing: (t: number) => number = EASE.out) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/** 0→1→0 bell between two frames. */
export const bell = (frame: number, start: number, end: number) => Math.sin(Math.PI * clamp((frame - start) / (end - start)));
/** Fades in over `fade` frames after start and out before end. */
export const window_ = (frame: number, start: number, end: number, fade = 8) =>
  Math.min(prog(frame, start, start + fade, EASE.linear), 1 - prog(frame, end - fade, end, EASE.linear));
export const rnd = (seed: string | number) => random(`ccf-${seed}`);
export const TAU = Math.PI * 2;
/** Arabic-Indic digits, zero padded. */
export const arNum = (n: number, pad = 2) =>
  String(n)
    .padStart(pad, "0")
    .replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
