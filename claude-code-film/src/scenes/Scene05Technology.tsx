import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { Glass, Tag } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { EASE, lerp, prog, rnd } from "../lib/anim";

// Real, valid Remotion code — this is exactly how a title is animated.
const CODE = [
  "import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';",
  "",
  "export const Title = () => {",
  "  const frame = useCurrentFrame();",
  "  const opacity = interpolate(frame, [0, 30], [0, 1], {",
  "    extrapolateRight: 'clamp',",
  "  });",
  "  return (",
  "    <AbsoluteFill style={{opacity, fontSize: 80}}>",
  "      فكرتك تبدأ هنا",
  "    </AbsoluteFill>",
  "  );",
  "};",
];
const KEYWORDS = /(import|from|export|const|return)\b|('[^']*')|(\b\d+\b)|(<\/?AbsoluteFill)|(useCurrentFrame|interpolate)/g;

const CodeLine: React.FC<{ text: string; chars: number; hot?: boolean; size: number }> = ({ text, chars, hot, size }) => {
  let shown = text.slice(0, Math.max(0, chars));
  if (hot) shown = shown.replace("fontSize: 80", `fontSize: ${size}`);
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of shown.matchAll(KEYWORDS)) {
    parts.push(shown.slice(last, m.index));
    const color = m[1] ? COLORS.violetSoft : m[2] ? COLORS.green : m[3] ? "#FFC24D" : m[4] ? COLORS.blue : "#E7B8FF";
    parts.push(<span key={m.index} style={{ color }}>{m[0]}</span>);
    last = (m.index ?? 0) + m[0].length;
  }
  parts.push(shown.slice(last));
  return <>{parts}</>;
};

const TRACK_CLIPS = [
  [[0.0, 0.2], [0.23, 0.3], [0.56, 0.18], [0.77, 0.21]],
  [[0.19, 0.06], [0.52, 0.06], [0.74, 0.05]],
  [[0.02, 0.05], [0.2, 0.04], [0.36, 0.06], [0.55, 0.04], [0.8, 0.07]],
  [[0.03, 0.4], [0.47, 0.5]],
  [[0.03, 0.12], [0.16, 0.1], [0.27, 0.15], [0.47, 0.13], [0.62, 0.16], [0.8, 0.16]],
];
const TRACK_AT = [134, 146, 158, 170, 182];

export const Scene05Technology: React.FC = () => {
  const frame = useCurrentFrame();

  // A — wordmark
  const logo = prog(frame, 4, 34, EASE.out);
  const dock = prog(frame, 44, 74, EASE.inOut);
  const react = prog(frame, 22, 42, EASE.back);
  // B — panels
  const panels = prog(frame, 50, 80, EASE.out);
  const typeChars = (frame - 58) * 9;
  const toTimeline = prog(frame, 112, 140, EASE.inOut);
  // D — render
  const render = prog(frame, 236, 252, EASE.out);
  const progress = prog(frame, 250, 296, EASE.inOut);
  const done = prog(frame, 296, 312, EASE.back);
  const renderOut = prog(frame, 326, 340, EASE.in);
  // E — tweak by code
  const tweak = prog(frame, 346, 372, EASE.inOut);
  const size = Math.round(lerp(80, 120, tweak));
  const play = frame > 140 ? ((frame - 140) * 0.0058) % 1 : 0;
  const pf = Math.max(0, frame - 140) % 110; // preview-local frame

  let acc = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.blueDeep} b={COLORS.violet} intensity={0.8} />
      <Particles count={70} seed="tech" drift={[0.3, -0.15]} opacity={0.7} />

      {/* Remotion + React */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 34, transform: `translate(${lerp(0, 600, dock)}px, ${lerp(-60, -452, dock)}px) scale(${lerp(lerp(0.7, 1, logo), 0.36, dock)})`, opacity: logo, filter: `blur(${(1 - logo) * 16}px)` }}>
          <div style={{ fontFamily: FONTS.latin, fontWeight: 700, fontSize: 190, color: "#fff", letterSpacing: "-0.02em" }}>Remotion</div>
          <svg width="170" height="170" viewBox="-50 -50 100 100" style={{ filter: `drop-shadow(0 0 30px ${COLORS.blue})` }}>
            {[0, 1, 2].map((i) => (
              <path key={i} d="M-22 -30 L30 0 L-22 30 Z" fill={i === 2 ? COLORS.blue : "none"} stroke={COLORS.blue} strokeWidth={5} strokeLinejoin="round" opacity={[0.3, 0.6, 1][i]} transform={`translate(${(i - 2) * 9 * logo} 0) scale(${1.3 - i * 0.2})`} />
            ))}
          </svg>
        </div>
        <div dir="rtl" lang="ar" style={{ position: "absolute", top: 640, display: "flex", alignItems: "center", gap: 20, fontFamily: FONTS.body, fontWeight: 500, fontSize: 58, color: COLORS.white, opacity: react * (1 - dock), transform: `scale(${0.8 + react * 0.2})` }}>
          {COPY.technology.subtitle.join(" ")}
          <span dir="ltr" style={{ display: "inline-flex", alignItems: "center", gap: 14, fontFamily: FONTS.latin, fontWeight: 700, color: COLORS.blue }}>
            <svg width="70" height="70" viewBox="-50 -50 100 100">
              {[0, 60, 120].map((r) => <ellipse key={r} rx={44} ry={17} fill="none" stroke={COLORS.blue} strokeWidth={4.5} transform={`rotate(${r + frame * 1.5})`} />)}
              <circle r={8} fill={COLORS.blue} />
            </svg>
            React
          </span>
        </div>
      </AbsoluteFill>

      {/* code */}
      <Glass style={{ left: 90, top: 150, width: 880, height: 470, opacity: panels, transform: `translateX(${(1 - panels) * -120}px) scale(${1 + tweak * 0.035})`, boxShadow: tweak > 0 ? `0 0 ${tweak * 90}px ${COLORS.blue}88, 0 30px 90px rgba(0,0,0,0.6)` : undefined }}>
        <div dir="rtl" style={{ height: 48, borderBottom: `1px solid ${COLORS.faint}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px" }}>
          <span lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 24, color: COLORS.white }}>{COPY.technology.panels.code}</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: 19, color: COLORS.dim }}>src/Title.tsx</span>
        </div>
        <div style={{ padding: "16px 22px", fontFamily: FONTS.mono, fontSize: 19.5, lineHeight: "30px", color: COLORS.white, whiteSpace: "pre" }}>
          {CODE.map((line, i) => {
            const before = acc;
            acc += line.length + 4;
            const hot = i === 8;
            return (
              <div key={i} style={{ display: "flex", background: hot && tweak > 0 ? `${COLORS.blue}${tweak < 1 ? "44" : "22"}` : "transparent", borderRadius: 6, margin: "0 -8px", padding: "0 8px" }}>
                <span style={{ width: 34, color: "rgba(255,255,255,0.25)" }}>{i + 1}</span>
                <span dir={i === 9 ? "rtl" : "ltr"} lang={i === 9 ? "ar" : undefined} style={i === 9 ? { fontFamily: FONTS.body, textAlign: "left", paddingLeft: 68, opacity: typeChars > before ? 1 : 0 } : undefined}>
                  {i === 9 ? line.trim() : <CodeLine text={line} chars={typeChars - before} hot={hot} size={size} />}
                </span>
              </div>
            );
          })}
        </div>
      </Glass>

      {/* preview: the code above, rendered */}
      <Glass style={{ left: 1000, top: 150, width: 830, height: 470, opacity: panels, transform: `translateX(${(1 - panels) * 120}px)` }} glow={COLORS.blue}>
        <div dir="rtl" style={{ height: 48, borderBottom: `1px solid ${COLORS.faint}`, display: "flex", alignItems: "center", padding: "0 22px" }}>
          <span lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 24, color: COLORS.white }}>{COPY.technology.panels.preview}</span>
        </div>
        <div style={{ position: "absolute", inset: "48px 0 0 0", background: "radial-gradient(circle at 50% 40%, #2a1170, #05030b 75%)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", width: 520, height: 520, borderRadius: "50%", border: `2px solid ${COLORS.violet}66`, transform: `scale(${0.5 + (pf / 110) * 0.9})`, opacity: 1 - pf / 110 }} />
          <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: size * 0.92, whiteSpace: "nowrap", opacity: frame < 140 ? 0 : tweak > 0 ? 1 : prog(pf, 0, 30, EASE.linear), ...gradientText(tweak > 0.5 ? GRADIENT : "linear-gradient(#fff,#fff)"), filter: `drop-shadow(0 0 ${tweak * 30}px ${COLORS.violet})` }}>
            فكرتك تبدأ هنا
          </div>
        </div>
      </Glass>

      {/* timeline: code becomes tracks */}
      <Glass style={{ left: 90, top: 646, width: 1740, height: 236, opacity: toTimeline, transform: `translateY(${(1 - toTimeline) * 80}px)` }}>
        <div style={{ position: "absolute", inset: "12px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {COPY.technology.tracks.map((name, i) => {
            const on = prog(frame, TRACK_AT[i], TRACK_AT[i] + 14, EASE.out);
            const c = [COLORS.violet, COLORS.blue, COLORS.green, COLORS.violetSoft, COLORS.blueDeep][i];
            return (
              <div key={i} dir="rtl" style={{ display: "flex", alignItems: "center", gap: 18, height: 36 }}>
                <div lang="ar" style={{ width: 250, fontFamily: FONTS.body, fontWeight: 700, fontSize: 25, color: on > 0.5 ? "#fff" : COLORS.dim, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 12, background: c, boxShadow: `0 0 ${on * 16}px ${c}` }} />
                  {name}
                </div>
                <div dir="ltr" style={{ flex: 1, height: 30, position: "relative", borderRadius: 8, background: "rgba(255,255,255,0.035)" }}>
                  {TRACK_CLIPS[i].map(([s, w], k) => {
                    const p = prog(frame, TRACK_AT[i] + k * 2, TRACK_AT[i] + 14 + k * 2, EASE.out);
                    return (
                      <div key={k} style={{ position: "absolute", left: `${s * 100}%`, width: `${w * 100 * p}%`, top: 2, bottom: 2, borderRadius: 6, background: `linear-gradient(90deg, ${c}, ${c}aa)`, opacity: p, overflow: "hidden" }}>
                        {i === 3 ? new Array(60).fill(0).map((_, b) => <span key={b} style={{ position: "absolute", left: `${(b / 60) * 100}%`, top: "50%", width: 3, borderRadius: 2, height: 4 + rnd(`vo${b}${k}`) * 18, marginTop: -(2 + rnd(`vo${b}${k}`) * 9), background: "#0a0518" }} />) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 6, bottom: 6, left: 20 + (1740 - 40 - 268) * play, width: 3, background: "#fff", boxShadow: `0 0 14px ${COLORS.blue}` }} />
      </Glass>

      {/* render → MP4 */}
      <AbsoluteFill style={{ backgroundColor: `rgba(3,2,7,${0.72 * render * (1 - renderOut)})`, alignItems: "center", justifyContent: "center" }}>
        <Glass style={{ position: "relative", width: 1040, height: 430, opacity: render * (1 - renderOut), transform: `translateY(-50px) scale(${lerp(0.86, 1, render) + renderOut * 0.1})`, padding: "40px 52px", background: "linear-gradient(160deg, #150d33, #0a0618)", overflow: "visible" }} glow={COLORS.blue}>
          <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 46, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{done > 0.5 ? COPY.technology.done : COPY.technology.rendering}</span>
            <span dir="ltr" style={{ fontFamily: FONTS.latin, color: COLORS.blue }}>{Math.round(progress * 100)}%</span>
          </div>
          <div style={{ marginTop: 26, fontFamily: FONTS.mono, fontSize: 27, color: COLORS.dim, whiteSpace: "pre" }}>
            <span style={{ color: COLORS.green }}>$ </span>
            {"npx remotion render Main out/video.mp4".slice(0, Math.max(0, (frame - 240) * 3))}
          </div>
          <div style={{ marginTop: 30, height: 18, borderRadius: 18, background: COLORS.faint, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, borderRadius: 18, background: GRADIENT, boxShadow: `0 0 24px ${COLORS.blue}` }} />
          </div>
          <div style={{ marginTop: 22, display: "flex", gap: 6 }}>
            {new Array(34).fill(0).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 44, borderRadius: 5, background: i / 34 < progress ? (i % 2 ? COLORS.violet : COLORS.blueDeep) : "rgba(255,255,255,0.05)", opacity: i / 34 < progress ? 0.9 : 1, transform: `scaleY(${i / 34 < progress ? 1 : 0.6})` }} />
            ))}
          </div>
          <div style={{ position: "absolute", right: 52, bottom: -70, width: 190, height: 150, borderRadius: 24, background: "linear-gradient(150deg,#1b0f45,#0a0618)", border: `2.5px solid ${COLORS.blue}`, boxShadow: `0 0 ${done * 70}px ${COLORS.blue}`, transform: `scale(${done}) rotate(${lerp(-18, -6, done)}deg)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ width: 0, height: 0, borderLeft: "30px solid #fff", borderTop: "19px solid transparent", borderBottom: "19px solid transparent" }} />
            <div style={{ fontFamily: FONTS.latin, fontWeight: 700, fontSize: 40, ...gradientText(GRADIENT) }}>MP4</div>
          </div>
        </Glass>
      </AbsoluteFill>

      {/* tweak caption */}
      <div style={{ position: "absolute", left: 90, top: 66, opacity: prog(frame, 342, 356), transform: `translateY(${(1 - prog(frame, 342, 356)) * -20}px)` }}>
        <Tag color={COLORS.blue}>{COPY.technology.tweak}</Tag>
      </div>
    </AbsoluteFill>
  );
};
