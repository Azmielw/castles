import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { Glass, Tag } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { arNum, EASE, lerp, prog } from "../lib/anim";

const WEAK_IN = 10;
const STRONG_IN = 56;
const RESULTS = 168;
const VERDICT = 262;

const Meter: React.FC<{ value: number; good: boolean; label: string }> = ({ value, good, label }) => (
  <div dir="rtl" style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 22 }}>
    <span lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 26, color: COLORS.dim, whiteSpace: "nowrap" }}>{label}</span>
    <div style={{ flex: 1, height: 16, borderRadius: 16, background: COLORS.faint, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value * 100}%`, borderRadius: 16, background: good ? `linear-gradient(270deg, ${COLORS.greenBright}, ${COLORS.green})` : COLORS.grayMid, boxShadow: good ? `0 0 20px ${COLORS.green}` : undefined }} />
    </div>
    <span style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 32, color: good ? COLORS.greenBright : COLORS.grayMid, minWidth: 80 }}>{arNum(Math.round(value * 100), 1)}٪</span>
  </div>
);

export const Scene03Prompt: React.FC = () => {
  const frame = useCurrentFrame();
  const weak = prog(frame, WEAK_IN, WEAK_IN + 22, EASE.out);
  const strong = prog(frame, STRONG_IN, STRONG_IN + 22, EASE.out);
  const verdict = prog(frame, VERDICT, VERDICT + 20, EASE.inOut);
  const weakChars = Math.max(0, (frame - WEAK_IN - 16) * 1.2);
  const weakRes = prog(frame, RESULTS, RESULTS + 24, EASE.out);
  const strongRes = (i: number) => prog(frame, RESULTS + 16 + i * 16, RESULTS + 34 + i * 16, EASE.out);
  const meterW = prog(frame, RESULTS + 30, RESULTS + 80, EASE.inOut);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.green} b={COLORS.greenDeep} intensity={0.75} />
      <Particles count={60} seed="prompt" opacity={0.55} />

      <div dir="rtl" lang="ar" style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 76, color: "#fff", opacity: prog(frame, 0, 16), transform: `translateY(${(1 - prog(frame, 0, 18, EASE.out)) * 30}px)` }}>
        سر الـ <span style={gradientText(GRADIENT)}>Prompt</span> الصح
      </div>

      {/* weak */}
      <Glass style={{ left: 70, right: 70, top: 300, height: 420, padding: "34px 40px", opacity: weak * lerp(1, 0.42, verdict), transform: `translateY(${(1 - weak) * 80}px) perspective(1400px) rotateX(${(1 - weak) * 18}deg) scale(${lerp(1, 0.94, verdict)})`, filter: verdict > 0 ? `grayscale(${verdict}) blur(${verdict * 1.5}px)` : undefined, background: "linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", border: `1.5px solid ${COLORS.faint}` }} glow="#000000">
        <div dir="rtl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tag color={COLORS.grayMid} style={{ fontSize: 30 }}>{COPY.prompt.weakTag}</Tag>
          <span style={{ fontSize: 60, color: COLORS.grayMid, fontFamily: FONTS.latin, opacity: verdict }}>✕</span>
        </div>
        <div dir="rtl" lang="ar" style={{ marginTop: 28, display: "inline-block", background: "#2f2f2f", borderRadius: 30, padding: "16px 30px 20px", fontFamily: FONTS.body, fontWeight: 500, fontSize: 40, color: "#fff" }}>
          {COPY.prompt.weak.slice(0, Math.floor(weakChars))}
          {weakChars < COPY.prompt.weak.length ? <span style={{ display: "inline-block", width: 3, height: 40, background: COLORS.greenBright, marginInlineStart: 4 }} /> : null}
        </div>
        <div dir="rtl" lang="ar" style={{ marginTop: 26, fontFamily: FONTS.body, fontSize: 32, lineHeight: 1.6, color: COLORS.grayMid, opacity: weakRes, transform: `translateY(${(1 - weakRes) * 20}px)` }}>
          {COPY.prompt.weakResult}
        </div>
        <div style={{ opacity: weakRes }}>
          <Meter value={meterW * 0.28} good={false} label={COPY.prompt.meter} />
        </div>
      </Glass>

      {/* strong */}
      <Glass style={{ left: 70, right: 70, top: 750, height: 610, padding: "34px 40px", opacity: strong, transform: `translateY(${(1 - strong) * 100 - verdict * 30}px) perspective(1400px) rotateX(${(1 - strong) * 18}deg) scale(${1 + verdict * 0.04})`, boxShadow: `0 30px 90px rgba(0,0,0,0.6), 0 0 ${40 + verdict * 90}px ${COLORS.green}66`, border: `2px solid ${verdict > 0.5 ? COLORS.green : COLORS.glassBorder}` }}>
        <div dir="rtl" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tag color={COLORS.greenBright} style={{ fontSize: 30 }}>{COPY.prompt.strongTag}</Tag>
          <span style={{ fontSize: 60, color: COLORS.greenBright, fontFamily: FONTS.latin, opacity: verdict, transform: `scale(${0.6 + verdict * 0.4})`, display: "inline-block" }}>✓</span>
        </div>
        <div dir="rtl" lang="ar" style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12, background: "#2f2f2f", borderRadius: 30, padding: "18px 24px" }}>
          {COPY.prompt.strong.map((chunk, i) => {
            const on = prog(frame, STRONG_IN + 20 + i * 15, STRONG_IN + 32 + i * 15, EASE.back);
            const hot = i > 0;
            return (
              <span key={i} dir={/[A-Za-z0-9]/.test(chunk) && !/[؀-ۿ]/.test(chunk) ? "ltr" : "rtl"} style={{ display: "inline-block", fontFamily: FONTS.body, fontWeight: hot ? 700 : 500, fontSize: 34, color: "#fff", padding: hot ? "4px 16px 8px" : "4px 4px 8px", borderRadius: 14, background: hot ? `rgba(16,163,127,${0.18 + on * 0.22})` : "transparent", border: hot ? `1.5px solid ${COLORS.green}` : "none", opacity: on, transform: `translateY(${(1 - on) * 16}px) scale(${0.85 + on * 0.15})` }}>
                {chunk}
              </span>
            );
          })}
        </div>
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          {COPY.prompt.strongResult.map(([k, v], i) => (
            <div key={k} dir="rtl" style={{ display: "flex", alignItems: "center", gap: 16, opacity: strongRes(i), transform: `translateX(${(1 - strongRes(i)) * -40}px)` }}>
              <span style={{ fontFamily: FONTS.latin, fontWeight: 700, fontSize: 26, color: "#000", background: COLORS.greenBright, borderRadius: 10, padding: "4px 12px", minWidth: 90, textAlign: "center" }}>{k}</span>
              <span lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 30, color: "#fff" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ opacity: strongRes(0) }}>
          <Meter value={meterW * 0.95} good label={COPY.prompt.meter} />
        </div>
      </Glass>
    </AbsoluteFill>
  );
};
