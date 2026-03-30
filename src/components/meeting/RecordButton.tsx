import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface RecordButtonProps {
  isRecording: boolean;
  onToggle: () => void;
  /** Elapsed seconds (pass in from backend/parent or let the component self-track) */
  elapsedSeconds?: number;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: { btn: 36, icon: 12 },
  md: { btn: 48, icon: 15 },
  lg: { btn: 60, icon: 18 },
};

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function RecordButton({
  isRecording,
  onToggle,
  elapsedSeconds,
  disabled = false,
  size = "md",
  className = "",
}: RecordButtonProps) {
  const { btn, icon } = SIZE_MAP[size];
  const [pressed, setPressed] = useState(false);

  // Self-managed timer (used when elapsedSeconds not provided)
  const [internalElapsed, setInternalElapsed] = useState(0);
  useEffect(() => {
    if (!isRecording || elapsedSeconds !== undefined) {
      setInternalElapsed(0);
      return;
    }
    const interval = setInterval(() => setInternalElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isRecording, elapsedSeconds]);

  const displayTime = formatTime(elapsedSeconds ?? internalElapsed);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Record button */}
      <div className="relative flex items-center justify-center">
        <button
          onClick={() => { if (!disabled) onToggle(); }}
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          disabled={disabled}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          aria-pressed={isRecording}
          className="relative flex items-center justify-center rounded-full transition-all duration-150"
          style={{
            width: btn,
            height: btn,
            background: isRecording
              ? "linear-gradient(135deg, rgba(239,68,68,0.35), rgba(185,28,28,0.3))"
              : "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(180,210,255,0.10))",
            border: isRecording
              ? "1.5px solid rgba(239,68,68,0.6)"
              : "1.5px solid rgba(255,255,255,0.2)",
            boxShadow: isRecording
              ? "0 2px 0 rgba(255,100,100,0.2) inset, 0 -1px 0 rgba(120,0,0,0.2) inset, 0 4px 16px rgba(200,0,0,0.25), 0 0 20px rgba(239,68,68,0.15)"
              : "0 2px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 4px 14px rgba(0,30,160,0.2)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.45 : 1,
            transform: pressed ? "translateY(1px) scale(0.96)" : "translateY(0) scale(1)",
          }}
        >
          {isRecording ? (
            /* Stop square */
            <div
              style={{
                width: icon * 0.65,
                height: icon * 0.65,
                background: "#ef4444",
                borderRadius: 3,
                boxShadow: "0 0 8px rgba(239,68,68,0.6)",
              }}
            />
          ) : (
            /* Record dot */
            <div
              style={{
                width: icon,
                height: icon,
                background: "rgba(255,255,255,0.85)",
                borderRadius: "50%",
              }}
            />
          )}
        </button>

        {/* Pulsing ring when recording */}
        {isRecording && (
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: btn + 12,
              height: btn + 12,
              border: "1.5px solid rgba(239,68,68,0.4)",
              animation: "recordPulse 1.4s ease-out infinite",
            }}
          />
        )}
      </div>

      {/* Live timer — only shown while recording */}
      {isRecording && (
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span
            className="inline-block rounded-full"
            style={{
              width: 6, height: 6,
              background: "#ef4444",
              animation: "recordDot 1s ease-in-out infinite",
              flexShrink: 0,
            }}
          />
          <span
            className="text-xs tabular-nums"
            style={{
              color: "#fca5a5",
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 500,
              letterSpacing: "0.06em",
            }}
          >
            {displayTime}
          </span>
        </div>
      )}

      <style>{`
        @keyframes recordPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.5); opacity: 0;   }
        }
        @keyframes recordDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}