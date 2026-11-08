import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";

type Panel = {
  img: string; x: number; y: number; w: number; h: number;
  pan: [number, number]; // direction of camera drift, -1..1 (x right, y down)
  shake?: boolean;
  sub?: string;
  layers?: { src: string; depth: number; bob?: number }[];
};
const IMG_W = 736;
const W = 1080;
const H = 1920;
export const PANEL_FRAMES = 60;

export const PANELS: Panel[] = [
  { img: "p1.jpg", x: 320, y: 0, w: 416, h: 270, pan: [0, 1], sub: "อากาศ... กำลังถูกดึงเข้าหาเขา..." },
  { img: "p1.jpg", x: 0, y: 280, w: 736, h: 290, pan: [1, 0], shake: true, sub: "[เสียงสะเทือนกึกก้อง]",
    layers: [
      { src: "p1_bg.png", depth: 0.4 },
      { src: "p1_koku.png", depth: 0.8, bob: 3 },
      { src: "p1_gyomei.png", depth: 1.2, bob: 6 },
    ] },
  { img: "p1.jpg", x: 0, y: 600, w: 736, h: 230, pan: [1, 0], shake: true },
  { img: "p1.jpg", x: 0, y: 860, w: 736, h: 213, pan: [1, -1], shake: true },
  { img: "p2.jpg", x: 0, y: 0, w: 736, h: 640, pan: [1, -1] },
  { img: "p2.jpg", x: 0, y: 670, w: 736, h: 404, pan: [1, 0], sub: "ลมหายใจแห่งจันทร์" },
  { img: "p3.jpg", x: 0, y: 0, w: 736, h: 520, pan: [0, 1], sub: "ข้าผิดงั้นหรือ?" },
  { img: "p3.jpg", x: 0, y: 520, w: 736, h: 400, pan: [1, 1] },
  { img: "p3.jpg", x: 0, y: 800, w: 736, h: 347, pan: [1, 0] },
];

const PanelView: React.FC<{ p: Panel }> = ({ p }) => {
  const frame = useCurrentFrame();
  const zoom = interpolate(frame, [0, PANEL_FRAMES], [1.12, 1.18]);
  const drift = interpolate(frame, [0, PANEL_FRAMES], [-60, 60]);
  const amp = p.shake ? 14 * (0.6 + 0.4 * Math.sin(frame * 0.8)) : 0;
  const sx = amp * Math.sin(frame * 2.9);
  const sy = amp * Math.cos(frame * 3.7);
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
          transform: `translate(${drift * p.pan[0] + sx}px, ${drift * p.pan[1] + sy}px) scale(${zoom})`,
        }}
      >
        {p.layers ? (
          p.layers.map((l) => (
            <Img
              key={l.src}
              src={staticFile(l.src)}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: fw,
                height: fh,
                transform: `translate(${drift * p.pan[0] * l.depth}px, ${(l.bob ?? 0) * Math.sin(frame * 0.5) * s}px) scale(${1 + 0.05 * l.depth})`,
              }}
            />
          ))
        ) : (
          <Img
            src={staticFile(p.img)}
            style={{ position: "absolute", width: IMG_W * s, left: -p.x * s, top: -p.y * s }}
          />
        )}
      </div>
      {p.sub ? (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            bottom: 200,
            textAlign: "center",
            fontFamily: "Loma, sans-serif",
            fontWeight: 700,
            fontSize: 64,
            color: "white",
            WebkitTextStroke: "3px black",
            paintOrder: "stroke fill",
            opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          {p.sub}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const MotionComic: React.FC = () => (
  <AbsoluteFill>
    <Audio src={staticFile("sfx.wav")} />
    {PANELS.map((p, i) => (
      <Sequence key={i} from={i * PANEL_FRAMES} durationInFrames={PANEL_FRAMES}>
        <PanelView p={p} />
      </Sequence>
    ))}
  </AbsoluteFill>
);
