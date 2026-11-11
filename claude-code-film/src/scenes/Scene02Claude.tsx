import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { Glass } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { EASE, lerp, prog, TAU } from "../lib/anim";

/** Extruded 3D wordmark built from stacked layers — rotates in real CSS 3D space. */
export const Wordmark3D: React.FC<{ frame: number; size?: number; depth?: number }> = ({ frame, size = 190, depth = 22 }) => {
  const sweep = lerp(-60, 160, prog(frame, 22, 70, EASE.inOut));
  return (
    <div style={{ position: "relative", transformStyle: "preserve-3d", fontFamily: FONTS.latin, fontWeight: 700, fontSize: size, letterSpacing: "0.02em", lineHeight: 1, whiteSpace: "nowrap" }}>
      {new Array(depth).fill(0).map((_, i) => {
        const k = i / (depth - 1);
        return (
          <div key={i} style={{ position: i ? "absolute" : "relative", inset: 0, transform: `translateZ(${-(depth - 1 - i) * 3.2}px)`, color: i === depth - 1 ? "transparent" : `rgb(${Math.round(lerp(34, 122, k))},${Math.round(lerp(10, 50, k))},${Math.round(lerp(90, 235, k))})` }}>
            {i === depth - 1 ? (
              <span style={{ ...gradientText(`linear-gradient(105deg, #fff 0%, #e9dcff ${sweep - 22}%, ${COLORS.blue} ${sweep}%, #fff ${sweep + 22}%, #d9c6ff 100%)`), filter: `drop-shadow(0 0 30px ${COLORS.violet}aa)` }}>CLAUDE CODE</span>
            ) : (
              "CLAUDE CODE"
            )}
          </div>
        );
      })}
    </div>
  );
};

const HudRings: React.FC<{ frame: number; opacity: number }> = ({ frame, opacity }) => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity }}>
    <svg width="1500" height="1500" viewBox="-750 -750 1500 1500" style={{ position: "absolute" }}>
      {[
        [300, 2, 0.5, "40 26", COLORS.violet],
        [420, 1.5, -0.3, "4 18", COLORS.blue],
        [520, 3, 0.2, "260 120", COLORS.violetSoft],
        [640, 1.5, -0.14, "2 12", COLORS.blue],
        [720, 2, 0.1, "500 300", COLORS.violet],
      ].map(([r, w, sp, dash, c], i) => (
        <circle key={i} r={r as number} fill="none" stroke={c as string} strokeWidth={w as number} strokeDasharray={dash as string} opacity={0.55 - i * 0.07} transform={`rotate(${frame * (sp as number) + i * 40})`} />
      ))}
      {new Array(36).fill(0).map((_, i) => (
        <line key={i} x1={560} x2={i % 3 === 0 ? 590 : 574} y1={0} y2={0} stroke={COLORS.blue} strokeWidth={2} opacity={0.5} transform={`rotate(${i * 10 + frame * 0.08})`} />
      ))}
    </svg>
  </AbsoluteFill>
);

const CODE: [string, string][] = [
  ["export const", " Hook = () => {"],
  ["  const", " frame = useCurrentFrame();"],
  ["  const", " scale = spring({frame, fps});"],
  ["  return", " <Title scale={scale} />;"],
  ["", "};"],
];

/** Shapes the code lines morph into. */
const SHAPES = [
  { x: 150, y: 80, w: 150, h: 150, r: 75 },
  { x: 380, y: 60, w: 190, h: 190, r: 36 },
  { x: 110, y: 300, w: 330, h: 44, r: 22 },
  { x: 500, y: 300, w: 120, h: 120, r: 60 },
  { x: 250, y: 400, w: 210, h: 44, r: 22 },
];

export const Scene02Claude: React.FC = () => {
  const frame = useCurrentFrame();

  // A — the 3D title
  const titleIn = prog(frame, 4, 46, EASE.out);
  const dock = prog(frame, 70, 104, EASE.inOut); // title docks to the top
  // B — interface
  const ui = prog(frame, 78, 112, EASE.out);
  const stepAt = [172, 206, 236];
  const typed = COPY.claude.prompt.filter((_, i) => frame >= 86 + i * 7).length;
  const fly = (i: number) => prog(frame, 132 + i * 6, 160 + i * 6, EASE.inOut); // prompt words → code lines
  const morph = prog(frame, 258, 286, EASE.inOut); // code lines → shapes
  const diff = prog(frame, 236, 250, EASE.out);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow intensity={0.9} />
      <AbsoluteFill style={{ transform: `scale(${lerp(1, 1.7, dock)})`, filter: `blur(${dock * 8}px)` }}>
        <HudRings frame={frame} opacity={prog(frame, 0, 30) * lerp(1, 0.28, dock)} />
      </AbsoluteFill>
      <Particles count={90} seed="claude" camX={frame * 0.6} opacity={0.8} />

      {/* 3D wordmark */}
      <AbsoluteFill style={{ perspective: 1500, alignItems: "center", justifyContent: "center" }}>
        <div style={{ transformStyle: "preserve-3d", transform: `translateY(${lerp(-30, -438, dock)}px) scale(${lerp(lerp(0.5, 1, titleIn), 0.3, dock)}) rotateX(${lerp(lerp(38, 8, titleIn), 0, dock)}deg) rotateY(${lerp(lerp(64, -16, titleIn) + Math.sin(frame / 26) * 5 * (1 - dock), 0, dock)}deg)`, opacity: titleIn, filter: `blur(${(1 - titleIn) * 20}px)` }}>
          <Wordmark3D frame={frame} />
        </div>
        <div dir="rtl" lang="ar" style={{ position: "absolute", top: 668, fontFamily: FONTS.body, fontWeight: 500, fontSize: 50, color: COLORS.dim, opacity: prog(frame, 34, 54) * (1 - prog(frame, 64, 78)), transform: `translateY(${(1 - prog(frame, 34, 54)) * 30}px)` }}>
          {COPY.claude.tagline}
        </div>
      </AbsoluteFill>

      {/* understand → write → edit */}
      <div dir="rtl" style={{ position: "absolute", top: 172, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 26, opacity: ui }}>
        {COPY.claude.steps.map((s, i) => {
          const on = prog(frame, stepAt[i], stepAt[i] + 12, EASE.back);
          return (
            <React.Fragment key={i}>
              {i > 0 ? <div style={{ alignSelf: "center", width: 90, height: 3, borderRadius: 3, background: `linear-gradient(270deg, ${COLORS.violet}, ${COLORS.blue})`, transformOrigin: "right", transform: `scaleX(${prog(frame, stepAt[i] - 14, stepAt[i], EASE.out)})` }} /> : null}
              <div style={{ padding: "14px 38px 18px", borderRadius: 999, fontFamily: FONTS.display, fontWeight: 600, fontSize: 40, color: on > 0.5 ? "#fff" : COLORS.dim, border: `2px solid ${on > 0.5 ? COLORS.blue : COLORS.faint}`, background: on > 0.5 ? `linear-gradient(100deg, ${COLORS.blueDeep}66, ${COLORS.violet}88)` : "rgba(255,255,255,0.03)", boxShadow: `0 0 ${on * 50}px ${COLORS.violet}aa`, transform: `scale(${0.94 + on * 0.06})` }}>
                {s.title}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* terminal (right) */}
      <Glass style={{ right: 110, top: 290, width: 800, height: 520, opacity: ui, transform: `translateX(${(1 - ui) * 160}px) perspective(1400px) rotateY(${lerp(-22, -5, ui)}deg)` }} glow={COLORS.blue}>
        <div style={{ height: 54, borderBottom: `1px solid ${COLORS.faint}`, display: "flex", alignItems: "center", padding: "0 24px", gap: 12, fontFamily: FONTS.mono, fontSize: 22, color: COLORS.dim }}>
          <span style={{ width: 12, height: 12, borderRadius: 12, background: COLORS.violet, boxShadow: `0 0 12px ${COLORS.violet}` }} />
          claude
        </div>
        <div style={{ padding: "28px 32px" }}>
          <div dir="rtl" lang="ar" style={{ display: "flex", gap: 12, fontFamily: FONTS.body, fontWeight: 500, fontSize: 38, color: "#fff", minHeight: 62 }}>
            <span style={{ color: COLORS.blue, fontFamily: FONTS.mono }}>‹</span>
            {COPY.claude.prompt.map((w, i) => (
              <span key={i} style={{ display: "inline-block", opacity: i < typed ? 1 - fly(i) * 0.65 : 0, color: fly(i) > 0 ? COLORS.violetSoft : "#fff" }}>
                {w}
              </span>
            ))}
            <span style={{ width: 4, height: 44, background: COLORS.blue, opacity: frame < 132 && Math.floor(frame / 8) % 2 ? 1 : 0 }} />
          </div>
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 20 }}>
            {COPY.claude.steps.map((s, i) => {
              const on = prog(frame, stepAt[i], stepAt[i] + 12, EASE.out);
              const done = frame > stepAt[i] + 26;
              return (
                <div key={i} dir="rtl" style={{ display: "flex", alignItems: "center", gap: 18, opacity: on, transform: `translateX(${(1 - on) * 40}px)` }}>
                  <span style={{ width: 34, height: 34, borderRadius: 34, flexShrink: 0, border: `3px solid ${done ? COLORS.green : COLORS.blue}`, borderTopColor: done ? COLORS.green : "transparent", transform: `rotate(${done ? 0 : frame * 22}deg)`, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.green, fontSize: 22, fontFamily: FONTS.mono }}>
                    {done ? "✓" : ""}
                  </span>
                  <div>
                    <div lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 34, color: "#fff" }}>{s.title}</div>
                    <div dir="ltr" style={{ fontFamily: FONTS.mono, fontSize: 22, color: COLORS.dim, textAlign: "right", whiteSpace: "pre" }}>{s.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Glass>

      {/* editor (left): prompt words arrive as code, then become motion */}
      <Glass style={{ left: 110, top: 290, width: 800, height: 520, opacity: ui, overflow: "visible", transform: `translateX(${(1 - ui) * -160}px) perspective(1400px) rotateY(${lerp(22, 5, ui)}deg)` }}>
        <div style={{ height: 54, borderBottom: `1px solid ${COLORS.faint}`, display: "flex", alignItems: "center", padding: "0 24px", fontFamily: FONTS.mono, fontSize: 22, color: COLORS.dim, opacity: 1 - morph }}>
          src/scenes/Hook.tsx
        </div>
        <div style={{ position: "absolute", inset: "54px 0 0 0" }}>
          {CODE.map(([kw, rest], i) => {
            const a = fly(i);
            const m = prog(frame, 258 + i * 3, 284 + i * 3, EASE.inOut);
            const sh = SHAPES[i];
            const lineY = 44 + i * 62;
            const isDiff = i === 2;
            const spin = m * (i % 2 ? -1 : 1) * 180 + (m >= 1 ? (frame - 284) * (i % 2 ? -1.6 : 1.2) : 0);
            const bob = m * Math.sin(frame / 9 + i * 1.3) * 16;
            return (
              <div key={i} style={{ position: "absolute", left: lerp(lerp(840, 36, a), sh.x, m), top: lerp(lerp(40, lineY, a), sh.y, m) + bob, width: lerp(lerp(150, 700, a), sh.w, m), height: lerp(46, sh.h, m), borderRadius: lerp(10, sh.r, m), opacity: Math.min(1, a * 3), background: m > 0 ? (i % 2 ? `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.blueDeep})` : GRADIENT) : isDiff && diff > 0 ? `${COLORS.green}22` : a < 1 ? `${COLORS.violet}55` : "transparent", backgroundSize: "100% 100%", boxShadow: m > 0 ? `0 0 ${m * 50}px ${i % 2 ? COLORS.blue : COLORS.violet}aa` : undefined, transform: `rotate(${i === 0 || i === 3 ? 0 : spin * (i === 1 ? 0.5 : 0.04)}deg) scale(${1 + m * 0.08 * Math.sin(frame / 7 + i)})`, overflow: "hidden", display: "flex", alignItems: "center" }}>
                <span style={{ fontFamily: FONTS.mono, fontSize: 27, whiteSpace: "pre", paddingLeft: 12, opacity: prog(a, 0.7, 1, EASE.linear) * (1 - prog(m, 0, 0.3, EASE.linear)), color: COLORS.white }}>
                  <span style={{ color: isDiff && diff > 0 ? COLORS.green : COLORS.dim }}>{isDiff && diff > 0 ? "+ " : "  "}</span>
                  <span style={{ color: COLORS.violetSoft }}>{kw}</span>
                  {isDiff && diff > 0.5 ? " scale = spring({frame, fps, config: {damping: 12}});".slice(0, 32) : rest}
                </span>
              </div>
            );
          })}
          {/* orbiting dots give the finished shapes life */}
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "absolute", left: 400 + Math.cos(frame / 8 + (i * TAU) / 3) * 330, top: 230 + Math.sin(frame / 8 + (i * TAU) / 3) * 200, width: 18, height: 18, borderRadius: 18, background: "#fff", boxShadow: `0 0 20px ${COLORS.blue}`, opacity: morph }} />
          ))}
        </div>
      </Glass>
    </AbsoluteFill>
  );
};
