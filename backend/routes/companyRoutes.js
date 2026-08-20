import express from "express";
import {
  registerCompany,
  loginCompany,
  getMe,
  checkEmailExists,
  checkVerificationToken,
  resendVerificationEmail,
  updateAvatar,
  updateProfile,
} from "../controllers/companyController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.get("/check-email", checkEmailExists);
router.get("/verify-email", checkVerificationToken); // confirms the link AND creates the account
router.post("/resend-verification", resendVerificationEmail);
router.get("/me", protect, getMe);
router.patch("/me/avatar", protect, updateAvatar);
router.patch("/me/profile", protect, updateProfile);

export default router;
