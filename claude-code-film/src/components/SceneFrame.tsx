import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { TRANSITION_FRAMES } from "../config/timeline";
import { COLORS } from "../config/theme";
import { EASE, prog } from "../lib/anim";

export type Move = "none" | "push" | "pull" | "left" | "right" | "up" | "fade";

/**
 * Wraps a scene and plays its camera transition in / out:
 * push = fly through towards the viewer, pull = fall back, left/right/up = whip pan with motion blur.
 */
export const SceneFrame: React.FC<{ duration: number; enter?: Move; exit?: Move; children: React.ReactNode }> = ({
  duration,
  enter = "none",
  exit = "none",
  children,
}) => {
  const frame = useCurrentFrame();
  const T = TRANSITION_FRAMES;
  const pin = enter === "none" ? 1 : prog(frame, 0, T + 4, EASE.out);
  const pout = exit === "none" ? 0 : prog(frame, duration - T, duration, EASE.in);

  let scale = 1;
  let x = 0;
  let y = 0;
  let blur = 0;
  let opacity = 1;
  const apply = (move: Move, k: number, dir: 1 | -1) => {
    // k: 0 = settled, 1 = fully away. dir: 1 = leaving, -1 = arriving
    if (k <= 0) return;
    if (move === "push") scale *= dir === 1 ? 1 + k * 1.4 : 1 - k * 0.35;
    if (move === "pull") scale *= dir === 1 ? 1 - k * 0.3 : 1 + k * 0.9;
    if (move === "left") x += dir * k * -1500;
    if (move === "right") x += dir * k * 1500;
    if (move === "up") y += dir * k * -900;
    blur += k * (move === "fade" ? 6 : 16);
    opacity *= 1 - Math.pow(k, move === "fade" ? 1 : 2.2);
  };
  apply(enter, 1 - pin, -1);
  apply(exit, pout, 1);
  const horizontal = x !== 0;

  return (
    <AbsoluteFill style={{ backgroundColor: enter === "none" ? COLORS.bg : "transparent" }}>
      <AbsoluteFill
        style={{
          opacity,
          transform: `translate(${x}px, ${y}px) scale(${scale})`,
          filter: blur > 0.2 ? (horizontal ? `blur(${blur * 0.4}px) url(#streak)` : `blur(${blur}px)`) : undefined,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Horizontal smear used by whip-pan transitions (directional motion blur). */
export const MotionBlurDefs: React.FC = () => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <filter id="streak" x="-20%" width="140%">
      <feGaussianBlur stdDeviation="38 0" />
    </filter>
    <filter id="streakSoft" x="-20%" width="140%">
      <feGaussianBlur stdDeviation="14 0" />
    </filter>
  </svg>
);

/** Anamorphic light streak + flash that lands exactly on a cut. */
export const CutFlash: React.FC<{ at: number; strength?: number; color?: string }> = ({ at, strength = 1, color = COLORS.violetSoft }) => {
  const frame = useCurrentFrame();
  const k = frame < at ? prog(frame, at - 6, at, EASE.in) : 1 - prog(frame, at, at + 16, EASE.out);
  if (k <= 0.001) return null;
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${color} 0%, transparent 70%)`, opacity: 0.38 * k * strength }} />
      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          top: "50%",
          height: 10,
          marginTop: -5,
          background: `linear-gradient(90deg, transparent, ${COLORS.blue}, #fff, ${color}, transparent)`,
          filter: "blur(7px)",
          opacity: k * strength,
          transform: `scaleX(${0.3 + k * 0.9}) scaleY(${0.6 + k * 2.2})`,
        }}
      />
    </AbsoluteFill>
  );
};
