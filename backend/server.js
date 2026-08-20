import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import companyRoutes from "./routes/companyRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import candidateRoutes from "./routes/candidateRoutes.js";

dotenv.config();

const app = express();
app.use(cors());
// Default 100kb JSON limit is fine for everything except uploaded avatar
// images (sent as base64 data URLs after client-side compression) — bump
// it just enough to cover those. Resume .zip uploads go through multer on
// a separate route entirely, so they're unaffected by this.
app.use(express.json({ limit: "3mb" }));

app.use("/api/companies", companyRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/candidates", candidateRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`AuraHire backend running on port ${PORT}`));
});
