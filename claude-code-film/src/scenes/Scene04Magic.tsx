import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Tag } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS } from "../config/theme";
import { EASE, prog } from "../lib/anim";
import { BurstShot, CompareShot, ProductsShot, TypoShot, UiShot } from "./magic/DomShots";
import { MapShot, SphereLogoShot } from "./magic/ThreeShots";

/** Six motion examples + the plain-vs-pro comparison, cut to the narration. [start frame, component] */
export const SHOTS: [number, React.FC][] = [
  [0, TypoShot], // «من النصوص المتحركة»
  [66, SphereLogoShot], // «للمجسمات ثلاثية الأبعاد»
  [136, MapShot], // «للخرائط»
  [200, ProductsShot], // «والانتقالات السينمائية»
  [264, UiShot],
  [326, CompareShot],
  [392, BurstShot],
];
const END = 450 + 14;
const WHIP = 7;

/** Whip-pan between shots: a fast horizontal slide with directional motion blur. */
const Shot: React.FC<{ length: number; first: boolean; last: boolean; index: number; children: React.ReactNode }> = ({ length, first, last, index, children }) => {
  const frame = useCurrentFrame();
  const i = first ? 1 : prog(frame, 0, WHIP, EASE.out);
  const o = last ? 0 : prog(frame, length - WHIP, length, EASE.in);
  const x = (1 - i) * -1920 + o * 1920; // content travels left → right, like a camera panning with the RTL reading direction
  const moving = Math.max(1 - i, o);
  const label = COPY.magic.labels[index];
  return (
    <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: moving > 0.02 ? "url(#streakSoft)" : undefined }}>
      {children}
      {label ? (
        <div style={{ position: "absolute", top: 70, right: 100, opacity: prog(frame, 8, 20) * (index === 5 ? 0 : 1), transform: `translateX(${(1 - prog(frame, 8, 22)) * 60}px)` }}>
          <Tag color={index % 2 ? COLORS.blue : COLORS.violetSoft}>{label}</Tag>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Scene04Magic: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    {SHOTS.map(([start, Comp], i) => {
      const next = i < SHOTS.length - 1 ? SHOTS[i + 1][0] + WHIP : END;
      return (
        <Sequence key={i} from={start} durationInFrames={next - start} name={`Shot ${i + 1}`}>
          <Shot length={next - start} first={i === 0} last={i === SHOTS.length - 1} index={i}>
            <Comp />
          </Shot>
        </Sequence>
      );
    })}
  </AbsoluteFill>
);
