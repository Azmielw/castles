// 🎨 الهوية البصرية — غيّر الألوان والخطوط من هنا فقط.
export const COLORS = {
  bg: "#030207",
  bgSoft: "#0A0714",
  white: "#F6F4FF",
  dim: "rgba(246,244,255,0.62)",
  faint: "rgba(246,244,255,0.14)",
  violet: "#8B3DFF",
  violetSoft: "#B48CFF",
  blue: "#19C8FF",
  blueDeep: "#2B6BFF",
  green: "#3DFFB0",
  red: "#FF4D6D",
  glass: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(180,140,255,0.28)",
} as const;

export const FONTS = {
  display: "'Alexandria', 'Alexandria Latin', sans-serif", // عناوين عربية
  body: "'IBM Plex Sans Arabic', 'Plex Latin', 'Alexandria', sans-serif", // نصوص وكابشن
  latin: "'Space Grotesk', 'Alexandria', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const GRADIENT = `linear-gradient(100deg, ${COLORS.blue} 0%, ${COLORS.violetSoft} 45%, ${COLORS.violet} 100%)`;

export const gradientText = (gradient: string = GRADIENT) =>
  ({
    backgroundImage: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  }) as const;
