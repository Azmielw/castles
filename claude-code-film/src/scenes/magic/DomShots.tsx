import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../../components/Atmosphere";
import { Glass } from "../../components/Type";
import { COPY } from "../../config/copy";
import { COLORS, FONTS, GRADIENT, gradientText } from "../../config/theme";
import { arNum, bell, EASE, lerp, prog, rnd, TAU } from "../../lib/anim";

// ───────────── Shot: Arabic kinetic typography ─────────────
export const TypoShot: React.FC = () => {
  const frame = useCurrentFrame();
  const [w1, w2, w3] = COPY.magic.typo;
  const a = prog(frame, 0, 16, EASE.out);
  const b = prog(frame, 10, 28, EASE.out);
  const c = prog(frame, 30, 46, EASE.out);
  const settle = prog(frame, 28, 46, EASE.inOut);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: "hidden" }}>
      <Glow intensity={0.7} />
      {/* speed lines */}
      {new Array(9).fill(0).map((_, i) => (
        <div key={i} style={{ position: "absolute", top: 90 + i * 110, right: `${((frame * (14 + i * 3) + i * 400) % 2600) - 500}px`, width: 260 + i * 40, height: 3, borderRadius: 3, background: `linear-gradient(270deg, ${i % 2 ? COLORS.blue : COLORS.violet}, transparent)`, opacity: 0.5 }} />
      ))}
      <AbsoluteFill dir="rtl" lang="ar" style={{ alignItems: "center", justifyContent: "center", fontFamily: FONTS.display, fontWeight: 800, transform: `translateY(${-40 - settle * 60}px) scale(${1 - settle * 0.18})` }}>
        <div style={{ overflow: "hidden", lineHeight: 1.25, height: 330 }}>
          <div style={{ fontSize: 260, color: "#fff", transform: `translateY(${(1 - a) * 340}px) skewY(${(1 - a) * 9}deg)` }}>{w1}</div>
        </div>
        <div style={{ lineHeight: 1.25, fontSize: 210, marginTop: -40, transform: `translateX(${(1 - b) * 900}px) skewX(${(1 - b) * 24}deg)`, opacity: Math.min(1, b * 2), filter: `blur(${(1 - b) * 20}px) drop-shadow(0 0 40px ${COLORS.violet}99)`, ...gradientText(GRADIENT) }}>{w2}</div>
      </AbsoluteFill>
      <div dir="rtl" lang="ar" style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center" }}>
        <div style={{ position: "relative", fontFamily: FONTS.body, fontWeight: 500, fontSize: 60, color: COLORS.white, opacity: c, letterSpacing: 0, transform: `translateY(${(1 - c) * 40}px)` }}>
          {w3}
          <div style={{ position: "absolute", right: 0, bottom: -12, height: 5, borderRadius: 5, width: `${prog(frame, 38, 58, EASE.inOut) * 100}%`, background: GRADIENT }} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Shot: geometric shapes morph into products ─────────────
const Product: React.FC<{ kind: 0 | 1 | 2; frame: number; x: number }> = ({ kind, frame, x }) => {
  const pop = prog(frame, kind * 4, 16 + kind * 4, EASE.back);
  const m = prog(frame, 20 + kind * 5, 44 + kind * 5, EASE.inOut);
  const c = [COLORS.violet, COLORS.blue, COLORS.violetSoft][kind];
  // shape → product dimensions
  const from = [{ w: 220, h: 220, r: 10 }, { w: 220, h: 220, r: 110 }, { w: 260, h: 150, r: 10 }][kind];
  const to = [{ w: 210, h: 420, r: 44 }, { w: 230, h: 230, r: 70 }, { w: 440, h: 280, r: 22 }][kind];
  const w = lerp(from.w, to.w, m);
  const h = lerp(from.h, to.h, m);
  const detail = prog(m, 0.55, 1, EASE.linear);
  return (
    <div style={{ position: "absolute", left: x, top: 470, width: 0, height: 0, perspective: 1200 }}>
      <div style={{ position: "absolute", left: -w / 2, top: -h / 2 + Math.sin(frame / 14 + kind * 2) * 10, width: w, height: h, borderRadius: lerp(from.r, to.r, m), transform: `scale(${pop}) rotateY(${lerp(0, 360, m) + lerp(-28, -16, m)}deg) rotateZ(${lerp(kind === 0 ? 45 : 0, 0, m)}deg) rotateX(8deg)`, border: `4px solid ${c}`, background: `linear-gradient(160deg, ${c}${m > 0.5 ? "33" : "11"}, rgba(8,5,20,0.95))`, boxShadow: `0 0 ${40 + m * 50}px ${c}88, inset 0 0 40px ${c}22`, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: detail }}>
          {kind === 0 ? (
            <>
              <div style={{ position: "absolute", top: 14, left: "50%", width: 70, height: 16, marginLeft: -35, borderRadius: 16, background: "#000" }} />
              <div style={{ position: "absolute", inset: "46px 16px 110px", borderRadius: 22, background: GRADIENT, opacity: 0.9 }} />
              {[0, 1, 2].map((i) => <div key={i} style={{ position: "absolute", left: 20, bottom: 78 - i * 26, height: 10, borderRadius: 10, width: [150, 110, 80][i], background: "#fff", opacity: 0.8 - i * 0.2 }} />)}
            </>
          ) : kind === 1 ? (
            <>
              <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: `10px solid ${COLORS.faint}` }} />
              <div style={{ position: "absolute", inset: 22, borderRadius: "50%", border: "10px solid transparent", borderTopColor: COLORS.blue, borderRightColor: COLORS.blue, transform: `rotate(${frame * 5}deg)` }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.display, fontWeight: 800, fontSize: 54, color: "#fff" }}>{arNum(Math.round(detail * 72))}</div>
            </>
          ) : (
            <>
              <div style={{ position: "absolute", inset: 14, borderRadius: 12, background: "radial-gradient(circle at 30% 30%, #2a1466, #07040f)" }} />
              {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ position: "absolute", left: 50 + i * 72, bottom: 40, width: 44, borderRadius: 8, height: (60 + 90 * Math.abs(Math.sin(frame / 9 + i))) * detail, background: i % 2 ? COLORS.blue : COLORS.violetSoft }} />)}
            </>
          )}
        </div>
      </div>
      {kind === 1 ? <div style={{ position: "absolute", left: -55, top: -230, width: 110, height: 460, borderRadius: 34, background: `linear-gradient(180deg, ${c}55, ${c}11 40%, ${c}11 60%, ${c}55)`, opacity: detail, zIndex: -1, transform: `scale(${pop})` }} /> : null}
      {kind === 2 ? <div style={{ position: "absolute", left: -260, top: 150, width: 520, height: 22, borderRadius: "4px 4px 16px 16px", background: `linear-gradient(180deg, ${c}, ${c}55)`, opacity: detail, transform: `scaleX(${detail})` }} /> : null}
      <div style={{ position: "absolute", left: -180, top: 300, width: 360, height: 40, borderRadius: "50%", background: c, filter: "blur(30px)", opacity: 0.35 * pop }} />
    </div>
  );
};

export const ProductsShot: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow intensity={0.8} a={COLORS.blueDeep} b={COLORS.violet} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, height: 2, background: `linear-gradient(90deg, transparent, ${COLORS.violet}, ${COLORS.blue}, transparent)`, opacity: 0.6 }} />
      <AbsoluteFill style={{ transform: `scale(${1 + frame * 0.0015})` }}>
        <Product kind={2} frame={frame} x={1400} />
        <Product kind={1} frame={frame} x={880} />
        <Product kind={0} frame={frame} x={440} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────── Shot: fluid tech UI in depth ─────────────
export const UiShot: React.FC = () => {
  const frame = useCurrentFrame();
  const card = (i: number) => prog(frame, i * 5, 24 + i * 5, EASE.out);
  const pts = new Array(9).fill(0).map((_, i) => `${i * 62},${150 - (30 + rnd(`ui${i}`) * 90 + i * 6)}`);
  const pct = Math.round(prog(frame, 10, 50, EASE.out) * 87);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow intensity={0.9} />
      <Particles count={60} seed="ui" camX={frame * 2} />
      <AbsoluteFill style={{ perspective: 1600 }}>
        <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateX(${10 - frame * 0.05}deg) rotateY(${-16 + frame * 0.24}deg) translateY(-40px)` }}>
          <Glass style={{ left: 520, top: 220, width: 620, height: 400, opacity: card(0), transform: `translateZ(${lerp(-700, 60, card(0))}px)`, padding: 34 }}>
            <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 34, color: "#fff" }}>نمو المشاهدات</div>
            <svg width="550" height="200" viewBox="-10 -20 520 190" style={{ marginTop: 30, overflow: "visible" }}>
              <polyline points={pts.join(" ")} fill="none" stroke={COLORS.blue} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(frame, 12, 48, EASE.inOut)} style={{ filter: `drop-shadow(0 0 12px ${COLORS.blue})` }} />
              {[0, 1, 2, 3].map((i) => <line key={i} x1={0} x2={500} y1={i * 50} y2={i * 50} stroke={COLORS.faint} />)}
            </svg>
          </Glass>
          <Glass style={{ left: 1180, top: 300, width: 380, height: 380, opacity: card(1), transform: `translateZ(${lerp(-900, 220, card(1))}px) translateX(${(1 - card(1)) * 500}px)`, display: "flex", alignItems: "center", justifyContent: "center" }} glow={COLORS.blue}>
            <svg width="270" height="270" viewBox="-135 -135 270 270" style={{ position: "absolute", transform: "rotate(-90deg)" }}>
              <circle r={110} fill="none" stroke={COLORS.faint} strokeWidth={18} />
              <circle r={110} fill="none" stroke={COLORS.violetSoft} strokeWidth={18} strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} style={{ filter: `drop-shadow(0 0 14px ${COLORS.violet})` }} />
            </svg>
            <div style={{ fontFamily: FONTS.display, fontWeight: 800, fontSize: 84, color: "#fff" }}>{arNum(pct)}٪</div>
          </Glass>
          <Glass style={{ left: 200, top: 360, width: 360, height: 330, opacity: card(2), transform: `translateZ(${lerp(-900, 160, card(2))}px) translateX(${(1 - card(2)) * -500}px)`, padding: 30, display: "flex", alignItems: "flex-end", gap: 18 }}>
            {[0.5, 0.8, 0.62, 1, 0.74].map((v, i) => (
              <div key={i} style={{ flex: 1, borderRadius: 12, height: `${v * 100 * prog(frame, 14 + i * 4, 40 + i * 4, EASE.back)}%`, background: i === 3 ? GRADIENT : `${COLORS.violet}88` }} />
            ))}
          </Glass>
          <Glass style={{ left: 640, top: 660, width: 560, height: 120, opacity: card(3), transform: `translateZ(${lerp(-600, 300, card(3))}px) translateY(${(1 - card(3)) * 300}px)`, display: "flex", alignItems: "center", padding: "0 30px", gap: 22 }} glow={COLORS.green}>
            <div style={{ width: 96, height: 52, borderRadius: 52, background: frame > 30 ? COLORS.green : COLORS.faint, position: "relative" }}>
              <div style={{ position: "absolute", top: 5, left: lerp(5, 49, prog(frame, 28, 38, EASE.back)), width: 42, height: 42, borderRadius: 42, background: "#fff" }} />
            </div>
            <div dir="rtl" lang="ar" style={{ flex: 1, fontFamily: FONTS.body, fontWeight: 700, fontSize: 34, color: "#fff" }}>الحركة الانسيابية</div>
          </Glass>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ───────────── Shot: ordinary design vs professional motion ─────────────
const Poster: React.FC<{ live: boolean; frame: number }> = ({ live, frame }) => {
  const t = live ? frame : 0;
  const tone = live ? COLORS.violet : "#5a5866";
  return (
    <div style={{ position: "absolute", inset: 0, background: live ? "radial-gradient(circle at 30% 20%, #2b1070, #07040f 70%)" : "#191920", overflow: "hidden" }}>
      {live ? <div style={{ position: "absolute", inset: 0, background: `radial-gradient(40% 50% at ${50 + Math.sin(t / 14) * 26}% 50%, ${COLORS.blue}44, transparent 70%)` }} /> : null}
      <div style={{ position: "absolute", left: 130, top: 130, width: 300, height: 300, borderRadius: live ? lerp(70, 150, 0.5 + 0.5 * Math.sin(t / 8)) : 0, background: live ? GRADIENT : tone, transform: `rotate(${t * 2.2}deg) scale(${1 + (live ? 0.12 * Math.sin(t / 6) : 0)})`, boxShadow: live ? `0 0 90px ${COLORS.violet}` : undefined }} />
      {live ? [0, 1, 2, 3].map((i) => <div key={i} style={{ position: "absolute", left: 280 + Math.cos(t / 9 + (i * TAU) / 4) * 240 - 11, top: 280 + Math.sin(t / 9 + (i * TAU) / 4) * 240 - 11, width: 22, height: 22, borderRadius: 22, background: "#fff", boxShadow: `0 0 22px ${COLORS.blue}` }} />) : null}
      <div dir="rtl" lang="ar" style={{ position: "absolute", right: 110, top: 150, textAlign: "right", fontFamily: FONTS.display, fontWeight: 800, fontSize: 96, lineHeight: 1.3, ...(live ? gradientText("linear-gradient(100deg,#fff,#cdb4ff)") : { color: "#8a8894" }), transform: live ? `translateY(${Math.sin(t / 10) * 8}px)` : undefined }}>
        فكرتك
        <br />
        بتتحرّك
      </div>
      <div style={{ position: "absolute", right: 110, top: 440, display: "flex", gap: 16, alignItems: "flex-end", height: 110 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ width: 44, borderRadius: 10, height: live ? 30 + 80 * Math.abs(Math.sin(t / 6 + i * 0.8)) : 30 + ((i * 37) % 60), background: live ? (i % 2 ? COLORS.blue : COLORS.violetSoft) : "#4a4854" }} />
        ))}
      </div>
      {live ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.16) 50%, transparent 58%)", transform: `translateX(${((t * 3.4) % 240) - 120}%)` }} /> : null}
    </div>
  );
};

export const CompareShot: React.FC = () => {
  const frame = useCurrentFrame();
  const inn = prog(frame, 0, 16, EASE.out);
  const wipe = prog(frame, 22, 56, EASE.inOut); // sweeps right → left
  const W = 1240;
  const H = 610;
  const edge = (1 - wipe) * W;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow intensity={0.4 + wipe * 0.6} />
      <div style={{ position: "absolute", left: (1920 - W) / 2, top: 150, width: W, height: H, borderRadius: 34, overflow: "hidden", transform: `scale(${lerp(0.9, 1, inn) + wipe * 0.03})`, opacity: inn, boxShadow: `0 40px 120px rgba(0,0,0,0.8), 0 0 ${wipe * 120}px ${COLORS.violet}77`, border: `2px solid ${COLORS.glassBorder}` }}>
        <Poster live={false} frame={frame} />
        <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${edge}px)` }}>
          <Poster live frame={frame} />
        </div>
        <div style={{ position: "absolute", top: 0, bottom: 0, left: edge - 3, width: 6, background: "#fff", boxShadow: `0 0 30px 8px ${COLORS.blue}, 0 0 80px 20px ${COLORS.violet}`, opacity: wipe > 0 && wipe < 1 ? 1 : 0 }} />
      </div>
      <div dir="rtl" lang="ar" style={{ position: "absolute", top: 54, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 60, fontFamily: FONTS.display, fontWeight: 800, fontSize: 58 }}>
        <span style={{ ...gradientText(GRADIENT), opacity: lerp(0.25, 1, wipe), transform: `scale(${lerp(0.86, 1, wipe)})`, display: "inline-block" }}>{COPY.magic.pro}</span>
        <span style={{ color: COLORS.dim, fontWeight: 400 }}>≠</span>
        <span style={{ color: "#9a98a6", opacity: lerp(1, 0.4, wipe), display: "inline-block" }}>{COPY.magic.plain}</span>
      </div>
    </AbsoluteFill>
  );
};

// ───────────── Shot: explosion of light particles (canvas, with motion-blur streaks) ─────────────
export const BurstShot: React.FC<{ text?: boolean }> = ({ text = true }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const parts = useMemo(
    () =>
      new Array(1100).fill(0).map((_, i) => ({
        a: rnd(`ba${i}`) * TAU,
        v: 6 + Math.pow(rnd(`bv${i}`), 1.6) * 54,
        s: 1 + rnd(`bs${i}`) * 3.4,
        hue: rnd(`bh${i}`),
        curl: (rnd(`bc${i}`) - 0.5) * 0.02,
      })),
    [],
  );
  const START = 6;
  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 1920, 1080);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    const pos = (p: (typeof parts)[number], t: number) => {
      // fast launch that eases out (drag)
      const d = p.v * 22 * (1 - Math.exp(-t / 16));
      const ang = p.a + p.curl * t;
      return [960 + Math.cos(ang) * d * 1.25, 500 + Math.sin(ang) * d + t * t * 0.02];
    };
    const t = frame - START;
    if (t < 0) return;
    for (const p of parts) {
      const [x, y] = pos(p, t);
      const [px, py] = pos(p, Math.max(0, t - 1.4)); // shutter trail = motion blur
      const fade = Math.max(0, 1 - t / 70) * (0.5 + 0.5 * Math.sin(t / 3 + p.a * 9));
      const col = p.hue > 0.8 ? "255,255,255" : p.hue > 0.4 ? "139,61,255" : "25,200,255";
      ctx.strokeStyle = `rgba(${col},${fade})`;
      ctx.lineWidth = p.s;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }, [frame, parts]);

  const flash = bell(frame, START - 6, START + 16);
  const tIn = prog(frame, 18, 36, EASE.out);
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 46%, ${COLORS.violet}66, transparent 60%)`, opacity: prog(frame, START, START + 10) * (1 - prog(frame, 30, 70) * 0.5) }} />
      <canvas ref={ref} width={1920} height={1080} style={{ position: "absolute", inset: 0 }} />
      {[0, 1, 2].map((i) => {
        const r = prog(frame, START + i * 5, START + 34 + i * 5, EASE.out);
        return <div key={i} style={{ position: "absolute", left: 960 - 900, top: 500 - 900, width: 1800, height: 1800, borderRadius: "50%", border: `${5 - i}px solid ${i === 1 ? COLORS.blue : COLORS.violetSoft}`, opacity: (1 - r) * (r > 0 ? 1 : 0), transform: `scale(${r * (1 + i * 0.25)})` }} />;
      })}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 46%, #fff, transparent 55%)", opacity: flash, mixBlendMode: "screen" }} />
      {text ? (
        <AbsoluteFill dir="rtl" lang="ar" style={{ alignItems: "center", justifyContent: "center", paddingBottom: 90, fontFamily: FONTS.display, fontWeight: 800, textAlign: "center", lineHeight: 1.3 }}>
          <div style={{ position: "absolute", width: 1300, height: 520, background: "radial-gradient(ellipse at center, rgba(3,2,7,0.8), transparent 68%)", opacity: tIn }} />
          <div style={{ position: "relative", fontSize: 150, color: "#fff", opacity: tIn, transform: `scale(${lerp(1.6, 1, tIn)})`, filter: `blur(${(1 - tIn) * 20}px)` }}>{COPY.magic.burst[0]}</div>
          <div style={{ position: "relative", fontSize: 150, opacity: prog(frame, 26, 44), transform: `scale(${lerp(1.6, 1, prog(frame, 26, 44, EASE.out))})`, filter: `drop-shadow(0 0 40px ${COLORS.violet})`, ...gradientText(GRADIENT) }}>{COPY.magic.burst[1]}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
