import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { Icon } from "../components/ChatUI";
import { COPY } from "../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../config/theme";
import { EASE, lerp, prog, rnd } from "../lib/anim";

const ICON_KEYS = ["write", "learn", "code", "data", "idea", "image"] as const;
export const USE_AT = [16, 74, 132, 190, 248, 306];
const SPAN = 58;
const OVERVIEW = 366;

const HERO = { x: 540, y: 820, w: 820, h: 640 };
const slot = (i: number) => ({ x: i % 2 === 0 ? 760 : 320, y: 470 + Math.floor(i / 2) * 330, w: 400, h: 280 });

// ───────── mini scenes (lf = local frame since the hero opened) ─────────
const MiniWrite: React.FC<{ lf: number }> = ({ lf }) => {
  const text = "٥ أفكار لبوستات الأسبوع ده عن منتجك الجديد";
  const n = Math.floor(Math.max(0, lf - 4) * 1.6);
  return (
    <div dir="rtl" lang="ar" style={{ padding: 44 }}>
      <div style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 40, color: "#fff", lineHeight: 1.5, minHeight: 130 }}>
        {text.slice(0, n)}
        <span style={{ display: "inline-block", width: 4, height: 42, background: COLORS.greenBright, marginInlineStart: 6, opacity: Math.floor(lf / 6) % 2 }} />
      </div>
      {[0.92, 0.78, 0.86, 0.6].map((w, i) => (
        <div key={i} style={{ marginTop: 22, height: 18, borderRadius: 18, width: `${w * 100 * prog(lf, 14 + i * 5, 30 + i * 5, EASE.out)}%`, background: i === 0 ? COLORS.green : COLORS.faint }} />
      ))}
    </div>
  );
};

const MiniLearn: React.FC<{ lf: number }> = ({ lf }) => {
  const flip = prog(lf, 12, 30, EASE.inOut);
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 1200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: 520, height: 330, transformStyle: "preserve-3d", transform: `rotateY(${flip * 180}deg)` }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 30, background: "#1d211f", border: `2px solid ${COLORS.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "center", backfaceVisibility: "hidden", fontFamily: FONTS.latin, fontWeight: 700, fontSize: 90, color: "#fff" }}>Hello</div>
        <div dir="rtl" lang="ar" style={{ position: "absolute", inset: 0, borderRadius: 30, background: "linear-gradient(150deg, #3a3a40, #000)", border: "2px solid #fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, backfaceVisibility: "hidden", transform: "rotateY(180deg)", fontFamily: FONTS.display, fontWeight: 800, fontSize: 84, color: "#fff" }}>
          مرحبًا
          <span style={{ fontFamily: FONTS.body, fontWeight: 500, fontSize: 30, opacity: 0.85 }}>/ˈhɛloʊ/</span>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, display: "flex", gap: 14 }}>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ width: 20, height: 20, borderRadius: 20, background: i <= Math.floor(lf / 9) % 5 ? COLORS.green : COLORS.faint }} />)}
      </div>
    </div>
  );
};

const CODE = [["def ", "summarize", "(text):"], ["    ", "words", " = text.split()"], ["    ", "return", " words[:50]"]];
const MiniCode: React.FC<{ lf: number }> = ({ lf }) => {
  let budget = Math.max(0, lf - 4) * 2.2;
  return (
    <div style={{ padding: "54px 50px", fontFamily: FONTS.mono, fontSize: 36, lineHeight: "64px", whiteSpace: "pre", direction: "ltr" }}>
      {CODE.map((parts, i) => (
        <div key={i}>
          {parts.map((p, k) => {
            const take = Math.max(0, Math.min(p.length, Math.floor(budget)));
            budget -= p.length;
            return <span key={k} style={{ color: k === 1 ? COLORS.greenBright : k === 0 && i === 0 ? COLORS.greenSoft : "#fff" }}>{p.slice(0, take)}</span>;
          })}
        </div>
      ))}
      <div style={{ marginTop: 18, display: "inline-flex", gap: 12, alignItems: "center", padding: "8px 20px", borderRadius: 14, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 28, opacity: prog(lf, 34, 42) }}>✓ Ran successfully</div>
    </div>
  );
};

const MiniData: React.FC<{ lf: number }> = ({ lf }) => {
  const vals = [0.42, 0.65, 0.5, 0.82, 0.7, 0.95];
  return (
    <div style={{ position: "absolute", inset: "70px 60px 60px", display: "flex", alignItems: "flex-end", gap: 26, borderBottom: `3px solid ${COLORS.faint}` }}>
      {vals.map((v, i) => (
        <div key={i} style={{ flex: 1, height: `${v * 100 * prog(lf, 4 + i * 4, 24 + i * 4, EASE.back)}%`, borderRadius: "14px 14px 4px 4px", background: i === 5 ? `linear-gradient(180deg, ${COLORS.greenBright}, ${COLORS.green})` : "rgba(236,236,241,0.25)", boxShadow: i === 5 ? `0 0 30px ${COLORS.green}` : undefined }} />
      ))}
      <svg style={{ position: "absolute", inset: 0, overflow: "visible" }} width="100%" height="100%" viewBox="0 0 700 500" preserveAspectRatio="none">
        <polyline points="40,320 160,230 280,280 400,140 520,190 640,40" fill="none" stroke="#fff" strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(lf, 16, 40, EASE.inOut)} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

const NOTES = ["فيديو قصير", "مسابقة", "بث مباشر", "عرض خاص"];
const MiniIdea: React.FC<{ lf: number }> = ({ lf }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ filter: `drop-shadow(0 0 ${20 + 20 * Math.sin(lf / 4)}px ${COLORS.greenBright})` }}>
      <Icon name="idea" size={190} color={COLORS.greenBright} stroke={6} />
    </div>
    {NOTES.map((n, i) => {
      const on = prog(lf, 8 + i * 6, 20 + i * 6, EASE.back);
      const pos = [[-250, -170], [250, -150], [-260, 160], [250, 170]][i];
      return (
        <div key={n} dir="rtl" lang="ar" style={{ position: "absolute", left: "50%", top: "50%", transform: `translate(calc(-50% + ${pos[0] * on}px), calc(-50% + ${pos[1] * on}px)) rotate(${(i % 2 ? 1 : -1) * 5}deg) scale(${on})`, padding: "14px 24px 18px", borderRadius: 16, background: i % 2 ? COLORS.gray : "#1c1c20", color: i % 2 ? "#111" : "#fff", border: "2px solid #fff", fontFamily: FONTS.body, fontWeight: 700, fontSize: 32, whiteSpace: "nowrap" }}>
          {n}
        </div>
      );
    })}
  </div>
);

const MiniImage: React.FC<{ lf: number }> = ({ lf }) => {
  const k = prog(lf, 6, 40, EASE.inOut);
  return (
    <div style={{ position: "absolute", inset: 36, borderRadius: 26, overflow: "hidden", background: "#0b0b0c" }}>
      <div style={{ position: "absolute", inset: -30, filter: `blur(${(1 - k) * 34}px) saturate(${0.4 + k * 0.6})`, transform: `scale(${1.15 - k * 0.1})` }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, #2b2b30 0%, #8a8a92 55%, #e9e9ee 100%)` }} />
        <div style={{ position: "absolute", left: "58%", top: "18%", width: 150, height: 150, borderRadius: 150, background: "#fff", boxShadow: "0 0 90px #fff" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", background: "#1c1c20", clipPath: "polygon(0 60%, 18% 20%, 34% 55%, 52% 5%, 72% 50%, 86% 25%, 100% 55%, 100% 100%, 0 100%)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "34%", background: "#0a0a0b", clipPath: "polygon(0 50%, 22% 25%, 44% 60%, 66% 20%, 100% 55%, 100% 100%, 0 100%)" }} />
      </div>
      {/* generation noise */}
      {new Array(48).fill(0).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: `${(i % 8) * 12.5}%`, top: `${Math.floor(i / 8) * 16.66}%`, width: "12.5%", height: "16.66%", background: rnd(`px${i}${Math.floor(lf / 3)}`) > 0.5 ? "#1f1f22" : "#3a3a40", opacity: Math.max(0, 1 - k * 1.6 - rnd(`po${i}`) * 0.3) }} />
      ))}
      <div style={{ position: "absolute", left: 24, bottom: 20, padding: "6px 16px", borderRadius: 12, background: "rgba(0,0,0,0.55)", color: "#fff", fontFamily: FONTS.latin, fontSize: 24 }}>{k < 1 ? `${Math.round(k * 100)}%` : "✓"}</div>
    </div>
  );
};

const MINI = [MiniWrite, MiniLearn, MiniCode, MiniData, MiniIdea, MiniImage];

export const Scene04Uses: React.FC = () => {
  const frame = useCurrentFrame();
  const over = prog(frame, OVERVIEW, OVERVIEW + 20, EASE.out);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.green} b={COLORS.greenDeep} intensity={0.85} />
      <Particles count={80} seed="uses" opacity={0.6} drift={[0.1, -0.4]} />
      <div dir="rtl" lang="ar" style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 80, color: "#fff", opacity: prog(frame, 0, 14) }}>
        تستخدمه <span style={gradientText(GRADIENT)}>في إيه؟</span>
      </div>

      <AbsoluteFill style={{ perspective: 1600 }}>
        {COPY.uses.items.map((label, i) => {
          const s = USE_AT[i];
          const lf = frame - s;
          if (lf < 0) return null;
          const pop = prog(lf, 0, 12, EASE.back);
          const open = prog(lf, 8, 22, EASE.inOut);
          const park = prog(lf, SPAN - 10, SPAN + 4, EASE.inOut);
          const sl = slot(i);
          const big = { x: HERO.x, y: HERO.y, w: lerp(300, HERO.w, open), h: lerp(300, HERO.h, open) };
          const x = lerp(big.x, sl.x, park);
          const y = lerp(big.y, sl.y, park);
          const w = lerp(big.w, sl.w, park);
          const h = lerp(big.h, sl.h, park);
          const parked = park >= 1;
          const dimmed = parked && frame < OVERVIEW ? 0.14 : 1;
          const Mini = MINI[i];
          const miniOn = open * (1 - park);
          return (
            <div key={i} style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, borderRadius: lerp(64, 40, park), transform: `scale(${pop}) rotateY(${(1 - pop) * 50}deg) rotateX(${parked ? Math.sin(frame / 30 + i) * 3 : 0}deg)`, opacity: dimmed, filter: dimmed < 1 ? "blur(2px)" : undefined, background: "linear-gradient(160deg, rgba(255,255,255,0.1), rgba(13,15,14,0.96) 60%)", border: `2px solid ${parked && over > 0 ? COLORS.green : COLORS.glassBorder}`, boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 ${miniOn * 80 + over * 30}px ${COLORS.green}66, inset 0 2px 0 rgba(255,255,255,0.14)`, overflow: "hidden", zIndex: parked ? 1 : 10 }}>
              {/* icon (tile state) */}
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, opacity: 1 - miniOn }}>
                <div style={{ filter: `drop-shadow(0 0 16px ${COLORS.green})` }}>
                  <Icon name={ICON_KEYS[i]} size={parked ? 110 : 150} />
                </div>
                {parked && frame >= OVERVIEW - 6 ? <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 36, color: "#fff" }}>{label}</div> : null}
              </div>
              {/* mini scene */}
              {miniOn > 0.01 ? (
                <div style={{ position: "absolute", inset: 0, opacity: miniOn }}>
                  <Mini lf={lf - 10} />
                </div>
              ) : null}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* hero label */}
      {COPY.uses.items.map((label, i) => {
        const lf = frame - USE_AT[i];
        const on = Math.min(prog(lf, 8, 20, EASE.out), 1 - prog(lf, SPAN - 14, SPAN - 4, EASE.in));
        if (on <= 0) return null;
        return (
          <div key={i} dir="rtl" lang="ar" style={{ position: "absolute", left: 0, right: 0, top: HERO.y + HERO.h / 2 + 36, textAlign: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 70, color: "#fff", opacity: on, transform: `translateY(${(1 - on) * 24}px)`, textShadow: `0 0 30px ${COLORS.green}` }}>
            {label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
