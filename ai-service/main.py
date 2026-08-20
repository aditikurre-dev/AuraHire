"""
AuraHire AI Service
--------------------
Standalone Python microservice that scores resumes against a job description
using Groq's LLM API (fast inference, OpenAI-compatible SDK).

The Node/Express backend calls this service internally — it is never
exposed directly to the frontend.

Run:
    pip install -r requirements.txt
    export GROQ_API_KEY=your_key_here
    uvicorn main:app --reload --port 8001
"""

import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from groq import Groq
from dotenv import load_dotenv

load_dotenv()  # reads ai-service/.env into the process environment

app = FastAPI(title="AuraHire AI Service")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Groq's fast open-weight model — good balance of speed/quality for structured scoring.
# Swap to a larger model (e.g. llama-3.3-70b-versatile) if you need higher accuracy.
MODEL = "llama-3.1-8b-instant"

# If no GROQ_API_KEY is set, the service falls back to a simple keyword/TF-IDF-free
# mock scorer. This lets you run and test the full three-service pipeline
# (frontend -> backend -> AI service -> MongoDB) with zero setup before you
# have a Groq key. Swap MOCK_MODE off automatically the moment a key is present.
MOCK_MODE = client is None

class JobDescription(BaseModel):
    title: str
    description: str
    required_skills: List[str]
    preferred_skills: List[str] = []
    min_experience_years: float = 0

class ResumeInput(BaseModel):
    filename: str
    text: str

class ScoreRequest(BaseModel):
    job: JobDescription
    resumes: List[ResumeInput]

SCORING_PROMPT = """You are an expert technical recruiter. Score how well the RESUME matches the JOB DESCRIPTION below.

JOB TITLE: {title}
JOB DESCRIPTION: {description}
REQUIRED SKILLS: {required_skills}
PREFERRED SKILLS: {preferred_skills}
MINIMUM EXPERIENCE (years): {min_experience}

RESUME TEXT:
{resume_text}

IMPORTANT — how to judge experience:
- "years_experience_detected" must count ONLY professional work experience
  (full-time jobs, part-time jobs, internships with an actual employer) that
  is RELEVANT to this specific job — i.e. the role's actual duties involved
  the required skills, this tech stack, or clearly transferable technical
  work. Judge relevance by what the person actually DID in that role
  (responsibilities/duties described in the resume), never by the employer's
  name, size, or reputation — e.g. a Sales or Marketing role at a well-known
  tech company is still NOT relevant technical experience.
- Do NOT count college coursework, academic assignments, personal/portfolio
  projects, hackathons, or capstone projects toward this number, even if they
  used the required tech stack and even if the resume states a duration for
  them. Those demonstrate skill, not work experience.
- Do NOT count professional experience in an unrelated field or role (e.g.
  sales, customer support, a different engineering discipline) toward
  "years_experience_detected", even though it is real paid work experience —
  it does not make the candidate more qualified for THIS role.
- Instead, report any such unrelated professional experience separately in
  "irrelevant_experience_years" and "irrelevant_experience_note". If there is
  none, use 0 and "None".
- CRITICAL — never invent or estimate a duration. Only report a number in
  "irrelevant_experience_years" if the resume explicitly states a duration
  (dates, "X years", "X months", etc.) for that specific role. If the resume
  names an unrelated role/company but does NOT state how long the person
  worked there, set "irrelevant_experience_years" to 0 and still name the
  role in "irrelevant_experience_note" with the words "duration not
  specified" — do not guess a round number like 1 or 2 years to fill the gap.
- If the resume has no relevant professional work experience at all, set
  "years_experience_detected" to 0, and instead mention the relevant
  projects/coursework as a strength if the skills genuinely match — being a
  fresher with strong project work is not a concern by itself, but it should
  never be reported as if it were years of professional experience.

Respond with ONLY a valid JSON object (no markdown, no preamble) in exactly this shape:
{{
  "score": <integer 0-100, overall match score>,
  "years_experience_detected": <number, RELEVANT professional work experience ONLY — see rules above>,
  "irrelevant_experience_years": <number, ONLY if a duration is explicitly stated in the resume for the unrelated role(s) — 0 if no duration is stated, never estimated>,
  "irrelevant_experience_note": "<short phrase naming the unrelated role(s)/field, e.g. 'Sales Executive at X — unrelated, duration not specified', or 'None'>",
  "required_skills_matched": [<list of required skills found in resume>],
  "required_skills_missing": [<list of required skills NOT found in resume>],
  "preferred_skills_matched": [<list of preferred skills found in resume>],
  "meets_min_experience": <true or false>,
  "strengths": "<one short sentence on candidate's key strength for this role>",
  "concerns": "<one short sentence on the biggest gap or concern, or 'None' if strong fit>"
}}
"""

def mock_score_resume(job: JobDescription, resume: ResumeInput) -> dict:
    """
    Simple keyword-overlap scorer used only when GROQ_API_KEY is not set.
    Good enough to test the end-to-end pipeline (upload -> extract -> score ->
    display) without needing an API key yet. Not a substitute for LLM scoring.
    """
    text_lower = resume.text.lower()
    all_skills = job.required_skills + job.preferred_skills

    def matches(skill):
        s = skill.lower()
        return s in text_lower or s.replace(".", "") in text_lower.replace(".", "")

    matched_required = [s for s in job.required_skills if matches(s)]
    missing_required = [s for s in job.required_skills if not matches(s)]
    matched_preferred = [s for s in job.preferred_skills if matches(s)]

    years_matches = [float(y) for y in __import__("re").findall(r"(\d+(?:\.\d+)?)\s*\+?\s*years?", resume.text, flags=__import__("re").IGNORECASE)]
    years = max(years_matches) if years_matches else 0.0

    req_ratio = len(matched_required) / len(job.required_skills) if job.required_skills else 1.0
    pref_ratio = len(matched_preferred) / len(job.preferred_skills) if job.preferred_skills else 1.0
    exp_ratio = 1.0 if job.min_experience_years == 0 or years >= job.min_experience_years else years / max(job.min_experience_years, 0.1)

    score = round(req_ratio * 60 + pref_ratio * 20 + exp_ratio * 20)

    return {
        "score": score,
        "years_experience_detected": years,
        "irrelevant_experience_years": 0,
        "irrelevant_experience_note": "MOCK MODE — irrelevant-experience detection needs GROQ_API_KEY",
        "required_skills_matched": matched_required,
        "required_skills_missing": missing_required,
        "preferred_skills_matched": matched_preferred,
        "meets_min_experience": years >= job.min_experience_years,
        "strengths": f"Matched {len(matched_required)}/{len(job.required_skills)} required skills" if job.required_skills else "N/A",
        "concerns": "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring" if missing_required else "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring",
    }

def score_single_resume(job: JobDescription, resume: ResumeInput) -> dict:
    if MOCK_MODE:
        result = mock_score_resume(job, resume)
        result["filename"] = resume.filename
        return result

    prompt = SCORING_PROMPT.format(
        title=job.title,
        description=job.description,
        required_skills=", ".join(job.required_skills),
        preferred_skills=", ".join(job.preferred_skills) or "None specified",
        min_experience=job.min_experience_years,
        resume_text=resume.text[:6000],  # guard against extremely long resumes blowing the context
    )

    raw = None
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # LLM occasionally wraps output in markdown fences despite instructions — strip and retry
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
    except Exception as e:
        # Never let one bad resume kill the whole batch — return a zero-score flagged entry
        parsed = {
            "score": 0,
            "years_experience_detected": 0,
            "irrelevant_experience_years": 0,
            "irrelevant_experience_note": "None",
            "required_skills_matched": [],
            "required_skills_missing": job.required_skills,
            "preferred_skills_matched": [],
            "meets_min_experience": False,
            "strengths": "N/A",
            "concerns": f"Scoring failed: {str(e)}",
        }

    parsed["filename"] = resume.filename
    return parsed

@app.post("/score")
def score_resumes(request: ScoreRequest):
    results = [score_single_resume(request.job, r) for r in request.resumes]
    results.sort(key=lambda r: r["score"], reverse=True)
    return {"results": results, "mock_mode": MOCK_MODE}

@app.get("/health")
def health():
    return {"status": "ok", "groq_key_configured": not MOCK_MODE, "mock_mode": MOCK_MODE}
"""
AuraHire AI Service
--------------------
Standalone Python microservice that scores resumes against a job description
using Groq's LLM API (fast inference, OpenAI-compatible SDK).

The Node/Express backend calls this service internally — it is never
exposed directly to the frontend.

Run:
    pip install -r requirements.txt
    export GROQ_API_KEY=your_key_here
    uvicorn main:app --reload --port 8001
"""

import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from groq import Groq
from dotenv import load_dotenv

load_dotenv()  # reads ai-service/.env into the process environment

app = FastAPI(title="AuraHire AI Service")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Groq's fast open-weight model — good balance of speed/quality for structured scoring.
# Swap to a larger model (e.g. llama-3.3-70b-versatile) if you need higher accuracy.
MODEL = "llama-3.1-8b-instant"

# If no GROQ_API_KEY is set, the service falls back to a simple keyword/TF-IDF-free
# mock scorer. This lets you run and test the full three-service pipeline
# (frontend -> backend -> AI service -> MongoDB) with zero setup before you
# have a Groq key. Swap MOCK_MODE off automatically the moment a key is present.
MOCK_MODE = client is None

class JobDescription(BaseModel):
    title: str
    description: str
    required_skills: List[str]
    preferred_skills: List[str] = []
    min_experience_years: float = 0

class ResumeInput(BaseModel):
    filename: str
    text: str

class ScoreRequest(BaseModel):
    job: JobDescription
    resumes: List[ResumeInput]

SCORING_PROMPT = """You are an expert technical recruiter. Score how well the RESUME matches the JOB DESCRIPTION below.

JOB TITLE: {title}
JOB DESCRIPTION: {description}
REQUIRED SKILLS: {required_skills}
PREFERRED SKILLS: {preferred_skills}
MINIMUM EXPERIENCE (years): {min_experience}

RESUME TEXT:
{resume_text}

IMPORTANT — how to judge experience:
- "years_experience_detected" must count ONLY professional work experience
  (full-time jobs, part-time jobs, internships with an actual employer) that
  is RELEVANT to this specific job — i.e. the role's actual duties involved
  the required skills, this tech stack, or clearly transferable technical
  work. Judge relevance by what the person actually DID in that role
  (responsibilities/duties described in the resume), never by the employer's
  name, size, or reputation — e.g. a Sales or Marketing role at a well-known
  tech company is still NOT relevant technical experience.
- Do NOT count college coursework, academic assignments, personal/portfolio
  projects, hackathons, or capstone projects toward this number, even if they
  used the required tech stack and even if the resume states a duration for
  them. Those demonstrate skill, not work experience.
- Do NOT count professional experience in an unrelated field or role (e.g.
  sales, customer support, a different engineering discipline) toward
  "years_experience_detected", even though it is real paid work experience —
  it does not make the candidate more qualified for THIS role.
- Instead, report any such unrelated professional experience separately in
  "irrelevant_experience_years" and "irrelevant_experience_note". If there is
  none, use 0 and "None".
- CRITICAL — never invent or estimate a duration. Only report a number in
  "irrelevant_experience_years" if the resume explicitly states a duration
  (dates, "X years", "X months", etc.) for that specific role. If the resume
  names an unrelated role/company but does NOT state how long the person
  worked there, set "irrelevant_experience_years" to 0 and still name the
  role in "irrelevant_experience_note" with the words "duration not
  specified" — do not guess a round number like 1 or 2 years to fill the gap.
- If the resume has no relevant professional work experience at all, set
  "years_experience_detected" to 0, and instead mention the relevant
  projects/coursework as a strength if the skills genuinely match — being a
  fresher with strong project work is not a concern by itself, but it should
  never be reported as if it were years of professional experience.

Respond with ONLY a valid JSON object (no markdown, no preamble) in exactly this shape:
{{
  "score": <integer 0-100, overall match score>,
  "years_experience_detected": <number, RELEVANT professional work experience ONLY — see rules above>,
  "irrelevant_experience_years": <number, ONLY if a duration is explicitly stated in the resume for the unrelated role(s) — 0 if no duration is stated, never estimated>,
  "irrelevant_experience_note": "<short phrase naming the unrelated role(s)/field, e.g. 'Sales Executive at X — unrelated, duration not specified', or 'None'>",
  "required_skills_matched": [<list of required skills found in resume>],
  "required_skills_missing": [<list of required skills NOT found in resume>],
  "preferred_skills_matched": [<list of preferred skills found in resume>],
  "meets_min_experience": <true or false>,
  "strengths": "<one short sentence on candidate's key strength for this role>",
  "concerns": "<one short sentence on the biggest gap or concern, or 'None' if strong fit>"
}}
"""

def mock_score_resume(job: JobDescription, resume: ResumeInput) -> dict:
    """
    Simple keyword-overlap scorer used only when GROQ_API_KEY is not set.
    Good enough to test the end-to-end pipeline (upload -> extract -> score ->
    display) without needing an API key yet. Not a substitute for LLM scoring.
    """
    text_lower = resume.text.lower()
    all_skills = job.required_skills + job.preferred_skills

    def matches(skill):
        s = skill.lower()
        return s in text_lower or s.replace(".", "") in text_lower.replace(".", "")

    matched_required = [s for s in job.required_skills if matches(s)]
    missing_required = [s for s in job.required_skills if not matches(s)]
    matched_preferred = [s for s in job.preferred_skills if matches(s)]

    years_matches = [float(y) for y in __import__("re").findall(r"(\d+(?:\.\d+)?)\s*\+?\s*years?", resume.text, flags=__import__("re").IGNORECASE)]
    years = max(years_matches) if years_matches else 0.0

    req_ratio = len(matched_required) / len(job.required_skills) if job.required_skills else 1.0
    pref_ratio = len(matched_preferred) / len(job.preferred_skills) if job.preferred_skills else 1.0
    exp_ratio = 1.0 if job.min_experience_years == 0 or years >= job.min_experience_years else years / max(job.min_experience_years, 0.1)

    score = round(req_ratio * 60 + pref_ratio * 20 + exp_ratio * 20)

    return {
        "score": score,
        "years_experience_detected": years,
        "irrelevant_experience_years": 0,
        "irrelevant_experience_note": "MOCK MODE — irrelevant-experience detection needs GROQ_API_KEY",
        "required_skills_matched": matched_required,
        "required_skills_missing": missing_required,
        "preferred_skills_matched": matched_preferred,
        "meets_min_experience": years >= job.min_experience_years,
        "strengths": f"Matched {len(matched_required)}/{len(job.required_skills)} required skills" if job.required_skills else "N/A",
        "concerns": "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring" if missing_required else "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring",
    }

def score_single_resume(job: JobDescription, resume: ResumeInput) -> dict:
    if MOCK_MODE:
        result = mock_score_resume(job, resume)
        result["filename"] = resume.filename
        return result

    prompt = SCORING_PROMPT.format(
        title=job.title,
        description=job.description,
        required_skills=", ".join(job.required_skills),
        preferred_skills=", ".join(job.preferred_skills) or "None specified",
        min_experience=job.min_experience_years,
        resume_text=resume.text[:6000],  # guard against extremely long resumes blowing the context
    )

    raw = None
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # LLM occasionally wraps output in markdown fences despite instructions — strip and retry
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
    except Exception as e:
        # Never let one bad resume kill the whole batch — return a zero-score flagged entry
        parsed = {
            "score": 0,
            "years_experience_detected": 0,
            "irrelevant_experience_years": 0,
            "irrelevant_experience_note": "None",
            "required_skills_matched": [],
            "required_skills_missing": job.required_skills,
            "preferred_skills_matched": [],
            "meets_min_experience": False,
            "strengths": "N/A",
            "concerns": f"Scoring failed: {str(e)}",
        }

    parsed["filename"] = resume.filename
    return parsed

@app.post("/score")
def score_resumes(request: ScoreRequest):
    results = [score_single_resume(request.job, r) for r in request.resumes]
    results.sort(key=lambda r: r["score"], reverse=True)
    return {"results": results, "mock_mode": MOCK_MODE}

@app.get("/health")
def health():
    return {"status": "ok", "groq_key_configured": not MOCK_MODE, "mock_mode": MOCK_MODE}
"""
AuraHire AI Service
--------------------
Standalone Python microservice that scores resumes against a job description
using Groq's LLM API (fast inference, OpenAI-compatible SDK).

The Node/Express backend calls this service internally — it is never
exposed directly to the frontend.

Run:
    pip install -r requirements.txt
    export GROQ_API_KEY=your_key_here
    uvicorn main:app --reload --port 8001
"""

import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from groq import Groq
from dotenv import load_dotenv

load_dotenv()  # reads ai-service/.env into the process environment

app = FastAPI(title="AuraHire AI Service")

GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# Groq's fast open-weight model — good balance of speed/quality for structured scoring.
# Swap to a larger model (e.g. llama-3.3-70b-versatile) if you need higher accuracy.
MODEL = "llama-3.1-8b-instant"

# If no GROQ_API_KEY is set, the service falls back to a simple keyword/TF-IDF-free
# mock scorer. This lets you run and test the full three-service pipeline
# (frontend -> backend -> AI service -> MongoDB) with zero setup before you
# have a Groq key. Swap MOCK_MODE off automatically the moment a key is present.
MOCK_MODE = client is None

class JobDescription(BaseModel):
    title: str
    description: str
    required_skills: List[str]
    preferred_skills: List[str] = []
    min_experience_years: float = 0

class ResumeInput(BaseModel):
    filename: str
    text: str

class ScoreRequest(BaseModel):
    job: JobDescription
    resumes: List[ResumeInput]

SCORING_PROMPT = """You are an expert technical recruiter. Score how well the RESUME matches the JOB DESCRIPTION below.

JOB TITLE: {title}
JOB DESCRIPTION: {description}
REQUIRED SKILLS: {required_skills}
PREFERRED SKILLS: {preferred_skills}
MINIMUM EXPERIENCE (years): {min_experience}

RESUME TEXT:
{resume_text}

IMPORTANT — how to judge experience:
- "years_experience_detected" must count ONLY professional work experience
  (full-time jobs, part-time jobs, internships with an actual employer) that
  is RELEVANT to this specific job — i.e. the role's actual duties involved
  the required skills, this tech stack, or clearly transferable technical
  work. Judge relevance by what the person actually DID in that role
  (responsibilities/duties described in the resume), never by the employer's
  name, size, or reputation — e.g. a Sales or Marketing role at a well-known
  tech company is still NOT relevant technical experience.
- Do NOT count college coursework, academic assignments, personal/portfolio
  projects, hackathons, or capstone projects toward this number, even if they
  used the required tech stack and even if the resume states a duration for
  them. Those demonstrate skill, not work experience.
- Do NOT count professional experience in an unrelated field or role (e.g.
  sales, customer support, a different engineering discipline) toward
  "years_experience_detected", even though it is real paid work experience —
  it does not make the candidate more qualified for THIS role.
- Instead, report any such unrelated professional experience separately in
  "irrelevant_experience_years" and "irrelevant_experience_note". If there is
  none, use 0 and "None".
- CRITICAL — never invent or estimate a duration. Only report a number in
  "irrelevant_experience_years" if the resume explicitly states a duration
  (dates, "X years", "X months", etc.) for that specific role. If the resume
  names an unrelated role/company but does NOT state how long the person
  worked there, set "irrelevant_experience_years" to 0 and still name the
  role in "irrelevant_experience_note" with the words "duration not
  specified" — do not guess a round number like 1 or 2 years to fill the gap.
- If the resume has no relevant professional work experience at all, set
  "years_experience_detected" to 0, and instead mention the relevant
  projects/coursework as a strength if the skills genuinely match — being a
  fresher with strong project work is not a concern by itself, but it should
  never be reported as if it were years of professional experience.

Respond with ONLY a valid JSON object (no markdown, no preamble) in exactly this shape:
{{
  "score": <integer 0-100, overall match score>,
  "years_experience_detected": <number, RELEVANT professional work experience ONLY — see rules above>,
  "irrelevant_experience_years": <number, ONLY if a duration is explicitly stated in the resume for the unrelated role(s) — 0 if no duration is stated, never estimated>,
  "irrelevant_experience_note": "<short phrase naming the unrelated role(s)/field, e.g. 'Sales Executive at X — unrelated, duration not specified', or 'None'>",
  "required_skills_matched": [<list of required skills found in resume>],
  "required_skills_missing": [<list of required skills NOT found in resume>],
  "preferred_skills_matched": [<list of preferred skills found in resume>],
  "meets_min_experience": <true or false>,
  "strengths": "<one short sentence on candidate's key strength for this role>",
  "concerns": "<one short sentence on the biggest gap or concern, or 'None' if strong fit>"
}}
"""

def mock_score_resume(job: JobDescription, resume: ResumeInput) -> dict:
    """
    Simple keyword-overlap scorer used only when GROQ_API_KEY is not set.
    Good enough to test the end-to-end pipeline (upload -> extract -> score ->
    display) without needing an API key yet. Not a substitute for LLM scoring.
    """
    text_lower = resume.text.lower()
    all_skills = job.required_skills + job.preferred_skills

    def matches(skill):
        s = skill.lower()
        return s in text_lower or s.replace(".", "") in text_lower.replace(".", "")

    matched_required = [s for s in job.required_skills if matches(s)]
    missing_required = [s for s in job.required_skills if not matches(s)]
    matched_preferred = [s for s in job.preferred_skills if matches(s)]

    years_matches = [float(y) for y in __import__("re").findall(r"(\d+(?:\.\d+)?)\s*\+?\s*years?", resume.text, flags=__import__("re").IGNORECASE)]
    years = max(years_matches) if years_matches else 0.0

    req_ratio = len(matched_required) / len(job.required_skills) if job.required_skills else 1.0
    pref_ratio = len(matched_preferred) / len(job.preferred_skills) if job.preferred_skills else 1.0
    exp_ratio = 1.0 if job.min_experience_years == 0 or years >= job.min_experience_years else years / max(job.min_experience_years, 0.1)

    score = round(req_ratio * 60 + pref_ratio * 20 + exp_ratio * 20)

    return {
        "score": score,
        "years_experience_detected": years,
        "irrelevant_experience_years": 0,
        "irrelevant_experience_note": "MOCK MODE — irrelevant-experience detection needs GROQ_API_KEY",
        "required_skills_matched": matched_required,
        "required_skills_missing": missing_required,
        "preferred_skills_matched": matched_preferred,
        "meets_min_experience": years >= job.min_experience_years,
        "strengths": f"Matched {len(matched_required)}/{len(job.required_skills)} required skills" if job.required_skills else "N/A",
        "concerns": "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring" if missing_required else "MOCK MODE — set GROQ_API_KEY for real LLM-based scoring",
    }

def score_single_resume(job: JobDescription, resume: ResumeInput) -> dict:
    if MOCK_MODE:
        result = mock_score_resume(job, resume)
        result["filename"] = resume.filename
        return result

    prompt = SCORING_PROMPT.format(
        title=job.title,
        description=job.description,
        required_skills=", ".join(job.required_skills),
        preferred_skills=", ".join(job.preferred_skills) or "None specified",
        min_experience=job.min_experience_years,
        resume_text=resume.text[:6000],  # guard against extremely long resumes blowing the context
    )

    raw = None
    try:
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = completion.choices[0].message.content
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # LLM occasionally wraps output in markdown fences despite instructions — strip and retry
        cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(cleaned)
    except Exception as e:
        # Never let one bad resume kill the whole batch — return a zero-score flagged entry
        parsed = {
            "score": 0,
            "years_experience_detected": 0,
            "irrelevant_experience_years": 0,
            "irrelevant_experience_note": "None",
            "required_skills_matched": [],
            "required_skills_missing": job.required_skills,
            "preferred_skills_matched": [],
            "meets_min_experience": False,
            "strengths": "N/A",
            "concerns": f"Scoring failed: {str(e)}",
        }

    parsed["filename"] = resume.filename
    return parsed

@app.post("/score")
def score_resumes(request: ScoreRequest):
    results = [score_single_resume(request.job, r) for r in request.resumes]
    results.sort(key=lambda r: r["score"], reverse=True)
    return {"results": results, "mock_mode": MOCK_MODE}

@app.get("/health")
def health():
    return {"status": "ok", "groq_key_configured": not MOCK_MODE, "mock_mode": MOCK_MODE}
