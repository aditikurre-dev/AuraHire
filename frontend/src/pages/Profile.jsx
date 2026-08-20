import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/api";
import AvatarPickerModal, { PRESET_AVATARS, PresetIcon } from "../components/AvatarPickerModal";
import CompanyProfileModal from "../components/CompanyProfileModal";

const RESEND_COOLDOWN_SECONDS = 45;

const STATUS_LABELS = {
  created: "Created",
  queued: "Queued",
  processing: "Scoring…",
  completed: "Completed",
  failed: "Failed",
};

// A stable, pleasant gradient pair for the avatar — derived from the
// company name itself, so the same company always gets the same colors
// rather than a random one on every page load.
const AVATAR_GRADIENTS = [
  ["var(--coral)", "var(--tangerine)"],
  ["var(--mint)", "#22d3b8"],
  ["var(--violet)", "#9c8bff"],
  ["var(--tangerine)", "var(--sunny)"],
];

function initialsOf(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase()).join("") || "?";
}

function gradientFor(name) {
  const sum = (name || "").split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[sum % AVATAR_GRADIENTS.length];
}

// SVG ring around the avatar showing profile completion — the meter itself
// is drawn here (stroke-dasharray math), not left to CSS, since it needs
// the exact circle circumference to animate a partial arc correctly.
function CompletionRing({ percent, size = 84, stroke = 4 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  const complete = percent >= 100;
  return (
    <svg className="profile-completion-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--illus-line)"
        strokeWidth={stroke}
      />
      {percent > 0 && (
        <circle
          className={complete ? "profile-completion-ring-complete" : ""}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? "var(--mint)" : "url(#completionGradient)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <defs>
        <linearGradient id="completionGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--coral)" />
          <stop offset="100%" stopColor="var(--violet)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function Profile() {
  const { company, resendVerification, refreshCompany } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);

  useEffect(() => {
    api
      .get("/jobs")
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalResumes = jobs.reduce((sum, j) => sum + (j.candidateCount || 0), 0);
    const totalShortlisted = jobs.reduce((sum, j) => sum + (j.shortlistedCount || 0), 0);
    return { totalJobs: jobs.length, totalResumes, totalShortlisted };
  }, [jobs]);

  // Company details + contact person are already collected via
  // CompanyProfileModal, but were never actually displayed anywhere on the
  // page itself — only editable, never visible. Surfacing them here (with
  // an empty-state nudge per section when nothing's filled in yet) is real
  // profile content, not decoration.
  const companyFacts = useMemo(
    () =>
      [
        { key: "industry", icon: "🏭", label: "Industry", value: company?.industry },
        { key: "companySize", icon: "👥", label: "Company size", value: company?.companySize },
        { key: "website", icon: "🌐", label: "Website", value: company?.website, isLink: true },
        { key: "location", icon: "📍", label: "Headquarters", value: company?.location },
        { key: "foundedYear", icon: "📅", label: "Founded", value: company?.foundedYear },
      ].filter((f) => f.value),
    [company]
  );

  const contactFacts = useMemo(
    () =>
      [
        { key: "contactName", icon: "🧑", label: "Contact", value: company?.contactName },
        { key: "designation", icon: "💼", label: "Designation", value: company?.designation },
        { key: "phone", icon: "📞", label: "Phone", value: company?.phone },
        { key: "linkedin", icon: "🔗", label: "LinkedIn", value: company?.linkedin, isLink: true },
      ].filter((f) => f.value),
    [company]
  );

  const recentJobs = jobs.slice(0, 3);

  const memberSince = company?.createdAt
    ? new Date(company.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : null;

  const [avatarFrom, avatarTo] = gradientFor(company?.name);

  async function handleResend() {
    if (resending || cooldown > 0) return;
    setResending(true);
    setResendMessage("");
    try {
      await resendVerification(company.email);
      setResendMessage("Verification link resent — check your inbox.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      const tick = setInterval(() => {
        setCooldown((s) => {
          if (s <= 1) {
            clearInterval(tick);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setResendMessage("Couldn't resend — please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-blobs" aria-hidden="true">
        <span className="blob blob-violet profile-blob-1" />
        <span className="blob blob-mint profile-blob-2" />
      </div>

      <div className="profile-hero">
        <div className="profile-avatar-wrap profile-avatar-wrap-ringed">
          <CompletionRing percent={company?.profileCompletion ?? 0} />
          {company?.avatarType === "upload" && company.avatarValue ? (
            <img src={company.avatarValue} alt="" className="profile-avatar profile-avatar-img" />
          ) : company?.avatarType === "preset" && company.avatarValue ? (
            <div
              className="profile-avatar"
              style={{
                background: `linear-gradient(135deg, ${
                  PRESET_AVATARS.find((p) => p.id === company.avatarValue)?.colors[0] || avatarFrom
                }, ${PRESET_AVATARS.find((p) => p.id === company.avatarValue)?.colors[1] || avatarTo})`,
              }}
              aria-hidden="true"
            >
              <PresetIcon id={company.avatarValue} />
            </div>
          ) : (
            <div
              className="profile-avatar"
              style={{ background: `linear-gradient(135deg, ${avatarFrom}, ${avatarTo})` }}
              aria-hidden="true"
            >
              {initialsOf(company?.name)}
            </div>
          )}
          <span className="profile-completion-badge" title={`Profile ${company?.profileCompletion ?? 0}% complete`}>
            {company?.profileCompletion ?? 0}%
          </span>
          <button
            type="button"
            className="profile-avatar-edit"
            onClick={() => setAvatarPickerOpen(true)}
            aria-label="Change profile picture"
            title="Change profile picture"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>
        </div>
        <div className="profile-hero-info">
          <button
            type="button"
            className="profile-name-edit"
            onClick={() => setDetailsOpen(true)}
            title="Edit company details"
          >
            <h1>{company?.name}</h1>
            <svg className="profile-name-edit-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
            </svg>
          </button>
          <div className="profile-hero-meta">
            <span>{company?.email}</span>
            {company?.isVerified ? (
              <span className="verify-badge verify-badge-verified">✓ Verified</span>
            ) : (
              <span className="verify-badge verify-badge-unverified">Not verified</span>
            )}
          </div>
          {memberSince && <p className="profile-member-since">Member since {memberSince}</p>}
        </div>
      </div>

      {!company?.isVerified && (
        <div className="verify-nudge profile-verify-nudge">
          <div className="verify-nudge-row">
            <span className="verify-nudge-icon" aria-hidden="true">✉</span>
            <div>
              <p>Verify your email to unlock posting jobs.</p>
              <div className="profile-resend-row">
                {cooldown > 0 ? (
                  <span className="auth-hint">You can resend in {cooldown}s</span>
                ) : (
                  <button type="button" className="resend-link" onClick={handleResend} disabled={resending}>
                    {resending ? "Sending…" : "Resend verification link"}
                  </button>
                )}
                <button type="button" className="resend-link profile-refresh-link" onClick={refreshCompany}>
                  I've verified — refresh status
                </button>
              </div>
              {resendMessage && <p className="auth-hint resend-feedback">{resendMessage}</p>}
            </div>
          </div>
        </div>
      )}

      <div className="profile-stats-grid">
        <div className="profile-stat-card profile-stat-coral">
          <span className="profile-stat-icon" aria-hidden="true">📋</span>
          <span className="profile-stat-value">{jobsLoading ? "…" : stats.totalJobs}</span>
          <span className="profile-stat-label">Jobs posted</span>
        </div>
        <div className="profile-stat-card profile-stat-mint">
          <span className="profile-stat-icon" aria-hidden="true">📄</span>
          <span className="profile-stat-value">{jobsLoading ? "…" : stats.totalResumes}</span>
          <span className="profile-stat-label">Resumes screened</span>
        </div>
        <div className="profile-stat-card profile-stat-violet">
          <span className="profile-stat-icon" aria-hidden="true">⭐</span>
          <span className="profile-stat-value">{jobsLoading ? "…" : stats.totalShortlisted}</span>
          <span className="profile-stat-label">Shortlisted</span>
        </div>
        <div className="profile-stat-card profile-stat-sunny">
          <span className="profile-stat-icon" aria-hidden="true">🗓️</span>
          <span className="profile-stat-value profile-stat-value-small">{memberSince || "—"}</span>
          <span className="profile-stat-label">Member since</span>
        </div>
      </div>

      <div className="profile-actions">
        {company?.isVerified ? (
          <Link to="/create-job" className="btn btn-primary">
            Post a New Job
          </Link>
        ) : (
          <button type="button" className="btn btn-primary" disabled title="Verify your email first">
            Post a New Job
          </button>
        )}
        <Link to="/jobs" className="btn btn-secondary">
          Job History
        </Link>
        <Link to="/shortlisted" className="btn btn-secondary">
          Shortlisted
        </Link>
      </div>

      <section className="profile-info-grid">
        <div className="postjob-card postjob-card-coral profile-info-card profile-about-card">
          <div className="postjob-card-head">
            <span className="postjob-card-icon postjob-card-icon-coral" aria-hidden="true">📝</span>
            <h2>About {company?.name}</h2>
          </div>
          {company?.about ? (
            <p className="profile-about-text">{company.about}</p>
          ) : (
            <div className="profile-empty-hint">
              <p>Add a short description of what your company does.</p>
            </div>
          )}
          <button type="button" className="resend-link profile-edit-link" onClick={() => setDetailsOpen(true)}>
            {company?.about ? "Edit description" : "+ Add description"}
          </button>
        </div>

        <div className="postjob-card postjob-card-violet profile-info-card">
          <div className="postjob-card-head">
            <span className="postjob-card-icon postjob-card-icon-violet" aria-hidden="true">🏢</span>
            <h2>Company details</h2>
          </div>
          {companyFacts.length > 0 ? (
            <ul className="profile-fact-list">
              {companyFacts.map((f) => (
                <li key={f.key}>
                  <span className="profile-fact-icon" aria-hidden="true">{f.icon}</span>
                  <span className="profile-fact-label">{f.label}</span>
                  {f.isLink ? (
                    <a
                      href={f.value.startsWith("http") ? f.value : `https://${f.value}`}
                      target="_blank"
                      rel="noreferrer"
                      className="profile-fact-value profile-fact-link"
                    >
                      {f.value}
                    </a>
                  ) : (
                    <span className="profile-fact-value">{f.value}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="profile-empty-hint">
              <p>Add your industry, size, and location.</p>
            </div>
          )}
          <button type="button" className="resend-link profile-edit-link" onClick={() => setDetailsOpen(true)}>
            {companyFacts.length > 0 ? "Edit details" : "+ Add company details"}
          </button>
        </div>

        <div className="postjob-card postjob-card-mint profile-info-card">
          <div className="postjob-card-head">
            <span className="postjob-card-icon postjob-card-icon-mint" aria-hidden="true">🙋</span>
            <h2>Contact person</h2>
          </div>
          {contactFacts.length > 0 ? (
            <ul className="profile-fact-list">
              {contactFacts.map((f) => (
                <li key={f.key}>
                  <span className="profile-fact-icon" aria-hidden="true">{f.icon}</span>
                  <span className="profile-fact-label">{f.label}</span>
                  {f.isLink ? (
                    <a
                      href={f.value.startsWith("http") ? f.value : `https://${f.value}`}
                      target="_blank"
                      rel="noreferrer"
                      className="profile-fact-value profile-fact-link"
                    >
                      {f.value}
                    </a>
                  ) : (
                    <span className="profile-fact-value">{f.value}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="profile-empty-hint">
              <p>Add who should be reached for this account.</p>
            </div>
          )}
          <button type="button" className="resend-link profile-edit-link" onClick={() => setDetailsOpen(true)}>
            {contactFacts.length > 0 ? "Edit contact" : "+ Add contact person"}
          </button>
        </div>
      </section>

      <section className="profile-activity">
        <h2>Recent activity</h2>

        {!jobsLoading && jobs.length === 0 && (
          <div className="history-empty">
            <p>You haven't posted a job yet.</p>
            {company?.isVerified && (
              <Link to="/create-job" className="btn btn-primary">
                Post your first job
              </Link>
            )}
          </div>
        )}

        {recentJobs.length > 0 && (
          <ul className="history-list">
            {recentJobs.map((job) => (
              <li key={job._id} className="history-row">
                <div className="history-row-main">
                  <strong>{job.title}</strong>
                  <span className={`status-pill status-pill-${job.status}`}>
                    {STATUS_LABELS[job.status] || job.status}
                  </span>
                  {job.shortlistedCount > 0 && (
                    <Link to={`/jobs/${job._id}/results`} className="shortlist-badge">
                      ⭐ {job.shortlistedCount} shortlisted
                    </Link>
                  )}
                </div>
                <div className="history-row-meta">
                  <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                  <Link to={`/jobs/${job._id}/results`}>View results →</Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {jobs.length > 3 && (
          <Link to="/jobs" className="profile-view-all">
            View all {jobs.length} jobs →
          </Link>
        )}
      </section>

      {avatarPickerOpen && <AvatarPickerModal onClose={() => setAvatarPickerOpen(false)} />}
      {detailsOpen && <CompanyProfileModal onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}
