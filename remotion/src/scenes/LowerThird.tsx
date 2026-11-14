import { AbsoluteFill, interpolate, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { clamp, useBreath, useEnter, useExit } from "../components/Motion";
import { Grain } from "../components/Grain";

export type LowerThirdProps = {
  name: string;
  title: string;
  inSec: number; // when the lower third starts entering
  outSec: number; // when it starts leaving
};

export const LowerThird: React.FC<LowerThirdProps> = ({ name, title, inSec, outSec }) => {
  const { fps, height } = useVideoConfig();
  const s = height / 1080; // everything is designed at 1080p and scales with the frame
  const inF = Math.round(inSec * fps);
  const outF = Math.round(outSec * fps);
  const st = Math.round(theme.timing.stagger * fps);
  const exitSt = Math.round(st / 2); // exits stagger tighter than entrances

  // Entrances: bar → plate → name → title
  const bar = useEnter(inF, "snappy");
  const plate = useEnter(inF + Math.round(st / 2));
  const nameIn = useEnter(inF + st + Math.round(st / 2), "snappy");
  const titleIn = useEnter(inF + 2 * st + Math.round(st / 2), "snappy");

  // Exits, reverse order: title → name → plate → bar
  const titleOut = useExit(outF);
  const nameOut = useExit(outF + exitSt);
  const plateOut = useExit(outF + 2 * exitSt);
  const barOut = useExit(outF + 3 * exitSt);

  const breath = useBreath();

  const plateReveal = Math.min(plate, plateOut); // 0..1 wipe from the left
  const groupShift = interpolate(plateOut, [0, 1], [-40, 0], clamp);

  const textStyle = (enter: number, exit: number, rise: number): React.CSSProperties => ({
    opacity: Math.min(enter, exit),
    transform: `translateY(${interpolate(enter, [0, 1], [rise * s, 0])}px) translateX(${interpolate(exit, [0, 1], [-24 * s, 0])}px)`,
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 120 * s,
          bottom: 130 * s,
          display: "flex",
          alignItems: "stretch",
          transform: `translateX(${groupShift * s}px)`,
          filter: `drop-shadow(0 ${12 * s}px ${28 * s}px ${theme.colors.shadow})`,
        }}
      >
        {/* Accent bar — the one hero-colored, glowing element */}
        <div
          style={{
            width: 8 * s,
            background: theme.colors.primary,
            borderRadius: 4 * s,
            transformOrigin: "50% 100%",
            transform: `scaleY(${Math.min(bar, barOut)})`,
            opacity: barOut,
            boxShadow: `0 0 ${(18 + breath * 14) * s}px ${theme.colors.glow}`,
          }}
        />

        {/* Plate */}
        <div
          style={{
            position: "relative",
            marginLeft: 14 * s,
            padding: `${22 * s}px ${40 * s}px ${24 * s}px ${32 * s}px`,
            background: `linear-gradient(100deg, ${theme.colors.plate}, rgba(18, 18, 26, 0.80))`,
            border: `${1 * s}px solid ${theme.colors.plateEdge}`,
            borderRadius: 10 * s,
            overflow: "hidden",
            clipPath: `inset(0 ${(1 - plateReveal) * 100}% 0 0 round ${10 * s}px)`,
            transform: `scale(${interpolate(plate, [0, 1], [0.97, 1], clamp)})`,
            transformOrigin: "0% 50%",
          }}
        >
          <Grain />
          <div
            style={{
              position: "relative",
              fontFamily: theme.fonts.display,
              fontWeight: 700,
              fontSize: 60 * s,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              color: theme.colors.text,
              whiteSpace: "nowrap",
              ...textStyle(nameIn, nameOut, 28),
            }}
          >
            {name}
          </div>
          <div
            style={{
              position: "relative",
              marginTop: 10 * s,
              fontFamily: theme.fonts.body,
              fontWeight: 500,
              fontSize: 30 * s,
              letterSpacing: "0.01em",
              color: theme.colors.textDim,
              whiteSpace: "nowrap",
              ...textStyle(titleIn, titleOut, 20),
            }}
          >
            {title}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
