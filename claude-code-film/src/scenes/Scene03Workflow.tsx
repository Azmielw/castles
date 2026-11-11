import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { COPY } from "../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { arNum, bell, EASE, lerp, prog } from "../lib/anim";

/** Frame (inside the scene) at which each stage lights up. Synced to the narration. */
export const STAGE_AT = [26, 110, 152, 215, 262, 302, 342];
const OVERVIEW_AT = 372;
const GAP = 560;

const ICONS: React.ReactNode[] = [
  // idea
  <g key="0"><path d="M50 14c-17 0-30 13-30 29 0 11 6 19 14 25v10h32V68c8-6 14-14 14-25 0-16-13-29-30-29z" /><path d="M38 90h24" /><path d="M50 44v20M42 50l8-8 8 8" /></g>,
  // script
  <g key="1"><rect x="22" y="12" width="56" height="76" rx="8" /><path d="M34 32h32M34 48h32M34 64h20" /></g>,
  // scenes
  <g key="2"><rect x="12" y="20" width="42" height="28" rx="5" /><rect x="46" y="52" width="42" height="28" rx="5" /><path d="M54 34h18v18M46 66H28V48" /></g>,
  // motion code
  <g key="3"><path d="M32 30 14 50l18 20M68 30l18 20-18 20" /><path d="M56 22 44 78" /></g>,
  // sound
  <g key="4"><path d="M16 42v16M30 30v40M44 18v64M58 34v32M72 24v52M86 42v16" /></g>,
  // captions
  <g key="5"><rect x="10" y="22" width="80" height="56" rx="10" /><path d="M24 50h22M54 50h22M24 64h36" /></g>,
  // export
  <g key="6"><path d="M50 14v48M32 44l18 18 18-18" /><path d="M16 66v14a6 6 0 0 0 6 6h56a6 6 0 0 0 6-6V66" /></g>,
];

const node = (i: number) => ({ x: -i * GAP, y: Math.sin(i * 1.25) * 70, z: (i % 2 ? -1 : 1) * 130 });

export const Scene03Workflow: React.FC = () => {
  const frame = useCurrentFrame();
  const stages = COPY.workflow.stages;

  // camera follows the active stage, then pulls back to reveal the whole pipeline
  let cam = 0;
  for (let i = 1; i < STAGE_AT.length; i++) cam += prog(frame, STAGE_AT[i] - 22, STAGE_AT[i] + 6, EASE.inOut);
  const over = prog(frame, OVERVIEW_AT, OVERVIEW_AT + 30, EASE.inOut);
  const camX = lerp(cam * GAP, 3 * GAP, over);
  const zoom = lerp(1.28, 0.5, over);
  const active = STAGE_AT.filter((s) => frame >= s).length - 1;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.blueDeep} b={COLORS.violet} intensity={0.8} />
      <Particles count={130} seed="flow" camX={-camX * 0.5} drift={[0.1, -0.2]} />

      {/* header */}
      <div dir="rtl" lang="ar" style={{ position: "absolute", top: 84, right: 110, left: 110, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: prog(frame, 6, 26) }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 46, color: COLORS.white }}>{COPY.workflow.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 360, height: 6, borderRadius: 6, background: COLORS.faint, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((lerp(cam, 6, over) + 1) / 7) * 100}%`, background: GRADIENT, borderRadius: 6 }} />
          </div>
          <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 40, color: COLORS.blue, minWidth: 150 }}>
            {arNum(Math.max(1, active + 1))} <span style={{ color: COLORS.dim, fontWeight: 400 }}>/ {arNum(7)}</span>
          </div>
        </div>
      </div>

      {/* 3D world */}
      <AbsoluteFill style={{ perspective: 1500, perspectiveOrigin: "50% 46%" }}>
        <div style={{ position: "absolute", left: "50%", top: "50%", transformStyle: "preserve-3d", transform: `scale(${zoom}) rotateX(${lerp(7, 14, over)}deg) rotateY(${lerp(-20, 0, over) + Math.sin(frame / 44) * 2.5}deg) translateX(${camX - lerp(120, 0, over)}px) translateY(${lerp(-10, -150, over)}px)` }}>
          {/* glowing connectors */}
          {stages.slice(0, -1).map((_, i) => {
            const a = node(i);
            const b = node(i + 1);
            const draw = prog(frame, STAGE_AT[i + 1] - 26, STAGE_AT[i + 1] - 2, EASE.inOut);
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            const pulse = ((frame - STAGE_AT[i + 1]) % 46) / 46;
            return (
              <div key={i} style={{ position: "absolute", left: a.x, top: a.y, width: len, height: 0, transformOrigin: "0 0", transform: `translateZ(${(a.z + b.z) / 2}px) rotate(${ang}deg)` }}>
                <div style={{ position: "absolute", left: 150, right: 150, top: -3, height: 6, borderRadius: 6, background: COLORS.faint }} />
                <div style={{ position: "absolute", left: 150, width: (len - 300) * draw, top: -3, height: 6, borderRadius: 6, background: `linear-gradient(90deg, ${COLORS.violet}, ${COLORS.blue})`, boxShadow: `0 0 22px ${COLORS.blue}` }} />
                {draw >= 1 ? <div style={{ position: "absolute", left: 150 + (len - 300) * pulse - 20, top: -8, width: 40, height: 16, borderRadius: 16, background: "#fff", filter: "blur(4px)", opacity: Math.sin(pulse * Math.PI) }} /> : null}
              </div>
            );
          })}

          {stages.map((label, i) => {
            const n = node(i);
            const on = prog(frame, STAGE_AT[i], STAGE_AT[i] + 20, EASE.back);
            const ring = bell(frame, STAGE_AT[i], STAGE_AT[i] + 34);
            const isActive = i === active && over < 0.5;
            const focus = over > 0.5 ? 1 : 1 - Math.min(1, Math.abs(i - cam) * 0.5);
            const c = i % 2 ? COLORS.blue : COLORS.violet;
            return (
              <div key={i} style={{ position: "absolute", left: n.x, top: n.y, transformStyle: "preserve-3d", transform: `translateZ(${n.z}px) scale(${lerp(0.3, 1, on)}) rotateY(${lerp(20 - over * 20, 60, 1 - Math.min(1, on))}deg)`, opacity: Math.min(1, on * 1.5) * lerp(0.35, 1, focus), filter: `blur(${(1 - focus) * 5}px)` }}>
                {/* extruded 3D tile */}
                {[0, 1, 2, 3, 4, 5].map((d) => (
                  <div key={d} style={{ position: "absolute", left: -130, top: -150, width: 260, height: 260, borderRadius: 56, transform: `translateZ(${-d * 7}px)`, background: d === 0 ? `linear-gradient(150deg, ${c}55, rgba(12,8,28,0.96) 60%)` : `${c}${d === 5 ? "55" : "22"}`, border: d === 0 ? `2.5px solid ${c}` : undefined, boxShadow: d === 0 ? `0 0 ${50 + ring * 90}px ${c}${isActive ? "cc" : "66"}, inset 0 2px 0 rgba(255,255,255,0.25)` : undefined }} />
                ))}
                <svg viewBox="0 0 100 100" width={150} height={150} style={{ position: "absolute", left: -75, top: -95, transform: `translateZ(46px) translateY(${Math.sin(frame / 16 + i) * 7}px)`, filter: `drop-shadow(0 0 16px ${c})`, overflow: "visible" }} fill="none" stroke="#fff" strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[i]}
                </svg>
                <div style={{ position: "absolute", left: 74, top: -178, width: 74, height: 74, borderRadius: 74, background: GRADIENT, transform: "translateZ(70px)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 38, color: "#06030f", boxShadow: `0 0 26px ${COLORS.blue}` }}>
                  {arNum(i + 1, 1)}
                </div>
                <div style={{ position: "absolute", left: -180, top: -200, width: 360, height: 360, borderRadius: "50%", border: `3px solid ${c}`, opacity: ring * 0.8, transform: `scale(${0.7 + prog(frame, STAGE_AT[i], STAGE_AT[i] + 34) * 0.9})` }} />
                <div dir="rtl" lang="ar" style={{ position: "absolute", left: -300, width: 600, top: 148, opacity: Math.max(0, 1 - over * 3), textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 54, color: "#fff", whiteSpace: "nowrap", transform: `translateZ(30px) translateY(${(1 - Math.min(1, on)) * 30}px)`, textShadow: "0 4px 30px rgba(0,0,0,0.9)" }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      {/* overview headline */}
      <div dir="rtl" lang="ar" style={{ position: "absolute", left: 0, right: 0, top: 560, textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 104, color: "#fff", opacity: prog(frame, OVERVIEW_AT + 20, OVERVIEW_AT + 36), transform: `translateY(${(1 - prog(frame, OVERVIEW_AT + 20, OVERVIEW_AT + 40)) * 50}px)` }}>
        {COPY.workflow.summary[0]} <span style={gradientText(GRADIENT)}>{COPY.workflow.summary[1]}</span>
      </div>
    </AbsoluteFill>
  );
};
