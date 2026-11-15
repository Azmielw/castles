import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, Enter, useExit, useSec, useSpring, Words } from "../components/Motion";
import { Card, Chip, CodeLine, Folder, h1, Top, useTyped, WindowBar } from "../components/UI";

// Each step: when its line types in (sec), and the label shown under the card.
const STEPS = [
  { at: 2.3, label: "1 · الاسم" },
  { at: 3.6, label: "2 · وصف قصير" },
  { at: 5.5, label: "3 · التعليمات" },
  { at: 8.3, label: "4 · ملفات مساعدة، لو محتاج" },
];

const Label: React.FC<{ at: number; out: number; text: string }> = ({ at, out, text }) => (
  <Enter at={at} out={out} rise={20} cfg="snappy" style={{ position: "absolute", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
    <Chip style={{ fontSize: 40 }}>{text}</Chip>
  </Enter>
);

export const Anatomy: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const folderIn = useSpring(8, "bouncy");
  const open = interpolate(frame, [f(1.2), f(1.7)], [0, 1], { easing: theme.ease.out, ...clamp });
  const card = useSpring(f(1.5));
  const out = useExit(dur - 10);
  const step = STEPS.reduce((acc, s, i) => (frame >= f(s.at) ? i : acc), -1);
  const hlFor = (i: number) => interpolate(frame, [f(STEPS[i].at), f(STEPS[i].at) + 10], [0, 1], { easing: theme.ease.out, ...clamp }) * (step === i ? 1 : 0);

  const name = useTyped("name: yt-script", f(STEPS[0].at), 24);
  const desc = useTyped("description: اكتب سكريبت يوتيوب من فكرة", f(STEPS[1].at), 26);
  const head = useTyped("# التعليمات", f(STEPS[2].at), 20);
  const i1 = useTyped("1. اكتب 5 هوكات واختار أحسن اتنين", f(STEPS[2].at + 0.6), 30);
  const i2 = useTyped("2. علّم كل مقطع بـ [ON SCREEN]", f(STEPS[2].at + 1.5), 30);
  const push = interpolate(frame, [0, dur], [1, 1.04]);

  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <Top>
        <Words text="المهارة ببساطة = فولدر" at={3} per={4} style={{ ...h1, fontSize: 82 }} />
      </Top>
      {/* folder */}
      <AbsoluteFill style={{ width: "auto", top: 430, height: "auto", alignItems: "center" }}>
        <div style={{ opacity: folderIn, transform: `scale(${interpolate(folderIn, [0, 1], [0.6, 1])})` }}>
          <Folder size={170} open={open} />
        </div>
      </AbsoluteFill>
      {/* SKILL.md card rising out of the folder */}
      <AbsoluteFill style={{ width: "auto", top: 600, left: 90, right: 90, height: "auto" }}>
        <div style={{ opacity: card, transform: `translateY(${interpolate(card, [0, 1], [-60, 0])}px) scale(${interpolate(card, [0, 1], [0.8, 1])})` }}>
          <Card>
            <WindowBar title="yt-script/SKILL.md" />
            <div style={{ padding: "24px 14px 30px" }}>
              <CodeLine color={theme.colors.dim}>---</CodeLine>
              <CodeLine color={theme.colors.code} hl={hlFor(0)}>{name}</CodeLine>
              <CodeLine color={theme.colors.code} hl={hlFor(1)}>{desc}</CodeLine>
              <CodeLine color={theme.colors.dim}>{frame >= f(STEPS[1].at + 1.2) ? "---" : " "}</CodeLine>
              <div style={{ position: "relative" }}>
                <CodeLine color={theme.colors.ink} hl={hlFor(2)}>{head || " "}</CodeLine>
                <CodeLine color={theme.colors.ink}>{i1 || " "}</CodeLine>
                <CodeLine color={theme.colors.ink}>{i2 || " "}</CodeLine>
              </div>
            </div>
          </Card>
          {/* helper folders */}
          <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 34, direction: "ltr" }}>
            {["scripts/", "references/"].map((t, i) => (
              <Enter key={t} at={f(STEPS[3].at) + i * 5} cfg="bouncy" rise={30}>
                <div
                  style={{
                    fontFamily: theme.fonts.mono, fontSize: 36, color: step === 3 ? theme.colors.primary : theme.colors.ink,
                    border: `2px ${step === 3 ? "solid" : "dashed"} ${step === 3 ? theme.colors.primary : theme.colors.faint}`,
                    borderRadius: 18, padding: "16px 30px", background: "rgba(244,239,230,0.05)",
                  }}
                >
                  {t}
                </div>
              </Enter>
            ))}
          </div>
        </div>
      </AbsoluteFill>
      {/* step label */}
      <AbsoluteFill style={{ width: "auto", top: 1380, height: "auto" }}>
        {STEPS.map((s, i) => (
          <Label key={i} at={f(s.at)} out={i < STEPS.length - 1 ? f(STEPS[i + 1].at) - 6 : 1e9} text={s.label} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
