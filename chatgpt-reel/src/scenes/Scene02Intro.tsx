import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { BrandMark } from "../components/BrandMark";
import { ChatHeader, Composer, Greeting, Phone3D } from "../components/ChatUI";
import { Tag } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS, FONTS } from "../config/theme";
import { EASE, lerp, prog } from "../lib/anim";

const LOGIN_TAP = 64;
const TO_CHAT = 76;
const PUSH = 118;
const TYPE_AT = 160;

/** Finger-tap ripple. */
const Tap: React.FC<{ frame: number; at: number; x: number; y: number }> = ({ frame, at, x, y }) => {
  const k = prog(frame, at, at + 18, EASE.out);
  const show = frame >= at - 8 && frame < at + 20;
  if (!show) return null;
  return (
    <>
      <div style={{ position: "absolute", left: x - 34, top: y - 34, width: 68, height: 68, borderRadius: 68, background: "rgba(255,255,255,0.75)", opacity: 1 - k, transform: `scale(${frame < at ? 1 : 1 - k * 0.3})` }} />
      <div style={{ position: "absolute", left: x - 70, top: y - 70, width: 140, height: 140, borderRadius: 140, border: `4px solid ${COLORS.greenSoft}`, opacity: (1 - k) * (frame >= at ? 1 : 0), transform: `scale(${0.4 + k})` }} />
    </>
  );
};

export const Scene02Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const inn = prog(frame, 0, 34, EASE.out);
  const toChat = prog(frame, TO_CHAT, TO_CHAT + 18, EASE.inOut);
  const push = prog(frame, PUSH, PUSH + 30, EASE.inOut);
  const hl = prog(frame, PUSH + 20, PUSH + 34, EASE.out);
  const words = COPY.intro.typed.split(" ");
  const typed = words.filter((_, i) => frame >= TYPE_AT + i * 9).join(" ");
  const done = frame >= TYPE_AT + words.length * 9;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Glow a={COLORS.green} b={COLORS.greenDeep} intensity={0.9} />
      <Particles count={70} seed="intro" opacity={0.6} />

      <div style={{ position: "absolute", top: 150, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: prog(frame, 6, 22) * (1 - push) }}>
        <Tag color={COLORS.green}>{COPY.intro.step}</Tag>
      </div>

      <Phone3D
        rotateY={lerp(lerp(-38, -10, inn), 0, push) + Math.sin(frame / 40) * 3 * (1 - push)}
        rotateX={lerp(lerp(24, 6, inn), 0, push)}
        scale={lerp(lerp(0.6, 0.94, inn), 1.32, push)}
        y={lerp(lerp(500, -50, inn), -300, push)}
        z={0}
      >
        {/* login screen */}
        <div style={{ position: "absolute", inset: 0, opacity: 1 - toChat, transform: `translateX(${-toChat * 120}px)` }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 320, display: "flex", justifyContent: "center" }}>
            <BrandMark size={150} glow={0.4} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 520, textAlign: "center", fontFamily: FONTS.latin, fontWeight: 700, fontSize: 56, color: "#fff" }}>ChatGPT</div>
          <div dir="rtl" lang="ar" style={{ position: "absolute", left: 50, right: 50, bottom: 140, height: 100, borderRadius: 100, background: frame >= LOGIN_TAP ? COLORS.green : "#fff", color: frame >= LOGIN_TAP ? "#fff" : "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.body, fontWeight: 700, fontSize: 36, transform: `scale(${frame >= LOGIN_TAP && frame < LOGIN_TAP + 8 ? 0.96 : 1})` }}>
            {COPY.intro.login}
          </div>
          <Tap frame={frame} at={LOGIN_TAP} x={262} y={1104 - 190} />
        </div>

        {/* chat screen */}
        <div style={{ position: "absolute", inset: 0, opacity: toChat, transform: `translateX(${(1 - toChat) * 120}px)` }}>
          <ChatHeader />
          <Greeting text={COPY.intro.greeting} opacity={prog(frame, TO_CHAT + 6, TO_CHAT + 24)} />
          <Composer text={typed} placeholder={COPY.intro.placeholder} caret={frame >= PUSH + 30 && !done ? Math.floor(frame / 8) % 2 === 0 : false} highlight={hl * (0.75 + 0.25 * Math.sin(frame / 5))} sendReady={done} />
        </div>
      </Phone3D>

      {/* callout pointing at the composer */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1150, display: "flex", justifyContent: "center", opacity: hl * (1 - prog(frame, 228, 240)), transform: `translateY(${(1 - hl) * 30}px)` }}>
        <Tag color={COLORS.greenSoft}>{COPY.intro.hint}</Tag>
      </div>
    </AbsoluteFill>
  );
};
