<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:FF5A5F,50:7C5CFC,100:00C2A8&height=220&section=header&text=AuraHire&fontSize=72&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=AI-Powered%20Resume%20Screening%20for%20Modern%20HR%20Teams&descAlignY=58&descSize=18" width="100%" />


<img src="https://readme-typing-svg.demolab.com?font=Poppins&weight=600&size=22&duration=2800&pause=900&color=FF5A5F&center=true&vCenter=true&width=700&lines=Upload+a+zip+of+resumes.;Get+an+AI-ranked+shortlist+in+seconds.;Every+job+and+shortlist%2C+attributed+by+name.;Built+MERN+%2B+Python+%2B+Groq+LLM+%E2%9A%A1" alt="Typing SVG" />

</div>

<br/>

<div align="center">

![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Python](https://img.shields.io/badge/Python_3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_LLM-F55036?style=for-the-badge&logo=lightning&logoColor=white)
![JWT](https://img.shields.io/badge/JWT_Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

</div>

<p align="center">
  <b>AuraHire</b> is a three-service resume-screening platform: an HR posts a job and drops in a zip of
  resumes, a Python microservice scores every candidate against it with an LLM, and the results come back
  ranked, explained, and ready to shortlist — with a full audit trail of who did what.
</p>

<div align="center">

[🚀 Quick Start](#-quick-start) · [✨ Features](#-features) · [🏗️ Architecture](#️-architecture) · [🔐 Environment Variables](#-environment-variables) · [📁 Project Structure](#-project-structure) · [🛣️ Roadmap](#️-before-going-to-production)

</div>

<img src="https://capsule-render.vercel.app/api?type=rect&color=0:FF5A5F,50:7C5CFC,100:00C2A8&height=4&section=header" width="100%"/>

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🔐 Auth that respects real HR workflows
- Register → **log in immediately**, even before verifying your email
- Verify anytime via a popup, no page navigation lost
- Job posting stays gated behind verification — everything else doesn't
- Live cross-tab sync: verify in one tab, the other updates instantly

### 🧑‍💼 A profile that's actually useful
- Custom avatar picker + auto-generated initials fallback
- Profile-completion ring that nudges you to fill in the gaps
- Editable company name, industry, size, website, HQ, "About"

</td>
<td width="50%" valign="top">

### 🧠 AI resume screening, with a safety net
- Drop a `.zip` of `.pdf` / `.docx` / `.txt` resumes — any number at once
- Groq LLM scores each one against required + preferred skills
- **Mock mode**: no API key yet? The full pipeline still runs on a
  keyword-overlap scorer so you can build and test for free
- Every score comes with a plain-language "why," not just a number

### 🏷️ Attribution, not guesswork
- **Posted by** — typed fresh per job, so the record survives HR turnover
- **Shortlisted by** — captured per reviewer, per job, automatically
  timestamped — no more "wait, who picked this candidate?"

</td>
</tr>
</table>

<div align="center">
<sub>+ Job History with live shortlist counts · a cross-job Shortlist view · dark/light theme · a fully responsive layout</sub>
</div>

<br/>

## 🏗️ Architecture

Three services, run side by side — nothing talks to the frontend except the Node backend:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     AURA HIRE - SYSTEM ARCHITECTURE PIPELINE                     │
└──────────────────────────────────────────────────────────────────────────────────┘

[ 1. FRONTEND LAYER ]        [ 2. BACKEND LAYER ]         [ 3. AI MICROSERVICE ]
┌────────────────────────┐   ┌────────────────────────┐   ┌────────────────────────┐
│       React SPA        │   │   Node.js / Express    │   │     Python FastAPI     │
│       Port :5173       ├─►│       Port :5000       │   │       Port :8001       │
└────────────────────────┘   └────────────────────────┘   └────────────────────────┘
             │                            │                            │
       HTTP REST API                                          Internal REST API
             ▼                            ▼                            ▲
 - Candidate Management       • JWT Authentication         • PDF Text Extraction
 - Job Description Postings   • Route Orchestration        • Groq Llama 3 LLM
 - Multipart ZIP Uploader     • Multipart Stream Handling  • Evaluation & Scoring
 - Ranked Leaderboards        • Email Notifications        • Fallback Mock Mode
                                          │
                                          ▼
                                [ MongoDB Database ]
                              (Persistent Data Storage)

```


### How a request flows end to end

```text
Browser (React)
  → POST /api/companies/register or /login   Node: create/verify company, return JWT
  → POST /api/jobs                           Node: create job in MongoDB, companyId from JWT
  → POST /api/jobs/:id/resumes                Node: unzip, extract text from each resume
      → POST http://ai-service/score              Python: call Groq per resume, return JSON scores
  → Node saves scored Candidate documents to MongoDB
  → GET  /api/jobs/:id/results                React polls this until job.status === "completed"
```

<br/>

## 🚀 Quick Start

No Docker needed — three terminals, one per service.

### 0. Prerequisites

| Requirement | Why |
|---|---|
| Node.js 18+ & npm | Backend + frontend |
| Python 3.10+ | AI service |
| MongoDB (local or [Atlas](https://mongodb.com/atlas) free tier) | Data store |
| A free [Groq API key](https://console.groq.com/keys) | *Optional to start* — see Mock Mode below |

<details>
<summary><b>🐍 Terminal 1 — AI service (Python + Groq)</b></summary>

```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# edit .env and paste your real GROQ_API_KEY — or skip this, see Mock Mode
uvicorn main:app --reload --port 8001
```

Check it's alive → **http://localhost:8001/health** should show `"groq_key_configured": true`.

> **Mock Mode:** no `GROQ_API_KEY`? The service automatically falls back to a keyword-overlap
> scorer, so the *entire* pipeline (upload → extract → score → rank) works for free before you've
> set up Groq. `/health` shows `"mock_mode": true`, and the results page shows a banner whenever
> mock scores are being displayed. Add a real key and restart to flip to LLM scoring — zero code
> changes.

</details>

<details>
<summary><b>🟢 Terminal 2 — Backend (Node/Express)</b></summary>

```bash
cd backend
npm install
cp .env.example .env
# edit .env if your Mongo URI or AI service port differs
npm run dev
```

You should see `MongoDB connected` and `AuraHire backend running on port 5000`.

> **Email verification:** if `SMTP_USER`/`SMTP_PASS` are blank, verification links print straight
> to this terminal instead of emailing — copy-paste to test the flow with zero email setup. To send
> real emails via Gmail: turn on [2-Step Verification](https://myaccount.google.com/security),
> generate an [App Password](https://myaccount.google.com/apppasswords), and set `SMTP_USER` /
> `SMTP_PASS` / `SMTP_FROM` in `backend/.env`. Any other SMTP provider works too.

</details>

<details>
<summary><b>⚛️ Terminal 3 — Frontend (React)</b></summary>

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — this is the HR-facing app.

</details>

### Try it end to end

1. **Register** a company account — you're logged in immediately, no need to verify first
2. **Post a job**: title, description, required/preferred skills, minimum experience, and *who's
   posting it* (attributed by name, not by account)
3. **Attach a `.zip`** of resumes (`.pdf`, `.docx`, `.txt` — mix and match)
4. Hit **Filter Resumes** → land on a live-polling results page while the AI service scores each one
5. Get a **ranked table**: score, matched/missing skills, a plain-language reason, and a
   **Shortlist** button that records who shortlisted whom, and when

<br/>

## 🔐 Environment Variables

<details>
<summary><b>backend/.env</b></summary>

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `AI_SERVICE_URL` | Where the Python service lives (default `http://127.0.0.1:8001`) |
| `JWT_SECRET` | Signs session tokens — **use a long random string, never the sample value** |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Email verification — leave blank to print links to the console instead |
| `FRONTEND_URL` | Used to build the link inside verification emails |

</details>

<details>
<summary><b>ai-service/.env</b></summary>

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables real LLM scoring — omit to run in Mock Mode |

</details>

> ⚠️ **Never commit real secrets.** `.env.example` files should hold placeholder values only —
> double-check this repo's example files before making it public.

<br/>

## 📁 Project Structure

```
AuraHire/
├── frontend/          React (Vite) — HR UI
│   └── src/
│       ├── pages/       Home, Register, Login, Profile, CreateJob, JobResults, JobHistory, Shortlisted
│       ├── components/  Navbar, modals, shared UI
│       └── context/     Auth + Theme providers
├── backend/            Node/Express + MongoDB
│   ├── controllers/     company, job, candidate logic
│   ├── models/          Company, PendingRegistration, Job, Candidate
│   ├── routes/           REST endpoints
│   └── middleware/       JWT auth guard
└── ai-service/          Python/FastAPI + Groq
    └── main.py           Scoring endpoint + mock-mode fallback
```

<br/>

## 🗄️ Where resumes actually live

- **Disk** — `backend/uploads/extracted/<jobId>/...`
- **MongoDB** — raw bytes on each `Candidate` document (`fileData`, capped at 15MB to stay under
  Mongo's 16MB document limit; oversized files still save to disk, just not to Mongo)

`fileData` is excluded from normal queries (`select: false`) so results stay fast even with
thousands of candidates. Fetch the actual bytes via:

```
GET /api/candidates/:candidateId/resume
```

<br/>

## 🛣️ Before going to production

| Area | Current approach | At scale, switch to |
|---|---|---|
| **File storage** | `Buffer` field on the Candidate doc | GridFS, once resumes get large/image-heavy |
| **Resume processing** | In-process background task | A real queue (BullMQ + Redis) — survives restarts, scales horizontally |
| **Groq calls** | One resume per API call, in a loop | Batched or concurrency-limited requests past a few hundred resumes/job |
| **Model** | `llama-3.1-8b-instant` (fast, cheap) | `llama-3.3-70b-versatile` for higher accuracy at slightly higher latency/cost |

<br/>

## 🤝 Contributing

Issues and PRs are welcome — this is an actively evolving project. If you're proposing a bigger
change, open an issue first so we're aligned before you put in the work.

<br/>

<div align="center">

Built with 🧡 using the MERN stack + Python — because resumes shouldn't take all afternoon to read.

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:00C2A8,50:7C5CFC,100:FF5A5F&height=120&section=footer" width="100%"/>

</div>
