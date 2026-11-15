import "./fonts";
import { Composition } from "remotion";
import { Main } from "./Main";
import { TOTAL_SEC } from "./timeline";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <Composition id="SkillsReel" component={Main} fps={FPS} width={1080} height={1920} durationInFrames={Math.round(TOTAL_SEC * FPS)} />
);
