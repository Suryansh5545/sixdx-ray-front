import { useState } from "react";
import MicButton from "./MicButton";
import CameraButton from "./CameraButton";
import RecordButton from "./RecordButton";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ControlBarProps {
  /** Mic state */
  isMuted: boolean;
  onToggleMic: () => void;
  audioLevel?: number;

  /** Camera state */
  isCameraOff: boolean;
  onToggleCamera: () => void;

  /** Screen share */
  isScreenSharing: boolean;
  onToggleScreenShare: () => void;

  /** Recording */
  isRecording: boolean;
  onToggleRecord: () => void;
  recordingElapsed?: number;

  /** End call */
  onEndCall: () => void;

  /** Optional: participants count badge */
  participantCount?: number;
  onParticipantsClick?: () => void;

  /** Optional: chat unread badge */
  chatUnread?: number;
  onChatClick?: () => void;

  /** Disable individual controls */
  disableMic?: boolean;
  disableCamera?: boolean;
  disableRecord?: boolean;
  disableScreenShare?: boolean;

  className?: string;
}

// ─── Tooltip wrapper ──────────────────────────────────────────────────────────
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          className="absolute -top-9 px-2.5 py-1 rounded-lg text-xs pointer-events-none whitespace-nowrap z-50"
          style={{
            background: "rgba(5,10,28,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            fontFamily: "'DM Sans', sans-serif",
            animation: "tipFade 0.15s ease both",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Icon button (for generic control actions) ────────────────────────────────
interface IconBtnProps {
  onClick: () => void;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
  badge?: number;
  "aria-label": string;
  children: React.ReactNode;
}

function IconBtn({
  onClick,
  active,
  activeColor = "rgba(30,107,255,0.35)",
  disabled,
  badge,
  "aria-label": ariaLabel,
  children,
}: IconBtnProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-pressed={active}
        className="flex items-center justify-center rounded-full transition-all duration-150"
        style={{
          width: 48,
          height: 48,
          background: active
            ? activeColor
            : "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(180,210,255,0.08))",
          border: active
            ? "1.5px solid rgba(79,179,255,0.5)"
            : "1.5px solid rgba(255,255,255,0.18)",
          boxShadow: active
            ? "0 2px 0 rgba(79,179,255,0.15) inset, 0 4px 14px rgba(0,80,200,0.2)"
            : "0 2px 0 rgba(255,255,255,0.12) inset, 0 -1px 0 rgba(0,20,100,0.12) inset, 0 4px 14px rgba(0,30,160,0.15)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          transform: pressed ? "translateY(1px) scale(0.95)" : "translateY(0) scale(1)",
        }}
      >
        {children}
      </button>

      {/* Badge */}
      {!!badge && badge > 0 && (
        <div
          className="absolute flex items-center justify-center rounded-full text-white"
          style={{
            width: 16, height: 16,
            top: -3, right: -3,
            background: "#1e6bff",
            border: "1.5px solid rgba(10,15,30,0.9)",
            fontSize: "0.6rem",
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {badge > 9 ? "9+" : badge}
        </div>
      )}
    </div>
  );
}

// ─── Main ControlBar ──────────────────────────────────────────────────────────
function ControlBar({
  isMuted,
  onToggleMic,
  audioLevel = 0,
  isCameraOff,
  onToggleCamera,
  isScreenSharing,
  onToggleScreenShare,
  isRecording,
  onToggleRecord,
  recordingElapsed,
  onEndCall,
  participantCount,
  onParticipantsClick,
  chatUnread,
  onChatClick,
  disableMic,
  disableCamera,
  disableRecord,
  disableScreenShare,
  className = "",
}: ControlBarProps) {
  return (
    <>
      <style>{`
        @keyframes tipFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        className={`flex items-center justify-center gap-3 px-5 py-3 ${className}`}
        style={{
          background: "linear-gradient(to bottom, rgba(8,14,36,0.85), rgba(5,10,28,0.95))",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          boxShadow: "0 8px 32px rgba(0,10,60,0.5), 0 1px 0 rgba(255,255,255,0.06) inset",
        }}
        role="toolbar"
        aria-label="Meeting controls"
      >
        {/* Mic */}
        <Tip label={isMuted ? "Unmute" : "Mute"}>
          <MicButton
            isMuted={isMuted}
            onToggle={onToggleMic}
            audioLevel={audioLevel}
            disabled={disableMic}
            size="md"
          />
        </Tip>

        {/* Camera */}
        <Tip label={isCameraOff ? "Start video" : "Stop video"}>
          <CameraButton
            isCameraOff={isCameraOff}
            onToggle={onToggleCamera}
            disabled={disableCamera}
            size="md"
          />
        </Tip>

        {/* Screen share */}
        <Tip label={isScreenSharing ? "Stop sharing" : "Share screen"}>
          <IconBtn
            onClick={onToggleScreenShare}
            active={isScreenSharing}
            disabled={disableScreenShare}
            aria-label={isScreenSharing ? "Stop screen share" : "Share screen"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={isScreenSharing ? "#4fb3ff" : "rgba(255,255,255,0.85)"}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </IconBtn>
        </Tip>

        {/* Record */}
        <Tip label={isRecording ? "Stop recording" : "Record"}>
          <RecordButton
            isRecording={isRecording}
            onToggle={onToggleRecord}
            elapsedSeconds={recordingElapsed}
            disabled={disableRecord}
            size="md"
          />
        </Tip>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

        {/* Participants */}
        {onParticipantsClick && (
          <Tip label="Participants">
            <IconBtn
              onClick={onParticipantsClick}
              badge={participantCount}
              aria-label="Show participants"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
            </IconBtn>
          </Tip>
        )}

        {/* Chat */}
        {onChatClick && (
          <Tip label="Chat">
            <IconBtn
              onClick={onChatClick}
              badge={chatUnread}
              aria-label="Open chat"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.8)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </IconBtn>
          </Tip>
        )}

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />

        {/* End call */}
        <Tip label="End call">
          <button
            onClick={onEndCall}
            aria-label="End call"
            className="flex items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, rgba(239,68,68,0.55), rgba(185,28,28,0.5))",
              border: "1.5px solid rgba(239,68,68,0.6)",
              boxShadow: "0 2px 0 rgba(255,120,120,0.2) inset, 0 -1px 0 rgba(120,0,0,0.25) inset, 0 6px 0 rgba(160,0,0,0.25), 0 8px 20px rgba(200,0,0,0.3)",
              cursor: "pointer",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.43 9.68 19.79 19.79 0 01.36 1.05 2 2 0 012.34 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.32 8.91"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </Tip>
      </div>
    </>
  );
}

export default ControlBar;