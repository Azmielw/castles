import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Particles } from "../components/Atmosphere";
import { KineticLines } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS, gradientText } from "../config/theme";
import { EASE, lerp, prog, TAU } from "../lib/anim";

/** Abstract spark mark drawn from 8 rays. */
const Spark: React.FC<{ frame: number }> = ({ frame }) => (
  <svg width="120" height="120" viewBox="-60 -60 120 120" style={{ filter: `drop-shadow(0 0 22px ${COLORS.violet})`, overflow: "visible" }}>
    {new Array(8).fill(0).map((_, i) => {
      const p = prog(frame, 50 + i * 2, 74 + i * 2, EASE.out);
      const len = (i % 2 ? 30 : 50) * p;
      const a = (i / 8) * TAU + Math.PI / 8 + (1 - p) * 1.2;
      return <line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * (7 + len)} y2={Math.sin(a) * (7 + len)} stroke={i % 2 ? COLORS.blue : COLORS.violetSoft} strokeWidth={8} strokeLinecap="round" opacity={p} />;
    })}
  </svg>
);

export const Scene07Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const brand = prog(frame, 58, 88, EASE.out);
  const sweep = lerp(-40, 150, prog(frame, 70, 118, EASE.inOut));
  const fade = prog(frame, 122, 146, EASE.inOut);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: 1 - fade }}>
        <AbsoluteFill style={{ background: `radial-gradient(46% 40% at 50% 46%, ${COLORS.violet}2e, transparent 72%)`, opacity: prog(frame, 0, 40) }} />
        <Particles count={46} seed="outro" drift={[0.05, -0.18]} opacity={0.55} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingBottom: 130, perspective: 1200 }}>
          <div style={{ transform: `scale(${1 + frame * 0.0005})` }}>
            <KineticLines lines={[COPY.outro.line]} accent={["أفكارك."]} size={118} weight={800} starts={[[10, 17, 24, 31]]} />
          </div>
          <div style={{ marginTop: 44, width: 520 * prog(frame, 44, 78, EASE.inOut), height: 2, background: `linear-gradient(90deg, transparent, ${COLORS.violetSoft}, ${COLORS.blue}, transparent)` }} />
          <div style={{ marginTop: 44, display: "flex", alignItems: "center", gap: 30, opacity: brand, transform: `translateY(${(1 - brand) * 26}px)`, filter: `blur(${(1 - brand) * 10}px)` }}>
            <Spark frame={frame} />
            <div style={{ fontFamily: FONTS.latin, fontWeight: 500, fontSize: 62, letterSpacing: `${lerp(0.7, 0.34, brand)}em`, marginRight: "-0.34em", ...gradientText(`linear-gradient(105deg, #fff ${sweep - 30}%, ${COLORS.blue} ${sweep}%, #fff ${sweep + 30}%)`) }}>{COPY.outro.brand}</div>
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
