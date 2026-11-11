import React from "react";
import { Composition } from "remotion";
import { DURATION_SECONDS, FPS, HEIGHT, WIDTH } from "./config/timeline";
import { Main, type MainProps } from "./Main";

const defaults: MainProps = { captions: true, voice: true, music: true, sfx: true, picture: true };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* الفيديو الكامل */}
      <Composition id="Main" component={Main} durationInFrames={DURATION_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={defaults} />
      {/* نسخة بدون كابشن محروق (استخدم ملف الـ SRT) */}
      <Composition id="MainClean" component={Main} durationInFrames={DURATION_SECONDS * FPS} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={{ ...defaults, captions: false }} />
    </>
  );
};
