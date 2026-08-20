import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/api";

export default function JobResults() {
  const { jobId } = useParams();
  const [status, setStatus] = useState("processing");
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get(`/jobs/${jobId}/status`);
      setStatus(res.data.status);
      return res.data.status;
    } catch (err) {
      setError("Could not fetch job status.");
      return "failed";
    }
  }, [jobId]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await api.get(`/jobs/${jobId}/results`);
      setCandidates(res.data);
    } catch (err) {
      setError("Could not fetch results.");
    }
  }, [jobId]);

  useEffect(() => {
    let interval;
    async function poll() {
      const currentStatus = await fetchStatus();
      if (currentStatus === "completed" || currentStatus === "failed") {
        clearInterval(interval);
        if (currentStatus === "completed") fetchResults();
      }
    }
    poll();
    interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchResults]);

  async function toggleShortlist(candidateId, current) {
    await api.patch(`/candidates/${candidateId}/shortlist`, { shortlisted: !current });
    fetchResults();
  }

  return (
    <div className="page">
      <Link to="/">&larr; New job</Link>
      <h1>Ranked Candidates</h1>

      {status === "processing" || status === "queued" ? (
        <p className="status-banner">Scoring resumes... this page updates automatically.</p>
      ) : null}
      {status === "failed" && <p className="error">Scoring failed. Check that resumes were valid and the AI service is running.</p>}
      {error && <p className="error">{error}</p>}
      {candidates.length > 0 && candidates[0]?.concerns?.includes("MOCK MODE") && (
        <p className="status-banner">
          Running on the AI service's mock scorer (no GROQ_API_KEY set) — scores here are keyword-based, not LLM-based.
          Set GROQ_API_KEY in ai-service/.env for real scoring.
        </p>
      )}

      {candidates.length > 0 && (
        <table className="results-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Candidate File</th>
              <th>Score</th>
              <th>Experience (yrs)</th>
              <th>Irrelevant Experience</th>
              <th>Meets Min Exp?</th>
              <th>Required Skills Matched</th>
              <th>Concerns</th>
              <th>Resume</th>
              <th>Shortlist</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr key={c._id} className={c.shortlisted ? "shortlisted" : ""}>
                <td>{i + 1}</td>
                <td>{c.filename}</td>
                <td className="score">{c.score}</td>
                <td>{c.yearsExperienceDetected}</td>
                <td>
                  {c.irrelevantExperienceYears > 0
                    ? `${c.irrelevantExperienceYears} yr — ${c.irrelevantExperienceNote}`
                    : "—"}
                </td>
                <td>{c.meetsMinExperience ? "Yes" : "No"}</td>
                <td>{c.requiredSkillsMatched.join(", ") || "—"}</td>
                <td>{c.concerns || "—"}</td>
                <td>
                  <a href={`http://localhost:5000/api/candidates/${c._id}/resume`} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
                <td>
                  <button onClick={() => toggleShortlist(c._id, c.shortlisted)}>
                    {c.shortlisted ? "Remove" : "Shortlist"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
