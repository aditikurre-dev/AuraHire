import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false }, // excluded from normal queries; opt in with .select("+password")
    // "initial" (default) renders the colored initials circle the frontend
    // already derives from the company name. "preset" points at one of a
    // fixed set of illustrated avatars (id lives in avatarValue, the actual
    // art is defined frontend-side). "upload" means avatarValue holds a
    // client-compressed base64 data URL of the person's own image.
    avatarType: { type: String, enum: ["initial", "preset", "upload"], default: "initial" },
    avatarValue: { type: String, default: "" },

    // Extended company/employer profile — all optional, filled in from the
    // Profile page after the account exists. Loosely modeled on what a job
    // board like Naukri asks an employer for: company facts plus who the
    // actual contact person is (the HR user behind the account).
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

// Hash the password whenever it's set/changed, before saving — UNLESS
// _skipPasswordHashing is set. That flag is used when completing a
// registration (see companyController.completeRegistration): the password
// was already hashed once during the initial /register call and stored in
// a PendingRegistration record, so hashing it again here would corrupt it.
companySchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password") || this._skipPasswordHashing) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

companySchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Company", companySchema);
