import multer from "multer";
import path from "path";
import fs from "fs";

const UPLOAD_DIR = path.resolve("uploads/zips");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

function fileFilter(req, file, cb) {
  if (file.mimetype === "application/zip" || file.originalname.endsWith(".zip")) {
    cb(null, true);
  } else {
    cb(new Error("Only .zip files are allowed"));
  }
}

export const uploadZip = multer({ storage, fileFilter, limits: { fileSize: 200 * 1024 * 1024 } });
