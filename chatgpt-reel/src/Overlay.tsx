import React from "react";
import { AbsoluteFill } from "remotion";
import { AudioTracks } from "./audio/AudioTracks";
import { Captions } from "./components/Captions";
import "./lib/fonts";

/** Captions + full audio mix on a transparent background — composited over the picture with ffmpeg. */
export const Overlay: React.FC = () => (
  <AbsoluteFill>
    <Captions />
    <AudioTracks />
  </AbsoluteFill>
);
