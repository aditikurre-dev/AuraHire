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

## 🏗️ Architecture & System Design

Three services, run side by side — nothing talks to the frontend except the Node backend:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                         AURAHIRE — SYSTEM ARCHITECTURE PIPELINE                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘

   [ 1. FRONTEND LAYER ]           [ 2. BACKEND LAYER ]            [ 3. AI MICROSERVICE ]
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│        React SPA         │◄──►│    Node.js / Express     │◄──►│      Python FastAPI      │
│        Port :5173        │    │        Port :5000        │    │        Port :8001        │
└──────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
              │                               ▲                               │
        HTTP REST API                         |                        Internal REST API
              │                               |                               |│                               |                               |
              |                               │                               |
              ▼                               |                               ▼
- Candidate Management            • JWT Authentication          - PDF Text Extraction
- Job Description Postings        • Route Orchestration         - Groq Llama 3 LLM
- Multipart ZIP Uploader          • Multipart Stream Handling   - Evaluation & Scoring
- Ranked Leaderboards             • Email Notifications         - Fallback Mock Mode
                                              |
                                              |
                                              |
                                              │
                                              ▼
                                ┌──────────────────────────┐
                                │     MongoDB Database     │
                                │    (Persistent Store)    │
                                └──────────────────────────┘

```


### How a request flows end to end

```text
┌───────────────────┐
│  Browser (React)  │
└─────────┬─────────┘
          │
          ▼
POST /api/companies/register   (or /login)
          │   
          |   Node → creates/verifies the company, returns a JWT
          ▼
POST /api/jobs
          │   
          |   Node → creates the job in MongoDB, companyId comes from the JWT
          ▼
POST /api/jobs/:id/resumes
          │   
          |   Node → unzips the file, extracts text from every resume
          │
          ├──►  POST http://ai-service/score
          │           Python → calls Groq once per resume, returns JSON scores
          │
          |   Node → saves the scored Candidate documents to MongoDB
          ▼
GET /api/jobs/:id/results
          │   
          ├──►  React → polls this endpoint until job.status === "completed"
```

<br/>

## 🛠️ Tech Stack

### Frontend

|    Technology       |            Purpose              |
|---|---|
| React 18            | Builds the UI                   |
| React Router DOM    | Handles page routing            |
| Axios               | HTTP client for API requests    |
| Vite                | Build tool & dev server         |
| CSS (custom)        | App styling                     |

### Backend

|     Technology         |                 Purpose                 |
|---|---|
| Node.js                | JavaScript runtime for the server       |
| Express                | Web framework for building REST APIs    |
| MongoDB (Mongoose)     | Database & object modeling              |
| JWT                    | User authentication (tokens)            |
| bcryptjs               | Password hashing                        |
| Multer                 | Handles file uploads                    |
| pdf-parse              | Extracts text from PDF resumes          |
| Mammoth                | Extracts text from Word (.docx) resumes |
| Nodemailer             | Sends emails                            |
| Axios                  | Makes external API requests             |
| CORS                   | Enables cross-origin requests           |
| dotenv                 | Manages environment variables           |

### AI Microservice


|   Technology    |             Purpose                         |
|---|---|
| Python          | Core language for the AI service            |
| FastAPI         | Web framework for building the API          |
| Uvicorn         | ASGI server to run FastAPI                  |
| Groq            | LLM inference for AI-powered features       |
| Pydantic        | Data validation & request/response models   |
| python-dotenv   | Manages environment variables               |


### Tooling


|     Tool      |               Purpose                    |
|---|---|
| Git           | Version control                          |
| Nodemon       | Auto-restarts backend server on changes  |
| Vite          | Frontend dev server & build tool         |
| npm           | Package manager (frontend & backend)     |
| dotenv        | Environment variable management          |


## 🚀 Quick Start

### 0. Prerequisites

| Requirement | Why |
|---|---|
| Node.js 18+ & npm | Backend + frontend |
| Python 3.10+ | AI service |
| MongoDB ([Compass](https://www.mongodb.com/) free tier) | Data store |
| A free [Groq API key](https://console.groq.com/keys) | Groq LLM Interface |

### 1. Installation

<details>
<summary><b>📥 Terminal 1 - Clone the repository (GitHub)

```bash
git clone https://github.com/< username >/AuraHire.git
cd AuraHire
```

<summary><b>🐍 Terminal 2 — AI service (Python + Groq)</b></summary>

```bash
cd ai-service
python3 -m venv venv
source venv/Scripts/activate        
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn main:app --reload --port 8001
```

Check it's alive → **http://localhost:8001/health** should show `"groq_key_configured": true`.

> **Mock Mode:** no `GROQ_API_KEY`? The service automatically falls back to a keyword-overlap
> scorer, so the *entire* pipeline (upload → extract → score → rank) works for free before you've
> set up Groq. `/health` shows `"mock_mode": true`, and the results page shows a banner whenever
> mock scores are being displayed. Add a real key and restart to flip to LLM scoring — zero code
> changes.

</details>

<details>
<summary><b>🟢 Terminal 3 — Backend (Node/Express)</b></summary>

```bash
cd backend
npm install
cp .env.example .env
node server.js
```

You should see `MongoDB connected` and `AuraHire backend running on port 5000`.

> **Email verification:** To send real emails via Gmail: turn on [2-Step Verification](https://myaccount.google.com/security),
> generate an [App Password](https://myaccount.google.com/apppasswords), and set `SMTP_USER` /
> `SMTP_PASS` / `SMTP_FROM` in `backend/.env`.

</details>

<details>
<summary><b>⚛️ Terminal 4 — Frontend (React)</b></summary>

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — this is the User-facing app.

</details>

### Try it end to end

1. **Register** a company account — you're logged in immediately (a JWT is issued right away); email verification is only required later, before you can post a job.
2. **Post a job**: title, description, required/preferred skills, minimum experience, and *who's
   posting it* (attributed by name, not by account)
3. **Attach a `.zip`** of resumes (`.pdf`, `.docx`, `.txt` — mix and match)
4. Hit **Filter Resumes** → land on a live-polling results page while the AI service scores each one
5. Get a **ranked table**: score, matched/missing skills, a plain-language reason, and a
   **Shortlist** button that records who shortlisted whom, and when

<br/>

## 🔐 Environment Variables

### backend/.env

|     Variable      |                Description                         |
|---|---|
| `PORT`            | Port for the backend server (default: 5000)        |
| `MONGO_URI`       | MongoDB connection string                          |
| `AI_SERVICE_URL`  | URL of the running AI microservice                 |
| `JWT_SECRET`      | Secret key used to sign JWT tokens                 |
| `SMTP_HOST`       | SMTP server host (for sending verification emails) |
| `SMTP_PORT`       | SMTP server port                                   |
| `SMTP_USER`       | SMTP account username                              |
| `SMTP_PASS`       | SMTP account password / app password               |
| `SMTP_FROM`       | Sender email shown on verification emails          |
| `FRONTEND_URL`    | Base URL of the frontend (for email links)         |

### ai-service/.env

| Variable | Purpose |
|---|---|
| `GROQ_API_KEY` | Enables real LLM scoring — omit to run in Mock Mode |

The app will be running at `http://localhost:5173`, with the backend on port `5000` and the AI service on port `8001`.

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
