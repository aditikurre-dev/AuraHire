import mongoose from "mongoose";

const candidateSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    filename: { type: String, required: true },
    filePath: { type: String, default: null }, // disk path under backend/uploads, kept alongside the DB copy
    fileData: { type: Buffer, default: null, select: false }, // excluded from normal queries; fetched only via the resume-download endpoint
    contentType: { type: String, default: "application/octet-stream" },
    score: { type: Number, default: 0 },
    yearsExperienceDetected: { type: Number, default: 0 },
    irrelevantExperienceYears: { type: Number, default: 0 },
    irrelevantExperienceNote: { type: String, default: "None" },
    requiredSkillsMatched: { type: [String], default: [] },
    requiredSkillsMissing: { type: [String], default: [] },
    preferredSkillsMatched: { type: [String], default: [] },
    meetsMinExperience: { type: Boolean, default: false },
    strengths: { type: String, default: "" },
    concerns: { type: String, default: "" },
    shortlisted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Candidate", candidateSchema);
