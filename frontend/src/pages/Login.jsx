import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(form);
      navigate("/create-job"); // straight to job creation
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.error || "Invalid email or password.");
      } else if (err.request) {
        setError("Could not reach the server. Make sure the backend is running, then try again.");
      } else {
        setError("Invalid email or password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-blobs" aria-hidden="true">
        <span className="blob blob-coral" />
        <span className="blob blob-mint" />
      </div>

      <div className="auth-card-wrap">
        <span className="eyebrow eyebrow-center">Welcome back</span>
        <h1>Log in to AuraHire</h1>
        <p className="auth-subtitle">Sign in to post jobs and screen resumes for your company.</p>

        <div className="auth-card">
          <form onSubmit={handleSubmit}>
            {error && <p className="auth-error">{error}</p>}

            <div className="auth-field">
              <label htmlFor="login-email">HR email</label>
              <input
                id="login-email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
