import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS } from "../config/theme";
import { voice } from "../lib/voice";
import { EASE } from "../lib/anim";

const TONE: Record<string, string> = { violet: COLORS.greenBright, blue: COLORS.greenSoft, white: COLORS.white };

/** Word-synced Arabic captions. Each word pops in exactly when it is spoken. */
export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const phrase = voice.phrases.find((p) => t >= p.start - 0.06 && t < p.end);
  if (!phrase) return null;
  const out = interpolate(t, [phrase.end - 0.12, phrase.end], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div style={{ position: "absolute", left: 60, right: 60, bottom: 400, display: "flex", justifyContent: "center", opacity: out }}>
      <div
        dir="rtl"
        lang="ar"
        style={{
          display: "flex",
          gap: "4px 20px",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "baseline",
          padding: "16px 44px 22px",
          borderRadius: 28,
          background: "radial-gradient(ellipse at center, rgba(3,2,7,0.82) 0%, rgba(3,2,7,0.55) 60%, rgba(3,2,7,0) 100%)",
          fontFamily: FONTS.body,
          fontWeight: 700,
          fontSize: 62,
          lineHeight: 1.45,
        }}
      >
        {phrase.tokens.map((tok, i) => {
          const local = (t - tok.start) * fps;
          const appear = interpolate(local, [-2, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: EASE.back });
          const speaking = t >= tok.start - 0.03 && t < tok.end + 0.08;
          const color = TONE[tok.color];
          const accent = tok.color !== "white";
          return (
            <span
              key={i}
              dir={tok.latin ? "ltr" : "rtl"}
              style={{
                display: "inline-block",
                fontFamily: tok.latin ? FONTS.latin : FONTS.body,
                color,
                opacity: Math.min(1, appear * 1.4) * (speaking || accent ? 1 : 0.86),
                translate: `0px ${(1 - appear) * 22}px`,
                scale: String(0.82 + 0.18 * appear + (speaking ? 0.05 : 0)),
                filter: `blur(${(1 - Math.min(1, appear)) * 6}px)`,
                textShadow: accent
                  ? `0 0 26px ${color}aa, 0 2px 10px rgba(0,0,0,0.9)`
                  : `0 2px 12px rgba(0,0,0,0.95)${speaking ? ", 0 0 22px rgba(255,255,255,0.45)" : ""}`,
              }}
            >
              {tok.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
