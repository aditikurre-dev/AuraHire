import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import Company from "../models/Company.js";
import PendingRegistration from "../models/PendingRegistration.js";
import { sendVerificationEmail } from "../utils/email.js";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // how long a single verification link stays valid

function signToken({ _id, email }) {
  return jwt.sign({ companyId: _id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// The fields that count toward "profile completion" — deliberately excludes
// name/email/password (those exist from the moment the account is created,
// so they'd make every account start at some nonzero % instead of 0, which
// defeats the point of the meter as a nudge to fill in the *rest*).
const PROFILE_COMPLETION_FIELDS = [
  "industry",
  "companySize",
  "website",
  "location",
  "foundedYear",
  "about",
  "contactName",
  "designation",
  "phone",
  "linkedin",
];

function profileCompletionPercent(doc) {
  const hasAvatar = doc.avatarType && doc.avatarType !== "initial";
  const filled = PROFILE_COMPLETION_FIELDS.filter((f) => (doc[f] || "").trim().length > 0).length;
  const totalSlots = PROFILE_COMPLETION_FIELDS.length + 1; // +1 for the avatar
  const filledSlots = filled + (hasAvatar ? 1 : 0);
  return Math.round((filledSlots / totalSlots) * 100);
}

// Shared shape for "who is logged in" responses, whichever collection they
// currently live in. isVerified is derived from WHERE the record lives
// (Company = verified, PendingRegistration = not) rather than from a flag
// on the JWT, so it's always correct even for a token issued before the
// person verified.
function toPublicCompany(doc, isVerified) {
  return {
    _id: doc._id,
    name: doc.name,
    email: doc.email,
    isVerified,
    createdAt: doc.createdAt,
    avatarType: doc.avatarType || "initial",
    avatarValue: doc.avatarValue || "",
    industry: doc.industry || "",
    companySize: doc.companySize || "",
    website: doc.website || "",
    location: doc.location || "",
    foundedYear: doc.foundedYear || "",
    about: doc.about || "",
    contactName: doc.contactName || "",
    designation: doc.designation || "",
    phone: doc.phone || "",
    linkedin: doc.linkedin || "",
    profileCompletion: profileCompletionPercent(doc),
  };
}

// ---------------------------------------------------------------------------
// Check whether an email is already registered — verified OR not — used by
// the register form to show a live "already exists" message as the person
// types. Public (no auth) since it runs before login.
// ---------------------------------------------------------------------------
export async function checkEmailExists(req, res) {
  try {
    const email = (req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email is required" });

    const [company, pending] = await Promise.all([
      Company.findOne({ email }).select("_id"),
      PendingRegistration.findOne({ email }).select("_id"),
    ]);
    res.json({ exists: Boolean(company || pending) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Register a new company (HR account).
//
// The account is created right away — as a PendingRegistration document,
// not yet a Company. It can already log in and use the product; the only
// thing gated on verification is posting a job (see jobController.createJob).
// Once the emailed link is clicked, checkVerificationToken below moves this
// same record over into the Company collection.
// ---------------------------------------------------------------------------
export async function registerCompany(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const trimmedName = name.trim();

    const [existingCompany, existingPending] = await Promise.all([
      Company.findOne({ email: normalizedEmail }).select("_id"),
      PendingRegistration.findOne({ email: normalizedEmail }).select("_id"),
    ]);
    // The account already exists either way (verified or not) — don't wipe
    // an existing pending signup just because the form was submitted again.
    // They can log in with it right now, or resend the link from there.
    if (existingCompany || existingPending) {
      return res.status(400).json({ error: "A company with this email already exists. Try logging in." });
    }

    // Hash now so the password is never held in plain text anywhere.
    const passwordHash = await bcrypt.hash(password, 10);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    const pending = await PendingRegistration.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      tokenHash,
      tokenExpiresAt: Date.now() + TOKEN_TTL_MS,
    });

    try {
      await sendVerificationEmail(normalizedEmail, trimmedName, rawToken);
    } catch (emailErr) {
      // Don't fail the request just because the email failed to send —
      // log it so it's visible during development.
      console.error("Failed to send verification email:", emailErr.message);
    }

    res.status(201).json({
      message: "Account created. Verify your email to unlock posting jobs.",
      email: normalizedEmail,
      token: signToken(pending),
      company: toPublicCompany(pending, false),
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "A company with this email already exists. Try logging in." });
    }
    res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Resend the verification email for a still-unverified account. Issues a
// fresh token (invalidating the old link) and a fresh expiry, then re-sends.
// If the account doesn't exist or is already verified, we still return a
// generic success response so this can't be used to probe registered emails.
// ---------------------------------------------------------------------------
export async function resendVerificationEmail(req, res) {
  try {
    const email = (req.body.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email is required" });

    const pending = await PendingRegistration.findOne({ email });

    if (pending) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      pending.tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      pending.tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
      await pending.save();

      try {
        await sendVerificationEmail(pending.email, pending.name, rawToken);
      } catch (emailErr) {
        console.error("Failed to resend verification email:", emailErr.message);
      }
    }

    res.json({ message: "If that email is pending verification, a new link has been sent." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Confirms the emailed link is valid and MOVES the account from
// PendingRegistration into the Company collection — this is the "verified"
// moment. The same _id is kept on purpose: a JWT issued while the account
// was still unverified encodes that _id, and after the move it now resolves
// straight to the Company doc, so the person's existing session keeps
// working (and their profile flips to "verified") without needing to log
// in again.
//
// Written to be idempotent-ish: Gmail/Outlook prefetch links to scan them
// before a person clicks, and people sometimes double-click. If the Company
// doc already exists for this email, a repeat hit just confirms success
// again rather than erroring.
// ---------------------------------------------------------------------------
export async function checkVerificationToken(req, res) {
  try {
    const rawToken = req.query.token;
    if (!rawToken) return res.status(400).json({ verified: false, error: "Missing verification token" });

    const tokenHash = crypto.createHash("sha256").update(String(rawToken)).digest("hex");
    const pending = await PendingRegistration.findOne({ tokenHash });

    if (!pending) {
      // Not found: either the token is bogus, or this exact link was
      // already used once (the account has since moved to Company and the
      // pending record was deleted). Either way there's nothing left to
      // verify against, so this reads as "invalid or expired" — the person
      // should just try logging in if they've already verified.
      return res.status(400).json({ verified: false, error: "This verification link is invalid or has expired." });
    }

    if (pending.tokenExpiresAt < Date.now()) {
      return res.status(400).json({ verified: false, error: "This verification link has expired. Request a new one." });
    }

    const company = new Company({
      _id: pending._id,
      name: pending.name,
      email: pending.email,
      password: pending.passwordHash,
      avatarType: pending.avatarType || "initial",
      avatarValue: pending.avatarValue || "",
      industry: pending.industry || "",
      companySize: pending.companySize || "",
      website: pending.website || "",
      location: pending.location || "",
      foundedYear: pending.foundedYear || "",
      about: pending.about || "",
      contactName: pending.contactName || "",
      designation: pending.designation || "",
      phone: pending.phone || "",
      linkedin: pending.linkedin || "",
    });
    company._skipPasswordHashing = true; // already hashed during /register
    try {
      await company.save();
    } catch (err) {
      // A concurrent hit (e.g. mail-provider prefetch racing the user's real
      // click) may have created it a moment earlier — that's fine.
      if (err.code !== 11000) throw err;
    }

    // The account now lives in Company — remove the pending copy so there's
    // exactly one record of it going forward.
    await PendingRegistration.deleteOne({ _id: pending._id });

    res.json({ verified: true, email: pending.email });
  } catch (err) {
    res.status(500).json({ verified: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Log in with email + password. Checks the Company collection (verified
// accounts) first, then falls back to PendingRegistration (unverified but
// real accounts) — so a person can log in right after registering, even
// before clicking the verification link. Job posting stays gated on
// isVerified; everything else is open.
// ---------------------------------------------------------------------------
export async function loginCompany(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const normalizedEmail = email.toLowerCase().trim();

    // password has select: false on the schema, so opt back in explicitly
    const company = await Company.findOne({ email: normalizedEmail }).select("+password");
    if (company) {
      const isMatch = await company.comparePassword(password);
      if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });
      return res.json({ token: signToken(company), company: toPublicCompany(company, true) });
    }

    const pending = await PendingRegistration.findOne({ email: normalizedEmail });
    if (!pending) return res.status(401).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, pending.passwordHash);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

    return res.json({ token: signToken(pending), company: toPublicCompany(pending, false) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Return the logged-in company, based on the JWT (used to restore a session
// on page refresh without re-prompting for a password). Looks in Company
// first, then PendingRegistration, so an unverified session restores too.
// ---------------------------------------------------------------------------
export async function getMe(req, res) {
  try {
    const company = await Company.findById(req.companyId);
    if (company) return res.json(toPublicCompany(company, true));

    const pending = await PendingRegistration.findById(req.companyId);
    if (pending) return res.json(toPublicCompany(pending, false));

    return res.status(404).json({ error: "Company not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Keep this in sync with the preset list in frontend/src/components/AvatarPickerModal.jsx —
// duplicated deliberately so the backend never trusts an arbitrary string
// from the client for anything other than an actual uploaded image.
const PRESET_AVATAR_IDS = [
  "star", "rocket", "bolt", "building", "briefcase",
  "heart", "leaf", "diamond", "moon", "flame",
];

const MAX_UPLOAD_DATA_URL_LENGTH = 2_800_000; // ~2MB image, base64-inflated (~1.37x) plus headroom

// ---------------------------------------------------------------------------
// Update (or clear) the logged-in company's avatar. Three shapes of request:
//   { avatarType: "initial" }                          -> revert to the initials circle
//   { avatarType: "preset",  avatarValue: "<preset id>" } -> pick from the built-in set
//   { avatarType: "upload",  avatarValue: "<data URL>" }  -> a client-compressed image
// The actual resize/compression happens in the browser before this is ever
// called — this endpoint just validates shape and size, it doesn't touch
// image bytes itself.
// ---------------------------------------------------------------------------
export async function updateAvatar(req, res) {
  try {
    const { avatarType, avatarValue } = req.body;

    if (!["initial", "preset", "upload"].includes(avatarType)) {
      return res.status(400).json({ error: "Invalid avatar type." });
    }

    let nextValue = "";
    if (avatarType === "preset") {
      if (!PRESET_AVATAR_IDS.includes(avatarValue)) {
        return res.status(400).json({ error: "Unknown avatar." });
      }
      nextValue = avatarValue;
    } else if (avatarType === "upload") {
      if (typeof avatarValue !== "string" || !avatarValue.startsWith("data:image/")) {
        return res.status(400).json({ error: "Invalid image data." });
      }
      if (avatarValue.length > MAX_UPLOAD_DATA_URL_LENGTH) {
        return res.status(400).json({ error: "Image is too large. Please choose a smaller one." });
      }
      nextValue = avatarValue;
    }
    // avatarType === "initial" -> nextValue stays "" (falls back to initials)

    const company = await Company.findById(req.companyId);
    if (company) {
      company.avatarType = avatarType;
      company.avatarValue = nextValue;
      await company.save();
      return res.json(toPublicCompany(company, true));
    }

    const pending = await PendingRegistration.findById(req.companyId);
    if (pending) {
      pending.avatarType = avatarType;
      pending.avatarValue = nextValue;
      await pending.save();
      return res.json(toPublicCompany(pending, false));
    }

    return res.status(404).json({ error: "Company not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Fields the profile-details form is allowed to touch. Deliberately does
// NOT include name/email/password — those stay locked from this endpoint no
// matter what the request body contains, so the "name & email are shown but
// not editable" rule is enforced server-side, not just hidden in the UI.
const EDITABLE_PROFILE_FIELDS = [
  "name",
  "industry",
  "companySize",
  "website",
  "location",
  "foundedYear",
  "about",
  "contactName",
  "designation",
  "phone",
  "linkedin",
];

const MAX_FIELD_LENGTH = { about: 1000, website: 300, linkedin: 300 };
const DEFAULT_MAX_LENGTH = 200;

// ---------------------------------------------------------------------------
// Update the logged-in company's extended profile details — name, industry,
// size, website, contact person, etc. Only touches whitelisted fields;
// anything else in the request body (notably email — see the module-level
// comment on EDITABLE_PROFILE_FIELDS for why that one stays locked here) is
// silently ignored.
// ---------------------------------------------------------------------------
export async function updateProfile(req, res) {
  try {
    const updates = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (!(field in req.body)) continue;
      const raw = req.body[field];
      if (raw !== "" && typeof raw !== "string") {
        return res.status(400).json({ error: `Invalid value for ${field}.` });
      }
      const value = (raw || "").trim();

      // Unlike the rest of these fields, name is required on the schema
      // (it's shown all over the app — navbar, job postings, etc.) so an
      // empty save has to be rejected here rather than silently clearing it.
      if (field === "name" && value.length === 0) {
        return res.status(400).json({ error: "Company name can't be empty." });
      }

      const max = MAX_FIELD_LENGTH[field] || DEFAULT_MAX_LENGTH;
      if (value.length > max) {
        return res.status(400).json({ error: `${field} is too long (max ${max} characters).` });
      }
      updates[field] = value;
    }

    const company = await Company.findById(req.companyId);
    if (company) {
      Object.assign(company, updates);
      await company.save();
      return res.json(toPublicCompany(company, true));
    }

    const pending = await PendingRegistration.findById(req.companyId);
    if (pending) {
      Object.assign(pending, updates);
      await pending.save();
      return res.json(toPublicCompany(pending, false));
    }

    return res.status(404).json({ error: "Company not found" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
