# AuraHire — MERN + Python/Groq AI Resume Screener

Three services, run together:

```
frontend/    React (Vite)         → HR UI: job form, resume upload, ranked results
backend/     Node/Express + MongoDB → jobs, uploads, orchestration
ai-service/  Python/FastAPI + Groq  → LLM-based resume scoring
```

## Run it (no Docker needed)

## 1. Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- MongoDB running locally (or a free Atlas cluster — see below)
- A free Groq API key: https://console.groq.com/keys (optional to start —
  see Mock Mode below)

## 2. Open in VS Code
Open the `aurahire-mern` folder in VS Code. You'll run three terminals side by
side (View → Terminal, then click the "+" to open more, or use the split
terminal icon) — one per service.

## 3. Set up MongoDB
**Easiest for local dev:** install MongoDB Community Edition and run it
locally (default connects to `mongodb://127.0.0.1:27017`).

**Or use MongoDB Atlas** (free tier, no local install): create a cluster at
mongodb.com/atlas, get your connection string, and put it in `backend/.env`.

## 4. Terminal 1 — AI service (Python + Groq)
```
cd ai-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your real GROQ_API_KEY (or skip this — see Mock Mode)
export GROQ_API_KEY=your_key_here
uvicorn main:app --reload --port 8001
```
Check it's alive: open http://localhost:8001/health — should show
`"groq_key_configured": true`.

### Mock Mode
If `GROQ_API_KEY` is not set, the AI service automatically falls back to a
simple keyword-overlap scorer instead of calling Groq. This lets you build
and test the entire pipeline (upload → extract → score → display) for free,
before you've set up a Groq key. `/health` will show `"mock_mode": true`,
and the frontend results page will show a banner when mock scores are being
displayed. Add a real `GROQ_API_KEY` and restart the service to switch to
real LLM-based scoring — no code changes needed.

## 5. Terminal 2 — Backend (Node/Express)
```
cd backend
npm install
cp .env.example .env
# edit .env if your Mongo URI or AI service port differs
npm run dev
```
You should see `MongoDB connected` and `AuraHire backend running on port 5000`.

### Setting up email verification (optional but recommended)
New accounts must verify their email before they can log in. If you leave
`SMTP_USER`/`SMTP_PASS` blank in `backend/.env`, verification links are
printed to this terminal instead of emailed — copy the link into your
browser to test the flow without setting up email first.

To send real emails via Gmail (free):
1. Turn on 2-Step Verification on the Google account you want to send from:
   https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
   (choose "Mail" as the app) — Google gives you a 16-character password.
3. In `backend/.env`, set:
   ```
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=the_16_character_app_password   # not your normal Gmail password
   SMTP_FROM=AuraHire <your_email@gmail.com>
   ```
4. Restart the backend. Registering a new account will now send a real
   email with a "Verify Email" button.

Any other SMTP provider (Outlook, a transactional service like Brevo/Resend,
your own mail server) works too — just set `SMTP_HOST`/`SMTP_PORT` to match.

## 6. Terminal 3 — Frontend (React)
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 — this is the HR-facing app.

## 7. Try it end to end
1. On the frontend, register a company account (`/register`), then you'll be
   logged in and redirected straight to the job creation page
2. Fill in job details and list required skills (comma-separated), set
   minimum experience — the company posting the job is taken from your
   logged-in session, not typed in
3. Attach a `.zip` file containing resumes (`.pdf`, `.docx`, or `.txt`)
4. Click "Filter Resumes" — you'll land on the results page, which polls
   automatically while the AI service scores each resume via Groq
5. Once complete, you'll see a ranked table with scores, matched/missing
   skills, and a "Shortlist" button per candidate

## How a request flows through the system
```
Browser (React)
  → POST /api/companies/register or /login  (Node: create/verify company, return JWT)
  → POST /api/jobs                 (Node: create job in MongoDB, companyId from JWT)
  → POST /api/jobs/:id/resumes     (Node: unzip, extract text from each resume)
      → POST http://ai-service/score   (Python: call Groq per resume, return JSON scores)
  → Node saves scored Candidate documents to MongoDB
  → GET /api/jobs/:id/results      (React polls this until job.status === "completed")
```

## Resume files are stored in two places
- **Disk**: under `backend/uploads/extracted/<jobId>/...` (as before)
- **MongoDB**: the raw file bytes are saved on each `Candidate` document
  (`fileData` field, capped at 15MB per file to stay under MongoDB's 16MB
  document limit — oversized files still save to disk, just not to Mongo)

`fileData` is excluded from normal list/results queries (`select: false` in
the schema) so `/api/jobs/:id/results` stays fast even with thousands of
candidates. To fetch the actual file bytes:
```
GET /api/candidates/:candidateId/resume
```
This is what powers the "View" link in the results table.

## Before going to production
- **File storage at scale**: individual resumes are stored as `Buffer` fields
  directly on the `Candidate` document, which is simple and fine for typical
  resume sizes (a few hundred KB) but caps out at MongoDB's 16MB document
  limit. If you expect many large PDFs (scanned, image-heavy), switch to
  GridFS instead of storing bytes inline.
- **Job queue**: resume processing runs as an in-process background task —
  fine for dozens of resumes, but for true "thousands of resumes" scale, move
  this to a real queue (BullMQ + Redis) so it survives server restarts and
  can be scaled horizontally
- **Groq rate limits**: scoring one resume per API call in a loop is simple
  but slow at scale — batch requests or run them concurrently with a
  concurrency limit (e.g. `p-limit` equivalent) once you're past a few
  hundred resumes per job
- **Model choice**: `llama-3.1-8b-instant` is fast and cheap; swap to
  `llama-3.3-70b-versatile` in `ai-service/main.py` if you need higher
  scoring accuracy and can tolerate slightly higher latency/cost
