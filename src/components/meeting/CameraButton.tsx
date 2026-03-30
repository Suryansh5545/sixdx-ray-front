import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CameraButtonProps {
  isCameraOff: boolean;
  onToggle: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { btn: 36, icon: 14 },
  md: { btn: 48, icon: 18 },
  lg: { btn: 60, icon: 22 },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function CameraButton({
  isCameraOff,
  onToggle,
  disabled = false,
  size = "md",
  className = "",
}: CameraButtonProps) {
  const { btn, icon } = SIZE_MAP[size];
  const [pressed, setPressed] = useState(false);

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <button
        onClick={() => { if (!disabled) onToggle(); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        disabled={disabled}
        aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
        aria-pressed={!isCameraOff}
        className="relative flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: btn,
          height: btn,
          background: isCameraOff
            ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.25))"
            : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(180,210,255,0.10))",
          border: isCameraOff
            ? "1.5px solid rgba(239,68,68,0.55)"
            : "1.5px solid rgba(255,255,255,0.2)",
          boxShadow: isCameraOff
            ? "0 2px 0 rgba(255,100,100,0.15) inset, 0 -1px 0 rgba(120,0,0,0.2) inset, 0 4px 16px rgba(200,0,0,0.2)"
            : "0 2px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 4px 14px rgba(0,30,160,0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
          transform: pressed ? "translateY(1px) scale(0.96)" : "translateY(0) scale(1)",
        }}
      >
        {isCameraOff ? (
          /* Camera-off icon */
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        ) : (
          /* Camera-on icon */
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
        )}
      </button>

      {/* Off indicator dot */}
      {isCameraOff && (
        <div
          className="absolute rounded-full"
          style={{
            width: 8, height: 8,
            background: "#ef4444",
            border: "1.5px solid rgba(10,15,30,0.8)",
            bottom: -2,
            right: -2,
            boxShadow: "0 0 6px rgba(239,68,68,0.6)",
          }}
        />
      )}
    </div>
  );
}