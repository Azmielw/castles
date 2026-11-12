import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Particles } from "../components/Atmosphere";
import { BrandMark } from "../components/BrandMark";
import { Icon, ICONS } from "../components/ChatUI";
import { KineticLines } from "../components/Type";
import { BRAND } from "../config/brand";
import { COPY } from "../config/copy";
import { COLORS, FONTS } from "../config/theme";
import { bell, EASE, lerp, prog, TAU } from "../lib/anim";

const CY = 640;
const NAMES = Object.keys(ICONS) as (keyof typeof ICONS)[];

export const Scene06Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const gather = prog(frame, 10, 74, EASE.inOut);
  const pull = prog(frame, 0, 120, EASE.outSoft);
  const merge = prog(frame, 64, 84, EASE.in);
  const flash = bell(frame, 76, 104);
  const logo = prog(frame, 70, 96, EASE.out);
  const fade = prog(frame, 234, 268, EASE.inOut);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: 1 - fade }}>
        <AbsoluteFill style={{ background: `radial-gradient(55% 32% at 50% ${(CY / 1920) * 100}%, ${COLORS.green}22, transparent 72%)` }} />
        <Particles count={90} seed="outro" opacity={0.7} drift={[0, -0.3]} />

        {/* every element from the video orbits in and gathers around the mark; camera pulls back */}
        <AbsoluteFill style={{ perspective: 1400, transform: `scale(${lerp(1.35, 1, pull)})` }}>
          <div style={{ position: "absolute", left: 540, top: CY, width: 0, height: 0, transformStyle: "preserve-3d", transform: `rotateX(${lerp(30, 12, pull)}deg)` }}>
            {new Array(16).fill(0).map((_, i) => {
              const a = (i / 16) * TAU + frame * 0.018;
              const r = lerp(900 + (i % 3) * 140, 270, gather) * (1 - merge);
              const x = Math.cos(a) * r;
              const z = Math.sin(a) * r;
              const y = Math.sin(a * 2 + i) * 60 * (1 - gather);
              const kind = i % 4;
              return (
                <div key={i} style={{ position: "absolute", left: -55, top: -55, width: 110, height: 110, transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${-lerp(30, 12, pull)}deg) scale(${1 - merge * 0.6})`, opacity: prog(frame, 0, 12) * (1 - merge), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 30, background: kind === 0 ? "#fff" : "rgba(22,22,24,0.92)", border: `2px solid ${kind === 0 ? "#fff" : COLORS.glassBorder}`, boxShadow: "0 0 30px rgba(255,255,255,0.25)" }}>
                  {kind === 3 ? (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {[14, 28, 40, 28, 14].map((h, k) => <span key={k} style={{ width: 6, height: h * (0.6 + 0.4 * Math.abs(Math.sin(frame / 5 + k))), borderRadius: 6, background: "#fff" }} />)}
                    </div>
                  ) : (
                    <Icon name={NAMES[i % NAMES.length]} size={62} color={kind === 0 ? "#000" : "#fff"} />
                  )}
                </div>
              );
            })}
          </div>
        </AbsoluteFill>

        {/* the mark */}
        <div style={{ position: "absolute", left: 0, right: 0, top: CY - 150, display: "flex", justifyContent: "center", opacity: logo, transform: `scale(${lerp(0.5, 1, logo) + flash * 0.06})` }}>
          <BrandMark size={300} glow={0.6 + flash} />
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: CY + 190, textAlign: "center", fontFamily: FONTS.latin, fontWeight: 700, fontSize: 84, color: "#fff", opacity: prog(frame, 92, 112), letterSpacing: "-0.01em" }}>{BRAND.NAME}</div>
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${(CY / 1920) * 100}%, #fff 0%, ${COLORS.greenSoft} 12%, transparent 44%)`, opacity: flash * 0.8, mixBlendMode: "screen" }} />

        {/* closing line */}
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 1010 }}>
          <KineticLines lines={[COPY.outro.line1.slice(0, 3), COPY.outro.line1.slice(3)]} accent={COPY.outro.accent} size={70} weight={600} gap={1.4} starts={[[116, 120, 124], [128, 133]]} out={170} />
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 1010 }}>
          <KineticLines lines={[COPY.outro.line2.slice(0, 2), COPY.outro.line2.slice(2)]} accent={COPY.outro.accent} size={84} weight={800} gap={1.35} starts={[[182, 187], [194, 200, 206]]} />
        </AbsoluteFill>
        {BRAND.DISCLAIMER ? (
          <div dir="rtl" lang="ar" style={{ position: "absolute", left: 0, right: 0, top: 1300, textAlign: "center", fontFamily: FONTS.body, fontSize: 26, color: COLORS.grayMid, opacity: prog(frame, 200, 220) * 0.9 }}>
            {BRAND.DISCLAIMER}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
