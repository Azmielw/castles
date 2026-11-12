import React from "react";
import { COLORS, FONTS } from "../config/theme";
import { BrandMark } from "./BrandMark";

/** Extruded 3D smartphone. Children render on the screen (screen size = width-36 × height-36). */
export const Phone3D: React.FC<{
  width?: number;
  height?: number;
  rotateX?: number;
  rotateY?: number;
  scale?: number;
  x?: number;
  y?: number;
  z?: number;
  glow?: number;
  children: React.ReactNode;
}> = ({ width = 560, height = 1140, rotateX = 0, rotateY = 0, scale = 1, x = 0, y = 0, z = 0, glow = 0.6, children }) => {
  const depth = 12;
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, perspective: 2200 }}>
      <div style={{ position: "absolute", left: -width / 2, top: -height / 2, width, height, transformStyle: "preserve-3d", transform: `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})` }}>
        {/* body thickness */}
        {new Array(depth).fill(0).map((_, i) => (
          <div key={i} style={{ position: "absolute", inset: 0, borderRadius: 78, transform: `translateZ(${-i * 2.2}px)`, background: i === depth - 1 ? "#0a0c0b" : `rgb(${38 - i},${44 - i},${41 - i})`, boxShadow: i === depth - 1 ? `0 50px 120px rgba(0,0,0,0.85), 0 0 ${120 * glow}px ${COLORS.green}55` : undefined }} />
        ))}
        {/* front glass */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 78, background: "linear-gradient(145deg,#3b423f,#141816 40%,#0b0d0c)", boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.12), 0 0 0 1.5px ${COLORS.glassBorder}` }}>
          <div style={{ position: "absolute", inset: 18, borderRadius: 62, overflow: "hidden", background: "#0d0d0d" }}>
            {children}
            {/* dynamic island */}
            <div style={{ position: "absolute", left: "50%", top: 18, width: 150, height: 42, marginLeft: -75, borderRadius: 42, background: "#000" }} />
            {/* glass reflection */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.08) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.04) 100%)", pointerEvents: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
};

/** Status bar + chat header, like a mobile chat app. */
export const ChatHeader: React.FC = () => (
  <>
    <div style={{ position: "absolute", top: 20, left: 46, right: 46, display: "flex", justifyContent: "space-between", fontFamily: FONTS.latin, fontWeight: 600, fontSize: 24, color: "#fff" }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {[10, 14, 18, 22].map((h) => (
          <span key={h} style={{ width: 5, height: h, borderRadius: 2, background: "#fff" }} />
        ))}
        <span style={{ marginLeft: 8, width: 40, height: 20, borderRadius: 6, border: "2px solid #fff", position: "relative" }}>
          <span style={{ position: "absolute", inset: 2, right: 8, borderRadius: 3, background: "#fff" }} />
        </span>
      </span>
    </div>
    <div style={{ position: "absolute", top: 82, left: 30, right: 30, height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Burger />
      <div style={{ fontFamily: FONTS.latin, fontWeight: 600, fontSize: 32, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}>
        ChatGPT <span style={{ fontSize: 22, color: COLORS.grayMid }}>⌄</span>
      </div>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
    </div>
  </>
);

const Burger = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
    <path d="M4 8h16M4 16h10" />
  </svg>
);

/** The message composer pill: "+" button, text, mic and voice buttons. */
export const Composer: React.FC<{
  text?: string;
  placeholder?: string;
  caret?: boolean;
  highlight?: number;
  plusActive?: number;
  sendReady?: boolean;
  style?: React.CSSProperties;
}> = ({ text = "", placeholder = "", caret = false, highlight = 0, plusActive = 0, sendReady = false, style }) => (
  <div style={{ position: "absolute", left: 22, right: 22, bottom: 40, height: 104, borderRadius: 52, background: "#2f2f2f", display: "flex", alignItems: "center", padding: "0 16px", gap: 14, boxShadow: highlight > 0 ? `0 0 0 ${3 + highlight * 3}px ${COLORS.green}, 0 0 ${highlight * 60}px ${COLORS.green}` : "0 0 0 1px rgba(255,255,255,0.08)", ...style }}>
    <div style={{ width: 66, height: 66, borderRadius: 66, display: "flex", alignItems: "center", justifyContent: "center", background: plusActive > 0 ? `rgba(16,163,127,${0.25 + plusActive * 0.5})` : "transparent", border: "2px solid rgba(255,255,255,0.18)", color: "#fff", fontSize: 44, fontFamily: FONTS.latin, lineHeight: 1 }}>+</div>
    <div dir="rtl" lang="ar" style={{ flex: 1, fontFamily: FONTS.body, fontWeight: 500, fontSize: 34, color: text ? "#fff" : COLORS.grayMid, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", overflow: "hidden" }}>
      {text || placeholder}
      {caret ? <span style={{ width: 3, height: 40, background: COLORS.greenBright, marginInlineStart: 4 }} /> : null}
    </div>
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
    <div style={{ width: 70, height: 70, borderRadius: 70, background: sendReady ? "#fff" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
      {sendReady ? (
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      ) : (
        [12, 22, 30, 22, 12].map((h, i) => <span key={i} style={{ width: 4, height: h, borderRadius: 4, background: "#000" }} />)
      )}
    </div>
  </div>
);

/** Empty chat state: mark + greeting. */
export const Greeting: React.FC<{ text: string; opacity?: number }> = ({ text, opacity = 1 }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top: "38%", display: "flex", flexDirection: "column", alignItems: "center", gap: 34, opacity }}>
    <BrandMark size={96} />
    <div dir="rtl" lang="ar" style={{ fontFamily: FONTS.display, fontWeight: 600, fontSize: 44, color: "#fff" }}>
      {text}
    </div>
  </div>
);

/** User message bubble (right side in RTL chat). */
export const UserBubble: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div dir="rtl" lang="ar" style={{ alignSelf: "flex-start", maxWidth: "82%", background: "#2f2f2f", color: "#fff", borderRadius: 34, padding: "18px 28px 22px", fontFamily: FONTS.body, fontWeight: 500, fontSize: 32, lineHeight: 1.5, ...style }}>
    {children}
  </div>
);

/** Small SVG line icons used across scenes. */
export const ICONS: Record<string, React.ReactNode> = {
  write: <g><path d="M14 74 18 56 62 12a8 8 0 0 1 12 12L30 68z" /><path d="M54 20l12 12" /><path d="M14 86h56" /></g>,
  learn: <g><path d="M8 34 50 16l42 18-42 18z" /><path d="M24 42v22c0 6 12 12 26 12s26-6 26-12V42" /><path d="M92 34v24" /></g>,
  code: <g><path d="M32 28 12 50l20 22M68 28l20 22-20 22" /><path d="M56 20 44 80" /></g>,
  data: <g><path d="M12 86h76" /><rect x="18" y="52" width="14" height="28" rx="3" /><rect x="43" y="34" width="14" height="46" rx="3" /><rect x="68" y="16" width="14" height="64" rx="3" /></g>,
  idea: <g><path d="M50 12c-16 0-28 12-28 27 0 10 6 18 13 23v10h30V62c7-5 13-13 13-23 0-15-12-27-28-27z" /><path d="M38 86h24" /></g>,
  image: <g><rect x="10" y="16" width="80" height="68" rx="10" /><circle cx="34" cy="38" r="8" /><path d="M10 72l24-22 18 16 14-12 24 22" /></g>,
  file: <g><path d="M24 10h36l20 20v58a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" /><path d="M60 10v20h20M34 54h32M34 70h22" /></g>,
  mic: <g><rect x="38" y="12" width="24" height="46" rx="12" /><path d="M22 46a28 28 0 0 0 56 0M50 74v14" /></g>,
};

export const Icon: React.FC<{ name: keyof typeof ICONS; size: number; color?: string; stroke?: number }> = ({ name, size, color = "#fff", stroke = 6.5 }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
    {ICONS[name]}
  </svg>
);
