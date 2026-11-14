import { AbsoluteFill, useCurrentFrame } from "remotion";

// Procedural grain clipped to its parent (the plate) — the overlay itself stays transparent.
const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  const x = (frame * 37) % 220;
  const y = (frame * 61) % 220;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: noise,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
