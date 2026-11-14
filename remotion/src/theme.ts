// theme.ts — single source of truth. Never inline colors, easings or springs.
import { Easing } from "remotion";

export const theme = {
  colors: {
    plate: "rgba(10, 10, 15, 0.86)",
    plateEdge: "rgba(255, 255, 255, 0.08)",
    primary: "#22D3EE", // hero color — only the accent bar uses it
    text: "#F4F4F5",
    textDim: "#A1A1AA",
    glow: "rgba(34, 211, 238, 0.45)",
    shadow: "rgba(0, 0, 0, 0.35)",
  },
  fonts: {
    display: "Space Grotesk",
    body: "Inter",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1), // entrances
    inOut: Easing.bezier(0.83, 0, 0.17, 1), // moves
    in: Easing.bezier(0.7, 0, 0.84, 0), // exits only
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
  },
  timing: {
    // seconds — converted with fps at use sites
    tail: 0.5, // empty time after the exit finishes
    stagger: 0.13, // between plate → name → title
    exit: 0.33, // exits are faster than entrances
  },
} as const;
