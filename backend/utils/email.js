import nodemailer from "nodemailer";

// IMPORTANT: env vars are read lazily, inside the function, NOT at module
// load time. With ES modules, imports are evaluated before the importing
// file's own code runs — so if this were read at the top of the file (as a
// module-level constant), it would capture empty values whenever this file
// gets imported (via server.js -> companyRoutes.js -> companyController.js)
// before server.js's own dotenv.config() call has actually run. Reading
// process.env inside the function avoids that ordering trap entirely.
function getSmtpConfig() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL } = process.env;
  return {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM,
    FRONTEND_URL,
    configured: Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS),
  };
}

export async function sendVerificationEmail(toEmail, companyName, rawToken) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL, configured } = getSmtpConfig();
  const verifyUrl = `${FRONTEND_URL || "http://localhost:5173"}/register?verify=${rawToken}`;

  if (!configured) {
    // Dev fallback: no SMTP credentials set up yet. Print the link so the
    // full verification flow can still be tested end-to-end by copying it
    // into a browser, without needing real email delivery configured first.
    console.log("\n=== EMAIL NOT SENT — SMTP not configured (see backend/.env) ===");
    console.log(`To: ${toEmail}`);
    console.log(`Verification link: ${verifyUrl}`);
    console.log("=================================================================\n");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465, // true for port 465, false for 587/others (STARTTLS)
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  await transporter.sendMail({
    from: SMTP_FROM || SMTP_USER,
    to: toEmail,
    subject: "Verify your AuraHire account",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #241c15;">
        <h2 style="margin-bottom: 4px;">Welcome to AuraHire, ${companyName}!</h2>
        <p>Click the button below to verify your email address and activate your account.</p>
        <p style="margin: 32px 0;">
          <a href="${verifyUrl}"
             style="background:#ff5a5f;color:#ffffff;padding:12px 28px;border-radius:999px;
                    text-decoration:none;font-weight:600;display:inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color:#8b7e72;font-size:13px;">
          This link expires in 24 hours. If you didn't create an AuraHire account, you can
          safely ignore this email.
        </p>
        <p style="color:#8b7e72;font-size:12px;word-break:break-all;">
          Or paste this link into your browser: ${verifyUrl}
        </p>
      </div>
    `,
  });
}
