import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { scenes, TOTAL_SEC } from "./timeline";
import { cues } from "./sfx";
import { BgMesh, Finish, Grade } from "./components/Layers";
import { Hook } from "./scenes/Hook";
import { Intro } from "./scenes/Intro";
import { Anatomy } from "./scenes/Anatomy";
import { How } from "./scenes/How";
import { Install } from "./scenes/Install";
import { Tip1 } from "./scenes/Tip1";
import { Tip2 } from "./scenes/Tip2";
import { Outro } from "./scenes/Outro";

const SCENES: Record<(typeof scenes)[number]["id"], React.FC<{ dur: number }>> = {
  hook: Hook, intro: Intro, anatomy: Anatomy, how: How, install: Install, tip1: Tip1, tip2: Tip2, outro: Outro,
};

/** Right→left wipe across each cut (RTL reading direction). */
const Wipe: React.FC<{ color: string; len: number }> = ({ color, len }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, len], [100, -100], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ background: color, transform: `translateX(${x}%)` }} />;
};

export const Main: React.FC = () => {
  const { fps } = useVideoConfig();
  const fr = (s: number) => Math.round(s * fps);
  const WIPE = 16;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <BgMesh />
      {scenes.map((s) => {
        const C = SCENES[s.id];
        const dur = fr(s.to) - fr(s.from);
        return (
          <Sequence key={s.id} from={fr(s.from)} durationInFrames={dur} name={s.id}>
            <C dur={dur} />
          </Sequence>
        );
      })}
      {scenes.slice(1).map((s, i) => (
        <Sequence key={`w${i}`} from={fr(s.from) - WIPE / 2} durationInFrames={WIPE} name={`wipe-${s.id}`}>
          <Wipe len={WIPE} color={i % 2 ? theme.colors.primary : theme.colors.ink} />
        </Sequence>
      ))}
      <Grade />
      <Finish />

      {/* audio */}
      <Audio src={staticFile("audio/bed.wav")} volume={0.32} endAt={fr(TOTAL_SEC)} />
      {scenes.slice(1).map((s, i) => (
        <Sequence key={`ws${i}`} from={Math.max(0, fr(s.from) - 10)} durationInFrames={fr(0.6)}>
          <Audio src={staticFile("audio/whoosh.wav")} volume={0.45} />
        </Sequence>
      ))}
      {cues.map((c, i) => (
        <Sequence key={`c${i}`} from={fr(c.at)} durationInFrames={fr(1.2)}>
          <Audio src={staticFile(`audio/${c.file}.wav`)} volume={c.vol ?? 0.6} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
