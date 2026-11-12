// 🎨 الهوية البصرية — درجات الأخضر + الأبيض + الأسود + الرمادي الفاتح فقط.
// (المفاتيح violet/blue موروثة من المكوّنات المشتركة لكن قيمها كلها درجات أخضر.)
export const COLORS = {
  bg: "#050706",
  bgSoft: "#0D0F0E",
  white: "#FFFFFF",
  dim: "rgba(236,236,241,0.66)",
  faint: "rgba(236,236,241,0.13)",
  gray: "#ECECF1",
  grayMid: "#8E8EA0",
  green: "#10A37F", // أخضر ChatGPT
  greenBright: "#19C37D",
  greenSoft: "#7FE0BF",
  greenDeep: "#0A5C47",
  // aliases used by the shared components
  violet: "#10A37F",
  violetSoft: "#19C37D",
  blue: "#7FE0BF",
  blueDeep: "#0A5C47",
  red: "#EF4146",
  glass: "rgba(255,255,255,0.045)",
  glassBorder: "rgba(127,224,191,0.26)",
} as const;

export const FONTS = {
  display: "'Alexandria', 'Alexandria Latin', sans-serif",
  body: "'IBM Plex Sans Arabic', 'Plex Latin', 'Alexandria', sans-serif",
  latin: "'Space Grotesk', 'Alexandria', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export const GRADIENT = `linear-gradient(100deg, ${COLORS.white} 0%, ${COLORS.greenSoft} 45%, ${COLORS.greenBright} 100%)`;

export const gradientText = (gradient: string = GRADIENT) =>
  ({
    backgroundImage: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  }) as const;
