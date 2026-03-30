import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ScreenShareProps {
  /** The MediaStream from getDisplayMedia() */
  stream: MediaStream | null;
  /** Name of who is sharing */
  sharerName: string;
  /** Whether the local user is the one sharing */
  isLocalSharer?: boolean;
  /** Called when local user stops sharing */
  onStopShare?: () => void;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
function ScreenShare({
  stream,
  sharerName,
  isLocalSharer = false,
  onStopShare,
  className = "",
}: ScreenShareProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl group ${className}`}
      style={{
        background: "#060d1e",
        border: "1px solid rgba(79,179,255,0.25)",
        boxShadow: "0 0 48px rgba(0,50,200,0.2), 0 8px 32px rgba(0,10,60,0.5)",
        aspectRatio: stream ? "16/9" : undefined,
        minHeight: stream ? undefined : 240,
      }}
    >
      {stream ? (
        <>
          {/* Screen video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {/* Top overlay — sharer info */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{
              background: "linear-gradient(to bottom, rgba(0,5,20,0.85), transparent)",
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 28, height: 28,
                  background: "rgba(30,107,255,0.3)",
                  border: "1px solid rgba(79,179,255,0.4)",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#4fb3ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <span
                className="text-sm text-white/80"
                style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}
              >
                {isLocalSharer ? "You are sharing your screen" : `${sharerName} is sharing their screen`}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="flex items-center justify-center rounded-xl transition-all duration-150 hover:scale-110"
                style={{
                  width: 32, height: 32,
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  cursor: "pointer",
                }}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
                  </svg>
                )}
              </button>

              {/* Stop sharing (only for local sharer) */}
              {isLocalSharer && onStopShare && (
                <button
                  onClick={onStopShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 hover:scale-105"
                  style={{
                    background: "rgba(239,68,68,0.25)",
                    border: "1px solid rgba(239,68,68,0.45)",
                    color: "#fca5a5",
                    backdropFilter: "blur(8px)",
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: "pointer",
                  }}
                  aria-label="Stop sharing screen"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                  </svg>
                  Stop sharing
                </button>
              )}
            </div>
          </div>

          {/* Persistent bottom label */}
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
            style={{
              background: "rgba(30,107,255,0.3)",
              border: "1px solid rgba(79,179,255,0.35)",
              backdropFilter: "blur(8px)",
              color: "#90caff",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.68rem",
              letterSpacing: "0.04em",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: "#4fb3ff", animation: "screenSharePulse 1.5s ease-in-out infinite" }}
            />
            SCREEN SHARE
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div
            className="flex items-center justify-center rounded-2xl"
            style={{
              width: 56, height: 56,
              background: "rgba(30,107,255,0.15)",
              border: "1px solid rgba(79,179,255,0.2)",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="rgba(79,179,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <p className="text-white/30 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            No screen share active
          </p>
        </div>
      )}

      <style>{`
        @keyframes screenSharePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default ScreenShare;