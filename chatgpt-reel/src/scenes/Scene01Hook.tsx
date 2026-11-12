import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Particles } from "../components/Atmosphere";
import { BrandMark } from "../components/BrandMark";
import { KineticLines } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS } from "../config/theme";
import { bell, EASE, lerp, prog, rnd, TAU } from "../lib/anim";

const CX = 540;
const CY = 640;
const BOX = 300; // badge outline size

/** Point on the rounded-square outline the light lines assemble into (t in 0..1). */
const outline = (t: number): [number, number] => {
  const half = BOX / 2;
  const side = Math.floor(t * 4) % 4;
  const u = (t * 4) % 1;
  const v = -half + u * BOX;
  if (side === 0) return [CX + v, CY - half];
  if (side === 1) return [CX + half, CY + v];
  if (side === 2) return [CX - v, CY + half];
  return [CX - half, CY - v];
};

const LINES = new Array(28).fill(0).map((_, i) => {
  const a = rnd(`la${i}`) * TAU;
  const dist = 1300 + rnd(`ld${i}`) * 700;
  return { a, dist, t: i / 28, delay: rnd(`dl${i}`) * 22, len: 140 + rnd(`ll${i}`) * 220, w: 3 + rnd(`lw${i}`) * 5 };
});

export const Scene01Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const assemble = prog(frame, 52, 78, EASE.inOut);
  const badge = prog(frame, 70, 98, EASE.out);
  const burst = bell(frame, 88, 118);
  const settle = prog(frame, 96, 130, EASE.inOut);
  const draw = prog(frame, 50, 80, EASE.inOut);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ background: `radial-gradient(50% 30% at 50% 34%, ${COLORS.green}1f, transparent 70%)`, opacity: prog(frame, 40, 90) }} />
      <Particles count={80} seed="hook" opacity={prog(frame, 70, 110) * 0.8} drift={[0.05, -0.5]} />

      {/* light streaks rushing in and converging on the outline */}
      <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <filter id="glowLine" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {LINES.map((l, i) => {
          const k = prog(frame, 8 + l.delay, 60 + l.delay * 0.6, EASE.inOut);
          const [tx, ty] = outline(l.t);
          const sx = CX + Math.cos(l.a) * l.dist;
          const sy = CY + Math.sin(l.a) * l.dist;
          const hx = lerp(sx, tx, k);
          const hy = lerp(sy, ty, k);
          const dx = tx - sx;
          const dy = ty - sy;
          const n = Math.hypot(dx, dy);
          const tail = l.len * (1 - assemble);
          const op = k > 0 ? 1 - assemble : 0;
          return <line key={i} x1={hx} y1={hy} x2={hx - (dx / n) * tail} y2={hy - (dy / n) * tail} stroke={i % 3 ? COLORS.green : COLORS.greenSoft} strokeWidth={l.w} strokeLinecap="round" opacity={op} filter="url(#glowLine)" />;
        })}
        {/* outline being drawn */}
        <rect x={CX - BOX / 2} y={CY - BOX / 2} width={BOX} height={BOX} rx={BOX * 0.28} fill="none" stroke={COLORS.greenSoft} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} opacity={1 - badge * 0.85} filter="url(#glowLine)" />
      </svg>

      {/* the mark, in 3D */}
      <AbsoluteFill style={{ perspective: 1400 }}>
        <div style={{ position: "absolute", left: CX, top: CY, width: 0, height: 0, transformStyle: "preserve-3d", transform: `translateY(${lerp(0, -40, settle)}px) rotateY(${lerp(70, 0, badge) + Math.sin(frame / 30) * 6 * settle}deg) rotateX(${lerp(20, 0, badge)}deg) scale(${lerp(0.6, 1, badge) * lerp(1, 0.86, settle)})`, opacity: badge }}>
          {[6, 5, 4, 3, 2, 1].map((d) => (
            <div key={d} style={{ position: "absolute", left: -150, top: -150, width: 300, height: 300, borderRadius: 84, background: COLORS.greenDeep, opacity: 0.55, transform: `translateZ(${-d * 6}px)` }} />
          ))}
          <div style={{ position: "absolute", left: -150, top: -150 }}>
            <BrandMark size={300} glow={0.5 + burst} />
          </div>
        </div>
      </AbsoluteFill>

      {/* soft light burst */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% ${(CY / 1920) * 100}%, #fff 0%, ${COLORS.greenSoft} 14%, transparent 46%)`, opacity: burst * 0.85, mixBlendMode: "screen" }} />
      {[0, 1].map((i) => {
        const r = prog(frame, 90 + i * 6, 140 + i * 6, EASE.out);
        return <div key={i} style={{ position: "absolute", left: CX - 900, top: CY - 900, width: 1800, height: 1800, borderRadius: "50%", border: `${4 - i}px solid ${i ? COLORS.greenSoft : COLORS.green}`, opacity: (1 - r) * (r > 0 ? 1 : 0), transform: `scale(${r})` }} />;
      })}

      {/* title */}
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 900 }}>
        <KineticLines lines={COPY.hook.title} accent={COPY.hook.accent} size={118} gap={1.32} starts={[[104, 110], [118], [128]]} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
