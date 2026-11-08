import { Composition } from "remotion";
import { MotionComic, PANELS, PANEL_FRAMES } from "./Composition";

export const RemotionRoot: React.FC = () => (
  <Composition
    id="MotionComic"
    component={MotionComic}
    durationInFrames={PANELS.length * PANEL_FRAMES}
    fps={30}
    width={1080}
    height={1920}
  />
);
