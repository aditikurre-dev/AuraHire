import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import axios from "axios";
import Job from "../models/Job.js";
import Candidate from "../models/Candidate.js";
import Company from "../models/Company.js";
import { extractTextFromFile } from "../utils/extractText.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8001";
const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

const CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
};

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Create a job posting
// ---------------------------------------------------------------------------
export async function createJob(req, res) {
  try {
    const { title, description, requiredSkills, preferredSkills, minExperienceYears, minEducation } = req.body;
    // companyId is never taken from the request body — it comes from the
    // authenticated JWT (see middleware/auth.js), so a job is always tied
    // to whichever company is actually logged in.
    const companyId = req.companyId;

    // Posting a job is the one thing gated on email verification. Checked
    // fresh against the DB (not trusted from the JWT) so a token issued
    // before verification still gets blocked/unblocked correctly — a
    // verified account only ever exists in the Company collection.
    const company = await Company.findById(companyId).select("_id");
    if (!company) {
      return res.status(403).json({ error: "Please verify your email before posting a job." });
    }

    if (!title || !description || !requiredSkills) {
      return res.status(400).json({ error: "title, description, and requiredSkills are required" });
    }

    const job = await Job.create({
      company: companyId,
      title,
      description,
      requiredSkills,
      preferredSkills: preferredSkills || [],
      minExperienceYears: minExperienceYears || 0,
      minEducation: minEducation || null,
    });

    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Upload a zip of resumes -> unzip -> extract text -> call AI service -> save
// ---------------------------------------------------------------------------
export async function uploadResumes(req, res) {
  const job = await Job.findById(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (!req.file) return res.status(400).json({ error: "No zip file uploaded" });

  // Respond immediately; process in the background so the HR doesn't wait
  // on an open HTTP connection for thousands of resumes.
  res.status(202).json({ message: "Resumes received. Scoring in progress.", jobId: job._id });

  processResumesInBackground(job, req.file.path).catch((err) => {
    console.error("Background resume processing failed:", err);
  });
}

async function processResumesInBackground(job, zipPath) {
  job.status = "processing";
  await job.save();

  const extractDir = path.resolve("uploads", "extracted", job._id.toString());
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractDir, true);

    // Recursively find all supported resume files (zips can contain subfolders)
    const files = walkDir(extractDir).filter((f) => SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()));

    const resumes = [];
    const fileInfoByName = {}; // filename -> { filePath, buffer, contentType } for saving into MongoDB

    for (const filePath of files) {
      const text = await extractTextFromFile(filePath);
      if (text && text.trim().length > 0) {
        const filename = path.basename(filePath);
        const buffer = fs.readFileSync(filePath);

        // MongoDB documents are capped at 16MB. Guard against storing an
        // oversized resume in Mongo (it stays on disk regardless via filePath).
        // For a production system expecting many large PDFs, use GridFS instead.
        const MAX_MONGO_FILE_BYTES = 15 * 1024 * 1024;
        const tooLargeForMongo = buffer.length > MAX_MONGO_FILE_BYTES;
        if (tooLargeForMongo) {
          console.warn(`${filename} is ${(buffer.length / 1024 / 1024).toFixed(1)}MB — too large to store in MongoDB, keeping on disk only.`);
        }

        resumes.push({ filename, text });
        fileInfoByName[filename] = {
          filePath,
          buffer: tooLargeForMongo ? null : buffer,
          contentType: getContentType(filePath),
        };
      }
    }

    if (resumes.length === 0) {
      job.status = "failed";
      await job.save();
      return;
    }

    // Call the Python AI service for scoring
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/score`, {
      job: {
        title: job.title,
        description: job.description,
        required_skills: job.requiredSkills,
        preferred_skills: job.preferredSkills,
        min_experience_years: job.minExperienceYears,
      },
      resumes,
    }, { timeout: 300000 }); // large batches can take a while

    const scored = aiResponse.data.results;

    const candidateDocs = scored.map((r) => {
      const fileInfo = fileInfoByName[r.filename] || {};
      return {
        job: job._id,
        filename: r.filename,
        filePath: fileInfo.filePath || null,
        fileData: fileInfo.buffer || null,
        contentType: fileInfo.contentType || "application/octet-stream",
        score: r.score,
        yearsExperienceDetected: r.years_experience_detected,
        irrelevantExperienceYears: r.irrelevant_experience_years ?? 0,
        irrelevantExperienceNote: r.irrelevant_experience_note ?? "None",
        requiredSkillsMatched: r.required_skills_matched,
        requiredSkillsMissing: r.required_skills_missing,
        preferredSkillsMatched: r.preferred_skills_matched,
        meetsMinExperience: r.meets_min_experience,
        strengths: r.strengths,
        concerns: r.concerns,
      };
    });

    await Candidate.insertMany(candidateDocs);

    job.status = "completed";
    await job.save();
  } catch (err) {
    console.error("Error processing resumes:", err.message);
    job.status = "failed";
    await job.save();
  } finally {
    fs.rm(zipPath, { force: true }, () => {});
  }
}

function walkDir(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Status + results
// ---------------------------------------------------------------------------
export async function getJobStatus(req, res) {
  const job = await Job.findById(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const candidateCount = await Candidate.countDocuments({ job: job._id });
  res.json({ jobId: job._id, status: job.status, candidatesScored: candidateCount });
}

export async function getJobResults(req, res) {
  const job = await Job.findById(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const candidates = await Candidate.find({ job: job._id }).sort({ score: -1 });
  res.json(candidates);
}

// Includes a shortlistedCount and candidateCount per job — computed with two
// aggregations instead of Candidate.countDocuments() in a loop — so pages
// like Job History and the Profile stats dashboard don't need a separate
// request per job just to show these numbers.
export async function listJobs(req, res) {
  const jobs = await Job.find({ company: req.companyId }).sort({ createdAt: -1 });
  const jobIds = jobs.map((j) => j._id);

  const [shortlistedCounts, candidateCounts] = await Promise.all([
    Candidate.aggregate([
      { $match: { job: { $in: jobIds }, shortlisted: true } },
      { $group: { _id: "$job", count: { $sum: 1 } } },
    ]),
    Candidate.aggregate([{ $match: { job: { $in: jobIds } } }, { $group: { _id: "$job", count: { $sum: 1 } } }]),
  ]);
  const shortlistedByJobId = Object.fromEntries(shortlistedCounts.map((c) => [c._id.toString(), c.count]));
  const candidatesByJobId = Object.fromEntries(candidateCounts.map((c) => [c._id.toString(), c.count]));

  res.json(
    jobs.map((job) => ({
      ...job.toObject(),
      shortlistedCount: shortlistedByJobId[job._id.toString()] || 0,
      candidateCount: candidatesByJobId[job._id.toString()] || 0,
    }))
  );
}
