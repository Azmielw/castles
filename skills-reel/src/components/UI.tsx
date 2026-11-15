import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { clamp } from "./Motion";

const S = theme.size;

/** Headline block in the upper safe area. */
export const Top: React.FC<{ y?: number; children: React.ReactNode }> = ({ y = 270, children }) => (
  <AbsoluteFill style={{ width: "auto", top: y, left: S.pad, right: S.pad, height: "auto", alignItems: "center" }}>{children}</AbsoluteFill>
);

/** Visual stage in the middle of the frame. */
export const Stage: React.FC<{ y?: number; children: React.ReactNode }> = ({ y = 720, children }) => (
  <AbsoluteFill style={{ width: "auto", top: y, left: S.pad, right: S.pad, height: "auto", alignItems: "center" }}>{children}</AbsoluteFill>
);

export const h1: React.CSSProperties = {
  fontFamily: theme.fonts.display, fontWeight: 700, fontSize: S.h1, lineHeight: 1.18,
  color: theme.colors.ink, letterSpacing: "-0.01em", textAlign: "center", direction: "rtl",
};
export const h2: React.CSSProperties = { ...h1, fontSize: S.h2, lineHeight: 1.25 };
export const body: React.CSSProperties = {
  fontFamily: theme.fonts.body, fontWeight: 500, fontSize: S.body, lineHeight: 1.45,
  color: theme.colors.dim, textAlign: "center", direction: "rtl",
};

export const Card: React.FC<{ style?: React.CSSProperties; children: React.ReactNode }> = ({ style, children }) => (
  <div
    style={{
      background: `linear-gradient(160deg, ${theme.colors.cardHi}, ${theme.colors.card})`,
      border: `2px solid ${theme.colors.line}`, borderRadius: 28,
      boxShadow: "0 30px 60px rgba(0,0,0,0.45)", ...style,
    }}
  >
    {children}
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; hero?: boolean; style?: React.CSSProperties }> = ({ children, hero, style }) => (
  <div
    style={{
      display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 28px", borderRadius: 999,
      fontFamily: theme.fonts.body, fontWeight: 500, fontSize: S.small, direction: "rtl",
      color: hero ? theme.colors.bg : theme.colors.ink,
      background: hero ? theme.colors.primary : "rgba(244,239,230,0.08)",
      border: hero ? "none" : `2px solid ${theme.colors.line}`,
      boxShadow: hero ? `0 0 40px ${theme.colors.glow}` : undefined, ...style,
    }}
  >
    {children}
  </div>
);

/** Typewriter: returns the visible prefix of `text`. */
export const useTyped = (text: string, start: number, cps = 22) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.floor(interpolate(frame, [start, start + (text.length / cps) * fps], [0, text.length], clamp));
  return text.slice(0, n);
};

export const Caret: React.FC<{ color?: string }> = ({ color = theme.colors.primary }) => {
  const frame = useCurrentFrame();
  return (
    <span style={{ display: "inline-block", width: "0.55em", height: "1.05em", marginInlineStart: 4, verticalAlign: "-0.15em", background: color, opacity: Math.floor(frame / 12) % 2 ? 0.15 : 1 }} />
  );
};

/** Simple CSS folder glyph (no emoji). `open` 0..1 lifts the flap. */
export const Folder: React.FC<{ size?: number; open?: number; color?: string }> = ({ size = 220, open = 0, color = theme.colors.primary }) => (
  <div style={{ position: "relative", width: size, height: size * 0.78 }}>
    <div style={{ position: "absolute", left: 0, top: 0, width: size * 0.42, height: size * 0.16, background: color, borderRadius: `${size * 0.05}px ${size * 0.05}px 0 0`, opacity: 0.85 }} />
    <div style={{ position: "absolute", left: 0, top: size * 0.12, width: size, height: size * 0.66, background: color, borderRadius: size * 0.06, opacity: 0.7 }} />
    <div
      style={{
        position: "absolute", left: 0, bottom: 0, width: size, height: size * 0.56, background: color, borderRadius: size * 0.06,
        transformOrigin: "50% 100%", transform: `perspective(${size * 4}px) rotateX(${-open * 38}deg)`, boxShadow: "0 -6px 20px rgba(0,0,0,0.25)",
      }}
    />
  </div>
);

/** A line of monospace code; `hl` highlights it. */
export const CodeLine: React.FC<{ children: React.ReactNode; color?: string; hl?: number; hlColor?: string; style?: React.CSSProperties }> = ({
  children, color = theme.colors.ink, hl = 0, hlColor = theme.colors.primary, style,
}) => (
  <div
    style={{
      position: "relative", fontFamily: theme.fonts.mono, fontSize: S.mono, lineHeight: 1.6, color, whiteSpace: "pre",
      direction: "ltr", textAlign: "left", padding: "0 14px", borderRadius: 10, ...style,
    }}
  >
    <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: hlColor, opacity: hl * 0.18, borderLeft: `6px solid ${hlColor}`, transformOrigin: "0 50%", transform: `scaleX(${hl})` }} />
    <span style={{ position: "relative" }}>{children}</span>
  </div>
);

/** Window chrome for code/terminal cards. */
export const WindowBar: React.FC<{ title: string }> = ({ title }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "22px 28px", borderBottom: `2px solid ${theme.colors.line}`, direction: "ltr" }}>
    {[0.5, 0.35, 0.22].map((o, i) => (
      <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: theme.colors.ink, opacity: o }} />
    ))}
    <div style={{ marginLeft: 16, fontFamily: theme.fonts.mono, fontSize: 28, color: theme.colors.dim }}>{title}</div>
  </div>
);
