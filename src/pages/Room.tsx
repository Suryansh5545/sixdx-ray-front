import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode = "idle" | "join" | "create";
type Status = "idle" | "loading" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 9 }, (_, i) =>
    (i === 3 || i === 6 ? "-" : chars[Math.floor(Math.random() * chars.length)])
  ).join("");
}

// Validate room code: XXX-XXX-XXX (letters + numbers, hyphens allowed)
const ROOM_CODE_REGEX = /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/i;

function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
}

// ─── Camera preview hook ──────────────────────────────────────────────────────
function useCameraPreview() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    let s: MediaStream;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(s);
      } catch {
        setError("Camera/mic unavailable. You can still join.");
      }
    })();
    return () => { s?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const toggleMic = useCallback(() => {
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => { t.enabled = isMuted; });
    setIsMuted((m) => !m);
  }, [stream, isMuted]);

  const toggleCamera = useCallback(() => {
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => { t.enabled = isCameraOff; });
    setIsCameraOff((c) => !c);
  }, [stream, isCameraOff]);

  return { stream, error, isMuted, isCameraOff, toggleMic, toggleCamera };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated mesh gradient — identical to LandingPage */
function MeshGradient() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #ffffff 0%, #daeeff 28%, #9ecfff 42%, #3d8fff 58%, #1155ee 75%, #0930cc 100%)",
        }}
      />
      <div className="absolute" style={{
        top: "38%", left: "-10%", width: "80%", height: "55%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(100,200,255,0.75) 0%, transparent 65%)",
        filter: "blur(32px)", animation: "driftA 9s ease-in-out infinite",
      }} />
      <div className="absolute" style={{
        top: "45%", right: "-15%", width: "75%", height: "50%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(60,120,255,0.65) 0%, transparent 65%)",
        filter: "blur(28px)", animation: "driftB 11s ease-in-out infinite",
      }} />
      <div className="absolute" style={{
        top: "55%", left: "20%", width: "60%", height: "40%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(130,210,255,0.5) 0%, transparent 60%)",
        filter: "blur(22px)", animation: "driftC 13s ease-in-out infinite",
      }} />
    </div>
  );
}

/** Camera preview tile with mic/camera toggle controls */
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
      className="relative overflow-hidden flex flex-col"
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.15)",
        boxShadow:
          "0 2px 0 rgba(255,255,255,0.12) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 8px 0 rgba(100,150,255,0.12), 0 16px 48px rgba(0,30,160,0.3)",
        background: "#060d1e",
        aspectRatio: "16/9",
        width: "100%",
        maxWidth: 420,
      }}
    >
      {/* Video */}
      {!isCameraOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: "radial-gradient(ellipse at center, rgba(20,50,150,0.25) 0%, transparent 70%)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 64, height: 64,
              background: "linear-gradient(135deg, #1e6bff, #0099ff)",
              border: "2px solid rgba(255,255,255,0.2)",
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </div>
      )}

      {/* Error banner */}
      {previewError && (
        <div
          className="absolute top-3 left-3 right-3 px-3 py-2 rounded-xl text-xs flex items-center gap-2"
          style={{
            background: "rgba(239,68,68,0.2)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "rgba(255,180,180,0.9)",
            backdropFilter: "blur(8px)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {previewError}
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 py-3"
        style={{
          background: "linear-gradient(to top, rgba(0,5,20,0.85), transparent)",
        }}
      >
        {/* Mic toggle */}
        <button
          onClick={onToggleMic}
          aria-label={isMuted ? "Unmute" : "Mute"}
          className="flex items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
          style={{
            width: 40, height: 40,
            background: isMuted
              ? "rgba(239,68,68,0.3)"
              : "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(180,210,255,0.1))",
            border: isMuted
              ? "1.5px solid rgba(239,68,68,0.5)"
              : "1.5px solid rgba(255,255,255,0.2)",
            boxShadow: "0 2px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(0,30,160,0.2)",
            backdropFilter: "blur(12px)",
            cursor: "pointer",
          }}
        >
          {isMuted ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
              <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          )}
        </button>

        {/* Camera toggle */}
        <button
          onClick={onToggleCamera}
          aria-label={isCameraOff ? "Turn camera on" : "Turn camera off"}
          className="flex items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
          style={{
            width: 40, height: 40,
            background: isCameraOff
              ? "rgba(239,68,68,0.3)"
              : "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(180,210,255,0.1))",
            border: isCameraOff
              ? "1.5px solid rgba(239,68,68,0.5)"
              : "1.5px solid rgba(255,255,255,0.2)",
            boxShadow: "0 2px 0 rgba(255,255,255,0.1) inset, 0 4px 12px rgba(0,30,160,0.2)",
            backdropFilter: "blur(12px)",
            cursor: "pointer",
          }}
        >
          {isCameraOff ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.85)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Room() {
  const navigate = useNavigate();
  const { setUsername, setSelectedOrg, setIsTestLogin } = useAppContext();

  function handleLogout() {
    setUsername(null);
    setSelectedOrg(null);
    setIsTestLogin(false);
    navigate("/");
  }

  const [mode, setMode] = useState<Mode>("idle");
  const [joinCode, setJoinCode] = useState("");
  const [joinCodeError, setJoinCodeError] = useState("");
  const [joinCodeTouched, setJoinCodeTouched] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [generatedCode] = useState(generateRoomCode);
  const [mounted, setMounted] = useState(false);

  const { stream, error: camError, isMuted, isCameraOff, toggleMic, toggleCamera } =
    useCameraPreview();

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // ── Join code validation ──
  function handleCodeInput(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCode(e.target.value);
    setJoinCode(formatted);
    if (joinCodeTouched) {
      setJoinCodeError(
        ROOM_CODE_REGEX.test(formatted) ? "" : "Enter a valid code (e.g. ABC-123-XYZ)"
      );
    }
  }

  function handleCodeBlur() {
    setJoinCodeTouched(true);
    setJoinCodeError(
      ROOM_CODE_REGEX.test(joinCode) ? "" : "Enter a valid code (e.g. ABC-123-XYZ)"
    );
  }

  // ── Create meeting ──
  async function handleCreate() {
    setStatus("loading");
    try {
      // TODO: call your backend to reserve the room
      // e.g. await api.post("/rooms", { code: generatedCode });
      await new Promise((r) => setTimeout(r, 600)); // simulate latency
      navigate("/meetings", {
        state: { roomCode: generatedCode, isMuted, isCameraOff },
      });
    } catch {
      setStatus("error");
    }
  }

  // ── Join meeting ──
  async function handleJoin() {
    setJoinCodeTouched(true);
    if (!ROOM_CODE_REGEX.test(joinCode)) {
      setJoinCodeError("Enter a valid code (e.g. ABC-123-XYZ)");
      return;
    }
    setStatus("loading");
    try {
      // TODO: validate room exists on your backend
      // e.g. await api.get(`/rooms/${joinCode}`);
      await new Promise((r) => setTimeout(r, 600));
      navigate("/meetings", {
        state: { roomCode: joinCode, isMuted, isCameraOff },
      });
    } catch {
      setStatus("error");
      setJoinCodeError("Room not found. Check the code and try again.");
    }
  }

  const isLoading = status === "loading";
  const joinValid = "D8I-7834";

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
          font-display: swap;
        }

        @keyframes driftA {
          0%, 100% { transform: translate(0%,  0%) scale(1);    }
          33%       { transform: translate(6%,  -4%) scale(1.05); }
          66%       { transform: translate(-4%, 6%)  scale(0.97); }
        }
        @keyframes driftB {
          0%, 100% { transform: translate(0%,  0%) scale(1);    }
          40%       { transform: translate(-8%, 5%)  scale(1.08); }
          75%       { transform: translate(5%,  -3%) scale(0.95); }
        }
        @keyframes driftC {
          0%, 100% { transform: translate(0%, 0%)  scale(1);    }
          50%       { transform: translate(4%, -6%) scale(1.06); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0);    }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        .anim-logo    { animation: fadeSlideUp 0.5s  cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.05s; }
        .anim-preview { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.12s; }
        .anim-panel   { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.2s;  }

        .mode-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .mode-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .mode-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .primary-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .primary-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.9) inset,
            0 -1px 0 rgba(0,10,80,0.25) inset,
            0 8px 0 rgba(180,200,255,0.25),
            0 12px 24px rgba(0,30,160,0.35),
            0 24px 48px rgba(100,160,255,0.2) !important;
        }
        .primary-btn:active:not(:disabled) {
          transform: translateY(2px);
        }
        .primary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .spin-ring {
          border: 2px solid rgba(30,80,200,0.2);
          border-top-color: #1a4dcc;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          animation: spinRing 0.75s linear infinite;
          display: inline-block;
          flex-shrink: 0;
        }

        .code-input:focus {
          border-color: rgba(255,255,255,0.6) !important;
          background: linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, rgba(180,210,255,0.18) 100%) !important;
          box-shadow:
            0 2px 0 rgba(255,255,255,0.25) inset,
            0 -1px 0 rgba(0,20,100,0.2) inset,
            0 6px 0 rgba(100,150,255,0.15),
            0 10px 24px rgba(0,30,160,0.25),
            0 0 0 3px rgba(255,255,255,0.1) !important;
        }

        .back-btn {
          transition: color 0.2s ease;
        }
        .back-btn:hover { color: rgba(255,255,255,0.85) !important; }
      `}</style>

      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <MeshGradient />

        <div className="relative z-10 flex flex-col flex-1 w-full items-center justify-center px-5 py-10 sm:py-14">
          <div className="w-full flex flex-col items-center gap-20" style={{ maxWidth: 860 }}>

          {/* ── Header ── */}
          <div className={`relative flex items-center justify-center w-full ${mounted ? "anim-logo" : "opacity-0"}`}>
            <img src="/SixDX Logo.svg" alt="SixDX" style={{ height: 36 }} />
            <div className="absolute right-5 flex items-center gap-2">
              {/* Recordings */}
              <button
                onClick={() => navigate("/recordings")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: "rgba(255,255,255,0.18)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "rgba(0,0,0,0.6)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polygon points="10 8 16 12 10 16 10 8"/>
                </svg>
                Recordings
              </button>
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-full transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                style={{
                  background: "rgba(239,68,68,0.12)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  color: "rgba(180,40,40,0.85)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </button>
            </div>
          </div>

          {/* ── Main panel ── */}
          <div className="w-full">

            {/* Camera preview + controls side by side on wider screens */}
            <div
              className={`w-full flex flex-col lg:flex-row items-center justify-center gap-5 ${mounted ? "anim-preview" : "opacity-0"}`}
            >
              {/* Camera preview */}
              <div className="w-full lg:w-auto lg:flex-1" style={{ maxWidth: 420 }}>
                <CameraPreview
                  stream={stream}
                  isMuted={isMuted}
                  isCameraOff={isCameraOff}
                  onToggleMic={toggleMic}
                  onToggleCamera={toggleCamera}
                  previewError={camError}
                />
              </div>

              {/* Right panel */}
              <div
                className={`w-full lg:w-auto lg:flex-1 flex flex-col gap-4 ${mounted ? "anim-panel" : "opacity-0"}`}
                style={{ maxWidth: 360 }}
              >

                {/* Heading */}
                <div className="mb-1">
                  <h1
                    className="text-xl font-semibold mb-1"
                    style={{
                      color: mode === "idle" ? "#111" : "rgba(255,255,255,0.9)",
                      fontFamily: "'DM Sans', sans-serif",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {mode === "idle"  && "Ready to meet?"}
                    {mode === "create" && "Your meeting is ready"}
                    {mode === "join"  && "Join a meeting"}
                  </h1>
                  <p
                    className="text-sm"
                    style={{
                      color: mode === "idle" ? "rgba(30,30,80,0.55)" : "rgba(255,255,255,0.45)",
                      transition: "color 0.3s ease",
                    }}
                  >
                    {mode === "idle"   && "Create a new room or join with a code."}
                    {mode === "create" && "Share the code below with others to invite them."}
                    {mode === "join"   && "Enter the meeting code you received."}
                  </p>
                </div>

                {/* ── Idle: two option buttons ── */}
                {mode === "idle" && (
                  <div className="flex flex-col gap-3">
                    {/* Create */}
                    <button
                      onClick={() => setMode("create")}
                      className="mode-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2.5"
                      style={{
                        fontFamily: "'Ethnocentric', sans-serif",
                        background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                        color: "#0a20bb",
                        border: "1.5px solid rgba(255,255,255,0.5)",
                        letterSpacing: "0.04em",
                        boxShadow: `
                          0 2px 0 rgba(255,255,255,0.85) inset,
                          0 -2px 0 rgba(160,185,255,0.4) inset,
                          0 6px 0 rgba(160,185,255,0.3),
                          0 10px 20px rgba(0,30,160,0.3),
                          0 20px 40px rgba(100,160,255,0.15)
                        `,
                        textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.131a1 1 0 01-1.447.899L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"/>
                        <line x1="12" y1="12" x2="12" y2="12"/>
                      </svg>
                      New Meeting
                    </button>

                    {/* Join */}
                    <button
                      onClick={() => setMode("join")}
                      className="mode-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2.5"
                      style={{
                        fontFamily: "'Ethnocentric', sans-serif",
                        background: "linear-gradient(to bottom, rgba(255,255,255,0.16), rgba(140,190,255,0.10))",
                        color: "rgba(255,255,255,0.9)",
                        border: "1.5px solid rgba(255,255,255,0.25)",
                        letterSpacing: "0.04em",
                        boxShadow: `
                          0 2px 0 rgba(255,255,255,0.15) inset,
                          0 -1px 0 rgba(0,20,100,0.15) inset,
                          0 4px 0 rgba(100,150,255,0.1),
                          0 6px 16px rgba(0,30,160,0.18)
                        `,
                        backdropFilter: "blur(14px)",
                        cursor: "pointer",
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/>
                        <polyline points="10 17 15 12 10 7"/>
                        <line x1="15" y1="12" x2="3" y2="12"/>
                      </svg>
                      Join with Code
                    </button>
                  </div>
                )}

                {/* ── Create mode ── */}
                {mode === "create" && (
                  <div className="flex flex-col gap-3">
                    {/* Generated code display */}
                    <div
                      className="flex items-center justify-between px-5 py-4 rounded-2xl"
                      style={{
                        background: "linear-gradient(to bottom, rgba(255,255,255,0.16), rgba(140,190,255,0.10))",
                        border: "1.5px solid rgba(255,255,255,0.25)",
                        backdropFilter: "blur(14px)",
                        boxShadow:
                          "0 2px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 4px 0 rgba(100,150,255,0.1), 0 6px 16px rgba(0,30,160,0.18)",
                      }}
                    >
                      <div>
                        <p className="text-xs mb-0.5" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
                          MEETING CODE
                        </p>
                        <p
                          className="font-semibold tracking-widest"
                          style={{
                            fontFamily: "'Ethnocentric', sans-serif",
                            fontSize: "1.1rem",
                            color: "rgba(255,255,255,0.92)",
                            letterSpacing: "0.12em",
                          }}
                        >
                          {generatedCode}
                        </p>
                      </div>
                      {/* Copy button */}
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCode)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs transition-opacity hover:opacity-80"
                        style={{
                          background: "rgba(30,107,255,0.2)",
                          border: "1px solid rgba(79,179,255,0.3)",
                          color: "#90caff",
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                        aria-label="Copy meeting code"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                        Copy
                      </button>
                    </div>

                    {/* Start button */}
                    <button
                      onClick={handleCreate}
                      disabled={isLoading}
                      className="primary-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                      style={{
                        fontFamily: "'Ethnocentric', sans-serif",
                        background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                        color: "#0a20bb",
                        letterSpacing: "0.04em",
                        boxShadow: `
                          0 2px 0 rgba(255,255,255,0.85) inset,
                          0 -2px 0 rgba(160,185,255,0.4) inset,
                          0 6px 0 rgba(160,185,255,0.3),
                          0 10px 20px rgba(0,30,160,0.3),
                          0 20px 40px rgba(100,160,255,0.15)
                        `,
                        textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                        cursor: isLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {isLoading ? (
                        <><span className="spin-ring" /><span style={{ fontFamily: "'DM Sans', sans-serif" }}>Starting…</span></>
                      ) : (
                        "Start Meeting"
                      )}
                    </button>

                    {/* Back */}
                    <button
                      onClick={() => setMode("idle")}
                      className="back-btn text-xs text-center w-full"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ← Back
                    </button>
                  </div>
                )}

                {/* ── Join mode ── */}
                {mode === "join" && (
                  <div className="flex flex-col gap-3">
                    {/* Code input */}
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder="XXX-XXX-XXX"
                        value={joinCode}
                        onChange={handleCodeInput}
                        onBlur={handleCodeBlur}
                        maxLength={11}
                        autoFocus
                        aria-label="Meeting code"
                        aria-invalid={!!joinCodeError}
                        className="code-input w-full px-5 py-4 rounded-full text-white placeholder-white/40 text-sm font-light outline-none transition-all duration-200"
                        style={{
                          fontFamily: "'Ethnocentric', sans-serif",
                          letterSpacing: "0.14em",
                          fontSize: "1rem",
                          textAlign: "center",
                          background: joinCodeError
                            ? "linear-gradient(to bottom, rgba(255,80,80,0.18), rgba(200,60,60,0.12))"
                            : "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(140,190,255,0.10))",
                          border: joinCodeError
                            ? "1px solid rgba(255,100,100,0.75)"
                            : "1px solid rgba(255,255,255,0.22)",
                          backdropFilter: "blur(14px)",
                          boxShadow: joinCodeError
                            ? "0 2px 0 rgba(255,120,120,0.2) inset, 0 4px 0 rgba(255,80,80,0.12), 0 6px 20px rgba(180,0,0,0.18), 0 0 0 3px rgba(255,80,80,0.1)"
                            : "0 2px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,20,100,0.15) inset, 0 4px 0 rgba(100,150,255,0.1), 0 6px 16px rgba(0,30,160,0.18)",
                        }}
                      />
                      {joinCodeError && (
                        <p
                          role="alert"
                          className="text-xs px-4"
                          style={{ color: "rgba(255,160,160,0.95)", letterSpacing: "0.01em" }}
                        >
                          {joinCodeError}
                        </p>
                      )}
                    </div>

                    {/* Join button */}
                    <button
                      onClick={handleJoin}
                      disabled={isLoading || (!joinValid && joinCodeTouched)}
                      className="primary-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                      style={{
                        fontFamily: "'Ethnocentric', sans-serif",
                        background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                        color: "#0a20bb",
                        letterSpacing: "0.04em",
                        boxShadow: `
                          0 2px 0 rgba(255,255,255,0.85) inset,
                          0 -2px 0 rgba(160,185,255,0.4) inset,
                          0 6px 0 rgba(160,185,255,0.3),
                          0 10px 20px rgba(0,30,160,0.3),
                          0 20px 40px rgba(100,160,255,0.15)
                        `,
                        textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                        cursor: isLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {isLoading ? (
                        <><span className="spin-ring" /><span style={{ fontFamily: "'DM Sans', sans-serif" }}>Joining…</span></>
                      ) : (
                        "Join Meeting"
                      )}
                    </button>

                    {/* Back */}
                    <button
                      onClick={() => { setMode("idle"); setJoinCode(""); setJoinCodeError(""); setJoinCodeTouched(false); }}
                      className="back-btn text-xs text-center w-full"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(255,255,255,0.4)",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ← Back
                    </button>
                  </div>
                )}

                {/* Global error */}
                {status === "error" && mode !== "join" && (
                  <p className="text-xs text-center" style={{ color: "rgba(255,160,160,0.9)" }}>
                    Something went wrong. Please try again.
                  </p>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}