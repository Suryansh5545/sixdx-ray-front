import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConnectionState } from "livekit-client";
import { useAppContext } from "../context/AppContext";
import { useMeetingRoom } from "../lib/meeting/useMeetingRoom";

import ControlBar from "../components/meeting/ControlBar";
import VideoGrid from "../components/video/VideoGrid";
import ScreenShare from "../components/video/ScreenShare";
import type { Participant } from "../components/video/VideoTile";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingProps {
  roomId: string;
  localName?: string;
}

// ─── Audio level analyser ─────────────────────────────────────────────────────

function useAudioLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!stream) { setLevel(0); return; }

    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    dataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;

    function tick() {
      if (!analyserRef.current || !dataRef.current) return;
      analyserRef.current.getByteFrequencyData(dataRef.current);
      const avg = dataRef.current.reduce((a, b) => a + b, 0) / dataRef.current.length;
      setLevel(Math.min(avg / 128, 1));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close();
    };
  }, [stream]);

  return level;
}

// ─── Error message map ────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  token: "Could not get meeting credentials. Please try again.",
  connection: "Could not connect to the meeting server.",
  media: "Could not access camera or microphone. Check your permissions.",
  disconnected: "You were disconnected from the meeting.",
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Meeting({ roomId, localName = "You" }: MeetingProps) {
  const navigate = useNavigate();
  const { setCurrentPage } = useAppContext();

  const {
    participants,
    connectionState,
    isMuted,
    isCameraOff,
    isScreenSharing,
    error,
    localVideoStream,
    localAudioStream,
    screenShareStream,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    disconnect,
  } = useMeetingRoom(roomId, localName);

  // ── UI state ──
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const audioLevel = useAudioLevel(isMuted ? null : localAudioStream);

  useEffect(() => {
    setCurrentPage("meetings");
  }, [setCurrentPage]);

  // ── Recording timer ──
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (isRecording) {
      setRecordingElapsed(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingElapsed((s) => s + 1),
        1000,
      );
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
  }, [isRecording]);

  // ── Participant list: local tile prepended to remote participants ──
  const allParticipants: Participant[] = [
    {
      id: "local",
      name: localName,
      stream: localVideoStream,
      isMuted,
      isCameraOff,
      isScreenSharing,
      isLocal: true,
      connectionQuality: 3,
    },
    ...participants,
  ];

  // ── Handlers ──
  const handleToggleMic = useCallback(() => { toggleMic(); }, [toggleMic]);
  const handleToggleCamera = useCallback(() => { toggleCamera(); }, [toggleCamera]);
  const handleToggleScreenShare = useCallback(() => { toggleScreenShare(); }, [toggleScreenShare]);
  const handleToggleRecord = useCallback(() => { setIsRecording((r) => !r); }, []);

  const handleEndCall = useCallback(() => {
    disconnect();
    navigate("/");
  }, [disconnect, navigate]);

  const displayedError = error && error !== dismissedError ? ERROR_MESSAGES[error] ?? null : null;
  const isConnecting = connectionState === ConnectionState.Connecting
    || connectionState === ConnectionState.Reconnecting;

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

        .meeting-root * { box-sizing: border-box; }

        @keyframes connSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div
        className="meeting-root flex flex-col w-full h-screen overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #07111f 0%, #060d1c 50%, #040a18 100%)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(5,10,25,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <img src="/SixDX White.svg" alt="SixDX" style={{ height: 28 }} />

          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.06em",
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: 6, height: 6,
                background: isConnecting ? "#f59e0b" : "#22c55e",
                boxShadow: isConnecting
                  ? "0 0 6px rgba(245,158,11,0.6)"
                  : "0 0 6px rgba(34,197,94,0.6)",
              }}
            />
            {roomId}
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              {allParticipants.length}
            </div>
            <button
              type="button"
              onClick={() => navigate("/recordings")}
              className="flex items-center justify-center rounded-full transition-opacity hover:opacity-80"
              style={{
                width: 32, height: 32,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
              }}
              aria-label="View recordings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.75)" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
            </button>
          </div>
        </header>

        {/* ── Main content ────────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Video area */}
          <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3 min-w-0">

            {/* Local screen share */}
            {isScreenSharing && screenShareStream && (
              <div className="flex-shrink-0" style={{ maxHeight: "45%" }}>
                <ScreenShare
                  stream={screenShareStream}
                  sharerName={localName}
                  isLocalSharer
                  onStopShare={() => { toggleScreenShare(); }}
                  className="w-full h-full"
                />
              </div>
            )}

            {/* Remote screen share */}
            {!isScreenSharing && (() => {
              const sharer = participants.find((p) => p.screenShareStream != null)
              return sharer ? (
                <div className="flex-shrink-0" style={{ maxHeight: "45%" }}>
                  <ScreenShare
                    stream={sharer.screenShareStream!}
                    sharerName={sharer.name}
                    isLocalSharer={false}
                    className="w-full h-full"
                  />
                </div>
              ) : null
            })()}

            <div className="flex-1 min-h-0 overflow-hidden">
              <VideoGrid
                participants={allParticipants}
                layout="auto"
                className="h-full"
              />
            </div>
          </div>

          {/* ── Side panel ──────────────────────────────────────────────── */}
          {(showParticipants || showChat) && (
            <aside
              className="flex-shrink-0 flex flex-col"
              style={{
                width: 260,
                background: "rgba(5,10,25,0.75)",
                backdropFilter: "blur(16px)",
                borderLeft: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.75)" }}>
                  {showParticipants ? "Participants" : "Chat"}
                </span>
                <button
                  onClick={() => { setShowParticipants(false); setShowChat(false); }}
                  className="flex items-center justify-center rounded-lg transition-opacity hover:opacity-70"
                  style={{
                    width: 24, height: 24,
                    background: "rgba(255,255,255,0.07)",
                    border: "none", cursor: "pointer",
                  }}
                  aria-label="Close panel"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.6)" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {showParticipants && (
                <ul className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
                  {allParticipants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)" }}
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-xs font-semibold text-white flex-shrink-0"
                        style={{
                          width: 30, height: 30,
                          background: "linear-gradient(135deg, #1e6bff, #0099ff)",
                          fontSize: "0.65rem", letterSpacing: "0.04em",
                        }}
                      >
                        {p.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </div>
                      <span className="flex-1 text-xs truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
                        {p.name}
                        {p.isLocal && <span style={{ color: "rgba(255,255,255,0.3)" }}> (You)</span>}
                      </span>
                      {p.isMuted && (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                          stroke="rgba(239,68,68,0.7)" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round">
                          <line x1="1" y1="1" x2="23" y2="23"/>
                          <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                          <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
                        </svg>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {showChat && (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-center px-4" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Chat messages will appear here.
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>

        {/* ── Connecting overlay ───────────────────────────────────────────── */}
        {isConnecting && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            style={{ background: "rgba(4,10,24,0.75)", backdropFilter: "blur(8px)" }}
          >
            <div className="flex flex-col items-center gap-3">
              <div style={{
                width: 36, height: 36,
                border: "2px solid rgba(79,179,255,0.2)",
                borderTopColor: "#4fb3ff",
                borderRadius: "50%",
                animation: "connSpin 0.85s linear infinite",
              }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                {connectionState === ConnectionState.Reconnecting ? "Reconnecting…" : "Connecting…"}
              </p>
            </div>
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {displayedError && (
          <div
            className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl text-sm flex items-center gap-2.5 z-50"
            style={{
              background: "rgba(30,10,10,0.85)",
              border: "1px solid rgba(239,68,68,0.35)",
              color: "rgba(255,180,180,0.9)",
              backdropFilter: "blur(12px)",
              maxWidth: 360,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,120,120,0.9)" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {displayedError}
            <button
              onClick={() => setDismissedError(error)}
              style={{
                marginLeft: "auto", background: "none", border: "none",
                color: "rgba(255,255,255,0.4)", cursor: "pointer",
                fontSize: "1rem", lineHeight: 1,
              }}
              aria-label="Dismiss"
            >×</button>
          </div>
        )}

        {/* ── Control bar ──────────────────────────────────────────────────── */}
        <footer
          className="flex items-center justify-center py-4 flex-shrink-0"
          style={{ background: "transparent" }}
        >
          <ControlBar
            isMuted={isMuted}
            onToggleMic={handleToggleMic}
            audioLevel={audioLevel}
            isCameraOff={isCameraOff}
            onToggleCamera={handleToggleCamera}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={handleToggleScreenShare}
            isRecording={isRecording}
            onToggleRecord={handleToggleRecord}
            recordingElapsed={recordingElapsed}
            onEndCall={handleEndCall}
            participantCount={allParticipants.length}
            onParticipantsClick={() => {
              setShowChat(false);
              setShowParticipants((v) => !v);
            }}
            chatUnread={chatUnread}
            onChatClick={() => {
              setShowParticipants(false);
              setChatUnread(0);
              setShowChat((v) => !v);
            }}
          />
        </footer>
      </div>
    </>
  );
}
