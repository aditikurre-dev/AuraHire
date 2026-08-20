import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/api";

const TOKEN_KEY = "aurahire_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check for an existing session

  // On first load, if a token is stored, verify it against the backend and
  // restore the session instead of forcing a fresh login every refresh.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/companies/me")
      .then((res) => setCompany(res.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // Cross-tab: if verification completes in another tab (the person clicked
  // the emailed link, which usually opens in a new tab), that tab broadcasts
  // via localStorage (see Register.jsx). Pick that up here — app-wide,
  // not just on the Register page — so any open tab for this account
  // flips to verified immediately instead of needing a manual refresh.
  useEffect(() => {
    function handleStorage(e) {
      if (e.key !== "aurahire_verify_broadcast" || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue);
        setCompany((current) =>
          current && data.email && current.email === data.email
            ? { ...current, isVerified: true }
            : current
        );
      } catch {
        // Malformed broadcast payload — ignore it.
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Registering creates the account on the backend (and the backend does
  // return a token for it), but we deliberately do NOT log the person in
  // here — they land on the "Registration successful" screen instead and
  // have to go log in themselves, same as any real signup flow. That also
  // keeps the navbar showing "Sign In / Get Started" instead of "Profile /
  // Log Out" while they haven't actually logged in yet.
  async function register({ name, email, password }) {
    const res = await api.post("/companies/register", { name, email, password });
    return res.data; // { message, email, token, company } — token/company intentionally unused here
  }

  async function verifyEmail(token) {
    // Confirms the link is valid and moves the account from pending into
    // the verified Company collection.
    const res = await api.get("/companies/verify-email", { params: { token } });
    // If the person verifying is the same one currently logged in in this
    // tab, flip their session over to verified right away — no need to log
    // in again, since the token keeps working across the move.
    setCompany((current) =>
      current && current.email === res.data.email ? { ...current, isVerified: true } : current
    );
    return res.data; // { verified, email }
  }

  async function resendVerification(email) {
    const res = await api.post("/companies/resend-verification", { email });
    return res.data; // { message }
  }

  async function login({ email, password }) {
    const res = await api.post("/companies/login", { email, password });
    localStorage.setItem(TOKEN_KEY, res.data.token);
    setCompany(res.data.company);
  }

  // Re-fetches the current session from the backend — useful after an
  // action elsewhere (e.g. verifying in another tab) that could have
  // changed isVerified without this tab knowing yet.
  async function refreshCompany() {
    try {
      const res = await api.get("/companies/me");
      setCompany(res.data);
      return res.data;
    } catch {
      return null;
    }
  }

  // avatarType: "initial" | "preset" | "upload". avatarValue is a preset id
  // for "preset", a data URL for "upload", or omitted for "initial".
  async function updateAvatar({ avatarType, avatarValue }) {
    const res = await api.patch("/companies/me/avatar", { avatarType, avatarValue });
    setCompany(res.data);
    return res.data;
  }

  // Updates the company's extended profile — name, industry, size, website,
  // contact person, etc. Email is never sent here — the backend ignores it
  // on this endpoint even if included (see companyController.updateProfile
  // for why: it's the login identifier and has its own uniqueness/
  // verification concerns, unlike everything else in this form).
  async function updateProfile(fields) {
    const res = await api.patch("/companies/me/profile", fields);
    setCompany(res.data);
    return res.data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setCompany(null);
  }

  return (
    <AuthContext.Provider
      value={{
        company,
        loading,
        register,
        login,
        logout,
        verifyEmail,
        resendVerification,
        refreshCompany,
        updateAvatar,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
