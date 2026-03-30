import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Recording {
  id: string;
  title: string;
  roomId: string;
  startedAt: string;      // ISO date string
  durationSeconds: number;
  sizeBytes?: number;
  thumbnailUrl?: string;
  downloadUrl?: string;
  streamUrl?: string;     // HLS / direct MP4 for playback
  recordedBy: string;
  participants: string[]; // names
  status: "processing" | "ready" | "failed";
}

interface RecordingPageProps {
  /**
   * Fetch recordings from your backend.
   * Replace the default stub with a real API call.
   */
  fetchRecordings?: () => Promise<Recording[]>;
  /**
   * Delete a recording by ID on your backend.
   */
  deleteRecording?: (id: string) => Promise<void>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ─── Default stub — replace with real API call ────────────────────────────────
async function defaultFetchRecordings(): Promise<Recording[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 900));
  return [
    {
      id: "rec-001",
      title: "Weekly Sync",
      roomId: "room-abc",
      startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      durationSeconds: 3247,
      sizeBytes: 184 * 1024 * 1024,
      recordedBy: "Jordan Riley",
      participants: ["Jordan Riley", "Sofia M.", "Kai T.", "Alex B."],
      status: "ready",
    },
    {
      id: "rec-002",
      title: "Design Review",
      roomId: "room-def",
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      durationSeconds: 1820,
      sizeBytes: 98 * 1024 * 1024,
      recordedBy: "Sofia M.",
      participants: ["Sofia M.", "Jordan Riley"],
      status: "ready",
    },
    {
      id: "rec-003",
      title: "Q3 Planning",
      roomId: "room-ghi",
      startedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      durationSeconds: 0,
      recordedBy: "Kai T.",
      participants: ["Kai T.", "Alex B.", "Jordan Riley", "Sam W.", "Riley P."],
      status: "processing",
    },
    {
      id: "rec-004",
      title: "Client Onboarding",
      roomId: "room-jkl",
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      durationSeconds: 2640,
      sizeBytes: 142 * 1024 * 1024,
      recordedBy: "Alex B.",
      participants: ["Alex B.", "Client User"],
      status: "failed",
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Video player modal */
function PlayerModal({
  recording,
  onClose,
}: {
  recording: Recording;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  }, []);

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setCurrentTime(v.currentTime);
    setProgress(v.currentTime / v.duration);
  }

  function handleLoadedMetadata() {
    const v = videoRef.current;
    if (v) setDuration(v.duration);
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const t = Number(e.target.value) * v.duration;
    v.currentTime = t;
    setProgress(Number(e.target.value));
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, togglePlay]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,5,14,0.92)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col w-full overflow-hidden"
        style={{
          maxWidth: 860,
          background: "linear-gradient(160deg, #080f22, #050c1c)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 20,
          boxShadow: "0 32px 80px rgba(0,10,60,0.6)",
        }}
      >
        {/* Modal header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div>
            <p className="text-white font-medium text-sm">{recording.title}</p>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {formatDate(recording.startedAt)} · {recording.roomId}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close player"
            className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
            style={{
              width: 32, height: 32,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.6)" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Video area */}
        <div
          className="relative w-full cursor-pointer"
          style={{ background: "#000", aspectRatio: "16/9" }}
          onClick={togglePlay}
        >
          {recording.streamUrl ? (
            <video
              ref={videoRef}
              src={recording.streamUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setPlaying(false)}
            />
          ) : (
            /* No stream URL — placeholder */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="flex items-center justify-center rounded-2xl"
                style={{
                  width: 64, height: 64,
                  background: "rgba(30,107,255,0.15)",
                  border: "1px solid rgba(79,179,255,0.2)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(79,179,255,0.5)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                No stream URL — wire <code style={{ color: "rgba(79,179,255,0.6)" }}>recording.streamUrl</code> to play
              </p>
            </div>
          )}

          {/* Play/pause overlay */}
          {recording.streamUrl && !playing && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 56, height: 56,
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Player controls */}
        <div className="px-5 py-4 space-y-3">
          {/* Progress bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs tabular-nums w-10 text-right"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
              {formatDuration(Math.floor(currentTime))}
            </span>
            <div className="flex-1 relative h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full"
                style={{
                  width: `${progress * 100}%`,
                  background: "linear-gradient(to right, #1e6bff, #4fb3ff)",
                  transition: "width 0.1s linear",
                }}
              />
              <input
                type="range" min={0} max={1} step={0.001}
                value={progress}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                aria-label="Seek"
              />
            </div>
            <span className="text-xs tabular-nums w-10"
              style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'DM Sans', sans-serif" }}>
              {formatDuration(Math.floor(duration))}
            </span>
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pause" : "Play"}
              className="flex items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
              style={{
                width: 40, height: 40,
                background: "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(180,210,255,0.10))",
                border: "1.5px solid rgba(255,255,255,0.18)",
                boxShadow: "0 2px 0 rgba(255,255,255,0.12) inset, 0 4px 14px rgba(0,30,160,0.15)",
                cursor: "pointer",
              }}
            >
              {playing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.85)" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="4" x2="6" y2="20"/>
                  <line x1="18" y1="4" x2="18" y2="20"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" stroke="none">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              )}
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.5)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                {muted || volume === 0 ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <line x1="23" y1="9" x2="17" y2="15"/>
                    <line x1="17" y1="9" x2="23" y2="15"/>
                  </>
                ) : volume < 0.5 ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M15.54 8.46a5 5 0 010 7.07"/>
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                  </>
                )}
              </svg>
            </button>

            <input
              type="range" min={0} max={1} step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolume}
              aria-label="Volume"
              className="w-20 h-1 rounded-full cursor-pointer"
              style={{ accentColor: "#4fb3ff" }}
            />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Download */}
            {recording.downloadUrl && (
              <a
                href={recording.downloadUrl}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(30,107,255,0.2)",
                  border: "1px solid rgba(79,179,255,0.3)",
                  color: "#90caff",
                  textDecoration: "none",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single recording card */
function RecordingCard({
  recording,
  onPlay,
  onDelete,
}: {
  recording: Recording;
  onPlay: (r: Recording) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusConfig = {
    ready:      { label: "Ready",      color: "#22c55e", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.25)"  },
    processing: { label: "Processing", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)" },
    failed:     { label: "Failed",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.25)"  },
  }[recording.status];

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:translate-y-[-2px]"
      style={{
        background: "linear-gradient(160deg, rgba(10,18,40,0.9), rgba(6,12,28,0.95))",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,10,60,0.35)",
      }}
    >
      {/* Thumbnail / placeholder */}
      <div
        className="relative w-full flex-shrink-0"
        style={{ aspectRatio: "16/9", background: "#040a18", cursor: recording.status === "ready" ? "pointer" : "default" }}
        onClick={() => recording.status === "ready" && onPlay(recording)}
      >
        {recording.thumbnailUrl ? (
          <img
            src={recording.thumbnailUrl}
            alt={recording.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "radial-gradient(ellipse at center, rgba(20,50,150,0.2) 0%, transparent 70%)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polygon points="10 8 16 12 10 16 10 8"/>
            </svg>
          </div>
        )}

        {/* Duration badge */}
        {recording.status === "ready" && recording.durationSeconds > 0 && (
          <div
            className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-xs tabular-nums"
            style={{
              background: "rgba(0,0,0,0.7)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'DM Sans', sans-serif",
              backdropFilter: "blur(4px)",
            }}
          >
            {formatDuration(recording.durationSeconds)}
          </div>
        )}

        {/* Processing overlay */}
        {recording.status === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
            <div style={{
              width: 28, height: 28,
              border: "2px solid rgba(245,158,11,0.2)",
              borderTopColor: "#f59e0b",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <span className="text-xs" style={{ color: "rgba(245,158,11,0.8)" }}>Processing…</span>
          </div>
        )}

        {/* Play overlay on hover */}
        {recording.status === "ready" && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 44, height: 44,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {/* Title + status */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'DM Sans', sans-serif" }}>
            {recording.title}
          </p>
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0"
            style={{
              background: statusConfig.bg,
              border: `1px solid ${statusConfig.border}`,
              color: statusConfig.color,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "0.65rem",
              letterSpacing: "0.04em",
            }}
          >
            {recording.status === "processing" && (
              <span className="inline-block rounded-full"
                style={{ width: 5, height: 5, background: statusConfig.color, animation: "recordDot 1s ease-in-out infinite" }} />
            )}
            {statusConfig.label}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* Date */}
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>
            {formatDate(recording.startedAt)}
          </span>
          {/* Size */}
          {recording.sizeBytes && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              {formatSize(recording.sizeBytes)}
            </span>
          )}
        </div>

        {/* Recorded by */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex items-center justify-center rounded-full text-xs font-semibold"
            style={{
              width: 20, height: 20,
              background: "linear-gradient(135deg, #1e6bff, #0099ff)",
              color: "white",
              fontSize: "0.55rem",
              letterSpacing: "0.02em",
              flexShrink: 0,
            }}
          >
            {recording.recordedBy.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            {recording.recordedBy}
          </span>
          {recording.participants.length > 1 && (
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
              +{recording.participants.length - 1} more
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          {/* Play */}
          {recording.status === "ready" && (
            <button
              onClick={() => onPlay(recording)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs flex-1 justify-center transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(180,210,255,0.08))",
                border: "1.5px solid rgba(255,255,255,0.16)",
                boxShadow: "0 2px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(0,30,160,0.15)",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Play
            </button>
          )}

          {/* Download */}
          {recording.downloadUrl && recording.status === "ready" && (
            <a
              href={recording.downloadUrl}
              download
              className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-80"
              style={{
                width: 36, height: 36,
                background: "rgba(30,107,255,0.15)",
                border: "1px solid rgba(79,179,255,0.25)",
                color: "#90caff",
                textDecoration: "none",
              }}
              aria-label="Download recording"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </a>
          )}

          {/* Delete */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onDelete(recording.id)}
                className="px-2.5 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-80"
                style={{
                  background: "rgba(239,68,68,0.25)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#fca5a5",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-70"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-70"
              style={{
                width: 36, height: 36,
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "rgba(239,68,68,0.6)",
                cursor: "pointer",
              }}
              aria-label="Delete recording"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RecordingPage({
  fetchRecordings = defaultFetchRecordings,
  deleteRecording,
}: RecordingPageProps) {
  const navigate = useNavigate();
  const { setCurrentPage } = useAppContext();

  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingRecording, setPlayingRecording] = useState<Recording | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "ready" | "processing" | "failed">("all");
  const [sortBy, setSortBy] = useState<"date" | "duration" | "size">("date");

  // ── Load recordings ──
  useEffect(() => {
    setCurrentPage("recordings");
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecordings()
      .then((data) => { if (!cancelled) { setRecordings(data); setLoading(false); } })
      .catch(() => { if (!cancelled) { setError("Failed to load recordings. Please try again."); setLoading(false); } });
    return () => { cancelled = true; };
  }, [fetchRecordings, setCurrentPage]);

  // ── Delete handler ──
  async function handleDelete(id: string) {
    try {
      await deleteRecording?.(id);
      setRecordings((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("Could not delete recording. Please try again.");
    }
  }

  // ── Filtered + sorted recordings ──
  const displayed = recordings
    .filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          r.roomId.toLowerCase().includes(q) ||
          r.recordedBy.toLowerCase().includes(q) ||
          r.participants.some((p) => p.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      if (sortBy === "duration") return b.durationSeconds - a.durationSeconds;
      if (sortBy === "size") return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      return 0;
    });

  const counts = {
    all: recordings.length,
    ready: recordings.filter((r) => r.status === "ready").length,
    processing: recordings.filter((r) => r.status === "processing").length,
    failed: recordings.filter((r) => r.status === "failed").length,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');

        @font-face {
          font-family: 'Ethnocentric';
          src: url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff2') format('woff2'),
               url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff') format('woff');
          font-weight: normal;
          font-style: normal;
        }

        .rec-root * { box-sizing: border-box; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes recordDot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .rec-card-anim { animation: fadeUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }

        .filter-pill {
          transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          cursor: pointer;
        }
        .filter-pill:hover { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      <div
        className="rec-root flex flex-col w-full min-h-screen"
        style={{
          background: "linear-gradient(160deg, #07111f 0%, #060d1c 50%, #040a18 100%)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 py-3 flex-shrink-0 sticky top-0 z-40"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(5,10,25,0.8)",
            backdropFilter: "blur(16px)",
          }}
        >
          <img src="/SixDX White.svg" alt="SixDX" style={{ height: 28 }} />

          <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
            Recordings
          </span>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.4)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back
          </button>
        </header>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="flex-1 px-5 py-6 max-w-6xl mx-auto w-full">

          {/* Page title + stats row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h1 className="text-xl font-semibold text-white mb-1">
                Recordings
              </h1>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                {counts.all} total · {counts.ready} ready · {counts.processing} processing
              </p>
            </div>

            {/* Sort control */}
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Sort:</span>
              {(["date", "duration", "size"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className="filter-pill px-3 py-1.5 rounded-full text-xs capitalize"
                  style={{
                    background: sortBy === s ? "rgba(30,107,255,0.25)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${sortBy === s ? "rgba(79,179,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                    color: sortBy === s ? "#90caff" : "rgba(255,255,255,0.45)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Search */}
            <div className="relative flex-1">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                placeholder="Search recordings…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.3)";
                  e.target.style.background = "rgba(255,255,255,0.08)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(255,255,255,0.1)";
                  e.target.style.background = "rgba(255,255,255,0.05)";
                }}
              />
            </div>

            {/* Status filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "ready", "processing", "failed"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="filter-pill px-3 py-2 rounded-xl text-xs capitalize flex items-center gap-1.5"
                  style={{
                    background: filter === f ? "rgba(30,107,255,0.2)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${filter === f ? "rgba(79,179,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: filter === f ? "#90caff" : "rgba(255,255,255,0.4)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {f}
                  <span
                    className="px-1.5 py-0.5 rounded-full text-xs"
                    style={{
                      background: filter === f ? "rgba(79,179,255,0.2)" : "rgba(255,255,255,0.08)",
                      color: filter === f ? "#90caff" : "rgba(255,255,255,0.3)",
                      fontSize: "0.6rem",
                    }}
                  >
                    {counts[f]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── States ── */}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div style={{
                width: 36, height: 36,
                border: "2px solid rgba(79,179,255,0.15)",
                borderTopColor: "#4fb3ff",
                borderRadius: "50%",
                animation: "spin 0.85s linear infinite",
              }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                Loading recordings…
              </p>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "rgba(255,160,160,0.9)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span className="text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                style={{ marginLeft: "auto", background: "none", border: "none",
                  color: "inherit", cursor: "pointer", opacity: 0.5 }}
              >×</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && displayed.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div
                className="flex items-center justify-center rounded-2xl"
                style={{
                  width: 56, height: 56,
                  background: "rgba(30,107,255,0.1)",
                  border: "1px solid rgba(79,179,255,0.15)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(79,179,255,0.4)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="10 8 16 12 10 16 10 8"/>
                </svg>
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                {search ? "No recordings match your search." : "No recordings yet."}
              </p>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && displayed.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayed.map((rec, i) => (
                <div
                  key={rec.id}
                  className="rec-card-anim"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <RecordingCard
                    recording={rec}
                    onPlay={setPlayingRecording}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Player modal ── */}
      {playingRecording && (
        <PlayerModal
          recording={playingRecording}
          onClose={() => setPlayingRecording(null)}
        />
      )}
    </>
  );
}