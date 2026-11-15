import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { clamp, Enter, useBreath, useExit, useSpring, Words } from "../components/Motion";
import { body, h2 } from "../components/UI";

const Rays: React.FC<{ at: number }> = ({ at }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {Array.from({ length: 16 }).map((_, i) => {
        const p = interpolate(frame - at - i * 1.5, [0, 18], [0, 1], { easing: theme.ease.out, ...clamp });
        const fade = interpolate(frame - at - i * 1.5, [10, 40], [1, 0.25], clamp);
        return (
          <div
            key={i}
            style={{
              position: "absolute", left: "50%", top: "50%", width: 6, height: 260 * p, borderRadius: 3,
              background: `linear-gradient(${theme.colors.ink}, transparent)`, opacity: fade * 0.5,
              transformOrigin: "50% 0", transform: `rotate(${i * 22.5}deg) translateY(150px)`,
            }}
          />
        );
      })}
    </>
  );
};

export const Intro: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const hit = 12;
  const p = useSpring(hit, "bouncy");
  const b = useBreath(2.4);
  const out = useExit(dur - 10);
  const push = interpolate(frame, [0, dur], [1, 1.05]);
  return (
    <AbsoluteFill style={{ opacity: out, transform: `scale(${push})` }}>
      <AbsoluteFill style={{ width: "auto", top: 330, alignItems: "center", height: "auto" }}>
        <Enter at={2} rise={24}>
          <div style={{ ...h2, color: theme.colors.dim }}>الحل اسمه</div>
        </Enter>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 470, height: 520, alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", width: 0, height: 0 }}>
          <Rays at={hit} />
        </div>
        <div
          style={{
            position: "absolute", fontFamily: theme.fonts.display, fontWeight: 700, fontSize: 250, letterSpacing: "-0.03em",
            color: theme.colors.primary, direction: "ltr", opacity: p,
            transform: `scale(${interpolate(p, [0, 1], [0.6, 1]) * (1 + b * 0.012)})`,
            textShadow: `0 0 70px ${theme.colors.primary}66, 0 0 140px ${theme.colors.primary}33`,
          }}
        >
          Skills
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 1000, alignItems: "center", height: "auto" }}>
        <Enter at={28} rise={20}>
          <div style={{ ...h2, fontSize: 60 }}>يعني «مهارات»</div>
        </Enter>
      </AbsoluteFill>
      <AbsoluteFill style={{ width: "auto", top: 1170, left: 110, right: 110, alignItems: "center", height: "auto", gap: 10 }}>
        <Words text="بتعلّم بيها Claude شغلك مرة واحدة" at={62} per={3} style={{ ...body, color: theme.colors.ink, fontSize: 52 }} />
        <Words text="ويفتكره على طول." at={92} per={3} style={{ ...body, fontSize: 52 }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
