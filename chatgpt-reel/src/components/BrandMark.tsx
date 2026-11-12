import React from "react";
import { Img, staticFile } from "remotion";
import { BRAND } from "../config/brand";
import { COLORS, FONTS } from "../config/theme";

/**
 * The ChatGPT mark. Uses the official logo file when provided (see src/config/brand.ts),
 * otherwise a neutral text badge — never a hand-drawn imitation of the trademark.
 */
export const BrandMark: React.FC<{ size: number; glow?: number; showName?: boolean }> = ({ size, glow = 0, showName = false }) => {
  const shadow = glow > 0 ? `drop-shadow(0 0 ${glow * 40}px ${COLORS.green}) drop-shadow(0 0 ${glow * 12}px ${COLORS.greenSoft})` : undefined;
  if (BRAND.OFFICIAL_LOGO) {
    const tint = BRAND.LOGO_TINT === "white" ? "brightness(0) invert(1)" : BRAND.LOGO_TINT === "black" ? "brightness(0)" : "";
    return (
      <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
        <Img src={staticFile(BRAND.OFFICIAL_LOGO)} style={{ width: size, height: size, objectFit: "contain", filter: [tint, shadow].filter(Boolean).join(" ") || undefined }} />
        {showName ? <Name size={size} /> : null}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28, filter: shadow }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.28,
          background: `linear-gradient(150deg, ${COLORS.greenBright}, ${COLORS.green} 55%, ${COLORS.greenDeep})`,
          boxShadow: `inset 0 ${size * 0.03}px 0 rgba(255,255,255,0.35), 0 ${size * 0.08}px ${size * 0.3}px rgba(0,0,0,0.5)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* generic speech bubble — a placeholder, not the official logo */}
        <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 100 100" fill="none" stroke="#fff" strokeWidth={8} strokeLinejoin="round" strokeLinecap="round">
          <path d="M20 22h60a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H46L28 86V72h-8a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" />
          <path d="M34 47h32" />
        </svg>
      </div>
      {showName ? <Name size={size} /> : null}
    </div>
  );
};

const Name: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ fontFamily: FONTS.latin, fontWeight: 700, fontSize: size * 0.52, color: COLORS.white, letterSpacing: "-0.01em" }}>{BRAND.NAME}</div>
);
