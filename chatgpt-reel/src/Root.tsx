import React from "react";
import { Composition } from "remotion";
import { DURATION_SECONDS, FPS, HEIGHT, WIDTH } from "./config/timeline";
import { Main, type MainProps } from "./Main";

const defaults: MainProps = { captions: true, voice: true, music: true, sfx: true };

export const RemotionRoot: React.FC = () => (
  <>
    {/* ريل 9:16 كامل */}
    <Composition id="Reel" component={Main} durationInFrames={DURATION_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={defaults} />
    {/* بدون كابشن محروق (استخدم ملف SRT) */}
    <Composition id="ReelClean" component={Main} durationInFrames={DURATION_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ ...defaults, captions: false }} />
  </>
);
