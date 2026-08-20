import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { useAuth } from "../context/AuthContext";
import VerifyEmailModal from "../components/VerifyEmailModal";

// Rotating tips from Nova, the mascot who narrates how scoring works —
// genuinely useful info, not just decorative filler.
const MASCOT_TIPS = [
  "I check skills exactly as you type them — list them the way they'd appear on a resume.",
  "I separate real work experience from college projects and unrelated jobs automatically.",
  "One zip file, any number of resumes — I'll read every single one.",
  "I always explain why a score landed where it did, not just the number.",
];

// The 3-step pipeline shown in the sidebar — mirrors what actually happens
// server-side once a zip is uploaded (see jobController.js), so it's an
// accurate preview, not just decoration.
const FLOW_STEPS = [
  {
    title: "Upload",
    body: "Drop in a .zip of resumes — pdf, docx, or txt, any number at once.",
  },
  {
    title: "Score",
    body: "Each resume is read and compared against the role's required and preferred skills.",
  },
  {
    title: "Rank & explain",
    body: "Candidates are ranked with a plain-language reason behind every score.",
  },
];

// The company is no longer typed in on this page — it comes from the
// logged-in session (see AuthContext). The backend also re-derives the
// companyId from the JWT on every request, so a job can never be created
// under a company other than the one that's actually logged in.
export default function CreateJob() {
  const navigate = useNavigate();
  const { company } = useAuth();
  const [form, setForm] = useState({
    title: "",
    description: "",
    requiredSkills: "",
    preferredSkills: "",
    minExperienceYears: 0,
  });
  const [zipFile, setZipFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [tipIndex, setTipIndex] = useState(0);
  const [showVerifyModal, setShowVerifyModal] = useState(false);

  // Tracks whether THIS visit started out unverified, so we know to show a
  // "just verified!" confirmation the moment it flips true — rather than
  // showing that confirmation on every future visit for someone who was
  // already verified long ago.
  const wasUnverifiedRef = useRef(company ? !company.isVerified : false);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    if (!company) return;
    if (wasUnverifiedRef.current && company.isVerified) {
      setJustVerified(true);
      setShowVerifyModal(false); // no need for the modal anymore if it was open
      const timer = setTimeout(() => setJustVerified(false), 6000);
      return () => clearTimeout(timer);
    }
    wasUnverifiedRef.current = !company.isVerified;
  }, [company?.isVerified]);

  useEffect(() => {
    const id = setInterval(() => setTipIndex((i) => (i + 1) % MASCOT_TIPS.length), 5000);
    return () => clearInterval(id);
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function adjustExperience(delta) {
    setForm((f) => ({
      ...f,
      minExperienceYears: Math.max(0, Math.round((Number(f.minExperienceYears) + delta) * 10) / 10),
    }));
  }

  function pickZip(fileList) {
    const file = fileList?.[0];
    if (file) setZipFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    pickZip(e.dataTransfer.files);
  }

  const unverified = company && !company.isVerified;

  // Live checklist for the sidebar — reflects real form state, not just
  // decoration, so it fills out (and stays useful) as the person types.
  const roleReady = form.title.trim().length > 0 && form.description.trim().length > 0;
  const skillsReady = form.requiredSkills.trim().length > 0;
  const resumesReady = Boolean(zipFile);
  const readyCount = [roleReady, skillsReady, resumesReady].filter(Boolean).length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!zipFile) {
      setError("Please attach a .zip file of resumes.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the job (companyId is attached server-side from the JWT)
      const jobRes = await api.post("/jobs", {
        title: form.title,
        description: form.description,
        requiredSkills: form.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
        preferredSkills: form.preferredSkills.split(",").map((s) => s.trim()).filter(Boolean),
        minExperienceYears: Number(form.minExperienceYears) || 0,
      });
      const jobId = jobRes.data._id;

      // 2. Upload the resume zip -> triggers background scoring
      const formData = new FormData();
      formData.append("file", zipFile);
      await api.post(`/jobs/${jobId}/resumes`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // 3. Go to the results page, which will poll status until scoring completes
      navigate(`/jobs/${jobId}/results`);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="postjob-page postjob-page-wide">
      <div className="postjob-blobs" aria-hidden="true">
        <span className="blob blob-mint postjob-blob-1" />
        <span className="blob blob-violet postjob-blob-2" />
      </div>

      <div className="postjob-header">
        <span className="postjob-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M3 12h18" />
          </svg>
        </span>
        <div>
          <h1>Post a New Job</h1>
          <p className="subtitle">
            Posting as <strong>{company?.name}</strong>
            <span className="postjob-email">{company?.email}</span>
          </p>
        </div>
      </div>

      {unverified && (
        <div className="verify-nudge postjob-verify-nudge">
          <div className="verify-nudge-row">
            <span className="verify-nudge-icon" aria-hidden="true">✉</span>
            <p>Verify your email before posting a job.</p>
            <button type="button" className="verify-nudge-link" onClick={() => setShowVerifyModal(true)}>
              Verify now →
            </button>
          </div>
        </div>
      )}

      {justVerified && (
        <div className="verify-success postjob-verify-nudge">
          <div className="verify-nudge-row">
            <span className="verify-success-icon" aria-hidden="true">✓</span>
            <p>Email verified — you're all set to post this job.</p>
            <button
              type="button"
              className="verify-nudge-dismiss"
              onClick={() => setJustVerified(false)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div className="postjob-layout">
        <form onSubmit={handleSubmit} className="postjob-form">
          <section className="postjob-card postjob-card-coral">
            <div className="postjob-card-head">
              <span className="postjob-card-icon postjob-card-icon-coral" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6M9 17h6" />
                </svg>
              </span>
              <h2>The role</h2>
            </div>
            <p className="postjob-card-tip">💡 Be specific — vague descriptions make it harder to judge fit.</p>

            <div className="job-field">
              <label htmlFor="title">Job title</label>
              <input
                id="title"
                name="title"
                placeholder="e.g. Backend Developer"
                value={form.title}
                onChange={handleChange}
                required
              />
            </div>
            <div className="job-field">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="What will this person actually do day to day?"
                rows={5}
                value={form.description}
                onChange={handleChange}
                required
              />
            </div>
          </section>

          <section className="postjob-card postjob-card-mint">
            <div className="postjob-card-head">
              <span className="postjob-card-icon postjob-card-icon-mint" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              </span>
              <h2>Skills &amp; experience</h2>
            </div>
            <p className="postjob-card-tip">
              💡 List skills the way a candidate would write them (e.g. "Node.js", not "NodeJS") for the most
              accurate matching.
            </p>

            <div className="job-field">
              <label htmlFor="requiredSkills">Required skills</label>
              <input
                id="requiredSkills"
                name="requiredSkills"
                placeholder="Node.js, MongoDB, REST API"
                value={form.requiredSkills}
                onChange={handleChange}
                required
              />
              <span className="job-field-hint">Comma-separated</span>
            </div>
            <div className="job-field">
              <label htmlFor="preferredSkills">
                Preferred skills <span className="job-field-optional">optional</span>
              </label>
              <input
                id="preferredSkills"
                name="preferredSkills"
                placeholder="Docker, GraphQL"
                value={form.preferredSkills}
                onChange={handleChange}
              />
            </div>
            <div className="job-field">
              <label>Minimum experience</label>
              <div className="postjob-stepper">
                <button
                  type="button"
                  className="postjob-stepper-btn"
                  onClick={() => adjustExperience(-0.5)}
                  aria-label="Decrease minimum experience"
                >
                  −
                </button>
                <span className="postjob-stepper-value">
                  {form.minExperienceYears} <small>{form.minExperienceYears === 1 ? "year" : "years"}</small>
                </span>
                <button
                  type="button"
                  className="postjob-stepper-btn"
                  onClick={() => adjustExperience(0.5)}
                  aria-label="Increase minimum experience"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <section className="postjob-card postjob-card-violet">
            <div className="postjob-card-head">
              <span className="postjob-card-icon postjob-card-icon-violet" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="M17 8l-5-5-5 5" />
                  <path d="M12 3v12" />
                </svg>
              </span>
              <h2>Resumes</h2>
            </div>
            <p className="postjob-card-tip">💡 Works with .pdf, .docx, and .txt — any number of resumes in one zip.</p>

            <label
              htmlFor="resumeZip"
              className={
                "postjob-dropzone" +
                (dragActive ? " postjob-dropzone-active" : "") +
                (zipFile ? " postjob-dropzone-filled" : "")
              }
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              <input
                id="resumeZip"
                type="file"
                accept=".zip"
                onChange={(e) => pickZip(e.target.files)}
                required
                hidden
              />
              {zipFile ? (
                <>
                  <span className="postjob-dropzone-check" aria-hidden="true">✓</span>
                  <span className="postjob-dropzone-filename">{zipFile.name}</span>
                  <span className="postjob-dropzone-hint">Click or drop to replace</span>
                </>
              ) : (
                <>
                  <span className="postjob-dropzone-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" />
                      <path d="M7 8l5-5 5 5" />
                      <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
                    </svg>
                  </span>
                  <span className="postjob-dropzone-title">Click to choose, or drag a .zip file here</span>
                  <span className="postjob-dropzone-hint">.pdf, .docx, or .txt resumes inside</span>
                </>
              )}
            </label>
          </section>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn btn-primary postjob-submit" disabled={submitting || unverified}>
            {submitting ? "Submitting..." : unverified ? "Verify your email to post a job" : "Filter Resumes"}
          </button>
        </form>

        <aside className="postjob-sidebar">
          <div className="postjob-mascot-card">
            <span className="postjob-mascot-name">✨ Nova</span>
            <span className="postjob-mascot-icon" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="postjobMachineGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="var(--coral)" />
                    <stop offset="100%" stopColor="var(--mint)" />
                  </linearGradient>
                </defs>
                <circle className="flow-gear-ring" cx="60" cy="60" r="46" />
                <rect className="flow-machine-body" x="28" y="28" width="64" height="64" rx="16" style={{ fill: "url(#postjobMachineGrad)" }} />
                <rect className="flow-slot" x="20" y="52" width="12" height="16" rx="4" />
                <rect className="flow-slot" x="88" y="46" width="12" height="16" rx="4" />
                <polygon
                  className="flow-star"
                  points="60,44 65,55 77,55 67,63 71,75 60,67 49,75 53,63 43,55 55,55"
                />
              </svg>
            </span>
            <div className="postjob-mascot-bubble" key={tipIndex}>
              <p>{MASCOT_TIPS[tipIndex]}</p>
            </div>
          </div>

          <div className="postjob-progress-card">
            <div className="postjob-progress-head">
              <h3>Job post checklist</h3>
              <span className="postjob-progress-count">{readyCount}/3</span>
            </div>
            <div className="postjob-progress-bar">
              <div
                className="postjob-progress-fill"
                style={{ width: `${(readyCount / 3) * 100}%` }}
              />
            </div>
            <ul className="postjob-progress-list">
              <li className={roleReady ? "done" : ""}>
                <span className="postjob-progress-check" aria-hidden="true">
                  {roleReady ? "✓" : ""}
                </span>
                Role details
              </li>
              <li className={skillsReady ? "done" : ""}>
                <span className="postjob-progress-check" aria-hidden="true">
                  {skillsReady ? "✓" : ""}
                </span>
                Required skills
              </li>
              <li className={resumesReady ? "done" : ""}>
                <span className="postjob-progress-check" aria-hidden="true">
                  {resumesReady ? "✓" : ""}
                </span>
                Resumes attached
              </li>
            </ul>
            {readyCount === 3 && <p className="postjob-progress-ready">All set — ready to submit 🎉</p>}
          </div>

          <div className="postjob-flow-card">
            <h3>How scoring works</h3>
            <ol className="postjob-flow-steps">
              {FLOW_STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="postjob-flow-dot">{i + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="postjob-badges-card">
            <h3>Why teams like it</h3>
            <div className="postjob-badges">
              <span className="postjob-badge">⚡ Fast</span>
              <span className="postjob-badge">🔍 Explainable</span>
              <span className="postjob-badge">⚖️ Consistent</span>
            </div>
          </div>
        </aside>
      </div>

      {showVerifyModal && (
        <VerifyEmailModal email={company?.email} onClose={() => setShowVerifyModal(false)} />
      )}
    </div>
  );
}
