import { Audio } from "@remotion/media";
import React from "react";
import { interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { SFX } from "../config/sfx";
import voice from "../data/voiceover.generated.json";

/** Mix levels — the music always sits under the narrator. */
export const MIX = { voice: 1, musicFull: 0.5, musicUnderVoice: 0.18, sfx: 0.5 };

const Music: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  // Duck under every voice segment with soft 0.35s ramps.
  const duck = Math.max(
    ...voice.segments.map((s) =>
      interpolate(t, [s.placeAt - 0.35, s.placeAt, s.endAt - 0.1, s.endAt + 0.45], [0, 1, 1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  return <Audio src={staticFile("audio/music.mp3")} volume={interpolate(duck, [0, 1], [MIX.musicFull, MIX.musicUnderVoice])} />;
};

const VoiceSegment: React.FC<{ srcStart: number; length: number }> = ({ srcStart, length }) => {
  const { fps } = useVideoConfig();
  const total = Math.round(length * fps);
  return (
    <Audio
      src={staticFile("audio/voiceover.mp3")}
      trimBefore={Math.round(srcStart * fps)}
      durationInFrames={total}
      volume={(fr) => MIX.voice * Math.min(1, (fr + 1) / 2, (total - fr) / 2)}
    />
  );
};

/** voice / music / sfx can each be muted to export clean stems. */
export const AudioTracks: React.FC<{ voice?: boolean; music?: boolean; sfx?: boolean }> = ({ voice: v = true, music = true, sfx = true }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {music ? <Music /> : null}
      {v
        ? voice.segments.map((s) => (
            <Sequence key={s.id} name={`VO · ${s.id}`} from={Math.round(s.placeAt * fps)} layout="none">
              <VoiceSegment srcStart={s.srcStart} length={s.srcEnd - s.srcStart} />
            </Sequence>
          ))
        : null}
      {sfx
        ? SFX.map(([at, file, volume], i) => (
            <Audio key={i} from={Math.round(at * fps)} src={staticFile(`audio/sfx/${file}.wav`)} volume={volume * MIX.sfx} />
          ))
        : null}
    </>
  );
};
