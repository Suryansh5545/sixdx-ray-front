import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import {
  RecordingThemeBackdrop,
  recordingThemeMutedTextStyle,
  recordingThemePageStyle,
  recordingThemePillButtonStyle,
  recordingThemePrimaryButtonStyle,
  recordingThemeSecondaryActiveButtonStyle,
  recordingThemeSubtleTextStyle,
  recordingThemeSurfaceStrongStyle,
} from "../components/ui/recordingTheme";

interface OrganisationOption {
  id: string;
  label: string;
}

const ORGANISATIONS: OrganisationOption[] = [
  { id: "acme", label: "Acme Corporation" },
  { id: "globex", label: "Globex Industries" },
  { id: "initech", label: "Initech Group" },
  { id: "umbrella", label: "Umbrella Ltd" },
  { id: "soylent", label: "Soylent Dynamics" },
  { id: "vehement", label: "Vehement Capital" },
];

export default function Organisation() {
  const navigate = useNavigate();
  const {
    setSelectedOrg,
    setCurrentPage,
    isTestLogin,
    setIsTestLogin,
    selectedOrg,
    logout,
  } = useAppContext();

  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<OrganisationOption | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage("organisation");
    const timer = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(timer);
  }, [setCurrentPage]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleNext() {
    if (!selected) return;
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setSelectedOrg(selected.id);
      if (isTestLogin) {
        setIsTestLogin(false);
      }
      navigate("/dashboard");
    }, 1200);
  }

  function handleBack() {
    if (selectedOrg) {
      navigate("/dashboard");
      return;
    }

    logout();
    navigate("/");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes dropdownOpen {
          from { opacity: 0; transform: translateY(-8px) scaleY(0.96); }
          to { opacity: 1; transform: translateY(0) scaleY(1); }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        .anim-copy {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.05s;
        }

        .anim-card {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.12s;
        }

        .top-pill,
        .select-trigger,
        .next-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }

        .top-pill:hover,
        .select-trigger:hover:not([aria-expanded="true"]) {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(2, 8, 22, 0.24);
        }

        .top-pill:active,
        .select-trigger:active {
          transform: translateY(1px);
        }

        .next-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 20px 46px rgba(57, 132, 204, 0.26) !important;
        }

        .next-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .next-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .dropdown-list {
          animation: dropdownOpen 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
          transform-origin: top;
        }

        .dropdown-item {
          transition: background 0.15s ease;
        }

        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .chevron {
          transition: transform 0.25s ease;
        }

        .chevron.open {
          transform: rotate(180deg);
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
      `}</style>

      <div className="relative min-h-screen w-full overflow-hidden" style={recordingThemePageStyle}>
        <RecordingThemeBackdrop />

        <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-6 sm:py-14">
          <div className="w-full max-w-3xl">
            <div className={`mb-4 flex justify-start ${mounted ? "anim-copy" : "opacity-0"}`}>
              <button
                type="button"
                onClick={handleBack}
                className="top-pill flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
                style={{ ...recordingThemePillButtonStyle, cursor: "pointer" }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back
              </button>
            </div>
            <div className={`mb-6 flex flex-col gap-3 text-center ${mounted ? "anim-copy" : "opacity-0"}`}>
              <div
                className="mx-auto inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  ...recordingThemePillButtonStyle,
                  color: "#90caff",
                }}
              >
                Organization routing
              </div>
              <img src="/SixDX White.svg" alt="SixDX" className="mx-auto" style={{ height: 34 }} />
              <h1 className="text-3xl font-semibold text-white sm:text-4xl">Choose your workspace</h1>
              <p className="mx-auto max-w-xl text-sm leading-6" style={recordingThemeMutedTextStyle}>
                Pick the organization you want to enter. We will use it to route meetings,
                recordings, and the rest of the app context.
              </p>
            </div>

            <div
              className={`rounded-[28px] p-6 sm:p-8 ${mounted ? "anim-card" : "opacity-0"}`}
              style={recordingThemeSurfaceStrongStyle}
            >
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em]" style={recordingThemeSubtleTextStyle}>
                    Step 1 of 2
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Organization</h2>
                </div>
                <div
                  className="rounded-full px-3 py-1.5 text-xs"
                  style={{
                    ...recordingThemePillButtonStyle,
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  {ORGANISATIONS.length} available
                </div>
              </div>

              <div ref={dropdownRef} className="relative mb-4">
                <button
                  type="button"
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  onClick={() => setOpen((current) => !current)}
                  className="select-trigger flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-sm outline-none"
                  style={{
                    ...(open ? recordingThemeSecondaryActiveButtonStyle : recordingThemePillButtonStyle),
                    color: selected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.45)",
                    cursor: "pointer",
                  }}
                >
                  <span>{selected ? selected.label : "Select an organization"}</span>
                  <svg
                    className={`chevron ${open ? "open" : ""} flex-shrink-0`}
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {open && (
                  <ul
                    role="listbox"
                    className="dropdown-list absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-3xl py-2"
                    style={{
                      background: "rgba(8,16,33,0.96)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 24px 60px rgba(2,8,22,0.42)",
                      backdropFilter: "blur(18px)",
                      WebkitBackdropFilter: "blur(18px)",
                    }}
                  >
                    {ORGANISATIONS.map((org) => {
                      const isSelected = selected?.id === org.id;
                      return (
                        <li
                          key={org.id}
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSelected(org);
                            setOpen(false);
                          }}
                          className="dropdown-item flex cursor-pointer items-center justify-between px-5 py-3 text-sm"
                          style={{
                            color: isSelected ? "#90caff" : "rgba(255,255,255,0.78)",
                            background: isSelected ? "rgba(79,179,255,0.12)" : "transparent",
                          }}
                        >
                          <span>{org.label}</span>
                          {isSelected && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <p className="mb-6 text-sm leading-6" style={recordingThemeMutedTextStyle}>
                You can switch organizations later if your account has access to more than one
                workspace.
              </p>

              <button
                type="button"
                disabled={!selected || loading}
                onClick={handleNext}
                className="next-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                style={{
                  ...recordingThemePrimaryButtonStyle,
                  cursor: !selected || loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? (
                  <>
                    <span className="spin-ring" />
                    <span>Loading...</span>
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
