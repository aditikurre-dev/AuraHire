import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requiredSkills: { type: [String], required: true },
    preferredSkills: { type: [String], default: [] },
    minExperienceYears: { type: Number, default: 0 },
    minEducation: { type: String, default: null },
    status: {
      type: String,
      enum: ["created", "queued", "processing", "completed", "failed"],
      default: "created",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Job", jobSchema);
