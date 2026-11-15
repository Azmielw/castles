import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, Enter, useExit, useSec, useSpring, Words } from "../components/Motion";
import { body, Card, Chip, CodeLine, h1, WindowBar } from "../components/UI";

// Real lines from a skill installed earlier (invisible-threads/scripts/find_threads.py).
const LINES = [
  "import json",
  "import numpy as np",
  "from pathlib import Path",
  "",
  "def build_graph(chunks):",
  "    import subprocess",
  '    subprocess.check_call(["pip", "install", ...])',
  "    ...",
];
const DANGER = 6;

export const Tip1: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const scanFrom = f(1.6);
  const hitAt = f(3.4);
  const out = useExit(dur - 10);
  const hl = interpolate(frame, [hitAt, hitAt + 8], [0, 1], { easing: theme.ease.out, ...clamp });
  const lensY = interpolate(frame, [scanFrom, hitAt], [0, DANGER], { easing: theme.ease.inOut, ...clamp });
  const lensIn = useSpring(scanFrom - 6, "snappy");
  const lensOut = useExit(hitAt + 14, 8);
  const warn = useSpring(hitAt + 8, "bouncy");
  const shake = frame >= hitAt && frame < hitAt + 10 ? Math.sin(frame * 2.2) * 8 * (1 - (frame - hitAt) / 10) : 0;
  const push = interpolate(frame, [0, dur], [1, 1.05]);
  const LH = 54;

  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <AbsoluteFill style={{ width: "auto", top: 250, height: "auto", alignItems: "center" }}>
        <Enter at={2} rise={16} cfg="snappy">
          <Chip>نصيحة 1</Chip>
        </Enter>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 360, left: 100, right: 100, height: "auto" }}>
        <Words text="اقرا أي مهارة قبل ما تثبّتها" at={8} per={3} hero={["اقرا"]} style={h1} />
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 640, left: 80, right: 80, height: "auto" }}>
        <Enter at={18} style={{ transform: `translateX(${shake}px)` }}>
          <Card>
            <WindowBar title="find_threads.py" />
            <div style={{ position: "relative", padding: "20px 6px 26px" }}>
              {LINES.map((l, i) => (
                <Enter key={i} at={24 + i * 3} rise={12} cfg="snappy">
                  <CodeLine
                    color={i === DANGER ? theme.colors.ink : theme.colors.dim}
                    hl={i === DANGER ? hl : 0}
                    hlColor={theme.colors.red}
                    style={{ fontSize: 29, lineHeight: `${LH}px` }}
                  >
                    {l || " "}
                  </CodeLine>
                </Enter>
              ))}
              {/* lens */}
              <div
                style={{
                  position: "absolute", left: 14, right: 14, top: 20 + lensY * LH - 6, height: LH + 12, borderRadius: 14,
                  border: `3px solid ${theme.colors.ink}`, opacity: Math.min(lensIn, lensOut) * 0.8,
                  boxShadow: `0 0 30px rgba(244,239,230,0.25)`,
                }}
              />
            </div>
          </Card>
        </Enter>
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 1250, left: 100, right: 100, height: "auto", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, direction: "rtl", opacity: warn, transform: `scale(${interpolate(warn, [0, 1], [0.85, 1])})` }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 32, background: theme.colors.red, color: theme.colors.bg, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 44,
            }}
          >
            !
          </div>
          <div style={{ ...body, color: theme.colors.ink, fontSize: 48, textAlign: "right" }}>فيه مهارات جواها كود بيتنفّذ على جهازك</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
