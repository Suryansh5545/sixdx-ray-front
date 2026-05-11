import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { createMeetingRoom } from "../lib/meeting/roomService";
import {
  RecordingThemeBackdrop,
  getRecordingThemeInputStyle,
  recordingThemeDangerPillButtonStyle,
  recordingThemeErrorTextStyle,
  recordingThemeMutedTextStyle,
  recordingThemePageStyle,
  recordingThemePillButtonStyle,
  recordingThemePrimaryButtonStyle,
  recordingThemeSecondaryActiveButtonStyle,
  recordingThemeSecondaryButtonStyle,
  recordingThemeSubtleTextStyle,
  recordingThemeSurfaceStrongStyle,
} from "../components/ui/recordingTheme";

type Mode = "idle" | "join" | "create";
type Status = "idle" | "loading" | "error";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""),
  ).join("-");
}

const ROOM_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i;

function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
}

function useCameraPreview() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream;

    (async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(activeStream);
      } catch {
        setError("Camera or microphone is unavailable. You can still join the room.");
      }
    })();

    return () => {
      activeStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleMic = useCallback(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = isMuted;
    });
    setIsMuted((current) => !current);
  }, [isMuted, stream]);

  const toggleCamera = useCallback(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = isCameraOff;
    });
    setIsCameraOff((current) => !current);
  }, [isCameraOff, stream]);

  return { stream, error, isMuted, isCameraOff, toggleMic, toggleCamera };
}

function CameraPreview({
  stream,
  isMuted,
  isCameraOff,
  onToggleMic,
  onToggleCamera,
  previewError,
}: {
  stream: MediaStream | null;
  isMuted: boolean;
  isCameraOff: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  previewError: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      className="relative flex w-full flex-col overflow-hidden rounded-[28px]"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 24px 60px rgba(2,8,22,0.36)",
        aspectRatio: "16 / 10",
        minHeight: 320,
      }}
    >
      {!isCameraOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at center, rgba(79,179,255,0.16) 0%, rgba(5,10,25,0.2) 36%, rgba(5,10,25,0.86) 100%)",
          }}
        >
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{
              background: "rgba(79,179,255,0.16)",
              border: "1px solid rgba(79,179,255,0.24)",
              color: "#90caff",
            }}
          >
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
        </div>
      )}

      {previewError && (
        <div
          className="absolute left-4 right-4 top-4 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs"
          style={{
            background: "rgba(127,29,29,0.34)",
            border: "1px solid rgba(248,113,113,0.24)",
            color: "rgba(254,202,202,0.92)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {previewError}
        </div>
      )}

      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 px-4 py-4"
        style={{
          background: "linear-gradient(180deg, transparent 0%, rgba(4,10,24,0.78) 100%)",
        }}
      >
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          className="preview-toggle flex h-11 w-11 items-center justify-center rounded-full"
          style={isMuted ? recordingThemeDangerPillButtonStyle : recordingThemePillButtonStyle}
        >
          {isMuted ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
          className="preview-toggle flex h-11 w-11 items-center justify-center rounded-full"
          style={isCameraOff ? recordingThemeDangerPillButtonStyle : recordingThemePillButtonStyle}
        >
          {isCameraOff ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="23 7 16 12 23 17 23 7" />
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Room() {
  const navigate = useNavigate();
  const { logout } = useAppContext();

  const [mode, setMode] = useState<Mode>("idle");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState("");
  const [joinCodeTouched, setJoinCodeTouched] = useState(false);
  const [joinCodeFocused, setJoinCodeFocused] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [generatedCode] = useState(generateRoomCode);
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [mounted, setMounted] = useState(false);

  const { stream, error: camError, isMuted, isCameraOff, toggleMic, toggleCamera } =
    useCameraPreview();

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  function handleLogout() {
    logout();
    navigate("/");
  }

  async function reserveRoom() {
    const roomCode = await createMeetingRoom();
    setCreatedRoomCode(roomCode);
    return roomCode;
  }

  async function openCreateMode() {
    setMode("create");
    setStatus("loading");
    setCreateError("");
    setCreatedRoomCode(null);

    try {
      await reserveRoom();
      setStatus("idle");
    } catch {
      setStatus("error");
      setCreateError("Could not create a meeting room. Please try again.");
    }
  }

  function resetCreateMode() {
    setMode("idle");
    setStatus("idle");
    setCreateError("");
    setCreatedRoomCode(null);
  }

  function handleCodeInput(event: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCode(event.target.value);
    setJoinCode(formatted);
    if (joinCodeTouched) {
      setJoinCodeError(ROOM_CODE_REGEX.test(formatted) ? "" : "Enter a valid code like ABC-123-XYZ");
    }
  }

  function handleCodeBlur() {
    setJoinCodeTouched(true);
    setJoinCodeFocused(false);
    setJoinCodeError(ROOM_CODE_REGEX.test(joinCode) ? "" : "Enter a valid code like ABC-123-XYZ");
  }

  async function handleCreate() {
    setStatus("loading");
    setCreateError("");

    try {
      const roomCode = createdRoomCode ?? (await reserveRoom());
      navigate("/meetings", {
        state: { roomCode, isMuted, isCameraOff },
      });
    } catch {
      setStatus("error");
      setCreateError("Could not create a meeting room. Please try again.");
    }
  }

  async function handleJoin() {
    setJoinCodeTouched(true);
    if (!ROOM_CODE_REGEX.test(joinCode)) {
      setJoinCodeError("Enter a valid code like ABC-123-XYZ");
      return;
    }

    navigate("/meetings", {
      state: { roomCode: joinCode.toUpperCase(), isMuted, isCameraOff },
    });
  }

  const isLoading = status === "loading";
  const displayRoomCode =
    createdRoomCode ?? (isLoading ? "Creating..." : createError ? "Unavailable" : generatedCode);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        .anim-header {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.05s;
        }

        .anim-preview {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.12s;
        }

        .anim-panel {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.18s;
        }

        .header-btn,
        .mode-btn,
        .primary-btn,
        .text-link,
        .copy-btn,
        .preview-toggle {
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
        }

        .header-btn:hover,
        .mode-btn:hover,
        .copy-btn:hover,
        .preview-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(2, 8, 22, 0.24);
        }

        .header-btn:active,
        .mode-btn:active,
        .copy-btn:active,
        .preview-toggle:active,
        .text-link:active {
          transform: translateY(1px);
        }

        .primary-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 20px 46px rgba(57, 132, 204, 0.26) !important;
        }

        .primary-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .primary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .text-link:hover {
          color: rgba(255, 255, 255, 0.78) !important;
        }

        .spin-ring {
          border: 2px solid rgba(255, 255, 255, 0.25);
          border-top-color: rgba(4, 18, 31, 0.85);
          border-radius: 999px;
          width: 16px;
          height: 16px;
          animation: spinRing 0.75s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }

        .code-input {
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        .code-input:hover:not(:focus) {
          border-color: rgba(255, 255, 255, 0.16) !important;
          background: rgba(255, 255, 255, 0.065) !important;
        }
      `}</style>

      <div className="relative min-h-screen w-full overflow-hidden" style={recordingThemePageStyle}>
        <RecordingThemeBackdrop />

        <div className="relative z-10 flex min-h-screen flex-col px-5 py-6 sm:px-6 sm:py-8">
          <header className={`mx-auto flex w-full max-w-6xl items-center justify-between gap-4 ${mounted ? "anim-header" : "opacity-0"}`}>
            <img src="/SixDX White.svg" alt="SixDX" style={{ height: 28 }} />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/recordings")}
                className="header-btn rounded-xl px-4 py-2 text-sm"
                style={{ ...recordingThemePillButtonStyle, cursor: "pointer" }}
              >
                Recordings
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="header-btn rounded-xl px-4 py-2 text-sm"
                style={{ ...recordingThemeDangerPillButtonStyle, cursor: "pointer" }}
              >
                Log out
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 items-center py-8">
            <div className="grid w-full gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
              <div className={mounted ? "anim-preview" : "opacity-0"}>
                <CameraPreview
                  stream={stream}
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  onToggleMic={toggleMic}
                  onToggleCamera={toggleCamera}
                  previewError={camError}
                />
              </div>

              <section
                className={`rounded-[28px] p-6 sm:p-8 ${mounted ? "anim-panel" : "opacity-0"}`}
                style={recordingThemeSurfaceStrongStyle}
              >
                <div className="mb-6">
                  <div
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                    style={{
                      ...recordingThemePillButtonStyle,
                      color: "#90caff",
                    }}
                  >
                    Room controls
                  </div>
                  <h1 className="mt-4 text-3xl font-semibold text-white">
                    {mode === "idle" && "Ready to meet?"}
                    {mode === "create" && (isLoading ? "Preparing your room" : "Your room is ready")}
                    {mode === "join" && "Join a meeting"}
                  </h1>
                  <p className="mt-3 text-sm leading-6" style={recordingThemeMutedTextStyle}>
                    {mode === "idle" && "Create a new room or join one with a meeting code."}
                    {mode === "create" &&
                      (isLoading
                        ? "Creating a backend room and reserving its final code."
                        : "Share the room code below with everyone who needs to join.")}
                    {mode === "join" && "Enter the exact room code you received from the host."}
                  </p>
                </div>

                {mode === "idle" && (
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        void openCreateMode();
                      }}
                      className="mode-btn flex w-full items-center justify-between rounded-[24px] px-5 py-4 text-left"
                      style={recordingThemeSecondaryActiveButtonStyle}
                    >
                      <div>
                        <p className="text-base font-semibold text-white">New meeting</p>
                        <p className="mt-1 text-sm" style={recordingThemeSubtleTextStyle}>
                          Reserve a room id first, then enter the live call.
                        </p>
                      </div>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.868v6.263a1 1 0 0 1-1.447.899L15 14" />
                        <path d="M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("join")}
                      className="mode-btn flex w-full items-center justify-between rounded-[24px] px-5 py-4 text-left"
                      style={recordingThemeSecondaryButtonStyle}
                    >
                      <div>
                        <p className="text-base font-semibold text-white">Join with code</p>
                        <p className="mt-1 text-sm" style={recordingThemeSubtleTextStyle}>
                          Enter an existing room code and jump straight in.
                        </p>
                      </div>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                    </button>
                  </div>
                )}

                {mode === "create" && (
                  <div className="flex flex-col gap-4">
                    <div
                      className="rounded-[24px] p-5"
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <p className="text-xs uppercase tracking-[0.18em]" style={recordingThemeSubtleTextStyle}>
                        Meeting code
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <p className="text-2xl font-semibold tracking-[0.22em] text-white">{displayRoomCode}</p>
                        <button
                          type="button"
                          onClick={() => createdRoomCode && navigator.clipboard.writeText(createdRoomCode)}
                          disabled={!createdRoomCode}
                          className="copy-btn rounded-xl px-3 py-2 text-xs"
                          style={{
                            ...recordingThemePillButtonStyle,
                            color: "#90caff",
                            cursor: createdRoomCode ? "pointer" : "not-allowed",
                            opacity: createdRoomCode ? 1 : 0.5,
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={isLoading}
                      className="primary-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                      style={{
                        ...recordingThemePrimaryButtonStyle,
                        cursor: isLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {isLoading ? (
                        <>
                          <span className="spin-ring" />
                          <span>Starting...</span>
                        </>
                      ) : (
                        "Start Meeting"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={resetCreateMode}
                      className="text-link text-left text-sm"
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.48)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Back
                    </button>
                  </div>
                )}

                {mode === "join" && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder="XXX-XXX-XXX"
                        value={joinCode}
                        onChange={handleCodeInput}
                        onFocus={() => setJoinCodeFocused(true)}
                        onBlur={handleCodeBlur}
                        maxLength={11}
                        autoFocus
                        aria-label="Meeting code"
                        aria-invalid={!!joinCodeError}
                        className="code-input w-full rounded-2xl px-4 py-3.5 text-center text-base tracking-[0.22em] text-white placeholder-white/32 outline-none"
                        style={getRecordingThemeInputStyle(joinCodeFocused, !!joinCodeError)}
                      />
                      {joinCodeError && (
                        <p role="alert" className="px-1 text-xs" style={recordingThemeErrorTextStyle}>
                          {joinCodeError}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleJoin}
                      disabled={isLoading}
                      className="primary-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                      style={{
                        ...recordingThemePrimaryButtonStyle,
                        cursor: isLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {isLoading ? (
                        <>
                          <span className="spin-ring" />
                          <span>Joining...</span>
                        </>
                      ) : (
                        "Join Meeting"
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setMode("idle");
                        setJoinCode("");
                        setJoinCodeError("");
                        setJoinCodeTouched(false);
                        setJoinCodeFocused(false);
                      }}
                      className="text-link text-left text-sm"
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,255,255,0.48)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Back
                    </button>
                  </div>
                )}

                {status === "error" && mode !== "join" && (
                  <p className="mt-4 text-sm" style={recordingThemeErrorTextStyle}>
                    {createError || "Something went wrong. Please try again."}
                  </p>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
