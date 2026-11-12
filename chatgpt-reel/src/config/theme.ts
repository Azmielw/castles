// 🎨 الهوية البصرية — أبيض وأسود ودرجات رمادي فقط (Monochrome).
// (أسماء المفاتيح green/violet/blue موروثة؛ قيمها كلها أبيض/رمادي.)
export const COLORS = {
  bg: "#050505",
  bgSoft: "#0D0D0D",
  white: "#FFFFFF",
  dim: "rgba(236,236,241,0.66)",
  faint: "rgba(236,236,241,0.13)",
  gray: "#ECECF1",
  grayMid: "#8E8EA0",
  green: "#FFFFFF", // لون الإبراز الأساسي
  greenBright: "#FFFFFF",
  greenSoft: "#C9C9CF",
  greenDeep: "#2A2A2E",
  // aliases used by the shared components
  violet: "#FFFFFF",
  violetSoft: "#FFFFFF",
  blue: "#C9C9CF",
  blueDeep: "#2A2A2E",
  red: "#EF4146",
  glass: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(255,255,255,0.2)",
} as const;

export const FONTS = {
  display: "'Alexandria', 'Alexandria Latin', sans-serif",
  body: "'IBM Plex Sans Arabic', 'Plex Latin', 'Alexandria', sans-serif",
  latin: "'Space Grotesk', 'Alexandria', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const GRADIENT = `linear-gradient(100deg, #FFFFFF 0%, #DCDCE2 50%, #FFFFFF 100%)`;

export const gradientText = (gradient: string = GRADIENT) =>
  ({
    backgroundImage: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  }) as const;
