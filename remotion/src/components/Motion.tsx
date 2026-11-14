import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0→1 entrance spring starting at `start` (frames). */
export const useEnter = (start: number, config: keyof typeof theme.spring = "smooth") => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: theme.spring[config] });
};

/** 1→0 eased exit over theme.timing.exit seconds, starting at `start` (frames). */
export const useExit = (start: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const len = Math.round(theme.timing.exit * fps);
  return interpolate(frame, [start, start + len], [1, 0], { easing: theme.ease.in, ...clamp });
};

/** Slow sine breathing, 0→1, for elements that sit on screen. */
export const useBreath = (periodSec = 2.4) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (Math.sin((frame / fps) * ((2 * Math.PI) / periodSec)) + 1) / 2;
};

export { clamp };
