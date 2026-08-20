import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

const RESEND_COOLDOWN_SECONDS = 45;

// Popup used from Create Job (and anywhere else that wants a quick "verify
// your email" nudge without navigating the person off whatever they were
// doing). Sends a fresh link the moment it opens, then behaves like the
// resend flow on the Profile page: a cooldown, then a resend button.
export default function VerifyEmailModal({ email, onClose }) {
  const { resendVerification } = useAuth();
  const [status, setStatus] = useState("sending"); // sending | sent | error
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);
  const hasSentRef = useRef(false);

  // Guarded with a ref (not a `cancelled`/AbortController pattern) because
  // React 18 Strict Mode double-invokes effects in dev: mount → cleanup →
  // mount again, synchronously. hasSentRef makes sure the actual network
  // call only fires on the first of those — otherwise the send would fire
  // twice, and the second call would silently issue a fresh token that
  // invalidates the one from the first email (so whichever link the person
  // actually finds/clicks might already be stale).
  //
  // Importantly, this does NOT try to "cancel" that first call once its
  // effect instance is cleaned up — doing so was the actual bug here: the
  // discarded first instance's own promise still resolves (the email really
  // does get sent), but a `cancelled` flag captured in its closure would
  // suppress the resulting setStatus("sent") call, leaving the UI stuck on
  // "Sending a verification link…" forever even though the email had
  // already arrived. Since hasSentRef already guarantees only one request
  // is ever made, there's nothing left to cancel — whichever instance's
  // request is in flight should always be allowed to update the UI when it
  // resolves.
  useEffect(() => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;

    (async () => {
      try {
        await resendVerification(email);
        setStatus("sent");
      } catch {
        setStatus("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "sent" || cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, cooldown]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    try {
      await resendVerification(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setStatus("error");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Verify your email">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="status-icon status-icon-pending">✉</div>

        {status === "sending" && <p className="modal-body-text">Sending a verification link…</p>}

        {status === "sent" && (
          <>
            <h2>Check your email</h2>
            <p className="modal-body-text">
              We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
            </p>
            {cooldown > 0 ? (
              <p className="auth-hint">You can resend in {cooldown}s</p>
            ) : (
              <button type="button" className="resend-link" onClick={handleResend} disabled={resending}>
                {resending ? "Sending…" : "Resend verification link"}
              </button>
            )}
          </>
        )}

        {status === "error" && (
          <>
            <h2>Couldn't send it</h2>
            <p className="modal-body-text">Something went wrong sending the email. Please try again.</p>
            <button type="button" className="resend-link" onClick={handleResend} disabled={resending}>
              {resending ? "Sending…" : "Try again"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
