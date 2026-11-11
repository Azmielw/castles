import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Particles } from "../components/Atmosphere";
import { KineticLines } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS } from "../config/theme";
import { bell, EASE, lerp, prog, rnd, TAU } from "../lib/anim";

// ───────────────────────── 3D digital grid (Three.js) ─────────────────────────
const GridWorld: React.FC<{ frame: number }> = ({ frame }) => {
  const grid = useMemo(() => {
    const pts: number[] = [];
    const N = 34;
    for (let i = -N; i <= N; i++) {
      pts.push(i, 0, -N, i, 0, N, -N, 0, i, N, 0, i);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const dust = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 700; i++) pts.push((rnd(`dx${i}`) - 0.5) * 40, rnd(`dy${i}`) * 9 - 1.5, (rnd(`dz${i}`) - 0.5) * 44);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  const reveal = prog(frame, 46, 120, EASE.out);
  const travel = (frame * 0.035) % 1; // endless forward dolly
  const sway = Math.sin(frame / 60) * 0.12;
  return (
    <>
      <fog attach="fog" args={[COLORS.bg, 4, 30]} />
      <group rotation={[0.04, sway, 0]}>
        <group position={[0, -1.7, travel]} scale={Math.max(0.0001, reveal)}>
          <lineSegments geometry={grid}>
            <lineBasicMaterial color={COLORS.violet} transparent opacity={0.85} />
          </lineSegments>
        </group>
        <group position={[0, 4.6, travel]} scale={Math.max(0.0001, reveal)}>
          <lineSegments geometry={grid}>
            <lineBasicMaterial color={COLORS.blueDeep} transparent opacity={0.3} />
          </lineSegments>
        </group>
        <points geometry={dust} position={[0, 0, (frame * 0.03) % 6]}>
          <pointsMaterial size={0.07} color={COLORS.blue} transparent opacity={reveal * 0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </points>
      </group>
    </>
  );
};

// ───────────────────────── The "complex video project" on the monitor ─────────────────────────
const TRACKS = [
  { color: COLORS.violet, clips: [[0.02, 0.3], [0.36, 0.22], [0.62, 0.34]] },
  { color: COLORS.blue, clips: [[0.1, 0.42], [0.58, 0.2]] },
  { color: COLORS.violetSoft, clips: [[0.0, 0.18], [0.24, 0.3], [0.6, 0.12], [0.76, 0.2]] },
  { color: COLORS.blueDeep, clips: [[0.16, 0.6]] },
  { color: COLORS.green, clips: [[0.04, 0.9]] },
];

export const EditorMock: React.FC<{ frame: number }> = ({ frame }) => {
  const play = (frame * 0.004) % 1;
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#0d0a1a,#07050f)", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 38, display: "flex", alignItems: "center", gap: 9, padding: "0 16px", borderBottom: `1px solid ${COLORS.faint}` }}>
        {[COLORS.red, "#FFC24D", COLORS.green].map((c) => (
          <span key={c} style={{ width: 11, height: 11, borderRadius: 11, background: c, opacity: 0.85 }} />
        ))}
        <span style={{ marginLeft: 14, width: 180, height: 8, borderRadius: 8, background: COLORS.faint }} />
      </div>
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ width: 170, borderRight: `1px solid ${COLORS.faint}`, padding: 14, display: "flex", flexDirection: "column", gap: 11 }}>
          {new Array(9).fill(0).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", opacity: i === Math.floor(frame / 14) % 9 ? 1 : 0.45 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: i % 2 ? COLORS.blue : COLORS.violet }} />
              <span style={{ height: 7, borderRadius: 7, background: COLORS.white, width: 50 + rnd(`l${i}`) * 70, opacity: 0.6 }} />
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: "relative", margin: 14, borderRadius: 12, overflow: "hidden", background: "radial-gradient(circle at 50% 40%, #241050, #06040c 75%)", border: `1px solid ${COLORS.faint}` }}>
          {/* live preview: shapes that never stop moving */}
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: lerp(18, 60, 0.5 + 0.5 * Math.sin(frame / 12)), background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.violet})`, transform: `rotate(${frame * 2.4}deg) scale(${0.8 + 0.2 * Math.sin(frame / 9)})`, boxShadow: `0 0 60px ${COLORS.violet}` }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ position: "absolute", left: "50%", top: "50%", width: 16, height: 16, borderRadius: 16, background: COLORS.white, transform: `translate(${Math.cos(frame / 10 + (i * TAU) / 3) * 130 - 8}px, ${Math.sin(frame / 10 + (i * TAU) / 3) * 70 - 8}px)` }} />
          ))}
          <div style={{ position: "absolute", left: 22, bottom: 20, width: 150 + 60 * Math.sin(frame / 15), height: 10, borderRadius: 10, background: COLORS.white, opacity: 0.8 }} />
          <div style={{ position: "absolute", left: 22, bottom: 40, width: 90, height: 10, borderRadius: 10, background: COLORS.blue }} />
        </div>
        <div style={{ width: 150, borderLeft: `1px solid ${COLORS.faint}`, padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div style={{ height: 6, width: 60, borderRadius: 6, background: COLORS.white, opacity: 0.4, marginBottom: 7 }} />
              <div style={{ height: 8, borderRadius: 8, background: COLORS.faint }}>
                <div style={{ height: 8, borderRadius: 8, width: `${50 + 40 * Math.sin(frame / 18 + i * 1.7)}%`, background: i % 2 ? COLORS.blue : COLORS.violet }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ height: 196, borderTop: `1px solid ${COLORS.faint}`, padding: "12px 16px", position: "relative", display: "flex", flexDirection: "column", gap: 8 }}>
        {TRACKS.map((t, i) => (
          <div key={i} style={{ position: "relative", height: 26, borderRadius: 7, background: "rgba(255,255,255,0.03)" }}>
            {t.clips.map(([s, w], k) => (
              <div key={k} style={{ position: "absolute", left: `${s * 100}%`, width: `${w * 100}%`, top: 2, bottom: 2, borderRadius: 6, background: `linear-gradient(90deg, ${t.color}, ${t.color}99)`, opacity: 0.9 }}>
                {i === 4
                  ? new Array(46).fill(0).map((_, b) => <span key={b} style={{ position: "absolute", left: `${(b / 46) * 100}%`, bottom: 3, width: 3, borderRadius: 2, height: 4 + rnd(`w${b}`) * 14, background: "#04130c" }} />)
                  : [0.25, 0.7].map((d) => <span key={d} style={{ position: "absolute", left: `${d * 100}%`, top: 7, width: 8, height: 8, background: "#fff", transform: "rotate(45deg)", opacity: 0.85 }} />)}
              </div>
            ))}
          </div>
        ))}
        <div style={{ position: "absolute", top: 4, bottom: 4, left: `calc(16px + ${play * 96}%)`, width: 2, background: "#fff", boxShadow: "0 0 12px #fff" }}>
          <div style={{ position: "absolute", top: -2, left: -6, width: 14, height: 10, background: "#fff", borderRadius: 3 }} />
        </div>
      </div>
    </div>
  );
};

// floating project pieces that orbit the monitor in 3D
const Chip: React.FC<{ kind: number }> = ({ kind }) => {
  const c = kind % 2 ? COLORS.blue : COLORS.violet;
  const base: React.CSSProperties = { width: 132, height: 92, borderRadius: 20, background: "rgba(14,10,30,0.9)", border: `1.5px solid ${c}`, boxShadow: `0 0 34px ${c}77, inset 0 0 22px ${c}22`, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 };
  if (kind === 0) return <div style={base}><div style={{ width: 30, height: 30, background: c, transform: "rotate(45deg)", borderRadius: 5 }} /></div>;
  if (kind === 1) return <div style={base}>{[18, 40, 26, 52, 30, 44, 16].map((h, i) => <span key={i} style={{ width: 7, height: h, borderRadius: 7, background: c }} />)}</div>;
  if (kind === 2) return <div style={base}><svg width="92" height="54"><path d="M4 50 C 30 50, 26 6, 88 4" fill="none" stroke={c} strokeWidth="5" strokeLinecap="round" /><circle cx="4" cy="50" r="5" fill="#fff" /><circle cx="88" cy="4" r="5" fill="#fff" /></svg></div>;
  if (kind === 3) return <div style={base}><div style={{ width: 0, height: 0, borderLeft: `34px solid ${c}`, borderTop: "21px solid transparent", borderBottom: "21px solid transparent", marginLeft: 8 }} /></div>;
  if (kind === 4) return <div style={base}>{[COLORS.violet, COLORS.blue, COLORS.white].map((k) => <span key={k} style={{ width: 28, height: 28, borderRadius: 28, background: k }} />)}</div>;
  if (kind === 5) return <div style={{ ...base, flexDirection: "column", gap: 9 }}>{[84, 64, 74].map((w, i) => <span key={i} style={{ width: w, height: 10, borderRadius: 10, background: i === 1 ? "#fff" : c }} />)}</div>;
  if (kind === 6) return <div style={base}><div style={{ width: 44, height: 44, borderRadius: 44, border: `7px solid ${c}`, borderTopColor: "#fff" }} /></div>;
  return <div style={base}><div style={{ width: 70, height: 40, borderRadius: 8, border: `4px solid ${c}`, boxShadow: `10px -10px 0 -4px rgba(14,10,30,1), 10px -10px 0 0 ${c}88` }} /></div>;
};

export const Scene01Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // 1 — a single violet point of light on pure black
  const point = prog(frame, 14, 40, EASE.out);
  const pointPulse = 1 + 0.12 * Math.sin(frame / 3.2);
  const burst = bell(frame, 44, 78);
  const pointGone = prog(frame, 52, 80, EASE.out);
  // 2 — monitor arrives, then racks out of focus when the headline lands
  const mon = prog(frame, 76, 122, EASE.out);
  const rack = prog(frame, 144, 172, EASE.inOut);
  const orbitOn = prog(frame, 104, 140, EASE.out);

  const line1 = 150;
  const line2 = 172;
  const line3 = 198;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ opacity: prog(frame, 44, 70, EASE.linear), transform: `scale(${1 + rack * 0.06})`, filter: `blur(${rack * 3}px)` }}>
        <ThreeCanvas width={width} height={height} camera={{ fov: 58, position: [0, 0.4, 8.5], near: 0.1, far: 60 }}>
          <GridWorld frame={frame} />
        </ThreeCanvas>
      </AbsoluteFill>
      <Particles count={70} seed="hook" opacity={prog(frame, 60, 100, EASE.linear) * 0.8} />

      {/* horizon glow */}
      <AbsoluteFill style={{ background: `radial-gradient(60% 34% at 50% 52%, ${COLORS.violet}44, transparent 70%)`, opacity: prog(frame, 50, 90) * (1 - rack * 0.4) }} />

      {/* the point of light + shockwave */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: 26, height: 26, borderRadius: 26, background: "#fff", opacity: point * (1 - pointGone), transform: `scale(${point * pointPulse + burst * 3})`, boxShadow: `0 0 30px 10px ${COLORS.violet}, 0 0 120px 50px ${COLORS.violet}aa, 0 0 320px 120px ${COLORS.violet}55` }} />
        {[0, 1].map((i) => {
          const r = prog(frame, 46 + i * 8, 96 + i * 8, EASE.out);
          return <div key={i} style={{ position: "absolute", width: 2200, height: 2200, borderRadius: "50%", border: `3px solid ${i ? COLORS.blue : COLORS.violetSoft}`, opacity: (1 - r) * (r > 0 ? 0.9 : 0), transform: `scale(${r}) rotateX(${i * 62}deg)` }} />;
        })}
      </AbsoluteFill>

      {/* monitor + orbiting project pieces, in one 3D space */}
      <AbsoluteFill style={{ perspective: 1700, alignItems: "center", justifyContent: "center", opacity: mon * (1 - rack * 0.62), filter: `blur(${(1 - mon) * 18 + rack * 11}px)` }}>
        <div style={{ position: "relative", width: 1000, height: 590, transformStyle: "preserve-3d", transform: `translateY(${lerp(120, -30, mon)}px) translateZ(${lerp(-900, 0, mon) - rack * 260}px) rotateX(${lerp(26, 7, mon)}deg) rotateY(${lerp(34, -9, mon) + Math.sin(frame / 50) * 5}deg)` }}>
          <div style={{ position: "absolute", inset: -14, borderRadius: 30, background: "linear-gradient(145deg,#2a2440,#0b0916)", boxShadow: `0 0 0 2px ${COLORS.glassBorder}, 0 60px 160px rgba(0,0,0,0.9), 0 0 160px ${COLORS.violet}66` }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: 18, overflow: "hidden" }}>
            <EditorMock frame={frame} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.09) 50%, transparent 60%)`, transform: `translateX(${lerp(-110, 110, prog(frame, 96, 150, EASE.inOut))}%)` }} />
          </div>
          <div style={{ position: "absolute", left: "50%", bottom: -74, width: 240, height: 62, marginLeft: -120, background: "linear-gradient(180deg,#1c1830,#0a0814)", clipPath: "polygon(22% 0,78% 0,100% 100%,0 100%)" }} />
          {new Array(8).fill(0).map((_, i) => {
            const a = (i / 8) * TAU + frame * 0.021 + 0.4;
            const rx = 760 + (i % 3) * 60;
            const x = Math.cos(a) * rx * orbitOn;
            const z = Math.sin(a) * 560 * orbitOn;
            const y = Math.sin(a * 2 + i) * 150 * orbitOn - 20;
            const depthBlur = Math.max(0, -z / 560) * 5;
            return (
              <div key={i} style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -66, marginTop: -46, opacity: orbitOn, filter: `blur(${depthBlur}px)`, transform: `translate3d(${x}px, ${y}px, ${z}px) rotateY(${9 - Math.sin(frame / 50) * 5}deg) scale(${0.4 + orbitOn * 0.75})` }}>
                <Chip kind={i} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* headline — words land with the narrator */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 70, perspective: 1200 }}>
        <div style={{ position: "absolute", width: 1500, height: 520, background: "radial-gradient(ellipse at center, rgba(3,2,7,0.78), transparent 68%)", opacity: rack }} />
        <div style={{ position: "relative", transform: `scale(${1 + prog(frame, 150, 240, EASE.linear) * 0.045})` }}>
          <KineticLines
            lines={COPY.hook.lines}
            accent={COPY.hook.accent}
            size={108}
            starts={[[line1, line1 + 5, line1 + 10], [line2, line2 + 5, line2 + 10, line2 + 15], [line3, line3 + 6, line3 + 12]]}
          />
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 4, fontFamily: FONTS.mono }} />
    </AbsoluteFill>
  );
};
