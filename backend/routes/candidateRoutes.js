import express from "express";
import { toggleShortlist, getResumeFile, listShortlistedCandidates } from "../controllers/candidateController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Scoped to the logged-in company — must come before the "/:candidateId/..."
// routes below so "shortlisted" isn't ever matched as a candidateId.
router.get("/shortlisted", protect, listShortlistedCandidates);

router.patch("/:candidateId/shortlist", toggleShortlist);
router.get("/:candidateId/resume", getResumeFile);

export default router;
