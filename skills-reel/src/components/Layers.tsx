import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

/** Layer 1 — drifting warm mesh. Never a flat background. */
export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 60) * 70;
  const d2 = Math.cos(frame / 80) * 60;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div
        style={{
          position: "absolute", width: 1500, height: 1500, borderRadius: "50%",
          top: -600 + d2 * 0.5, right: -500 + d1, filter: "blur(40px)",
          background: `radial-gradient(circle, ${theme.colors.primary}2E, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute", width: 1300, height: 1300, borderRadius: "50%",
          bottom: -500, left: -450 - d2, filter: "blur(60px)",
          background: `radial-gradient(circle, ${theme.colors.green}14, transparent 62%)`,
        }}
      />
      {/* faint dot grid for depth */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${theme.colors.line} 1.5px, transparent 1.5px)`,
          backgroundSize: "54px 54px",
          backgroundPosition: `${(frame * 0.3) % 54}px ${(frame * 0.6) % 54}px`,
          opacity: 0.5,
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Layer 4 — unifying grade. */
export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: 0.14 }} />
    <AbsoluteFill
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25), transparent 22%, transparent 75%, rgba(0,0,0,0.35))" }}
    />
  </AbsoluteFill>
);

const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

/** Layer 5 — grain + vignette, always on top. */
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundImage: noise,
          backgroundPosition: `${(frame * 37) % 220}px ${(frame * 61) % 220}px`,
          mixBlendMode: "overlay",
          opacity: 0.12,
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
    </AbsoluteFill>
  );
};
