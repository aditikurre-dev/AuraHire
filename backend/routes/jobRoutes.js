import express from "express";
import { createJob, uploadResumes, getJobStatus, getJobResults, listJobs } from "../controllers/jobController.js";
import { uploadZip } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Listing and creating jobs are tied to whichever company is logged in.
router.get("/", protect, listJobs);
router.post("/", protect, createJob);

// Resume upload/status/results are scoped by jobId already, and JobResults
// is reached only via a link from a job the HR user just created, so these
// stay open to keep the polling flow simple (no login state needed there).
router.post("/:jobId/resumes", uploadZip.single("file"), uploadResumes);
router.get("/:jobId/status", getJobStatus);
router.get("/:jobId/results", getJobResults);

export default router;
