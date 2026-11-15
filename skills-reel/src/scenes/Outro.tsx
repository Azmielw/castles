import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { Enter, useBreath, useSec, Words } from "../components/Motion";
import { body, Chip, Folder, h1, h2 } from "../components/UI";

export const Outro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const b = useBreath(2.2);
  const push = interpolate(frame, [0, dur], [1, 1.05]);
  const endFade = interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ transform: `scale(${push})`, opacity: endFade }}>
      <AbsoluteFill style={{ width: "auto", top: 330, height: "auto", alignItems: "center" }}>
        <Enter at={2} cfg="bouncy" rise={30}>
          <div style={{ transform: `translateY(${b * 6}px)` }}>
            <Folder size={150} open={0.35} />
          </div>
        </Enter>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 520, left: 100, right: 100, height: "auto", gap: 14 }}>
        <Words text="ابدأ بمهارة واحدة" at={6} per={4} style={h1} />
        <Words text="لأكتر حاجة بتكررها…" at={f(0.9)} per={3} style={{ ...h2, color: theme.colors.dim }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 900, left: 90, right: 90, height: "auto" }}>
        <Words text="وخلّي Claude يشتغل بطريقتك إنت." at={f(2.3)} per={4} hero={["بطريقتك"]} style={{ ...h1, fontSize: 88 }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 1320, height: "auto", alignItems: "center", gap: 18 }}>
        <Enter at={f(3.8)} rise={20} cfg="snappy">
          <Chip style={{ fontSize: 40 }}>تابعني عشان الجاي</Chip>
        </Enter>
        <Enter at={f(4.2)} rise={12}>
          <div style={{ ...body, fontSize: 30, color: theme.colors.faint }}>فيديو تعليمي غير رسمي</div>
        </Enter>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
