import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InputFieldProps {
  id: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  autoComplete?: string;
  error?: string;
  touched?: boolean;
}

interface FormState {
  username: string;
  password: string;
}

interface FormErrors {
  username: string;
  password: string;
}

type FormStatus = "idle" | "validating" | "loading" | "success" | "error";

// ─── Validation ───────────────────────────────────────────────────────────────
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,20}$/;

function validateUsername(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!USERNAME_REGEX.test(value))
    return "3–21 chars, start with a letter, letters/numbers/underscore only";
  return "";
}

function validatePassword(value: string): string {
  if (!value.trim()) return "This field is required";
  return "";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Frosted pill input — mirrors the screenshot's translucent rounded fields */
function PillInput({
  id,
  type,
  placeholder,
  value,
  onChange,
  onBlur,
  autoComplete,
  error,
  touched,
}: InputFieldProps) {
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
      {/* Error message */}
      {hasError && (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 px-4 text-xs"
          style={{ color: "rgba(255,160,160,0.95)", letterSpacing: "0.01em" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/** Animated mesh gradient blob — matches the screenshot's soft blue glow */
function MeshGradient() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* White top — fades into blue mesh */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, #ffffff 0%, #daeeff 28%, #9ecfff 42%, #3d8fff 58%, #1155ee 75%, #0930cc 100%)",
        }}
      />

      {/* Radial blobs — replicating the soft cyan/blue mesh */}
      <div
        className="absolute"
        style={{
          top: "38%",
          left: "-10%",
          width: "80%",
          height: "55%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(100,200,255,0.75) 0%, transparent 65%)",
          filter: "blur(32px)",
          animation: "driftA 9s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "45%",
          right: "-15%",
          width: "75%",
          height: "50%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(60,120,255,0.65) 0%, transparent 65%)",
          filter: "blur(28px)",
          animation: "driftB 11s ease-in-out infinite",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "55%",
          left: "20%",
          width: "60%",
          height: "40%",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, rgba(130,210,255,0.5) 0%, transparent 60%)",
          filter: "blur(22px)",
          animation: "driftC 13s ease-in-out infinite",
        }}
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const navigate = useNavigate();
  const { setUsername, setCurrentPage, setIsTestLogin } = useAppContext();

  const [form, setForm]       = useState<FormState>({ username: "", password: "" });
  const [errors, setErrors]   = useState<FormErrors>({ username: "", password: "" });
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({ username: false, password: false });
  const [status, setStatus]   = useState<FormStatus>("idle");
  const [toast, setToast]     = useState<string>("");
  const [mounted, setMounted] = useState(false);

  // Entrance animation
  useEffect(() => {
    setCurrentPage("landing");
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, [setCurrentPage]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Real-time validation ──
  const validate = useCallback((field: keyof FormState, value: string): string => {
    if (field === "username") return validateUsername(value);
    if (field === "password") return validatePassword(value);
    return "";
  }, []);

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (touched[field]) {
        setErrors((prev) => ({ ...prev, [field]: validate(field, value) }));
      }
    };
  }

  function handleBlur(field: keyof FormState) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    setErrors((prev) => ({ ...prev, [field]: validate(field, form[field]) }));
  }

  // Derive form validity
  const usernameError = validate("username", form.username);
  const passwordError = validate("password", form.password);
  const isFormValid   = !usernameError && !passwordError;
  const isLoading     = status === "loading";

  // ── Submission ──
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Mark all fields touched & run full validation
    setStatus("validating");
    const newErrors: FormErrors = {
      username: validate("username", form.username),
      password: validate("password", form.password),
    };
    setErrors(newErrors);
    setTouched({ username: true, password: true });

    if (newErrors.username || newErrors.password) {
      setStatus("idle");
      return;
    }

    // Submit
    setStatus("loading");

    // Test login bypass: pratham / 11111 (for reaching meeting/recordings without API)
    const isTestLogin = form.username === "pratham" && form.password === "11111";
    if (isTestLogin) {
      setUsername(form.username);
      setIsTestLogin(true);
      setStatus("success");
      navigate("/organizations");
      return;
    }

    // normal login path should clear any previous test flag
    setIsTestLogin(false);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });

      if (!res.ok) throw new Error("Login failed");

      setUsername(form.username);
      setStatus("success");
      navigate("/organizations");
    } catch {
      setStatus("error");
      setToast("Login failed, please try again");
    }
  }

  return (
    <>
      {/* ── Keyframe injections ── */}
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
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          33%       { transform: translate(6%, -4%) scale(1.05); }
          66%       { transform: translate(-4%, 6%) scale(0.97); }
        }
        @keyframes driftB {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          40%       { transform: translate(-8%, 5%) scale(1.08); }
          75%       { transform: translate(5%, -3%) scale(0.95); }
        }
        @keyframes driftC {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          50%       { transform: translate(4%, -6%) scale(1.06); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes toastOut {
          from { opacity: 1; }
          to   { opacity: 0; transform: translateY(8px); }
        }

        .anim-logo {
          animation: fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.05s;
        }
        .anim-inputs {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.18s;
        }
        .anim-btn {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.28s;
        }
        .anim-forgot {
          animation: fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
          animation-delay: 0.36s;
        }

        .login-btn {
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
          transform: translateY(0px);
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow:
            0 2px 0 rgba(255,255,255,0.9) inset,
            0 -1px 0 rgba(0,10,80,0.25) inset,
            0 8px 0 rgba(180,200,255,0.25),
            0 12px 24px rgba(0,30,160,0.35),
            0 24px 48px rgba(100,160,255,0.2) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(2px);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.7) inset,
            0 -1px 0 rgba(0,10,80,0.2) inset,
            0 2px 0 rgba(180,200,255,0.2),
            0 4px 12px rgba(0,30,160,0.3) !important;
        }
        .login-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .forgot-link {
          transition: color 0.2s ease;
        }
        .forgot-link:hover {
          color: rgba(255,255,255,0.85);
        }

        .spin-ring {
          border: 2px solid rgba(30,80,200,0.2);
          border-top-color: #1a4dcc;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          animation: spinRing 0.75s linear infinite;
          display: inline-block;
        }

        .toast {
          animation: toastIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
        }

        .pill-input {
          transition: border-color 0.2s ease, background 0.2s ease;
        }
        .pill-input:hover:not(:focus) {
          border-color: rgba(255,255,255,0.5) !important;
          background: linear-gradient(to bottom, rgba(255,255,255,0.26) 0%, rgba(180,210,255,0.18) 100%) !important;
        }
      `}</style>

      {/* ── Full-screen wrapper ── */}
      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <MeshGradient />

        {/* Sign Up button */}
        <div className="absolute top-5 right-5 z-20">
          <button
            onClick={() => navigate("/signup")}
            className="text-sm font-medium px-6 py-3 rounded-full transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "rgba(0,0,0,0.65)",
              cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Sign Up
          </button>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div
            role="alert"
            aria-live="assertive"
            className="toast fixed top-6 left-1/2 z-50 px-5 py-3 rounded-2xl text-sm flex items-center gap-2.5"
            style={{
              transform: "translateX(-50%)",
              background: "rgba(30,10,10,0.75)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,80,80,0.35)",
              color: "rgba(255,180,180,0.95)",
              boxShadow: "0 8px 32px rgba(180,0,0,0.25)",
              whiteSpace: "nowrap",
            }}
          >
            {/* Error icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,120,120,0.9)" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {toast}
          </div>
        )}

        {/* ── Content layer ── */}
        <div className="relative z-10 flex flex-col flex-1 w-full items-center justify-center px-6 py-12">
          <div className="w-full flex flex-col items-center gap-10" style={{ maxWidth: 420 }}>

            {/* LOGO */}
            <div className={mounted ? "anim-logo" : "opacity-0"}>
              <img src="/SixDX Logo.svg" alt="SixDX" style={{ height: 40 }} />
            </div>

            {/* ── FORM ── */}
            <form
              onSubmit={handleSubmit}
              noValidate
              className="w-full"
            >
              {/* Inputs */}
              <div
                className={`space-y-2 mb-4 ${mounted ? "anim-inputs" : "opacity-0"}`}
              >
                <PillInput
                  id="username"
                  type="text"
                  placeholder="Username"
                  value={form.username}
                  onChange={handleChange("username")}
                  autoComplete="username"
                  error={errors.username}
                  touched={touched.username}
                  onBlur={() => handleBlur("username")}
                />
                <PillInput
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={form.password}
                  onChange={handleChange("password")}
                  autoComplete="current-password"
                  error={errors.password}
                  touched={touched.password}
                  onBlur={() => handleBlur("password")}
                />
              </div>

              {/* Log in button */}
              <div className={`mb-1 ${mounted ? "anim-btn" : "opacity-0"}`}>
                <button
                  type="submit"
                  disabled={isLoading || (touched.username && touched.password && !isFormValid)}
                  className="login-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
                  style={{
                    fontFamily: "'Ethnocentric', sans-serif",
                    background: "linear-gradient(to bottom, #ffffff 0%, #dce8ff 100%)",
                    color: "#0a20bb",
                    letterSpacing: "0.01em",
                    boxShadow: "none",
                    textShadow: "0 1px 0 rgba(255,255,255,0.6)",
                  }}
                >
                  {isLoading ? (
                    <>
                      <span className="spin-ring" />
                      <span style={{ fontFamily: "'DM Sans', sans-serif" }}>Signing in…</span>
                    </>
                  ) : (
                    "Log in"
                  )}
                </button>
              </div>

              {/* Forgot Password */}
              <div className={`mt-3 ${mounted ? "anim-forgot" : "opacity-0"}`}>
                <button
                  type="button"
                  className="forgot-link text-xs text-white/55 hover:text-white/85 text-left transition-colors duration-200"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  onClick={() => {/* hook up your password reset flow */}}
                >
                  Forgot Password ?
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

