import "./fonts";
import { Composition } from "remotion";
import { LowerThird, type LowerThirdProps } from "./scenes/LowerThird";
import { theme } from "./theme";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="LowerThird"
    component={LowerThird}
    fps={FPS}
    width={1920}
    height={1080}
    durationInFrames={FPS * 5}
    defaultProps={{
      name: "Lior Kolnik",
      title: "Product, Eve Security",
      inSec: 0.3,
      outSec: 4.0,
    } satisfies LowerThirdProps}
    // Length follows the props: ends shortly after the exit animation.
    calculateMetadata={({ props }) => ({
      durationInFrames: Math.ceil((props.outSec + theme.timing.exit + theme.timing.tail) * FPS),
    })}
  />
);
