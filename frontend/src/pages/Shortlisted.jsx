import { useCallback, useEffect, useState } from "react";
import api from "../api/api";

export default function Shortlisted() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get("/candidates/shortlisted");
      setCandidates(res.data);
    } catch {
      setError("Could not load your shortlisted candidates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeFromShortlist(candidateId) {
    await api.patch(`/candidates/${candidateId}/shortlist`, { shortlisted: false });
    load();
  }

  return (
    <div className="page">
      <h1>Shortlisted Candidates</h1>
      <p className="subtitle">Everyone you've shortlisted, across every job.</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && candidates.length === 0 && (
        <p>
          Nobody shortlisted yet — shortlist candidates from a job's results page and they'll show up here.
        </p>
      )}

      {candidates.length > 0 && (
        <table className="results-table">
          <thead>
            <tr>
              <th>Candidate File</th>
              <th>Job</th>
              <th>Score</th>
              <th>Resume</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c._id} className="shortlisted">
                <td>{c.filename}</td>
                <td>{c.jobTitle}</td>
                <td className="score">{c.score}</td>
                <td>
                  <a href={`http://localhost:5000/api/candidates/${c._id}/resume`} target="_blank" rel="noreferrer">
                    View
                  </a>
                </td>
                <td>
                  <button onClick={() => removeFromShortlist(c._id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
