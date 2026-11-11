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
import { Scene02Claude } from "./scenes/Scene02Claude";
import { Scene03Workflow } from "./scenes/Scene03Workflow";
import { Scene04Magic } from "./scenes/Scene04Magic";
import { Scene05Technology } from "./scenes/Scene05Technology";
import { Scene06Montage } from "./scenes/Scene06Montage";
import { Scene07Outro } from "./scenes/Scene07Outro";

export type MainProps = { captions: boolean; voice: boolean; music: boolean; sfx: boolean; picture: boolean };

// Scene order, component and camera transition in / out.
const PLAN: { id: SceneId; Scene: React.FC; enter: Move; exit: Move }[] = [
  { id: "hook", Scene: Scene01Hook, enter: "none", exit: "push" },
  { id: "claude", Scene: Scene02Claude, enter: "push", exit: "left" },
  { id: "workflow", Scene: Scene03Workflow, enter: "left", exit: "push" },
  { id: "magic", Scene: Scene04Magic, enter: "push", exit: "pull" },
  { id: "technology", Scene: Scene05Technology, enter: "pull", exit: "push" },
  { id: "montage", Scene: Scene06Montage, enter: "fade", exit: "fade" },
  { id: "outro", Scene: Scene07Outro, enter: "fade", exit: "none" },
];

export const Main: React.FC<MainProps> = ({ captions, voice, music, sfx, picture }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <MotionBlurDefs />
      {picture ? (
        <>
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
            <CutFlash key={id} at={f(SCENES[id].start) + 4} />
          ))}
          <Finish />
          {captions ? <Captions /> : null}
        </>
      ) : null}
      <AudioTracks voice={voice} music={music} sfx={sfx} />
    </AbsoluteFill>
  );
};
