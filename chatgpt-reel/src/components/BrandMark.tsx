import React from "react";
import { Img, staticFile } from "remotion";
import { BRAND } from "../config/brand";
import { COLORS, FONTS } from "../config/theme";

/**
 * The ChatGPT mark in its official black & white colours: a black tile with the white logo.
 * Uses the official logo file when provided (src/config/brand.ts), otherwise a neutral placeholder glyph —
 * never a hand-drawn imitation of the trademark.
 */
export const BrandMark: React.FC<{ size: number; glow?: number; showName?: boolean }> = ({ size, glow = 0, showName = false }) => {
  const halo = glow > 0 ? `0 0 ${glow * 70}px rgba(255,255,255,${0.18 * Math.min(1, glow)}), 0 0 ${glow * 30}px rgba(255,255,255,0.3)` : "";
  const tile: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size * 0.28,
    background: BRAND.TILE === "black" ? "linear-gradient(160deg, #1a1a1a, #000 60%)" : "linear-gradient(160deg, #ffffff, #e9e9ee)",
    boxShadow: [`inset 0 0 0 ${Math.max(1.5, size * 0.008)}px rgba(255,255,255,${BRAND.TILE === "black" ? 0.22 : 0})`, `0 ${size * 0.08}px ${size * 0.3}px rgba(0,0,0,0.55)`, halo].filter(Boolean).join(", "),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const ink = BRAND.TILE === "black" ? "#fff" : "#000";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <div style={tile}>
        {BRAND.OFFICIAL_LOGO ? (
          <Img src={staticFile(BRAND.OFFICIAL_LOGO)} style={{ width: size * 0.66, height: size * 0.66, objectFit: "contain", filter: BRAND.TILE === "black" ? "brightness(0) invert(1)" : "brightness(0)" }} />
        ) : (
          // neutral placeholder — replace with the official logo file
          <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 100 100" fill="none" stroke={ink} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round">
            <path d="M20 22h60a8 8 0 0 1 8 8v34a8 8 0 0 1-8 8H46L28 86V72h-8a8 8 0 0 1-8-8V30a8 8 0 0 1 8-8z" />
            <path d="M34 47h32" />
          </svg>
        )}
      </div>
      {showName ? <div style={{ fontFamily: FONTS.latin, fontWeight: 700, fontSize: size * 0.52, color: COLORS.white }}>{BRAND.NAME}</div> : null}
    </div>
  );
};
