import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extracts raw text from a resume file based on its extension.
 * Returns "" (rather than throwing) on unreadable files so one
 * corrupt resume never fails the entire batch.
 */
export async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === ".txt") {
      return fs.readFileSync(filePath, "utf-8");
    }

    if (ext === ".pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return data.text;
    }

    if (ext === ".docx") {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }

    return ""; // unsupported extension, skip
  } catch (err) {
    console.error(`Failed to extract text from ${filePath}:`, err.message);
    return "";
  }
}
