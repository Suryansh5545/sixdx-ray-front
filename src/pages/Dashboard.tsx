import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  RecordingThemeBackdrop,
  recordingThemeDangerPillButtonStyle,
  recordingThemeMutedTextStyle,
  recordingThemePageStyle,
  recordingThemePillButtonStyle,
  recordingThemeSecondaryActiveButtonStyle,
  recordingThemeSurfaceStrongStyle,
} from "../components/ui/recordingTheme";

export default function Dashboard() {
  const navigate = useNavigate();
  const { setCurrentPage, identifier, logout } = useAppContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCurrentPage("dashboard");
    const timer = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(timer);
  }, [setCurrentPage]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .anim-header {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.05s;
        }

        .anim-hero {
          animation: fadeSlideUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.12s;
        }

        .anim-card-1 {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.18s;
        }

        .anim-card-2 {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.24s;
        }

        .top-pill,
        .dashboard-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .top-pill:hover,
        .dashboard-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 50px rgba(2, 8, 22, 0.34);
        }

        .top-pill:active,
        .dashboard-card:active {
          transform: translateY(1px);
        }

        .dashboard-card:hover {
          border-color: rgba(79, 179, 255, 0.2) !important;
        }

        .dashboard-card:hover .dashboard-sheen {
          opacity: 1;
          transform: translateX(0);
        }

        .dashboard-card:hover .dashboard-icon {
          transform: scale(1.08) translateY(-2px);
          background: rgba(79, 179, 255, 0.18) !important;
        }

        .dashboard-card:hover .dashboard-arrow {
          transform: translateX(4px);
          color: #d8efff;
        }

        .dashboard-card:hover .dashboard-kicker {
          color: #d8efff;
        }

        .dashboard-icon,
        .dashboard-arrow,
        .dashboard-kicker,
        .dashboard-sheen {
          transition: transform 0.18s ease, opacity 0.18s ease, color 0.18s ease, background 0.18s ease;
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
                onClick={() => navigate("/room")}
                className="top-pill rounded-xl px-4 py-2 text-sm"
                style={{ ...recordingThemeSecondaryActiveButtonStyle, cursor: "pointer" }}
              >
                Open rooms
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
                className="top-pill rounded-xl px-4 py-2 text-sm"
                style={{ ...recordingThemeDangerPillButtonStyle, cursor: "pointer" }}
              >
                Sign out
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center py-10">
            <section className={mounted ? "anim-hero" : "opacity-0"}>
              <div
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  ...recordingThemePillButtonStyle,
                  color: "#90caff",
                }}
              >
                Workspace overview
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Welcome back, {identifier || "User"}.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7" style={recordingThemeMutedTextStyle}>
                Jump into a live room or head straight to recordings. Everything now follows the
                same calmer workspace theme as the recordings area.
              </p>
            </section>

            <section className="mt-10 grid gap-4 md:grid-cols-2">
              <button
                type="button"
                onClick={() => navigate("/room")}
                className={`dashboard-card relative overflow-hidden rounded-[28px] p-6 text-left ${mounted ? "anim-card-1" : "opacity-0"}`}
                style={recordingThemeSurfaceStrongStyle}
              >
                <div
                  aria-hidden
                  className="dashboard-sheen absolute inset-0 opacity-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(79,179,255,0.18) 0%, rgba(79,179,255,0.05) 38%, transparent 72%)",
                    transform: "translateX(-12px)",
                  }}
                />
                <div className="relative z-10">
                <div
                  className="dashboard-icon flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={recordingThemeSecondaryActiveButtonStyle}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">Meetings</h2>
                <p className="mt-3 text-sm leading-6" style={recordingThemeMutedTextStyle}>
                  Start a new room, join by code, and move straight into the live call flow.
                </p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="dashboard-kicker text-sm font-medium text-[#90caff]">
                    Open room controls
                  </div>
                  <div className="dashboard-arrow text-sm font-medium text-[#90caff]">Explore</div>
                </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/recordings")}
                className={`dashboard-card relative overflow-hidden rounded-[28px] p-6 text-left ${mounted ? "anim-card-2" : "opacity-0"}`}
                style={recordingThemeSurfaceStrongStyle}
              >
                <div
                  aria-hidden
                  className="dashboard-sheen absolute inset-0 opacity-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(79,179,255,0.18) 0%, rgba(79,179,255,0.05) 38%, transparent 72%)",
                    transform: "translateX(-12px)",
                  }}
                />
                <div className="relative z-10">
                <div
                  className="dashboard-icon flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={recordingThemeSecondaryActiveButtonStyle}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" fill="currentColor" />
                  </svg>
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">Recordings</h2>
                <p className="mt-3 text-sm leading-6" style={recordingThemeMutedTextStyle}>
                  Search saved sessions, preview footage, launch AI analysis, and inspect results.
                </p>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="dashboard-kicker text-sm font-medium text-[#90caff]">
                    Browse recordings
                  </div>
                  <div className="dashboard-arrow text-sm font-medium text-[#90caff]">Explore</div>
                </div>
                </div>
              </button>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
