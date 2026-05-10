import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

/** Animated mesh gradient — identical background to the login/org pages */
function MeshGradient() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #ffffff 0%, #daeeff 28%, #9ecfff 42%, #3d8fff 58%, #1155ee 75%, #0930cc 100%)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "38%", left: "-10%", width: "80%", height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(100,200,255,0.75) 0%, transparent 65%)",
          filter: "blur(32px)",
          animation: "driftA 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "45%", right: "-15%", width: "75%", height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(60,120,255,0.65) 0%, transparent 65%)",
          filter: "blur(28px)",
          animation: "driftB 11s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "55%", left: "20%", width: "60%", height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(130,210,255,0.5) 0%, transparent 60%)",
          filter: "blur(22px)",
          animation: "driftC 13s ease-in-out infinite",
        }}
      />
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { setCurrentPage, selectedOrg, username } = useAppContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCurrentPage("dashboard");
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [setCurrentPage]);

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

        .anim-logo   { animation: fadeSlideUp 0.5s  cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.05s; }
        .anim-title  { animation: fadeSlideUp 0.5s  cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.15s; }
        .anim-btn-1  { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.25s; }
        .anim-btn-2  { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.35s; }

        .dashboard-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
          transform: translateY(0px);
          background: linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(140,190,255,0.10) 100%);
          border: 1px solid rgba(255,255,255,0.22);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: rgba(255,255,255,0.9);
        }
        
        .dashboard-btn:hover {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,0.5);
          background: linear-gradient(to bottom, rgba(255,255,255,0.26) 0%, rgba(180,210,255,0.18) 100%);
          box-shadow:
            0 8px 0 rgba(180,200,255,0.25),
            0 12px 24px rgba(0,30,160,0.35),
            0 24px 48px rgba(100,160,255,0.2);
        }

        .dashboard-btn:active {
          transform: translateY(1px);
          box-shadow:
            0 2px 0 rgba(180,200,255,0.2),
            0 4px 12px rgba(0,30,160,0.3);
        }
      `}</style>

      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <MeshGradient />

        <div className="relative z-10 flex flex-col flex-1 w-full items-center justify-center px-6 py-12">
          <div className="w-full flex flex-col items-center gap-10" style={{ maxWidth: 420 }}>
            <div className={mounted ? "anim-logo" : "opacity-0"}>
              <img src="/SixDX Logo.svg" alt="SixDX" style={{ height: 40 }} />
            </div>

            <div className="w-full flex flex-col gap-4">
              <div className={`mb-4 text-center ${mounted ? "anim-title" : "opacity-0"}`}>
                <h1 className="text-2xl font-medium text-white/90 mb-1" style={{ letterSpacing: "0.01em" }}>
                  Welcome, {username || 'User'}
                </h1>
                <p className="text-sm text-white/70">
                  {selectedOrg ? `Connected to ${selectedOrg.charAt(0).toUpperCase() + selectedOrg.slice(1)}` : 'Dashboard Hub'}
                </p>
              </div>

              <div className={mounted ? "anim-btn-1" : "opacity-0"}>
                <button
                  type="button"
                  onClick={() => navigate("/room")}
                  className="dashboard-btn w-full px-5 py-5 rounded-3xl flex flex-col items-center justify-center gap-2 outline-none"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                  </svg>
                  <span className="font-medium text-lg tracking-wide">Meetings</span>
                  <span className="text-xs text-white/60">Join or start a session</span>
                </button>
              </div>

              <div className={mounted ? "anim-btn-2" : "opacity-0"}>
                <button
                  type="button"
                  onClick={() => navigate("/recordings")}
                  className="dashboard-btn w-full px-5 py-5 rounded-3xl flex flex-col items-center justify-center gap-2 outline-none"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <circle cx="12" cy="12" r="3" fill="currentColor"></circle>
                  </svg>
                  <span className="font-medium text-lg tracking-wide">Recordings</span>
                  <span className="text-xs text-white/60">View past sessions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
