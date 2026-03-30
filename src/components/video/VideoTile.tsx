import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Participant {
  id: string;
  name: string;
  /** Live MediaStream from WebRTC / backend */
  stream?: MediaStream | null;
  /** Static avatar fallback (URL or initials will be derived from name) */
  avatarUrl?: string;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing?: boolean;
  screenShareStream?: MediaStream | null;
  isSpeaking?: boolean;
  isLocal?: boolean;
  /** Connection quality: 0–3 (0 = disconnected, 3 = excellent) */
  connectionQuality?: 0 | 1 | 2 | 3;
}

export interface VideoTileProps {
  participant: Participant;
  /** Whether this tile is pinned / spotlighted (larger display) */
  isPinned?: boolean;
  /** Show the pin toggle button on hover */
  onPin?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function qualityColor(q: 0 | 1 | 2 | 3): string {
  return ["#ef4444", "#f97316", "#eab308", "#22c55e"][q];
}

// ─── Component ────────────────────────────────────────────────────────────────
function VideoTile({
  participant,
  isPinned = false,
  onPin,
  className = "",
  style,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<string>("16/9");

  // Attach MediaStream to <video> whenever it changes
  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  // Detect natural aspect ratio from the stream once metadata loads
  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (v && v.videoWidth && v.videoHeight) {
      setAspectRatio(`${v.videoWidth}/${v.videoHeight}`);
    }
  }

  const showVideo = !participant.isCameraOff && !!participant.stream;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl select-none ${className}`}
      style={{
        background: "linear-gradient(135deg, #0d1a3a 0%, #091228 100%)",
        border: participant.isSpeaking
          ? "2px solid rgba(79,179,255,0.8)"
          : isPinned
          ? "2px solid rgba(79,179,255,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: participant.isSpeaking
          ? "0 0 0 3px rgba(79,179,255,0.2), 0 8px 32px rgba(0,30,120,0.5)"
          : "0 4px 24px rgba(0,10,60,0.4)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        aspectRatio,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Video stream ── */}
      {showVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          onLoadedMetadata={handleLoadedMetadata}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: participant.isLocal ? "scaleX(-1)" : "none" }}
        />
      ) : (
        /* ── Avatar fallback ── */
        <div className="absolute inset-0 flex items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at center, rgba(30,80,200,0.25) 0%, transparent 70%)",
          }}
        >
          {participant.avatarUrl ? (
            <img
              src={participant.avatarUrl}
              alt={participant.name}
              className="w-16 h-16 rounded-full object-cover"
              style={{ border: "2px solid rgba(255,255,255,0.15)" }}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-full text-white font-semibold text-xl"
              style={{
                width: 64,
                height: 64,
                background: "linear-gradient(135deg, #1e6bff, #0099ff)",
                border: "2px solid rgba(255,255,255,0.2)",
                fontFamily: "'DM Sans', sans-serif",
                letterSpacing: "0.04em",
              }}
            >
              {getInitials(participant.name)}
            </div>
          )}
        </div>
      )}

      {/* ── Speaking pulse ring ── */}
      {participant.isSpeaking && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: "inset 0 0 0 2px rgba(79,179,255,0.6)",
            animation: "speakPulse 1.2s ease-in-out infinite",
          }}
        />
      )}

      {/* ── Bottom info bar ── */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
        style={{
          background: "linear-gradient(to top, rgba(0,5,20,0.85) 0%, transparent 100%)",
        }}
      >
        {/* Name */}
        <span
          className="text-xs text-white/90 truncate max-w-[70%]"
          style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
        >
          {participant.name}
          {participant.isLocal && (
            <span className="ml-1 text-white/40">(You)</span>
          )}
        </span>

        {/* Status icons */}
        <div className="flex items-center gap-1.5">
          {/* Mute indicator */}
          {participant.isMuted && (
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 20, height: 20,
                background: "rgba(239,68,68,0.25)",
                border: "1px solid rgba(239,68,68,0.4)",
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
          )}

          {/* Connection quality bars */}
          {participant.connectionQuality !== undefined && (
            <div className="flex items-end gap-px" style={{ height: 14 }}>
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  style={{
                    width: 3,
                    height: 4 + level * 3,
                    borderRadius: 1.5,
                    background:
                      (participant.connectionQuality ?? 0) >= level
                        ? qualityColor(participant.connectionQuality as 0|1|2|3)
                        : "rgba(255,255,255,0.15)",
                    transition: "background 0.3s ease",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Hover overlay: pin button ── */}
      {hovered && onPin && (
        <button
          onClick={() => onPin(participant.id)}
          className="absolute top-2 right-2 flex items-center justify-center rounded-xl transition-all duration-150"
          style={{
            width: 28, height: 28,
            background: isPinned ? "rgba(79,179,255,0.3)" : "rgba(0,0,0,0.45)",
            border: isPinned ? "1px solid rgba(79,179,255,0.6)" : "1px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
          title={isPinned ? "Unpin" : "Pin"}
          aria-label={isPinned ? "Unpin participant" : "Pin participant"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke={isPinned ? "#4fb3ff" : "rgba(255,255,255,0.8)"}
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
      )}

      {/* ── Screen share badge ── */}
      {participant.isScreenSharing && (
        <div
          className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs"
          style={{
            background: "rgba(30,107,255,0.35)",
            border: "1px solid rgba(79,179,255,0.4)",
            backdropFilter: "blur(8px)",
            color: "#90caff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "0.65rem",
            letterSpacing: "0.04em",
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Sharing
        </div>
      )}

      <style>{`
        @keyframes speakPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default VideoTile;