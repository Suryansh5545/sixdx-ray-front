import { useEffect, useState } from "react";
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

type FormStatus = "idle" | "loading" | "error";

interface SignupForm {
  name: string;
  email: string;
  username: string;
  password: string;
}

interface SignupErrors {
  name: string;
  email: string;
  username: string;
  password: string;
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
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{2,20}$/;

function validateName(value: string): string {
  if (!value.trim()) return "This field is required";
  return "";
}

function validateEmail(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!EMAIL_REGEX.test(value)) return "Enter a valid email address";
  return "";
}

function validateUsername(value: string): string {
  if (!value.trim()) return "This field is required";
  if (!USERNAME_REGEX.test(value)) {
    return "3-21 chars, start with a letter, letters/numbers/underscore only";
  }
  return "";
}

function validatePassword(value: string): string {
  if (!value.trim()) return "This field is required";
  if (value.length < 8) return "Minimum 8 characters";
  return "";
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }
  } catch {
    // Ignore parse failures and use the fallback message below.
  }

  return "Account creation failed. Please try again.";
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
}: PillInputProps) {
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

export default function Signup() {
  const navigate = useNavigate();
  const { setAuthSession } = useAppContext();

  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<SignupForm>({
    name: "",
    email: "",
    username: "",
    password: "",
  });
  const [touched, setTouched] = useState<Record<keyof SignupForm, boolean>>({
    name: false,
    email: false,
    username: false,
    password: false,
  });
  const [errors, setErrors] = useState<SignupErrors>({
    name: "",
    email: "",
    username: "",
    password: "",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isLoading = status === "loading";

  function validateField(field: keyof SignupForm, value: string): string {
    if (field === "name") return validateName(value);
    if (field === "email") return validateEmail(value);
    if (field === "username") return validateUsername(value);
    return validatePassword(value);
  }

  function handleChange(field: keyof SignupForm) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [field]: value }));

      if (touched[field]) {
        setErrors((current) => ({
          ...current,
          [field]: validateField(field, value),
        }));
      }
    };
  }

  function handleBlur(field: keyof SignupForm) {
    setTouched((current) => ({ ...current, [field]: true }));
    setErrors((current) => ({
      ...current,
      [field]: validateField(field, form[field]),
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: SignupErrors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      username: validateUsername(form.username),
      password: validatePassword(form.password),
    };

    setErrors(nextErrors);
    setTouched({
      name: true,
      email: true,
      username: true,
      password: true,
    });

    if (nextErrors.name || nextErrors.email || nextErrors.username || nextErrors.password) {
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(buildServerUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorDetail(response));
      }

      const authResponse = (await response.json()) as AuthResponse;
      setAuthSession(createAuthSession(authResponse));
      navigate("/organizations");
    } catch (error) {
      setStatus("error");
      setToast(error instanceof Error ? error.message : "Account creation failed. Please try again.");
      return;
    }

    setStatus("idle");
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

        .su-hero {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.05s;
        }

        .su-card {
          animation: fadeSlideUp 0.58s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.12s;
        }

        .su-form {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.2s;
        }

        .su-btn-wrap {
          animation: fadeSlideUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
          animation-delay: 0.28s;
        }

        .pill-input {
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }

        .pill-input:hover:not(:focus) {
          border-color: rgba(255, 255, 255, 0.16) !important;
          background: rgba(255, 255, 255, 0.065) !important;
        }

        .su-btn,
        .back-btn,
        .ghost-chip {
          transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
        }

        .su-btn:hover:not(:disabled) {
          transform: translateY(-3px);
          box-shadow: 0 20px 46px rgba(57, 132, 204, 0.26) !important;
        }

        .su-btn:active:not(:disabled),
        .back-btn:active,
        .ghost-chip:active {
          transform: translateY(1px);
        }

        .back-btn:hover,
        .ghost-chip:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 28px rgba(2, 8, 22, 0.24);
        }

        .su-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .toast {
          animation: toastIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
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

        <div className="absolute left-5 top-5 z-20">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="back-btn flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
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
            Back to login
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
          <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <section className={mounted ? "su-hero" : "opacity-0"}>
              <div
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  ...recordingThemePillButtonStyle,
                  color: "#90caff",
                }}
              >
                Account setup for meetings and recordings
              </div>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Create access once, then move straight into your workspace.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7" style={recordingThemeMutedTextStyle}>
                Register your account, select an organization, and you are ready to start rooms,
                review recordings, and run AI checks from the same flow.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {["One-step signup", "Room ready access", "Recording review"].map((item) => (
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
              className={`rounded-[28px] p-6 sm:p-8 ${mounted ? "su-card" : "opacity-0"}`}
              style={recordingThemeSurfaceStrongStyle}
            >
              <img src="/SixDX White.svg" alt="SixDX" style={{ height: 34 }} />
              <div className="mt-8">
                <h2 className="text-2xl font-semibold text-white">Create your account</h2>
                <p className="mt-2 text-sm leading-6" style={recordingThemeSubtleTextStyle}>
                  Enter your basic details and we will sign you into the app right away.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-4">
                <div className={`flex flex-col gap-3 ${mounted ? "su-form" : "opacity-0"}`}>
                  <PillInput
                    id="name"
                    type="text"
                    placeholder="Full name"
                    value={form.name}
                    onChange={handleChange("name")}
                    onBlur={() => handleBlur("name")}
                    autoComplete="name"
                    error={errors.name}
                    touched={touched.name}
                  />
                  <PillInput
                    id="email"
                    type="email"
                    placeholder="Email address"
                    value={form.email}
                    onChange={handleChange("email")}
                    onBlur={() => handleBlur("email")}
                    autoComplete="email"
                    error={errors.email}
                    touched={touched.email}
                  />
                  <PillInput
                    id="username"
                    type="text"
                    placeholder="Username"
                    value={form.username}
                    onChange={handleChange("username")}
                    onBlur={() => handleBlur("username")}
                    autoComplete="username"
                    error={errors.username}
                    touched={touched.username}
                  />
                  <PillInput
                    id="password"
                    type="password"
                    placeholder="Password"
                    value={form.password}
                    onChange={handleChange("password")}
                    onBlur={() => handleBlur("password")}
                    autoComplete="new-password"
                    error={errors.password}
                    touched={touched.password}
                  />
                </div>

                <div className={mounted ? "su-btn-wrap" : "opacity-0"}>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="su-btn flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold"
                    style={{
                      ...recordingThemePrimaryButtonStyle,
                      cursor: isLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {isLoading ? (
                      <>
                        <span className="spin-ring" />
                        <span>Creating account...</span>
                      </>
                    ) : (
                      "Create Account"
                    )}
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
