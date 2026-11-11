import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { COLORS } from "../config/theme";
import { rnd, TAU } from "../lib/anim";

/** Soft colour blobs that drift behind a scene. */
export const Glow: React.FC<{ a?: string; b?: string; intensity?: number; speed?: number }> = ({
  a = COLORS.violet,
  b = COLORS.blueDeep,
  intensity = 1,
  speed = 1,
}) => {
  const frame = useCurrentFrame() * speed;
  const x1 = 30 + Math.sin(frame / 90) * 12;
  const y1 = 35 + Math.cos(frame / 70) * 10;
  const x2 = 72 + Math.cos(frame / 110) * 10;
  const y2 = 68 + Math.sin(frame / 80) * 12;
  return (
    <AbsoluteFill
      style={{
        opacity: intensity,
        background: `radial-gradient(38% 46% at ${x1}% ${y1}%, ${a}3d 0%, transparent 70%), radial-gradient(42% 50% at ${x2}% ${y2}%, ${b}33 0%, transparent 72%)`,
      }}
    />
  );
};

type P = { x: number; y: number; z: number; s: number; hue: number; ph: number };

/**
 * Glowing particle field with real depth: near particles are bigger, faster and blurrier
 * (parallax + depth of field). Fully deterministic — driven by the frame only.
 */
export const Particles: React.FC<{
  count?: number;
  seed?: string;
  /** camera travel in px, applied with parallax */
  camX?: number;
  camY?: number;
  drift?: [number, number];
  opacity?: number;
  width?: number;
  height?: number;
}> = ({ count = 140, seed = "p", camX = 0, camY = 0, drift = [0.15, -0.35], opacity = 1, width = 1920, height = 1080 }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const parts = useMemo<P[]>(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        x: rnd(`${seed}x${i}`),
        y: rnd(`${seed}y${i}`),
        z: 0.15 + rnd(`${seed}z${i}`) * 0.85,
        s: 0.6 + rnd(`${seed}s${i}`) * 1.8,
        hue: rnd(`${seed}h${i}`),
        ph: rnd(`${seed}p${i}`) * TAU,
      })),
    [count, seed],
  );

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const depth = p.z * p.z;
      const px = (((p.x * width + (frame * drift[0] - camX) * (0.3 + depth * 2.2)) % width) + width) % width;
      const py = (((p.y * height + (frame * drift[1] - camY) * (0.3 + depth * 2.2)) % height) + height) % height;
      const tw = 0.55 + 0.45 * Math.sin(frame / 14 + p.ph);
      const r = p.s * (1 + depth * 7);
      const soft = depth > 0.55 ? 1 : 0.35; // far = crisp dots, near = bokeh
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
      const col = p.hue > 0.5 ? "139,61,255" : "25,200,255";
      g.addColorStop(0, `rgba(${p.hue > 0.86 ? "255,255,255" : col},${(soft > 0.9 ? 0.16 : 0.75) * tw})`);
      g.addColorStop(soft > 0.9 ? 0.7 : 0.25, `rgba(${col},${(soft > 0.9 ? 0.09 : 0.2) * tw})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 3, 0, TAU);
      ctx.fill();
    }
  }, [frame, parts, camX, camY, drift, width, height]);

  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity }} />;
};

/** Cinematic finishing layer: vignette + subtle animated grain. */
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.62) 100%)" }} />
      {/* noise plate, shifted and flipped every frame = living film grain (cheap to render) */}
      <AbsoluteFill style={{ opacity: 0.085, mixBlendMode: "overlay", overflow: "hidden" }}>
        <Img
          src={staticFile("grain.jpg")}
          style={{
            position: "absolute",
            left: "-5%",
            top: "-5%",
            width: "110%",
            height: "110%",
            transform: `translate(${(rnd(`gx${frame}`) - 0.5) * 8}%, ${(rnd(`gy${frame}`) - 0.5) * 8}%) scale(${frame % 2 ? -1 : 1}, ${frame % 3 ? 1 : -1})`,
          }}
        />
      </AbsoluteFill>
    </>
  );
};
