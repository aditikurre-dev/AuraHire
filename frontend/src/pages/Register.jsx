import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";

const NAME_REGEX = /^[A-Za-z0-9\s.,&-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_CHECK_DEBOUNCE_MS = 500;

const PASSWORD_CHECKS = [
  { key: "length", label: "At least 6 characters", test: (pw) => pw.length >= 6 },
  { key: "upper", label: "One uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { key: "lower", label: "One lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { key: "number", label: "One number (0-9)", test: (pw) => /\d/.test(pw) },
  { key: "symbol", label: "One symbol (!@#$%...)", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];
export default function Register() {
  const { register, verifyEmail } = useAuth();
  const [searchParams] = useSearchParams();
  const verifyToken = searchParams.get("verify");

  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirmPassword: false });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailExists, setEmailExists] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const emailCheckRequestId = useRef(0);

  // After a successful registration, we show a "check your email" panel
  // instead of navigating away — the account isn't usable until verified.
  const [registered, setRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // If this page was opened from the link in the verification email
  // (…/register?verify=<token>), verify it on mount.
  const [verifyStatus, setVerifyStatus] = useState(verifyToken ? "checking" : "idle");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const verifiedTokenRef = useRef(null);

  useEffect(() => {
    if (!verifyToken) return;
    // Guard against React 18 Strict Mode's dev-only double-invoke of
    // effects: without this, verifyEmail() fires twice for the same token —
    // the first call succeeds and consumes the token (moves the account
    // from pending to verified), then the second call hits the same token
    // again, finds it already gone, and overwrites "success" with
    // "invalid or expired" a moment later. This ref makes sure a given
    // token is only ever sent to the backend once, however many times the
    // effect itself re-runs.
    if (verifiedTokenRef.current === verifyToken) return;
    verifiedTokenRef.current = verifyToken;

    setVerifyStatus("checking");
    verifyEmail(verifyToken)
      .then((data) => {
        setVerifiedEmail(data.email || "");
        setVerifyStatus("success");
        // Let any other same-origin tab (e.g. the original registration tab,
        // still showing "Check your email") know verification just
        // succeeded, so it can also move straight to the "Email verified!"
        // screen without a manual refresh.
        try {
          localStorage.setItem(
            "aurahire_verify_broadcast",
            JSON.stringify({ email: data.email || "", ts: Date.now() })
          );
        } catch {
          // localStorage can fail in rare cases (private browsing, storage
          // disabled) — cross-tab sync is a nicety, not required, so just
          // skip it silently rather than breaking verification itself.
        }
      })
      .catch((err) => {
        setVerifyStatus("error");
        setVerifyMessage(err.response?.data?.error || "This verification link is invalid or has expired.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyToken]);

  // Listen for that broadcast on the "Check your email" screen, so this tab
  // automatically flips to "Email verified!" the moment verification
  // completes in the other tab — no manual refresh needed. By the time this
  // fires, the account has already been created on the backend.
  useEffect(() => {
    if (!registered || verifyStatus === "success") return;

    function handleStorage(e) {
      if (e.key !== "aurahire_verify_broadcast" || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        if (data.email && data.email === registeredEmail) {
          setVerifiedEmail(data.email);
          setVerifyStatus("success");
        }
      } catch {
        // Malformed broadcast payload — ignore it.
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [registered, registeredEmail, verifyStatus]);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  }

  function handleBlur(e) {
    setTouched({ ...touched, [e.target.name]: true });
  }

  const nameTrimmed = form.name.trim();
  const nameValid = nameTrimmed !== "" && NAME_REGEX.test(nameTrimmed);
  const nameError = touched.name && !nameValid
    ? nameTrimmed === ""
      ? "Company name is required."
      : "Only letters, numbers, and basic punctuation (. , & -) are allowed."
    : "";

  const emailValid = EMAIL_REGEX.test(form.email);
  const emailFormatError = touched.email && form.email && !emailValid ? "Enter a valid email address." : "";
  const emailExistsError = emailValid && emailExists ? "A company with this email already exists." : "";
  const emailError = emailFormatError || emailExistsError;

  // Live "is this email already registered?" check — debounced so it fires
  // shortly after typing stops rather than on every keystroke. The message
  // clears immediately when the email changes and only reappears once the
  // (new) email is confirmed to exist.
  useEffect(() => {
    setEmailExists(false);

    if (!emailValid) {
      setCheckingEmail(false);
      return;
    }

    const emailAtRequestTime = form.email.trim().toLowerCase();
    const requestId = ++emailCheckRequestId.current;
    setCheckingEmail(true);

    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/companies/check-email", { params: { email: emailAtRequestTime } });
        // Ignore this result if the email has changed again since we fired it
        if (requestId === emailCheckRequestId.current) {
          setEmailExists(Boolean(res.data.exists));
        }
      } catch {
        // Transient network error — don't block typing over it; the real
        // duplicate check still runs again on submit regardless.
      } finally {
        if (requestId === emailCheckRequestId.current) {
          setCheckingEmail(false);
        }
      }
    }, EMAIL_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [form.email, emailValid]);

  const passwordValid = PASSWORD_CHECKS.every((c) => c.test(form.password));
  const passwordScore = PASSWORD_CHECKS.filter((c) => c.test(form.password)).length;
  const passwordTier = passwordScore <= 2 ? "poor" : passwordScore <= 4 ? "average" : "strong";
  const showPasswordChecklist = touched.password || form.password.length > 0;

  const confirmMatches = form.confirmPassword.length > 0 && form.confirmPassword === form.password;
  const confirmMismatch = form.confirmPassword.length > 0 && form.confirmPassword !== form.password;

  const formValid = nameValid && emailValid && !emailExists && passwordValid && confirmMatches;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    if (!nameValid) {
      setError("Please enter a valid company name.");
      return;
    }
    if (!emailValid) {
      setError("Please enter a valid email address.");
      return;
    }
    if (emailExists) {
      setError("A company with this email already exists.");
      return;
    }
    if (!passwordValid) {
      setError("Password doesn't meet all the requirements below.");
      return;
    }
    if (!confirmMatches) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const { confirmPassword, ...credentials } = form;
      credentials.name = credentials.name.trim();
      const data = await register(credentials);
      setRegisteredEmail(data.email || credentials.email);
      setRegistered(true);
    } catch (err) {
      if (err.response) {
        // Backend responded with an error (e.g. duplicate email, validation failure).
        setError(err.response.data?.error || "Something went wrong. Please try again.");
      } else if (err.request) {
        // Request was sent but no response came back — backend down, wrong port, CORS, etc.
        setError("Could not reach the server. Make sure the backend is running, then try again.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // --- Verifying a link from the emailed verification button ---
  if (verifyStatus === "checking") {
    return (
      <div className="auth-shell">
        <div className="auth-blobs" aria-hidden="true">
          <span className="blob blob-tangerine" />
          <span className="blob blob-violet" />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card auth-status-card">
            <p>Verifying your email...</p>
          </div>
        </div>
      </div>
    );
  }

  if (verifyStatus === "success") {
    return (
      <div className="auth-shell">
        <div className="auth-blobs" aria-hidden="true">
          <span className="blob blob-tangerine" />
          <span className="blob blob-violet" />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card auth-status-card">
            <div className="status-icon status-icon-success">✓</div>
            <h2>Email verified!</h2>
            <p className="auth-subtitle">You're all set — you can close this tab.</p>
          </div>
        </div>
      </div>
    );
  }

  if (verifyStatus === "error") {
    return (
      <div className="auth-shell">
        <div className="auth-blobs" aria-hidden="true">
          <span className="blob blob-tangerine" />
          <span className="blob blob-violet" />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card auth-status-card">
            <div className="status-icon status-icon-error">✕</div>
            <h2>Verification failed</h2>
            <p className="auth-subtitle">{verifyMessage}</p>
            <Link to="/register" className="btn btn-secondary auth-submit">
              Back to registration
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Just registered: send them to log in ---
  if (registered) {
    return (
      <div className="auth-shell">
        <div className="auth-blobs" aria-hidden="true">
          <span className="blob blob-tangerine" />
          <span className="blob blob-violet" />
        </div>
        <div className="auth-card-wrap">
          <div className="auth-card auth-status-card">
            <div className="status-icon status-icon-success">✓</div>
            <h2>Registration successful!</h2>
            <p className="auth-subtitle">
              Your account for <strong>{registeredEmail}</strong> has been created.
            </p>
            <p className="auth-hint auth-fun-hint">
              Somewhere out there, a stack of resumes is about to get read by someone who isn't you. 🎉
            </p>

            <Link to="/login" className="btn btn-primary auth-submit">
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-blobs" aria-hidden="true">
        <span className="blob blob-tangerine" />
        <span className="blob blob-violet" />
      </div>

      <div className="auth-card-wrap">
        <span className="eyebrow eyebrow-center">Get started — it's free</span>
        <h1>Create your company account</h1>
        <p className="auth-subtitle">
          Register your company to start posting jobs and screening resumes.
        </p>

        <div className="auth-card">
          <form onSubmit={handleSubmit} noValidate>
            {error && <p className="auth-error">{error}</p>}

            <div className="auth-field">
              <label htmlFor="register-name">Company name</label>
              <input
                id="register-name"
                name="name"
                placeholder="Acme Inc."
                value={form.name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={nameError ? "input-invalid" : ""}
                required
              />
              {nameError && <p className="field-error">{nameError}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">HR email</label>
              <input
                id="register-email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={emailError ? "input-invalid" : ""}
                required
              />
              {!emailError && checkingEmail && <p className="auth-hint">Checking availability...</p>}
              {emailError && <p className="field-error">{emailError}</p>}
            </div>

            <div className="auth-field">
              <label htmlFor="register-password">Password</label>
              <input
                id="register-password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                onBlur={handleBlur}
                className={touched.password && !passwordValid ? "input-invalid" : ""}
                required
              />
              {showPasswordChecklist && (
                <div
                  className="pw-strength"
                  role="img"
                  aria-label={`Password strength: ${passwordScore} of ${PASSWORD_CHECKS.length} requirements met`}
                >
                  <div className="pw-strength-track">
                    {PASSWORD_CHECKS.map((check, i) => (
                      <span
                        key={check.key}
                        className={
                          i < passwordScore
                            ? `pw-strength-seg pw-seg-filled pw-tier-${passwordTier}`
                            : "pw-strength-seg"
                        }
                      />
                    ))}
                  </div>
                  <span
                    className={
                      passwordTier === "strong" ? "pw-strength-star pw-star-full" : "pw-strength-star"
                    }
                  />
                </div>
              )}
              {showPasswordChecklist && (
                <ul className="password-checklist">
                  {PASSWORD_CHECKS.map((check) => {
                    const met = check.test(form.password);
                    return (
                      <li key={check.key} className={met ? "checklist-item-met" : "checklist-item-unmet"}>
                        <span className="checklist-icon">{met ? "✓" : "○"}</span>
                        {check.label}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="register-confirm-password">Confirm password</label>
              <input
                id="register-confirm-password"
                name="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={form.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                className={confirmMismatch ? "input-invalid" : confirmMatches ? "input-valid" : ""}
                required
              />
              {confirmMatches && <p className="confirm-feedback confirm-feedback-match">✓ Passwords match</p>}
              {confirmMismatch && <p className="confirm-feedback confirm-feedback-mismatch">✗ Passwords don't match</p>}
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>
        </div>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
