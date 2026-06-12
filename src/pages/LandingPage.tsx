import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { createAuthSession, type AuthResponse } from "../lib/auth";
import { buildServerUrl } from "../lib/server";
import {
  RecordingThemeBackdrop,
  getRecordingThemeInputStyle,
  recordingThemeErrorTextStyle,
  recordingThemeMutedTextStyle,
  recordingThemePageStyle,
  recordingThemePillButtonStyle,
  recordingThemePrimaryButtonStyle,
  recordingThemeSubtleTextStyle,
  recordingThemeSurfaceStrongStyle,
} from "../components/ui/recordingTheme";

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
  identifier: string;
  password: string;
}

interface FormErrors {
  identifier: string;
  password: string;
}

type FormStatus = "idle" | "validating" | "loading" | "success" | "error";

const IDENTIFIER_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,20}$/;

function validateIdentifier(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!IDENTIFIER_REGEX.test(value)) {
    return "3-21 chars, start with a letter, letters/numbers/underscore only";
  }
  return "";
}

function validatePassword(value: string): string {
  if (!value.trim()) return "This field is required";
  return "";
}

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
  const hasError = Boolean(touched && error);

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
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        className="pill-input w-full rounded-2xl px-4 py-3.5 text-sm text-white placeholder-white/38 outline-none"
        style={getRecordingThemeInputStyle(focused, hasError)}
      />
      {hasError && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 px-1 text-xs" style={recordingThemeErrorTextStyle}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { setIdentifier, setCurrentPage, setIsTestLogin, setAuthSession } = useAppContext();

  const [form, setForm] = useState<FormState>({ identifier: "", password: "" });
  const [errors, setErrors] = useState<FormErrors>({ identifier: "", password: "" });
  const [touched, setTouched] = useState<Record<keyof FormState, boolean>>({
    identifier: false,
    password: false,
  });
  const [status, setStatus] = useState<FormStatus>("idle");
  const [toast, setToast] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCurrentPage("landing");
    const timer = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(timer);
  }, [setCurrentPage]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const validate = useCallback((field: keyof FormState, value: string): string => {
    if (field === "identifier") return validateIdentifier(value);
    if (field === "password") return validatePassword(value);
    return "";
  }, []);

  function handleChange(field: keyof FormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));
      if (touched[field]) {
        setErrors((current) => ({ ...current, [field]: validate(field, value) }));
      }
    };
  }

  function handleBlur(field: keyof FormState) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({ ...current, [field]: validate(field, form[field]) }));
  }

  const identifierError = validate("identifier", form.identifier);
  const passwordError = validate("password", form.password);
  const isFormValid = !identifierError && !passwordError;
  const isLoading = status === "loading";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setStatus("validating");
    const nextErrors: FormErrors = {
      identifier: validate("identifier", form.identifier),
      password: validate("password", form.password),
    };

    setErrors(nextErrors);
    setTouched({ identifier: true, password: true });

    if (nextErrors.identifier || nextErrors.password) {
      setStatus("idle");
      return;
    }

    setStatus("loading");

    const isTestLogin = form.identifier === "pratham" && form.password === "11111";
    if (isTestLogin) {
      setAuthSession(null);
      setIdentifier(form.identifier);
      setIsTestLogin(true);
      setStatus("success");
      navigate("/dashboard");
      return;
    }

    setIsTestLogin(false);

    try {
      const response = await fetch(buildServerUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
        }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const authResponse = (await response.json()) as AuthResponse;
      setAuthSession(createAuthSession(authResponse));
      setStatus("success");
      navigate("/dashboard");
    } catch {
      setStatus("error");
      setToast("Login failed, please try again");
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(22px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .anim-hero {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.05s;
        }

        .anim-card {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.12s;
        }

        .anim-inputs {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.2s;
        }

        .anim-btn {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.28s;
        }

        .anim-forgot {
          animation: fadeSlideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.36s;
        }

        .login-btn,
        .ghost-chip,
        .top-pill {
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 20px 46px rgba(57, 132, 204, 0.26) !important;
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .login-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .ghost-chip:hover,
        .top-pill:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(2, 8, 22, 0.24);
        }

        .ghost-chip:active,
        .top-pill:active {
          transform: translateY(1px);
        }

        .forgot-link {
          transition: color 0.2s ease;
        }

        .forgot-link:hover {
          color: rgba(255, 255, 255, 0.78);
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

        .toast {
          animation: toastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .pill-input {
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        .pill-input:hover:not(:focus) {
          border-color: rgba(255, 255, 255, 0.16) !important;
          background: rgba(255, 255, 255, 0.065) !important;
        }
      `}</style>

      <div className="relative min-h-screen w-full overflow-hidden" style={recordingThemePageStyle}>
        <RecordingThemeBackdrop />

        <div className="absolute right-5 top-5 z-20">
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className="top-pill rounded-xl px-5 py-2.5 text-sm font-medium"
            style={{ ...recordingThemePillButtonStyle, cursor: "pointer" }}
          >
            Sign Up
          </button>
        </div>

        {toast && (
          <div
            role="alert"
            aria-live="assertive"
            className="toast fixed left-1/2 top-6 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-sm"
            style={{
              transform: "translateX(-50%)",
              background: "rgba(37,10,16,0.82)",
              border: "1px solid rgba(248,113,113,0.2)",
              color: "rgba(254,202,202,0.95)",
              boxShadow: "0 16px 40px rgba(52,10,18,0.34)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              whiteSpace: "nowrap",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,120,120,0.9)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {toast}
          </div>
        )}

        <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10 sm:px-6 sm:py-14">
          <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <section className={mounted ? "anim-hero" : "opacity-0"}>
              <div
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  ...recordingThemePillButtonStyle,
                  color: "#90caff",
                }}
              >
                Live meetings, recordings, and AI review
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                One calmer place to run every meeting room.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7" style={recordingThemeMutedTextStyle}>
                Sign in to start rooms, manage participants, review recordings, and trigger safety
                analysis without jumping between different tools.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["Fast room access", "Recording review", "AI analysis jobs"].map((item) => (
                  <div
                    key={item}
                    className="ghost-chip rounded-full px-4 py-2 text-sm"
                    style={recordingThemePillButtonStyle}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`rounded-[28px] p-6 sm:p-8 ${mounted ? "anim-card" : "opacity-0"}`}
              style={recordingThemeSurfaceStrongStyle}
            >
              <img src="/SixDX White.svg" alt="SixDX" style={{ height: 34 }} />
              <div className="mt-8">
                <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
                <p className="mt-2 text-sm leading-6" style={recordingThemeSubtleTextStyle}>
                  Use your identifier and password to get back into your workspace.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-8 w-full">
                <div className={`mb-4 space-y-3 ${mounted ? "anim-inputs" : "opacity-0"}`}>
                  <PillInput
                    id="identifier"
                    type="text"
                    placeholder="Identifier"
                    value={form.identifier}
                    onChange={handleChange("identifier")}
                    autoComplete="username"
                    error={errors.identifier}
                    touched={touched.identifier}
                    onBlur={() => handleBlur("identifier")}
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

                <div className={`mb-1 ${mounted ? "anim-btn" : "opacity-0"}`}>
                  <button
                    type="submit"
                    disabled={isLoading || (touched.identifier && touched.password && !isFormValid)}
                    className="login-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                    style={{
                      ...recordingThemePrimaryButtonStyle,
                      cursor: isLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <span className="spin-ring" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      "Log in"
                    )}
                  </button>
                </div>

                <div className={`mt-4 ${mounted ? "anim-forgot" : "opacity-0"}`}>
                  <button
                    type="button"
                    className="forgot-link text-left text-xs"
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.48)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    onClick={() => {
                      // Placeholder for future password reset flow.
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
