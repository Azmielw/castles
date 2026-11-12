import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { AudioTracks } from "./audio/AudioTracks";
import { Finish } from "./components/Atmosphere";
import { Captions } from "./components/Captions";
import { CutFlash, MotionBlurDefs, type Move, SceneFrame } from "./components/SceneFrame";
import { f, SCENES, type SceneId, TRANSITION_FRAMES } from "./config/timeline";
import { COLORS } from "./config/theme";
import "./lib/fonts";
import { Scene01Hook } from "./scenes/Scene01Hook";
import { Scene02Intro } from "./scenes/Scene02Intro";
import { Scene03Prompt } from "./scenes/Scene03Prompt";
import { Scene04Uses } from "./scenes/Scene04Uses";
import { Scene05Advanced } from "./scenes/Scene05Advanced";
import { Scene06Outro } from "./scenes/Scene06Outro";

export type MainProps = { captions: boolean; voice: boolean; music: boolean; sfx: boolean };

// ترتيب المشاهد + حركة الكاميرا في الدخول والخروج
const PLAN: { id: SceneId; Scene: React.FC; enter: Move; exit: Move }[] = [
  { id: "hook", Scene: Scene01Hook, enter: "none", exit: "push" },
  { id: "intro", Scene: Scene02Intro, enter: "push", exit: "left" },
  { id: "prompt", Scene: Scene03Prompt, enter: "left", exit: "up" },
  { id: "uses", Scene: Scene04Uses, enter: "up", exit: "push" },
  { id: "advanced", Scene: Scene05Advanced, enter: "push", exit: "pull" },
  { id: "outro", Scene: Scene06Outro, enter: "pull", exit: "none" },
];

export const Main: React.FC<MainProps> = ({ captions, voice, music, sfx }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <MotionBlurDefs />
    {PLAN.map(({ id, Scene, enter, exit }, i) => {
      const from = f(SCENES[id].start);
      const last = i === PLAN.length - 1;
      const duration = f(SCENES[id].end) - from + (last ? 0 : TRANSITION_FRAMES);
      return (
        <Sequence key={id} name={`Scene · ${id}`} from={from} durationInFrames={duration}>
          <SceneFrame duration={duration} enter={enter} exit={last ? "none" : exit}>
            <Scene />
          </SceneFrame>
        </Sequence>
      );
    })}
    {PLAN.slice(1).map(({ id }) => (
      <CutFlash key={id} at={f(SCENES[id].start) + 4} color={COLORS.greenSoft} />
    ))}
    <Finish />
    {captions ? <Captions /> : null}
    <AudioTracks voice={voice} music={music} sfx={sfx} />
  </AbsoluteFill>
);
