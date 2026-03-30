import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "email" | "verify" | "password";
type StepStatus = "idle" | "loading" | "error";

// ─── Validation ───────────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_REGEX  = /^\d{6}$/;

function validateEmail(v: string)    { return !v.trim() ? "Required" : !EMAIL_REGEX.test(v) ? "Enter a valid email address" : ""; }
function validateCode(v: string)     { return !v.trim() ? "Required" : !CODE_REGEX.test(v)  ? "Enter the 6-digit code"       : ""; }
function validatePassword(v: string) { return !v.trim() ? "Required" : v.length < 8         ? "Minimum 8 characters"         : ""; }
function validateConfirm(p: string, c: string) { return !c.trim() ? "Required" : p !== c ? "Passwords do not match" : ""; }

// ─── Sub-components ───────────────────────────────────────────────────────────
function MeshGradient() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{
        background: "linear-gradient(to bottom, #ffffff 0%, #daeeff 28%, #9ecfff 42%, #3d8fff 58%, #1155ee 75%, #0930cc 100%)",
      }} />
      <div className="absolute" style={{ top: "38%", left: "-10%", width: "80%", height: "55%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(100,200,255,0.75) 0%, transparent 65%)",
        filter: "blur(32px)", animation: "driftA 9s ease-in-out infinite" }} />
      <div className="absolute" style={{ top: "45%", right: "-15%", width: "75%", height: "50%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(60,120,255,0.65) 0%, transparent 65%)",
        filter: "blur(28px)", animation: "driftB 11s ease-in-out infinite" }} />
      <div className="absolute" style={{ top: "55%", left: "20%", width: "60%", height: "40%", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(130,210,255,0.5) 0%, transparent 60%)",
        filter: "blur(22px)", animation: "driftC 13s ease-in-out infinite" }} />
    </div>
  );
}

interface PillInputProps {
  id: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  autoComplete?: string;
  error?: string;
  touched?: boolean;
  maxLength?: number;
}

function PillInput({ id, type, placeholder, value, onChange, onBlur, autoComplete, error, touched, maxLength }: PillInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = touched && !!error;

  return (
    <div className="relative w-full">
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${id}-error` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onBlur?.(); }}
        className="pill-input w-full px-5 py-4 rounded-full text-white placeholder-white/55 text-sm font-light outline-none"
        style={{
          background: hasError
            ? "linear-gradient(to bottom, rgba(255,80,80,0.18) 0%, rgba(200,60,60,0.12) 100%)"
            : focused
            ? "linear-gradient(to bottom, rgba(255,255,255,0.26) 0%, rgba(180,210,255,0.18) 100%)"
            : "linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(140,190,255,0.10) 100%)",
          border: hasError
            ? "1px solid rgba(255,100,100,0.75)"
            : focused
            ? "1px solid rgba(255,255,255,0.6)"
            : "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          boxShadow: "none",
          letterSpacing: "0.01em",
        }}
      />
      {hasError && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 px-4 text-xs"
          style={{ color: "rgba(255,160,160,0.95)", letterSpacing: "0.01em" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Signup() {
  const navigate = useNavigate();

  const [mounted,  setMounted]  = useState(false);
  const [step,     setStep]     = useState<Step>("email");
  const [status,   setStatus]   = useState<StepStatus>("idle");
  const [toast,    setToast]    = useState("");

  const [email,    setEmail]    = useState("");
  const [code,     setCode]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");

  const [emailTouched,    setEmailTouched]    = useState(false);
  const [codeTouched,     setCodeTouched]     = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched,  setConfirmTouched]  = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const isLoading = status === "loading";

  const handleSendCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailTouched(true);
    if (validateEmail(email)) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setStatus("idle");
      setStep("verify");
    } catch {
      setStatus("error");
      setToast("Failed to send verification code. Please try again.");
    }
  }, [email]);

  const handleVerifyCode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeTouched(true);
    if (validateCode(code)) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) throw new Error();
      setStatus("idle");
      setStep("password");
    } catch {
      setStatus("error");
      setToast("Invalid or expired code. Please try again.");
    }
  }, [email, code]);

  const handleRegister = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (validatePassword(password) || validateConfirm(password, confirm)) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error();
      setStatus("idle");
      navigate("/");
    } catch {
      setStatus("error");
      setToast("Account creation failed. Please try again.");
    }
  }, [email, password, confirm, navigate]);

  const STEPS: Step[] = ["email", "verify", "password"];
  const stepLabel: Record<Step, string> = {
    email:    "Enter your email",
    verify:   "Verify your email",
    password: "Create a password",
  };
  const currentIdx = STEPS.indexOf(step);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
        @font-face {
          font-family: 'Ethnocentric';
          src: url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff2') format('woff2'),
               url('https://db.onlinewebfonts.com/t/4f212c96840b7c759cb0e61720d2c2c5.woff') format('woff');
          font-weight: normal; font-style: normal; font-display: swap;
        }
        @keyframes driftA {
          0%,100% { transform: translate(0%,0%) scale(1); }
          33%      { transform: translate(6%,-4%) scale(1.05); }
          66%      { transform: translate(-4%,6%) scale(0.97); }
        }
        @keyframes driftB {
          0%,100% { transform: translate(0%,0%) scale(1); }
          40%      { transform: translate(-8%,5%) scale(1.08); }
          75%      { transform: translate(5%,-3%) scale(0.95); }
        }
        @keyframes driftC {
          0%,100% { transform: translate(0%,0%) scale(1); }
          50%      { transform: translate(4%,-6%) scale(1.06); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinRing { to { transform: rotate(360deg); } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .su-logo { animation: fadeSlideUp 0.5s  cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.05s; }
        .su-form { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.18s; }
        .su-btn-wrap { animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.28s; }
        .pill-input { transition: border-color 0.2s ease, background 0.2s ease; }
        .pill-input:hover:not(:focus) {
          border-color: rgba(255,255,255,0.5) !important;
          background: linear-gradient(to bottom, rgba(255,255,255,0.26) 0%, rgba(180,210,255,0.18) 100%) !important;
        }
        .su-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
        }
        .su-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 2px 0 rgba(255,255,255,0.9) inset, 0 -1px 0 rgba(0,10,80,0.25) inset,
            0 8px 0 rgba(180,200,255,0.25), 0 12px 24px rgba(0,30,160,0.35), 0 24px 48px rgba(100,160,255,0.2) !important;
        }
        .su-btn:active:not(:disabled) { transform: translateY(2px); }
        .su-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .back-btn { transition: opacity 0.2s ease; }
        .back-btn:hover { opacity: 0.7; }
        .toast { animation: toastIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
        .spin-ring {
          border: 2px solid rgba(30,80,200,0.2); border-top-color: #1a4dcc;
          border-radius: 50%; width: 18px; height: 18px;
          animation: spinRing 0.75s linear infinite; display: inline-block;
        }
        .step-dot { transition: background 0.3s ease, width 0.3s ease, height 0.3s ease; }
      `}</style>

      <div className="relative min-h-screen w-full overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <MeshGradient />

        {/* Back to login */}
        <div className="absolute top-5 left-5 z-20">
          <button onClick={() => navigate("/")} className="back-btn flex items-center gap-1.5 text-xs"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(0,0,0,0.45)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to login
          </button>
        </div>

        {/* Toast */}
        {toast && (
          <div role="alert" aria-live="assertive"
            className="toast fixed top-6 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm flex items-center gap-2.5"
            style={{
              transform: "translateX(-50%)", background: "rgba(30,10,10,0.75)",
              backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,80,80,0.35)", color: "rgba(255,180,180,0.95)",
              boxShadow: "0 8px 32px rgba(180,0,0,0.25)", whiteSpace: "nowrap",
            }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,120,120,0.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {toast}
          </div>
        )}

        {/* Content */}
        <div className="relative z-10 flex flex-col flex-1 w-full items-center justify-center px-6 py-12">
          <div className="w-full flex flex-col items-center gap-10" style={{ maxWidth: 420 }}>

            {/* Logo */}
            <div className={mounted ? "su-logo" : "opacity-0"}>
              <img src="/SixDX Logo.svg" alt="SixDX" style={{ height: 40 }} />
            </div>

            {/* Step indicator */}
            <div className={`flex flex-col items-center gap-3 w-full ${mounted ? "su-form" : "opacity-0"}`}>
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => {
                  const isActive = s === step;
                  const isDone   = STEPS.indexOf(s) < currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div className="step-dot rounded-full" style={{
                        width: isActive ? 8 : 6, height: isActive ? 8 : 6,
                        background: isActive ? "rgba(0,0,0,0.7)" : isDone ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.18)",
                      }} />
                      {i < STEPS.length - 1 && (
                        <div style={{ width: 20, height: 1, background: isDone ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.15)" }} />
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm font-medium" style={{ color: "rgba(0,0,0,0.6)", letterSpacing: "0.01em" }}>
                {stepLabel[step]}
              </p>
            </div>

            {/* ── Step 1: Email ── */}
            {step === "email" && (
              <form onSubmit={handleSendCode} noValidate className="w-full flex flex-col gap-4">
                <div className={mounted ? "su-form" : "opacity-0"}>
                  <PillInput
                    id="email" type="email" placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    autoComplete="email"
                    error={validateEmail(email)} touched={emailTouched}
                  />
                </div>
                <div className={mounted ? "su-btn-wrap" : "opacity-0"}>
                  <button type="submit" disabled={isLoading}
                    className="su-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                    style={{
                      fontFamily: "'Ethnocentric', sans-serif",
                      background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                      color: "#0a20bb", letterSpacing: "0.01em",
                      boxShadow: "none", textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                    }}>
                    {isLoading
                      ? <><span className="spin-ring" /><span style={{ fontFamily: "'DM Sans',sans-serif" }}>Sending…</span></>
                      : "Send Verification Code"}
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 2: Verify code ── */}
            {step === "verify" && (
              <form onSubmit={handleVerifyCode} noValidate className="w-full flex flex-col gap-4">
                <div className={`flex flex-col gap-3 ${mounted ? "su-form" : "opacity-0"}`}>
                  <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.65)" }}>
                    A 6-digit code was sent to{" "}
                    <strong style={{ color: "rgba(255,255,255,0.9)" }}>{email}</strong>
                  </p>
                  <PillInput
                    id="code" type="text" placeholder="6-digit code"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onBlur={() => setCodeTouched(true)}
                    autoComplete="one-time-code"
                    error={validateCode(code)} touched={codeTouched} maxLength={6}
                  />
                </div>
                <div className={`flex flex-col gap-2 ${mounted ? "su-btn-wrap" : "opacity-0"}`}>
                  <button type="submit" disabled={isLoading}
                    className="su-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                    style={{
                      fontFamily: "'Ethnocentric', sans-serif",
                      background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                      color: "#0a20bb", letterSpacing: "0.01em",
                      boxShadow: "none", textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                    }}>
                    {isLoading
                      ? <><span className="spin-ring" /><span style={{ fontFamily: "'DM Sans',sans-serif" }}>Verifying…</span></>
                      : "Verify Email"}
                  </button>
                  <button type="button"
                    className="back-btn text-xs text-center"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}
                    onClick={() => { setStep("email"); setCode(""); setCodeTouched(false); setStatus("idle"); }}>
                    Wrong email? Go back
                  </button>
                </div>
              </form>
            )}

            {/* ── Step 3: Password ── */}
            {step === "password" && (
              <form onSubmit={handleRegister} noValidate className="w-full flex flex-col gap-4">
                <div className={`flex flex-col gap-2 ${mounted ? "su-form" : "opacity-0"}`}>
                  <PillInput
                    id="password" type="password" placeholder="Create password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    autoComplete="new-password"
                    error={validatePassword(password)} touched={passwordTouched}
                  />
                  <PillInput
                    id="confirm" type="password" placeholder="Re-enter password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    autoComplete="new-password"
                    error={validateConfirm(password, confirm)} touched={confirmTouched}
                  />
                </div>
                <div className={mounted ? "su-btn-wrap" : "opacity-0"}>
                  <button type="submit" disabled={isLoading}
                    className="su-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                    style={{
                      fontFamily: "'Ethnocentric', sans-serif",
                      background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                      color: "#0a20bb", letterSpacing: "0.01em",
                      boxShadow: "none", textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                    }}>
                    {isLoading
                      ? <><span className="spin-ring" /><span style={{ fontFamily: "'DM Sans',sans-serif" }}>Creating account…</span></>
                      : "Create Account"}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
