import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, Enter, useExit, useSec, useSpring, Words } from "../components/Motion";
import { body, Chip, h1 } from "../components/UI";

const COLS = 18;
const ROWS = 15; // 270 dots
const CELL = 46;
// 15 deterministic "harmful" dots spread over the grid
const BAD = new Set(Array.from({ length: 15 }, (_, i) => (i * 97 + 31) % (COLS * ROWS)));

export const Tip2: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const gridAt = f(0.9);
  const badAt = f(3.6);
  const flyAt = f(4.4);
  const out = useExit(dur - 10);
  const count = Math.round(
    frame < flyAt
      ? interpolate(frame, [gridAt, gridAt + f(1.4)], [0, 270], { easing: theme.ease.out, ...clamp })
      : interpolate(frame, [flyAt, flyAt + f(0.8)], [270, 255], { easing: theme.ease.out, ...clamp }),
  );
  const red = interpolate(frame, [badAt, badAt + 8], [0, 1], clamp);
  const fly = interpolate(frame, [flyAt, flyAt + f(0.6)], [0, 1], { easing: theme.ease.in, ...clamp });
  const counterIn = useSpring(gridAt, "snappy");
  const push = interpolate(frame, [0, dur], [1, 1.05]);

  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <AbsoluteFill style={{ width: "auto", top: 250, height: "auto", alignItems: "center" }}>
        <Enter at={2} rise={16} cfg="snappy">
          <Chip>نصيحة 2</Chip>
        </Enter>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 360, left: 100, right: 100, height: "auto" }}>
        <Words text="ماتكترش منهم" at={8} per={4} style={h1} />
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 540, height: "auto", alignItems: "center" }}>
        <div style={{ position: "relative", width: COLS * CELL, height: ROWS * CELL }}>
          {Array.from({ length: COLS * ROWS }).map((_, i) => {
            const c = i % COLS;
            const r = Math.floor(i / COLS);
            const dist = Math.hypot(c - COLS / 2, r - ROWS / 2);
            const p = interpolate(frame - gridAt - dist * 2.2, [0, 10], [0, 1], { easing: theme.ease.out, ...clamp });
            const bad = BAD.has(i);
            const dx = bad ? ((i * 53) % 400) - 200 : 0;
            const dy = bad ? -300 - ((i * 31) % 300) : 0;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: c * CELL + 10, top: r * CELL + 10, width: 26, height: 26, borderRadius: 13,
                  background: bad && red > 0 ? theme.colors.red : theme.colors.ink,
                  opacity: p * (bad ? 1 - fly : 0.55),
                  transform: `translate(${dx * fly}px, ${dy * fly}px) scale(${p * (bad ? 1 + red * 0.35 + fly * 0.8 : 1)})`,
                  boxShadow: bad && red > 0 ? `0 0 ${18 * red}px ${theme.colors.red}` : undefined,
                }}
              />
            );
          })}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 1250, left: 100, right: 100, height: "auto", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, direction: "rtl", opacity: counterIn }}>
          <span style={{ fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 120, color: theme.colors.primary, fontVariantNumeric: "tabular-nums", direction: "ltr", textShadow: `0 0 50px ${theme.colors.glow}` }}>
            {count}
          </span>
          <span style={{ ...body, color: theme.colors.ink, fontSize: 48 }}>مهارة على حسابي</span>
        </div>
        <Words text="مسحت منهم 15 كانوا بيلخبطوا الباقي" at={flyAt + 4} per={3} style={{ ...body, fontSize: 44 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
