import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Seconds → frames. */
export const useSec = () => {
  const { fps } = useVideoConfig();
  return (s: number) => Math.round(s * fps);
};

export const useSpring = (start: number, cfg: keyof typeof theme.spring = "smooth") => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - start, fps, config: theme.spring[cfg] });
};

/** 1 → 0 over `len` frames from `start`, ease-in (exits are faster than entrances). */
export const useExit = (start: number, len = 10) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [start, start + len], [1, 0], { easing: theme.ease.in, ...clamp });
};

export const useBreath = (periodSec = 2.6, phase = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return Math.sin((frame / fps) * ((2 * Math.PI) / periodSec) + phase);
};

/** Fade + rise + scale entrance, with an optional exit. */
export const Enter: React.FC<{
  at: number;
  out?: number;
  rise?: number;
  cfg?: keyof typeof theme.spring;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, out, rise = 40, cfg = "smooth", style, children }) => {
  const p = useSpring(at, cfg);
  const x = useExit(out ?? 1e9);
  return (
    <div
      style={{
        opacity: Math.min(p, x),
        transform: `translateY(${interpolate(p, [0, 1], [rise, 0]) + interpolate(x, [0, 1], [-24, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Word-by-word reveal (RTL aware: the container's direction decides flow). `hero` words get the hero color. */
export const Words: React.FC<{
  text: string;
  at: number;
  out?: number;
  per?: number;
  hero?: string[];
  style?: React.CSSProperties;
}> = ({ text, at, out, per = 3, hero = [], style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const x = useExit(out ?? 1e9);
  const words = text.split(" ");
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: "0.28em",
        rowGap: 6,
        direction: "rtl",
        opacity: x,
        transform: `translateY(${interpolate(x, [0, 1], [-20, 0])}px)`,
        ...style,
      }}
    >
      {words.map((w, i) => {
        const p = spring({ frame: frame - at - i * per, fps, config: theme.spring.snappy });
        const isHero = hero.includes(w.replace(/[.،؟!…]/g, ""));
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [34, 0])}px) scale(${interpolate(p, [0, 1], [0.92, 1])})`,
              color: isHero ? theme.colors.primary : undefined,
              textShadow: isHero ? `0 0 40px ${theme.colors.glow}` : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};
