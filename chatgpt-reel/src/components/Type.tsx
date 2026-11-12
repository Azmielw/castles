import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { EASE, prog } from "../lib/anim";

/**
 * Kinetic Arabic headline. Animates per WORD (never per letter) so Arabic shaping stays joined.
 * `starts[line][word]` = frame at which each word lands.
 */
export const KineticLines: React.FC<{
  lines: readonly (readonly string[])[];
  starts: number[][];
  accent?: readonly string[];
  size?: number;
  weight?: number;
  gap?: number;
  out?: number;
}> = ({ lines, starts, accent = [], size = 104, weight = 800, gap = 1.42, out }) => {
  const frame = useCurrentFrame();
  const leave = out === undefined ? 0 : prog(frame, out, out + 12, EASE.in);
  return (
    <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.display, fontWeight: weight, fontSize: size, lineHeight: gap, textAlign: "center", opacity: 1 - leave, filter: leave ? `blur(${leave * 14}px)` : undefined, scale: String(1 + leave * 0.12) }}>
      {lines.map((words, li) => (
        <div key={li} style={{ display: "flex", justifyContent: "center", gap: size * 0.3, whiteSpace: "nowrap" }}>
          {words.map((w, wi) => {
            const s = starts[li][wi];
            const p = prog(frame, s, s + 16, EASE.out);
            const isAccent = accent.includes(w);
            return (
              <span key={wi} style={{ display: "inline-block", overflow: "visible" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0 0.04em",
                    opacity: Math.min(1, p * 1.6),
                    transform: `translateY(${(1 - p) * size * 0.55}px) rotateX(${(1 - p) * -70}deg) scale(${0.9 + p * 0.1})`,
                    transformOrigin: "50% 100%",
                    filter: `blur(${(1 - p) * 14}px)${isAccent ? ` drop-shadow(0 0 ${28 * p}px ${COLORS.violet}aa)` : ""}`,
                    ...(isAccent ? gradientText(GRADIENT) : { color: COLORS.white }),
                  }}
                >
                  {w}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Glass panel with a luminous hairline border. */
export const Glass: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: string }> = ({ style, children, glow = COLORS.violet }) => (
  <div
    style={{
      position: "absolute",
      borderRadius: 26,
      background: "linear-gradient(160deg, rgba(255,255,255,0.075), rgba(255,255,255,0.02) 55%, rgba(139,61,255,0.05))",
      border: `1.5px solid ${COLORS.glassBorder}`,
      boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 70px ${glow}22, inset 0 1px 0 rgba(255,255,255,0.14)`,
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Small pill label used for scene / shot titles. */
export const Tag: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; color?: string }> = ({ children, style, color = COLORS.blue }) => (
  <div
    dir="rtl"
    lang="ar"
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "12px 32px 15px",
      borderRadius: 999,
      border: `1.5px solid ${color}66`,
      background: "rgba(3,2,7,0.55)",
      color: COLORS.white,
      fontFamily: FONTS.body,
      fontWeight: 700,
      fontSize: 40,
      ...style,
    }}
  >
    <span style={{ width: 12, height: 12, borderRadius: 12, background: color, boxShadow: `0 0 16px ${color}` }} />
    {children}
  </div>
);
