import mongoose from "mongoose";

// Represents an account that exists and can log in, but whose email isn't
// verified yet. It lives here — not in the Company collection — until the
// verification link is clicked, at which point companyController moves it
// over (creates the Company doc, deletes this one), keeping the same _id so
// any session token issued while still unverified keeps working afterwards.
//
// IMPORTANT: this collection is NOT auto-expiring. Earlier versions TTL'd
// the whole document after 24h, which silently deleted a person's account
// (and login ability) just for not clicking the email in time. Only the
// verification *link* should expire — tokenExpiresAt below — not the
// account. An expired link just means "click Resend" for a fresh one.
const pendingRegistrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true }, // already bcrypt-hashed, never stored in plain text
    tokenHash: { type: String, required: true, unique: true },
    tokenExpiresAt: { type: Date, required: true }, // when the CURRENT verification link expires
    // Mirrors Company's avatar fields so someone can set a profile picture
    // before their email is verified without it getting lost on completion
    // (verify-email carries these over onto the real Company doc it creates).
    avatarType: { type: String, enum: ["initial", "preset", "upload"], default: "initial" },
    avatarValue: { type: String, default: "" },
    // Mirrors Company's extended profile fields for the same reason.
    industry: { type: String, default: "" },
    companySize: { type: String, default: "" },
    website: { type: String, default: "" },
    location: { type: String, default: "" },
    foundedYear: { type: String, default: "" },
    about: { type: String, default: "" },
    contactName: { type: String, default: "" },
    designation: { type: String, default: "" },
    phone: { type: String, default: "" },
    linkedin: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("PendingRegistration", pendingRegistrationSchema);
