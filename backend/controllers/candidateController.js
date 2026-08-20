import Candidate from "../models/Candidate.js";
import Job from "../models/Job.js";

export async function toggleShortlist(req, res) {
  const { shortlisted } = req.body;
  const candidate = await Candidate.findByIdAndUpdate(
    req.params.candidateId,
    { shortlisted: !!shortlisted },
    { new: true }
  );
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });
  res.json(candidate);
}

// Serves the resume file bytes stored in MongoDB (fileData is excluded from
// normal queries via `select: false` in the schema, so it must be explicitly
// requested here with .select("+fileData")).
export async function getResumeFile(req, res) {
  const candidate = await Candidate.findById(req.params.candidateId).select("+fileData");
  if (!candidate) return res.status(404).json({ error: "Candidate not found" });

  if (!candidate.fileData) {
    return res.status(404).json({ error: "Resume file is not stored in MongoDB for this candidate (it may be on disk only, or exceeded the size limit)." });
  }

  res.set("Content-Type", candidate.contentType || "application/octet-stream");
  res.set("Content-Disposition", `inline; filename="${candidate.filename}"`);
  res.send(candidate.fileData);
}

// ---------------------------------------------------------------------------
// All shortlisted candidates across every job posted by the logged-in
// company — powers the "Shortlisted" page linked from the account menu.
// Candidates don't store a companyId directly, so we scope this by first
// finding the company's own jobs, then filtering candidates to those.
// ---------------------------------------------------------------------------
export async function listShortlistedCandidates(req, res) {
  const jobs = await Job.find({ company: req.companyId }).select("_id title");
  const jobIds = jobs.map((j) => j._id);
  const titleByJobId = Object.fromEntries(jobs.map((j) => [j._id.toString(), j.title]));

  const candidates = await Candidate.find({ job: { $in: jobIds }, shortlisted: true }).sort({ score: -1 });

  res.json(
    candidates.map((c) => ({
      ...c.toObject(),
      jobTitle: titleByJobId[c.job.toString()] || "Untitled job",
    }))
  );
}
