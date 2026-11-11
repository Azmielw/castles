import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { Glow, Particles } from "../components/Atmosphere";
import { KineticLines } from "../components/Type";
import { COPY } from "../config/copy";
import { COLORS } from "../config/theme";
import { EASE, lerp, prog } from "../lib/anim";
import { BurstShot } from "./magic/DomShots";
import { MapShot, SphereLogoShot } from "./magic/ThreeShots";
import { Scene01Hook } from "./Scene01Hook";
import { Scene02Claude } from "./Scene02Claude";
import { Scene03Workflow } from "./Scene03Workflow";
import { Scene05Technology } from "./Scene05Technology";

/** One cut per second = every 2 beats of the 120 BPM score. [component, frame inside that scene to start from] */
const CUT = 30;
const CLIPS: [React.FC, number][] = [
  [Scene01Hook, 112],
  [Scene02Claude, 22],
  [Scene03Workflow, 384],
  [SphereLogoShot, 34],
  [MapShot, 26],
  [Scene05Technology, 176],
];
const TEXT_AT = CLIPS.length * CUT;

/** Plays a slice of another scene with a punchy push-in, like an editor's best-of reel. */
const Clip: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => {
  const frame = useCurrentFrame();
  const punch = prog(frame, 0, 9, EASE.out);
  const dir = index % 2 ? 1 : -1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: COLORS.bg }}>
      <AbsoluteFill style={{ transform: `scale(${lerp(1.22, 1.06, punch) + frame * 0.0022}) translateX(${(1 - punch) * 70 * dir}px) rotate(${(1 - punch) * 1.4 * dir}deg)`, filter: punch < 1 ? `blur(${(1 - punch) * 9}px)` : undefined }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: (1 - prog(frame, 0, 5, EASE.out)) * 0.5, mixBlendMode: "screen" }} />
    </AbsoluteFill>
  );
};

export const Scene06Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame - TEXT_AT;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      {CLIPS.map(([Comp, offset], i) => (
        <Sequence key={i} from={i * CUT} durationInFrames={CUT} name={`Cut ${i + 1}`} premountFor={20}>
          <Clip index={i}>
            <Sequence from={-offset} layout="none">
              <Comp />
            </Sequence>
          </Clip>
        </Sequence>
      ))}

      {/* closing statement over the particle explosion */}
      <Sequence from={TEXT_AT - 4} name="Statement">
        <AbsoluteFill style={{ opacity: 0.75 }}>
          <BurstShot text={false} />
        </AbsoluteFill>
        <Glow intensity={0.7} />
        <Particles count={110} seed="final" drift={[0.2, -0.5]} />
      </Sequence>
      {t >= 0 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 80, perspective: 1200 }}>
          <div style={{ position: "absolute", width: 1500, height: 620, background: "radial-gradient(ellipse at center, rgba(3,2,7,0.82), transparent 68%)" }} />
          <div style={{ position: "relative", transform: `scale(${1 + t * 0.0006})` }}>
            <KineticLines lines={COPY.montage.lines} accent={COPY.montage.accent} size={112} starts={[[TEXT_AT + 6, TEXT_AT + 11, TEXT_AT + 16], [TEXT_AT + 40, TEXT_AT + 46, TEXT_AT + 52], [TEXT_AT + 66, TEXT_AT + 74, TEXT_AT + 82]]} />
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
