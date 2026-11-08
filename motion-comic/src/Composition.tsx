import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";

type Panel = { img: string; x: number; y: number; w: number; h: number };
const IMG_W = 736;
const W = 1080;
const H = 1920;
export const PANEL_FRAMES = 60;

export const PANELS: Panel[] = [
  { img: "p1.jpg", x: 320, y: 0, w: 416, h: 270 },
  { img: "p1.jpg", x: 0, y: 280, w: 736, h: 290 },
  { img: "p1.jpg", x: 0, y: 600, w: 736, h: 230 },
  { img: "p1.jpg", x: 0, y: 860, w: 736, h: 213 },
  { img: "p2.jpg", x: 0, y: 0, w: 736, h: 640 },
  { img: "p2.jpg", x: 0, y: 670, w: 736, h: 404 },
  { img: "p3.jpg", x: 0, y: 0, w: 736, h: 520 },
  { img: "p3.jpg", x: 0, y: 520, w: 736, h: 400 },
  { img: "p3.jpg", x: 0, y: 800, w: 736, h: 347 },
];

const PanelView: React.FC<{ p: Panel }> = ({ p }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, PANEL_FRAMES], [1, 1.1]);
  const s = Math.min(W / p.w, H / p.h);
  const fw = p.w * s;
  const fh = p.h * s;
  const cover = Math.max(W / p.w, H / p.h);
  return (
    <AbsoluteFill style={{ backgroundColor: "black", overflow: "hidden" }}>
      <Img
        src={staticFile(p.img)}
        style={{
          position: "absolute",
          width: IMG_W * cover,
          left: W / 2 - (p.x + p.w / 2) * cover,
          top: H / 2 - (p.y + p.h / 2) * cover,
          filter: "blur(25px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: (W - fw) / 2,
          top: (H - fh) / 2,
          width: fw,
          height: fh,
          overflow: "hidden",
          transform: `scale(${zoom})`,
        }}
      >
        <Img
          src={staticFile(p.img)}
          style={{ position: "absolute", width: IMG_W * s, left: -p.x * s, top: -p.y * s }}
        />
      </div>
    </AbsoluteFill>
  );
};

export const MotionComic: React.FC = () => (
  <AbsoluteFill>
    {PANELS.map((p, i) => (
      <Sequence key={i} from={i * PANEL_FRAMES} durationInFrames={PANEL_FRAMES}>
        <PanelView p={p} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
