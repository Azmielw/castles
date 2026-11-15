import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, useExit, useSec, useSpring, Words } from "../components/Motion";
import { h1 } from "../components/UI";

const SKILLS = [
  { name: "find-skills", desc: "تدوّر على مهارات جديدة" },
  { name: "yt-script", desc: "سكريبت يوتيوب من فكرة" },
  { name: "remotion-motion", desc: "فيديوهات موشن بالكود" },
  { name: "yt-package", desc: "عنوان وصورة مصغّرة" },
];
const MATCH = 1;

export const How: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const ask = f(3.6);
  const scanStart = f(5.0);
  const matchAt = f(6.4);
  const expandAt = f(7.0);
  const out = useExit(dur - 10);
  const askIn = useSpring(ask, "snappy");
  const lit = interpolate(frame, [matchAt, matchAt + 10], [0, 1], { easing: theme.ease.out, ...clamp });
  const expand = useSpring(expandAt);
  const scanY = interpolate(frame, [scanStart, matchAt], [0, MATCH + 0.5], { easing: theme.ease.inOut, ...clamp });
  const scanOn = frame >= scanStart && frame < matchAt + 6 ? 1 : 0;
  const push = interpolate(frame, [0, dur], [1, 1.04]);

  const ROW = 140;
  const EXTRA = 180;

  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <AbsoluteFill style={{ width: "auto", top: 270, left: 100, right: 100, height: "auto" }}>
        <Words text="Claude بيشوف الوصف بس" at={3} per={3} out={f(4.6)} style={h1} />
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 270, left: 100, right: 100, height: "auto" }}>
        <Words text="ولما طلبك يناسبه… يفتح المهارة" at={f(4.9)} per={3} style={h1} />
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 560, left: 100, right: 100, height: "auto" }}>
        <div style={{ position: "relative" }}>
          {SKILLS.map((s, i) => {
            const p = useSpring(14 + i * 5);
            const isMatch = i === MATCH;
            const dimOthers = isMatch ? 1 : interpolate(lit, [0, 1], [1, 0.35]);
            const y = i * ROW + (i > MATCH ? EXTRA * expand : 0);
            return (
              <div
                key={s.name}
                style={{
                  position: "absolute", top: y, left: 0, right: 0, opacity: p * dimOthers,
                  transform: `translateX(${interpolate(p, [0, 1], [-60, 0])}px)`,
                }}
              >
                <div
                  style={{
                    background: `linear-gradient(160deg, ${theme.colors.cardHi}, ${theme.colors.card})`, borderRadius: 24,
                    border: `2px solid ${isMatch && lit > 0 ? theme.colors.primary : theme.colors.line}`,
                    boxShadow: isMatch ? `0 0 ${60 * lit}px ${theme.colors.glow}` : "0 20px 40px rgba(0,0,0,0.35)",
                    padding: "22px 34px", height: ROW - 20 + (isMatch ? EXTRA * expand : 0), overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", direction: "ltr" }}>
                    <div style={{ fontFamily: theme.fonts.mono, fontSize: 36, color: isMatch && lit > 0 ? theme.colors.primary : theme.colors.ink }}>
                      {s.name}
                    </div>
                    <div style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 34, color: theme.colors.dim, direction: "rtl" }}>{s.desc}</div>
                  </div>
                  {isMatch && (
                    <div style={{ marginTop: 24, opacity: expand, direction: "rtl", fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 34, color: theme.colors.ink, lineHeight: 1.6 }}>
                      <div style={{ color: theme.colors.green }}>✓ اتفتحت، وبيمشي على تعليماتها:</div>
                      <div style={{ color: theme.colors.dim }}>• 5 هوكات، ويختار أحسن اتنين</div>
                      <div style={{ color: theme.colors.dim }}>• كل مقطع معاه اللي يظهر على الشاشة</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* scanner */}
          <div
            style={{
              position: "absolute", left: -20, right: -20, top: scanY * ROW, height: 4, borderRadius: 2, opacity: scanOn,
              background: `linear-gradient(90deg, transparent, ${theme.colors.ink}, transparent)`, boxShadow: `0 0 24px ${theme.colors.ink}`,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* the user's request */}
      <AbsoluteFill style={{ width: "auto", top: 1340, left: 100, right: 100, height: "auto", alignItems: "flex-end" }}>
        <div
          style={{
            opacity: askIn, transform: `translateY(${interpolate(askIn, [0, 1], [80, 0])}px)`,
            direction: "rtl", fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 44, color: theme.colors.bg,
            background: theme.colors.ink, borderRadius: "36px 36px 36px 8px", padding: "24px 38px",
          }}
        >
          اكتبلي سكريبت ريل عن Claude
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
