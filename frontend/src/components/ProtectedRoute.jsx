import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { company, loading } = useAuth();

  if (loading) return <div className="page">Loading...</div>;
  if (!company) return <Navigate to="/login" replace />;

  return children;
}
