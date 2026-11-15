// theme.ts — single source of truth. Never inline colors, easings or springs in components.
import { Easing } from "remotion";

export const theme = {
  colors: {
    bg: "#13100E",
    bgAlt: "#1D1815",
    card: "#211B17",
    cardHi: "#2A221D",
    line: "rgba(244, 239, 230, 0.12)",
    ink: "#F4EFE6",
    dim: "#9B9086",
    faint: "rgba(244, 239, 230, 0.35)",
    primary: "#EF8A5E", // hero — at most one element per frame
    glow: "rgba(239, 138, 94, 0.45)",
    green: "#8FD18F",
    red: "#E5605A",
    code: "#E9C9A0",
  },
  fonts: {
    display: "Readex Pro",
    body: "IBM Plex Sans Arabic",
    mono: "JetBrains Mono",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
  size: {
    // 1080×1920. Safe area: keep text inside x 100..980, y 240..1480 (Shorts UI covers the bottom & right rail).
    pad: 100,
    h1: 96,
    h2: 64,
    body: 46,
    small: 34,
    mono: 34,
  },
} as const;
