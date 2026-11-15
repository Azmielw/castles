import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, useExit, useSec, useSpring, Words } from "../components/Motion";
import { Chip, h1, Stage, Top } from "../components/UI";

const PROMPT = "اكتب بالمصري، وبأسلوبي، ومن غير مقدمات…";
const BUBBLE_TIMES = [0.07, 0.53, 0.87, 1.13, 1.33, 1.5]; // accelerating repeats

const Bubble: React.FC<{ at: number; depth: number; gone: number }> = ({ at, depth, gone }) => {
  const p = useSpring(at, "snappy");
  const lift = depth * 118;
  const fade = interpolate(depth, [0, 5], [1, 0.25], clamp);
  return (
    <div
      style={{
        position: "absolute", top: 560 - lift, right: 0, left: 0, display: "flex", justifyContent: "flex-start",
        opacity: Math.min(p, gone) * fade,
        transform: `translateY(${interpolate(p, [0, 1], [70, 0])}px) scale(${interpolate(p, [0, 1], [0.85, 1]) * interpolate(depth, [0, 5], [1, 0.9], clamp) * interpolate(gone, [0, 1], [0.6, 1])})`,
        transformOrigin: "100% 50%",
      }}
    >
      <div
        style={{
          direction: "rtl", fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 42, color: theme.colors.ink,
          background: theme.colors.cardHi, border: `2px solid ${theme.colors.line}`, borderRadius: "36px 36px 8px 36px",
          padding: "26px 36px", maxWidth: 860, boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
        }}
      >
        {PROMPT}
      </div>
    </div>
  );
};

export const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const times = BUBBLE_TIMES.map(f);
  const turn = f(3.17);
  const gone = useExit(turn, 14);
  const count = times.filter((t) => frame >= t).length;
  const chip = useSpring(times[1], "bouncy");
  const out = useExit(dur - 10);
  const push = interpolate(frame, [0, dur], [1, 1.06]);

  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, opacity: out }}>
      <Top>
        <Words text="بتشرح لـ Claude نفس الطلب كل مرة؟" at={3} per={3} out={turn} style={h1} />
      </Top>
      <Stage y={640}>
        <div style={{ position: "relative", width: "100%", height: 760 }}>
          {times.map((t, i) => (
            <Bubble key={i} at={t} depth={Math.max(0, count - 1 - i)} gone={gone} />
          ))}
          <div style={{ position: "absolute", top: 700, left: 0, opacity: Math.min(chip, gone), transform: `scale(${chip})` }}>
            <Chip hero>
              <span style={{ fontFamily: theme.fonts.mono, direction: "ltr" }}>×{count}</span>
            </Chip>
          </div>
        </div>
      </Stage>
      <AbsoluteFill style={{ width: "auto", justifyContent: "center", left: 80, right: 80 }}>
        <Words text="إنت بتضيّع وقتك." at={turn + 6} per={4} hero={["وقتك"]} style={{ ...h1, fontSize: 120 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
