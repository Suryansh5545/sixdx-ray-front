import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { createAuthSession, type AuthResponse } from "../lib/auth";
import { buildServerUrl } from "../lib/server";

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
    // Ignore parse issues and fall back below.
  }

  return "Account creation failed. Please try again.";
}

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
      <div
        className="absolute"
        style={{
          top: "38%",
          left: "-10%",
          width: "80%",
          height: "55%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(100,200,255,0.75) 0%, transparent 65%)",
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
          background: "radial-gradient(ellipse, rgba(60,120,255,0.65) 0%, transparent 65%)",
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
          background: "radial-gradient(ellipse, rgba(130,210,255,0.5) 0%, transparent 60%)",
          filter: "blur(22px)",
          animation: "driftC 13s ease-in-out infinite",
        }}
      />
    </div>
  );
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
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
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
    const timer = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
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
      setToast(
        error instanceof Error ? error.message : "Account creation failed. Please try again.",
      );
      return;
    }

    setStatus("idle");
  }

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
          0%,100% { transform: translate(0%,0%) scale(1); }
          33% { transform: translate(6%,-4%) scale(1.05); }
          66% { transform: translate(-4%,6%) scale(0.97); }
        }
        @keyframes driftB {
          0%,100% { transform: translate(0%,0%) scale(1); }
          40% { transform: translate(-8%,5%) scale(1.08); }
          75% { transform: translate(5%,-3%) scale(0.95); }
        }
        @keyframes driftC {
          0%,100% { transform: translate(0%,0%) scale(1); }
          50% { transform: translate(4%,-6%) scale(1.06); }
        }
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

        .su-logo { animation: fadeSlideUp 0.5s cubic-bezier(0.22,1,0.36,1) both; animation-delay: 0.05s; }
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
          box-shadow:
            0 2px 0 rgba(255,255,255,0.9) inset,
            0 -1px 0 rgba(0,10,80,0.25) inset,
            0 8px 0 rgba(180,200,255,0.25),
            0 12px 24px rgba(0,30,160,0.35),
            0 24px 48px rgba(100,160,255,0.2) !important;
        }
        .su-btn:active:not(:disabled) { transform: translateY(2px); }
        .su-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .back-btn { transition: opacity 0.2s ease; }
        .back-btn:hover { opacity: 0.7; }
        .toast { animation: toastIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
        .spin-ring {
          border: 2px solid rgba(30,80,200,0.2);
          border-top-color: #1a4dcc;
          border-radius: 50%;
          width: 18px;
          height: 18px;
          animation: spinRing 0.75s linear infinite;
          display: inline-block;
        }
      `}</style>

      <div
        className="relative min-h-screen w-full overflow-hidden flex flex-col"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <MeshGradient />

        <div className="absolute top-5 left-5 z-20">
          <button
            onClick={() => navigate("/")}
            className="back-btn flex items-center gap-1.5 text-xs"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(0,0,0,0.45)",
            }}
          >
            <svg
              width="13"
              height="13"
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

        <div className="relative z-10 flex flex-col flex-1 w-full items-center justify-center px-6 py-12">
          <div className="w-full flex flex-col items-center gap-10" style={{ maxWidth: 420 }}>
            <div className={mounted ? "su-logo" : "opacity-0"}>
              <img src="/SixDX Logo.svg" alt="SixDX" style={{ height: 40 }} />
            </div>

            <div className={`flex flex-col items-center gap-3 w-full ${mounted ? "su-form" : "opacity-0"}`}>
              <p
                className="text-sm font-medium"
                style={{ color: "rgba(0,0,0,0.6)", letterSpacing: "0.01em" }}
              >
                Create your account
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="w-full flex flex-col gap-4">
              <div className={`flex flex-col gap-2 ${mounted ? "su-form" : "opacity-0"}`}>
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
                  className="su-btn w-full py-4 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
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
                      <span style={{ fontFamily: "'DM Sans',sans-serif" }}>Creating account...</span>
                    </>
                  ) : (
                    "Create Account"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
