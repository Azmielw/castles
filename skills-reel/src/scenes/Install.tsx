import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, Enter, useExit, useSec, useSpring, Words } from "../components/Motion";
import { Card, Caret, Chip, CodeLine, h1, useTyped, WindowBar } from "../components/UI";

const Ltr: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span style={{ direction: "ltr", unicodeBidi: "isolate", fontFamily: theme.fonts.mono, fontSize: "0.9em" }}>{children}</span>
);

export const Install: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const f = useSec();
  const cmdAt = f(1.2);
  const cmd = useTyped("cp -r yt-script .claude/skills/", cmdAt, 26);
  const treeAt = f(2.6);
  const okAt = f(3.6);
  const step2 = f(5.6);
  const typeAt = f(6.3);
  const slash = useTyped("/yt", typeAt, 8);
  const menuAt = f(7.0);
  const pickAt = f(8.2);
  const menu = useSpring(menuAt, "snappy");
  const menuOut = useExit(pickAt + 8, 8);
  const pick = interpolate(frame, [menuAt + 10, menuAt + 18], [0, 1], { easing: theme.ease.out, ...clamp });
  const ok = useSpring(okAt, "bouncy");
  const out = useExit(dur - 10);
  const push = interpolate(frame, [0, dur], [1, 1.04]);
  const typed = frame >= pickAt ? "/yt-script" : slash;

  const tree = [
    { t: "my-project/", d: 0 },
    { t: "└─ .claude/", d: 1 },
    { t: "   └─ skills/", d: 2 },
    { t: "      └─ yt-script/", d: 3 },
  ];

  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <AbsoluteFill style={{ width: "auto", top: 260, left: 100, right: 100, height: "auto" }}>
        <Words text="تثبّتها إزاي؟" at={3} per={4} style={h1} />
      </AbsoluteFill>

      <AbsoluteFill style={{ width: "auto", top: 420, left: 90, right: 90, height: "auto", alignItems: "center", gap: 22 }}>
        <Enter at={14} rise={20} cfg="snappy">
          <Chip style={{ fontSize: 38 }}>
            1 · حط الفولدر في <Ltr>.claude/skills</Ltr>
          </Chip>
        </Enter>
        <Enter at={22} style={{ width: "100%" }}>
          <Card>
            <WindowBar title="terminal" />
            <div style={{ padding: "22px 10px 26px" }}>
              <CodeLine color={theme.colors.ink}>
                <span style={{ color: theme.colors.dim }}>$ </span>
                {cmd}
                {frame < treeAt && <Caret color={theme.colors.ink} />}
              </CodeLine>
              <div style={{ height: 14 }} />
              {tree.map((row, i) => (
                <Enter key={i} at={treeAt + i * 4} rise={14} cfg="snappy">
                  <CodeLine color={i === 3 ? theme.colors.ink : theme.colors.dim}>
                    {row.t}
                    {i === 3 && (
                      <span style={{ display: "inline-block", marginLeft: 18, color: theme.colors.green, transform: `scale(${ok})`, opacity: ok }}>✓</span>
                    )}
                  </CodeLine>
                </Enter>
              ))}
            </div>
          </Card>
        </Enter>

        <div style={{ height: 8 }} />
        <Enter at={step2} rise={20} cfg="snappy">
          <Chip style={{ fontSize: 38 }}>
            2 · اكتب <Ltr>/</Ltr> واسمها
          </Chip>
        </Enter>
        <Enter at={step2 + 6} style={{ width: "100%" }}>
          <div style={{ position: "relative" }}>
            <Card style={{ padding: "26px 30px" }}>
              <CodeLine color={theme.colors.ink}>
                <span style={{ color: theme.colors.dim }}>{"> "}</span>
                {typed}
                <Caret color={theme.colors.ink} />
              </CodeLine>
            </Card>
            {/* autocomplete */}
            <div style={{ position: "absolute", top: 118, left: 0, right: 0, opacity: Math.min(menu, menuOut), transform: `translateY(${interpolate(menu, [0, 1], [-20, 0])}px)` }}>
              <Card style={{ padding: "12px 10px" }}>
                {[
                  { n: "/yt-script", d: "سكريبت يوتيوب من فكرة" },
                  { n: "/yt-seo", d: "وصف وتاجز" },
                  { n: "/yt-shorts", d: "يقطّع شورتس" },
                ].map((r, i) => (
                  <div
                    key={r.n}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", direction: "ltr",
                      padding: "12px 22px", borderRadius: 14,
                      background: i === 0 ? `rgba(239,138,94,${0.18 * pick})` : "transparent",
                    }}
                  >
                    <span style={{ fontFamily: theme.fonts.mono, fontSize: 34, color: i === 0 && pick > 0.5 ? theme.colors.primary : theme.colors.ink }}>{r.n}</span>
                    <span style={{ fontFamily: theme.fonts.body, fontWeight: 500, fontSize: 30, color: theme.colors.dim, direction: "rtl" }}>{r.d}</span>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </Enter>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
