import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MicButtonProps {
  isMuted: boolean;
  /** Called when user toggles mic */
  onToggle: () => void;
  /** 0–1 live audio level for the animated ring (optional) */
  audioLevel?: number;
  disabled?: boolean;
  /** "sm" | "md" | "lg" */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { btn: 36, icon: 14, ring: 44 },
  md: { btn: 48, icon: 18, ring: 60 },
  lg: { btn: 60, icon: 22, ring: 76 },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function MicButton({
  isMuted,
  onToggle,
  audioLevel = 0,
  disabled = false,
  size = "md",
  className = "",
}: MicButtonProps) {
  const { btn, icon, ring } = SIZE_MAP[size];
  const [pressed, setPressed] = useState(false);

  // Smooth audio level animation
  const smoothLevel = useRef(0);
  const [displayLevel, setDisplayLevel] = useState(0);

  useEffect(() => {
    let raf: number;
    function tick() {
      smoothLevel.current += (audioLevel - smoothLevel.current) * 0.15;
      setDisplayLevel(smoothLevel.current);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioLevel]);

  const ringScale = 1 + displayLevel * 0.35;
  const ringOpacity = isMuted ? 0 : displayLevel * 0.7;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: ring, height: ring }}
    >
      {/* Audio level ring */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: btn,
          height: btn,
          transform: `scale(${ringScale})`,
          background: "rgba(79,179,255,0.15)",
          border: "1.5px solid rgba(79,179,255,0.4)",
          opacity: ringOpacity,
          transition: "opacity 0.1s ease",
        }}
      />

      {/* Main button */}
      <button
        onClick={() => { if (!disabled) onToggle(); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        disabled={disabled}
        aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={!isMuted}
        className="relative flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: btn,
          height: btn,
          background: isMuted
            ? "linear-gradient(135deg, rgba(239,68,68,0.3), rgba(185,28,28,0.25))"
            : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(180,210,255,0.10))",
          border: isMuted
            ? "1.5px solid rgba(239,68,68,0.55)"
            : "1.5px solid rgba(255,255,255,0.2)",
          boxShadow: isMuted
            ? "0 2px 0 rgba(255,100,100,0.15) inset, 0 -1px 0 rgba(120,0,0,0.2) inset, 0 4px 16px rgba(200,0,0,0.2)"
            : "0 2px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 4px 14px rgba(0,30,160,0.2)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
          transform: pressed ? "translateY(1px) scale(0.96)" : "translateY(0) scale(1)",
        }}
      >
        {isMuted ? (
          /* Muted mic icon */
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
            stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23"/>
            <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
            <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        ) : (
          /* Active mic icon */
          <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
            <path d="M19 10v2a7 7 0 01-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        )}
      </button>

      {/* Muted label dot */}
      {isMuted && (
        <div
          className="absolute rounded-full"
          style={{
            width: 8, height: 8,
            background: "#ef4444",
            border: "1.5px solid rgba(10,15,30,0.8)",
            bottom: (ring - btn) / 2 - 2,
            right: (ring - btn) / 2 - 2,
            boxShadow: "0 0 6px rgba(239,68,68,0.6)",
          }}
        />
      )}
    </div>
  );
}