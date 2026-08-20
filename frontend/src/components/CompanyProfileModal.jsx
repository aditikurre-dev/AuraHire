import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

const INDUSTRY_OPTIONS = [
  "IT Services & Consulting",
  "Software Product",
  "Fintech",
  "E-commerce & Retail",
  "Healthcare & Pharma",
  "Manufacturing",
  "Education",
  "Media & Entertainment",
  "BPO / KPO",
  "Other",
];

const COMPANY_SIZE_OPTIONS = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "501-1000 employees",
  "1000+ employees",
];

const FIELD_DEFS = [
  {
    section: "Company details",
    icon: "🏢",
    accent: "coral",
    fields: [
      { key: "industry", label: "Industry", icon: "🏭", type: "select", options: INDUSTRY_OPTIONS },
      { key: "companySize", label: "Company size", icon: "👥", type: "select", options: COMPANY_SIZE_OPTIONS },
      { key: "website", label: "Website", icon: "🌐", type: "text", placeholder: "https://yourcompany.com" },
      { key: "location", label: "Headquarters", icon: "📍", type: "text", placeholder: "Bengaluru, India" },
      { key: "foundedYear", label: "Founded year", icon: "📅", type: "text", placeholder: "2015" },
      { key: "about", label: "About the company", icon: "📝", type: "textarea", placeholder: "What does your company do?" },
    ],
  },
  {
    section: "Contact person",
    icon: "🙋",
    accent: "violet",
    hint: "The HR or recruiter using this account — shown to no one but kept on file for your own reference.",
    fields: [
      { key: "contactName", label: "Full name", icon: "🧑", type: "text", placeholder: "Priya Sharma" },
      { key: "designation", label: "Designation", icon: "💼", type: "text", placeholder: "HR Manager" },
      { key: "phone", label: "Phone", icon: "📞", type: "text", placeholder: "+91 98765 43210" },
      { key: "linkedin", label: "LinkedIn", icon: "🔗", type: "text", placeholder: "linkedin.com/in/..." },
    ],
  },
];

const ALL_KEYS = FIELD_DEFS.flatMap((s) => s.fields.map((f) => f.key));

export default function CompanyProfileModal({ onClose }) {
  const { company, updateProfile } = useAuth();
  const [form, setForm] = useState(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, company?.[k] || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await updateProfile(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="avatar-modal-overlay" onMouseDown={onClose}>
      <div
        className="avatar-modal company-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Edit company details"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="avatar-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="company-modal-header-icon" aria-hidden="true">🏢</div>
        <h2>Company details</h2>

        <div className="company-modal-locked">
          <div className="company-modal-locked-row">
            <span className="company-modal-locked-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <div>
              <span className="company-modal-locked-label">Company name</span>
              <span className="company-modal-locked-value">{company?.name}</span>
            </div>
          </div>
          <div className="company-modal-locked-row">
            <span className="company-modal-locked-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
            </span>
            <div>
              <span className="company-modal-locked-label">Email</span>
              <span className="company-modal-locked-value">{company?.email}</span>
            </div>
          </div>
          <span className="company-modal-locked-note">🔒 Name and email can't be changed here</span>
        </div>

        {FIELD_DEFS.map((section) => (
          <div className={`postjob-card postjob-card-${section.accent} company-modal-section`} key={section.section}>
            <div className="postjob-card-head">
              <span className={`postjob-card-icon postjob-card-icon-${section.accent}`} aria-hidden="true">
                {section.icon}
              </span>
              <h3>{section.section}</h3>
            </div>
            {section.hint && <p className="company-modal-section-hint">{section.hint}</p>}
            <div className="company-modal-grid">
              {section.fields.map((field) => (
                <div
                  className={"job-field" + (field.type === "textarea" ? " company-modal-field-wide" : "")}
                  key={field.key}
                >
                  <label htmlFor={field.key}>
                    <span className="company-modal-field-icon" aria-hidden="true">{field.icon}</span>
                    {field.label}
                  </label>
                  {field.type === "select" ? (
                    <select
                      id={field.key}
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      id={field.key}
                      rows={3}
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={field.key}
                      type="text"
                      placeholder={field.placeholder}
                      value={form[field.key]}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {error && <p className="auth-error avatar-modal-error">{error}</p>}

        <div className="avatar-modal-actions">
          <div className="avatar-modal-actions-right">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
