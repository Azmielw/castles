import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { ChatHeader, Composer, Icon, Phone3D, UserBubble } from "../components/ChatUI";
import { Glass, Tag } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS } from "../config/theme";
import { EASE, lerp, prog, rnd, TAU } from "../lib/anim";

const PLUS_TAP = 26;
const PICK = 62;
const SCAN = 92;
const VOICE = 168;
const FILES = 250;

/** A receipt-like photo the assistant analyses. */
const Receipt: React.FC = () => (
  <div style={{ width: 300, height: 380, borderRadius: 20, background: "linear-gradient(170deg,#f4f4f6,#d9dadf)", padding: "26px 24px", boxSizing: "border-box", transform: "rotate(-3deg)", boxShadow: "0 16px 40px rgba(0,0,0,0.5)" }}>
    <div style={{ height: 22, width: "60%", margin: "0 auto 22px", borderRadius: 6, background: "#2a2d2b" }} />
    {[0.9, 0.7, 0.8].map((w, i) => (
      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ height: 14, width: `${w * 60}%`, borderRadius: 4, background: "#8a8d8b" }} />
        <span style={{ height: 14, width: 50, borderRadius: 4, background: "#8a8d8b" }} />
      </div>
    ))}
    <div style={{ borderTop: "3px dashed #8a8d8b", margin: "22px 0 18px" }} />
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ height: 20, width: 110, borderRadius: 4, background: "#2a2d2b" }} />
      <span style={{ height: 20, width: 80, borderRadius: 4, background: COLORS.green }} />
    </div>
    <div style={{ marginTop: 30, display: "flex", gap: 4, justifyContent: "center" }}>
      {new Array(22).fill(0).map((_, i) => <span key={i} style={{ width: i % 3 ? 4 : 7, height: 46, background: "#2a2d2b" }} />)}
    </div>
  </div>
);

/** Voice-mode orb: a glowing blob that breathes with the speech. */
const VoiceOrb: React.FC<{ frame: number }> = ({ frame }) => {
  const level = 0.5 + 0.5 * Math.abs(Math.sin(frame / 5) * Math.sin(frame / 13 + 1));
  const pts = new Array(48).fill(0).map((_, i) => {
    const a = (i / 48) * TAU;
    const r = 150 + Math.sin(a * 3 + frame / 7) * 10 * level + Math.sin(a * 5 - frame / 5) * 7 * level;
    return `${Math.cos(a) * r},${Math.sin(a) * r}`;
  });
  return (
    <svg width="420" height="420" viewBox="-210 -210 420 420" style={{ overflow: "visible", filter: `drop-shadow(0 0 ${40 + level * 40}px ${COLORS.green})` }}>
      <defs>
        <radialGradient id="orb" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor={COLORS.greenSoft} />
          <stop offset="100%" stopColor={COLORS.green} />
        </radialGradient>
      </defs>
      <polygon points={pts.join(" ")} fill="url(#orb)" transform={`scale(${0.94 + level * 0.1}) rotate(${frame * 0.6})`} />
    </svg>
  );
};

export const Scene05Advanced: React.FC = () => {
  const frame = useCurrentFrame();
  const inn = prog(frame, 0, 26, EASE.out);
  const menu = Math.min(prog(frame, PLUS_TAP + 2, PLUS_TAP + 16, EASE.out), 1 - prog(frame, PICK + 4, PICK + 16, EASE.in));
  const sent = prog(frame, PICK + 10, PICK + 26, EASE.out);
  const scan = prog(frame, SCAN, SCAN + 36, EASE.inOut);
  const answer = prog(frame, SCAN + 40, SCAN + 60, EASE.out);
  const voice = prog(frame, VOICE, VOICE + 18, EASE.inOut);
  const files = prog(frame, FILES, FILES + 30, EASE.inOut);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.green} b={COLORS.greenDeep} intensity={0.85} />
      <Particles count={70} seed="adv" opacity={0.55} />

      <div dir="rtl" lang="ar" style={{ position: "absolute", top: 136, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 70, color: "#fff", opacity: prog(frame, 0, 16) * (1 - files) }}>
        {voice > 0.5 ? COPY.advanced.voice : COPY.advanced.attach}
      </div>

      <Phone3D rotateY={lerp(lerp(30, 0, inn), -28, files) + Math.sin(frame / 50) * 2} rotateX={lerp(lerp(16, 4, inn), 8, files)} scale={lerp(lerp(0.7, 0.92, inn), 0.6, files)} y={lerp(lerp(300, -30, inn), -110, files)} x={lerp(0, 230, files)} glow={0.8}>
        {/* chat with attachment */}
        <div style={{ position: "absolute", inset: 0, opacity: 1 - voice }}>
          <ChatHeader />
          <div style={{ position: "absolute", left: 26, right: 26, top: 180, display: "flex", flexDirection: "column", gap: 22, alignItems: "stretch" }}>
            {sent > 0 ? (
              <div style={{ alignSelf: "flex-start", position: "relative", opacity: sent, transform: `translateY(${(1 - sent) * 60}px) scale(${0.9 + sent * 0.1})`, transformOrigin: "left bottom" }}>
                <Receipt />
                {/* scan line */}
                <div style={{ position: "absolute", left: -10, right: -10, top: 10 + scan * 360, height: 6, borderRadius: 6, background: COLORS.greenBright, boxShadow: `0 0 26px 8px ${COLORS.green}`, opacity: scan > 0 && scan < 1 ? 1 : 0 }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: 20, background: `linear-gradient(180deg, ${COLORS.green}33, transparent)`, height: `${scan * 100}%`, opacity: scan < 1 ? 1 : 0 }} />
              </div>
            ) : null}
            {sent > 0 ? (
              <UserBubble style={{ alignSelf: "flex-start", opacity: sent, fontSize: 30 }}>حلّلّي الفاتورة دي</UserBubble>
            ) : null}
            {scan > 0 ? (
              <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {COPY.advanced.found.map((t, i) => {
                  const on = prog(frame, SCAN + 10 + i * 9, SCAN + 22 + i * 9, EASE.back);
                  return (
                    <span key={t} lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 26, color: "#fff", padding: "6px 16px 9px", borderRadius: 14, border: `1.5px solid ${COLORS.green}`, background: `${COLORS.green}33`, opacity: on, transform: `scale(${on})` }}>
                      {t}
                    </span>
                  );
                })}
              </div>
            ) : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: answer }}>
              {[0.95, 0.85, 0.6].map((w, i) => (
                <div key={i} style={{ alignSelf: "flex-end", height: 16, borderRadius: 16, width: `${w * 92 * prog(frame, SCAN + 44 + i * 6, SCAN + 60 + i * 6, EASE.out)}%`, background: i === 0 ? "#fff" : "rgba(255,255,255,0.4)" }} />
              ))}
            </div>
          </div>
          {/* + menu sheet */}
          <div dir="rtl" style={{ position: "absolute", left: 22, right: 22, bottom: 160, borderRadius: 34, background: "#262626", padding: "16px 0", opacity: menu, transform: `translateY(${(1 - menu) * 60}px)`, boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}>
            {COPY.advanced.menu.map((m, i) => (
              <div key={m} lang="ar" style={{ display: "flex", alignItems: "center", gap: 22, padding: "20px 32px", fontFamily: FONTS.body, fontWeight: 500, fontSize: 32, color: "#fff", background: i === 0 && frame >= PICK - 10 ? `${COLORS.green}44` : "transparent" }}>
                <Icon name={(["image", "idea", "data"] as const)[i]} size={40} stroke={7} />
                {m}
              </div>
            ))}
          </div>
          <Composer placeholder={COPY.intro.placeholder} plusActive={menu} />
        </div>

        {/* voice mode */}
        <div style={{ position: "absolute", inset: 0, opacity: voice, background: "#0d0d0d" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", justifyContent: "center" }}>
            <VoiceOrb frame={frame} />
          </div>
          <div style={{ position: "absolute", left: 60, right: 60, top: 820, height: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            {new Array(28).fill(0).map((_, i) => (
              <span key={i} style={{ width: 7, borderRadius: 7, background: i % 4 === 0 ? COLORS.greenBright : "#fff", height: 10 + 70 * Math.abs(Math.sin(frame / 4 + i * 0.7) * Math.sin(frame / 11 + i * 0.3)) }} />
            ))}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, display: "flex", justifyContent: "center", gap: 70 }}>
            <div style={{ width: 110, height: 110, borderRadius: 110, background: "#2f2f2f", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="mic" size={54} stroke={7} />
            </div>
            <div style={{ width: 110, height: 110, borderRadius: 110, background: "#2f2f2f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, color: "#fff", fontFamily: FONTS.latin }}>✕</div>
          </div>
        </div>
      </Phone3D>

      {/* tap ripples on screen (approximate positions in the composition) */}
      {[PLUS_TAP, PICK].map((t, i) => {
        const k = prog(frame, t, t + 16, EASE.out);
        if (frame < t - 4 || frame > t + 18) return null;
        const pos = i === 0 ? [300, 1385] : [700, 1110];
        return <div key={i} style={{ position: "absolute", left: pos[0] - 50, top: pos[1] - 50, width: 100, height: 100, borderRadius: 100, border: `4px solid ${COLORS.greenSoft}`, background: "rgba(255,255,255,0.35)", opacity: 1 - k, transform: `scale(${0.5 + k})` }} />;
      })}

      {/* documents + dashboard in 3D */}
      <AbsoluteFill style={{ perspective: 1500, opacity: files }}>
        {COPY.advanced.files.map((name, i) => {
          const on = prog(frame, FILES + 6 + i * 8, FILES + 30 + i * 8, EASE.out);
          const y = 330 + i * 190;
          return (
            <Glass key={name} style={{ left: 60, top: y, width: 420, height: 150, transform: `translateZ(${lerp(-600, 60 - i * 30, on)}px) rotateY(${lerp(40, 14, on) + Math.sin(frame / 25 + i) * 3}deg) translateY(${Math.sin(frame / 18 + i * 2) * 8}px)`, opacity: on, display: "flex", alignItems: "center", gap: 24, padding: "0 28px" }}>
              <div style={{ width: 84, height: 96, borderRadius: 16, background: i === 1 ? COLORS.green : i === 0 ? COLORS.gray : COLORS.greenDeep, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.latin, fontWeight: 700, fontSize: 22, color: i === 0 ? "#111" : "#fff" }}>
                {name.split(".")[1].toUpperCase()}
              </div>
              <div dir="rtl" lang="ar" style={{ flex: 1, fontFamily: FONTS.body, fontWeight: 700, fontSize: 32, color: "#fff" }}>
                {name}
                <div style={{ marginTop: 10, height: 10, borderRadius: 10, background: COLORS.faint }}>
                  <div style={{ height: 10, borderRadius: 10, width: `${prog(frame, FILES + 20 + i * 8, FILES + 60 + i * 8, EASE.inOut) * 100}%`, background: COLORS.greenBright }} />
                </div>
              </div>
            </Glass>
          );
        })}
        <Glass style={{ left: 120, top: 920, width: 560, height: 330, padding: 28, transform: `translateZ(${lerp(-800, 120, prog(frame, FILES + 30, FILES + 60, EASE.out))}px) rotateY(16deg) rotateX(6deg)`, opacity: prog(frame, FILES + 30, FILES + 50) }}>
          <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 30, color: "#fff" }}>لوحة البيانات</div>
          <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", gap: 16, height: 190 }}>
            {[0.4, 0.62, 0.5, 0.78, 0.66, 0.92, 0.7].map((v, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 10, height: `${v * 100 * prog(frame, FILES + 40 + i * 3, FILES + 64 + i * 3, EASE.back)}%`, background: i === 5 ? COLORS.greenBright : `rgba(236,236,241,${0.2 + rnd(`d${i}`) * 0.15})` }} />
            ))}
          </div>
        </Glass>
      </AbsoluteFill>

      <div style={{ position: "absolute", left: 0, right: 0, top: 1290, display: "flex", justifyContent: "center", opacity: prog(frame, FILES + 30, FILES + 50) }}>
        <Tag color={COLORS.grayMid} style={{ fontSize: 30, fontWeight: 500 }}>{COPY.advanced.note}</Tag>
      </div>
    </AbsoluteFill>
  );
};
