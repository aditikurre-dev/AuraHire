import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

// A small set of hand-drawn, brand-colored avatars — kept intentionally
// abstract (icon on a gradient disc) rather than illustrated characters, so
// they read as a clean identity mark rather than a cartoon mascot. Each one
// pairs two colors from the site's own palette so every option already
// belongs, whichever a person picks.
//
// IMPORTANT: the id list here is duplicated server-side (companyController.js)
// as the source of truth for validation — this array only supplies the id
// plus how to *draw* it. Keep the ids in sync if this list ever changes.
const PRESET_AVATARS = [
  { id: "star", colors: ["var(--coral)", "var(--tangerine)"] },
  { id: "rocket", colors: ["var(--violet)", "#9c8bff"] },
  { id: "bolt", colors: ["var(--sunny)", "var(--tangerine)"] },
  { id: "building", colors: ["var(--mint)", "#22d3b8"] },
  { id: "briefcase", colors: ["var(--coral)", "var(--violet)"] },
  { id: "heart", colors: ["var(--coral)", "#ff8a8f"] },
  { id: "leaf", colors: ["var(--mint)", "var(--sunny)"] },
  { id: "diamond", colors: ["var(--violet)", "var(--mint)"] },
  { id: "moon", colors: ["var(--violet)", "#5b4bd6"] },
  { id: "flame", colors: ["var(--tangerine)", "var(--coral)"] },
];

function PresetIcon({ id }) {
  const common = { viewBox: "0 0 24 24", width: 22, height: 22, fill: "none", stroke: "#fff", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (id) {
    case "star":
      return (
        <svg {...common}>
          <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6-5.9-3.3-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
        </svg>
      );
    case "rocket":
      return (
        <svg {...common}>
          <path d="M13 2c3 1 5.5 4 6 8-1 1-2 2-3 2.5" />
          <path d="M11 22c-1-3-1-6 0-9 1-3 3-6 6-8-1 5-2 10-6 17z" />
          <path d="M11 13c-2.5-.5-4.5.5-6 3 2.5.5 4.5-.5 6-3z" />
          <circle cx="15" cy="8" r="1.4" fill="#fff" stroke="none" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
        </svg>
      );
    case "building":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
        </svg>
      );
    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.4-9.5-9C.9 7.6 3 4 6.5 4 9 4 11 6 12 7.5 13 6 15 4 17.5 4 21 4 23.1 7.6 21.5 11 19 15.6 12 20 12 20z" />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path d="M5 21c8 0 14-6 14-16-10 0-16 6-16 14 0 .7.1 1.4.2 2z" />
          <path d="M5 21c3-3 6-6 12-14" />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M3 9h18" />
          <path d="M7 3h10l4 6-11 12L3 9z" />
          <path d="M9 3l3 6-3 12M15 3l-3 6 3 12" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 22c4.4 0 7-2.7 7-6.5 0-3-1.7-4.8-3-7 .1 2-.7 3-1.6 3.6C15 9.5 14.5 6 11.5 2c.5 3-.8 5.3-2.7 7.5C7 11.5 6 13.3 6 15.5 6 19.3 8.6 22 12 22z" />
        </svg>
      );
    default:
      return null;
  }
}

function PresetSwatch({ id, colors, size = 68, ring = false, onClick, selected }) {
  const [from, to] = colors;
  return (
    <button
      type="button"
      className={"avatar-preset-swatch" + (selected ? " avatar-preset-swatch-selected" : "")}
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${from}, ${to})` }}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${id} avatar`}
    >
      <PresetIcon id={id} />
      {ring && <span className="avatar-preset-check" aria-hidden="true">✓</span>}
    </button>
  );
}

// Resizes + center-crops to a square, then compresses to JPEG — keeps the
// uploaded avatar small (a few hundred KB at most) regardless of how large
// the original photo was, so it's fast to store and fast to load back.
function compressImageFile(file, maxSize = 320, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That doesn't look like a valid image."));
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function AvatarPickerModal({ onClose }) {
  const { company, updateAvatar } = useAuth();
  const [tab, setTab] = useState("preset"); // "preset" | "upload"
  const [selectedPreset, setSelectedPreset] = useState(
    company?.avatarType === "preset" ? company.avatarValue : null
  );
  const [uploadPreview, setUploadPreview] = useState(
    company?.avatarType === "upload" ? company.avatarValue : null
  );
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
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

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError("");
    setProcessing(true);
    try {
      const dataUrl = await compressImageFile(file);
      setUploadPreview(dataUrl);
      setTab("upload");
    } catch (err) {
      setError(err.message || "Couldn't process that image.");
    } finally {
      setProcessing(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  const hasChange =
    (tab === "preset" && selectedPreset && !(company?.avatarType === "preset" && company.avatarValue === selectedPreset)) ||
    (tab === "upload" && uploadPreview && !(company?.avatarType === "upload" && company.avatarValue === uploadPreview));

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      if (tab === "preset" && selectedPreset) {
        await updateAvatar({ avatarType: "preset", avatarValue: selectedPreset });
      } else if (tab === "upload" && uploadPreview) {
        await updateAvatar({ avatarType: "upload", avatarValue: uploadPreview });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't save your avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUseInitials() {
    setSaving(true);
    setError("");
    try {
      await updateAvatar({ avatarType: "initial" });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Couldn't update your avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const previewColors =
    tab === "preset" && selectedPreset
      ? PRESET_AVATARS.find((p) => p.id === selectedPreset)?.colors
      : null;

  return (
    <div className="avatar-modal-overlay" onMouseDown={onClose}>
      <div
        className="avatar-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Choose profile picture"
        tabIndex={-1}
        ref={dialogRef}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="avatar-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2>Profile picture</h2>

        <div className="avatar-modal-preview-row">
          {tab === "upload" && uploadPreview ? (
            <img src={uploadPreview} alt="" className="avatar-modal-preview avatar-modal-preview-img" />
          ) : previewColors ? (
            <div
              className="avatar-modal-preview"
              style={{ background: `linear-gradient(135deg, ${previewColors[0]}, ${previewColors[1]})` }}
            >
              <PresetIcon id={selectedPreset} />
            </div>
          ) : (
            <div className="avatar-modal-preview avatar-modal-preview-empty">?</div>
          )}
        </div>

        <div className="avatar-modal-tabs">
          <button
            type="button"
            className={"avatar-tab-btn" + (tab === "preset" ? " avatar-tab-btn-active" : "")}
            onClick={() => setTab("preset")}
          >
            Choose an avatar
          </button>
          <button
            type="button"
            className={"avatar-tab-btn" + (tab === "upload" ? " avatar-tab-btn-active" : "")}
            onClick={() => setTab("upload")}
          >
            Upload a photo
          </button>
        </div>

        {tab === "preset" ? (
          <div className="avatar-preset-grid">
            {PRESET_AVATARS.map((p) => (
              <PresetSwatch
                key={p.id}
                id={p.id}
                colors={p.colors}
                selected={selectedPreset === p.id}
                ring
                onClick={() => setSelectedPreset(p.id)}
              />
            ))}
          </div>
        ) : (
          <div
            className={"avatar-dropzone" + (dragActive ? " avatar-dropzone-active" : "")}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <span className="avatar-dropzone-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
              </svg>
            </span>
            <span className="avatar-dropzone-title">
              {processing ? "Processing…" : "Click to choose, or drag a photo here"}
            </span>
            <span className="avatar-dropzone-hint">JPG or PNG — it'll be resized automatically</span>
          </div>
        )}

        {error && <p className="auth-error avatar-modal-error">{error}</p>}

        <div className="avatar-modal-actions">
          <button type="button" className="resend-link" onClick={handleUseInitials} disabled={saving}>
            Use my initials instead
          </button>
          <div className="avatar-modal-actions-right">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={!hasChange || saving || processing}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { PRESET_AVATARS, PresetIcon };
