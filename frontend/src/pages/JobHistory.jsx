import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

const STATUS_LABELS = {
  created: "Created",
  queued: "Queued",
  processing: "Scoring…",
  completed: "Completed",
  failed: "Failed",
};

export default function JobHistory() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/jobs")
      .then((res) => setJobs(res.data))
      .catch(() => setError("Could not load your job history."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1>Job History</h1>
      <p className="subtitle">Every job you've posted, most recent first.</p>

      {loading && <p>Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && jobs.length === 0 && (
        <div className="history-empty">
          <p>You haven't posted a job yet.</p>
          <Link to="/create-job" className="btn btn-primary">
            Post your first job
          </Link>
        </div>
      )}

      {jobs.length > 0 && (
        <ul className="history-list">
          {jobs.map((job) => (
            <li key={job._id} className="history-row">
              <div className="history-row-main">
                <strong>{job.title}</strong>
                <span className={`status-pill status-pill-${job.status}`}>
                  {STATUS_LABELS[job.status] || job.status}
                </span>
                {job.shortlistedCount > 0 && (
                  <Link to={`/jobs/${job._id}/results`} className="shortlist-badge">
                    ⭐ {job.shortlistedCount} shortlisted
                  </Link>
                )}
              </div>
              <div className="history-row-meta">
                <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                <Link to={`/jobs/${job._id}/results`}>View results →</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
