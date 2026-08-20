import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

// Account-menu items — each maps to a route that already exists (or is
// added alongside this component). Centralized here so the dropdown is
// just a map over data, not a wall of near-identical JSX.
const ACCOUNT_LINKS = [
  { to: "/profile", label: "My Profile", icon: "👤" },
  { to: "/create-job", label: "Post a New Job", icon: "📋" },
  { to: "/jobs", label: "Job History", icon: "🕘" },
  { to: "/shortlisted", label: "Shortlisted Candidates", icon: "⭐" },
];

function initialsFor(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + second).toUpperCase();
}

export default function Navbar() {
  const { company, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click and on Escape — standard dropdown behavior.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Also close whenever the route changes, so navigating via a menu item
  // (or anywhere else) doesn't leave it hanging open.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/");
  }

  const linkClass = ({ isActive }) => "nav-link" + (isActive ? " nav-link-active" : "");

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="logo-mark" aria-hidden="true">
            <span className="logo-star logo-pulse logo-pulse-coral" />
            <span className="logo-star logo-pulse logo-pulse-mint" />
            <span className="logo-star logo-core" />
          </span>
          <span className="navbar-brand-text">
            <span className="navbar-brand-gradient">Aura</span>
            <span className="navbar-brand-accent">Hire</span>
          </span>
        </Link>

        <nav className="navbar-links">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>

          {company ? (
            <div className="account-menu" ref={menuRef}>
              <button
                type="button"
                className="account-trigger"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <span className="account-avatar">{initialsFor(company.name)}</span>
                <span className="account-trigger-name">{company.name}</span>
                <span className={"account-trigger-caret" + (menuOpen ? " account-trigger-caret-open" : "")} aria-hidden="true">
                  ▾
                </span>
              </button>

              {menuOpen && (
                <div className="account-dropdown" role="menu">
                  <div className="account-dropdown-head">
                    <span className="account-avatar account-avatar-lg" aria-hidden="true">
                      {initialsFor(company.name)}
                    </span>
                    <div className="account-dropdown-identity">
                      <strong>{company.name}</strong>
                      <span className="account-dropdown-email">{company.email}</span>
                    </div>
                    {company.isVerified ? (
                      <span className="verify-badge verify-badge-verified">Verified</span>
                    ) : (
                      <span className="verify-badge verify-badge-unverified">Not verified</span>
                    )}
                  </div>

                  <div className="account-dropdown-links">
                    {ACCOUNT_LINKS.map((item) => (
                      <Link key={item.to} to={item.to} className="account-dropdown-item" role="menuitem">
                        <span aria-hidden="true">{item.icon}</span>
                        {item.label}
                      </Link>
                    ))}
                  </div>

                  <button type="button" className="account-dropdown-item account-dropdown-logout" onClick={handleLogout} role="menuitem">
                    <span aria-hidden="true">🚪</span>
                    Log Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <NavLink to="/login" className={linkClass}>
                Sign In
              </NavLink>
              <Link to="/register" className="nav-cta">
                Get Started
              </Link>
            </>
          )}

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </nav>
      </div>
    </header>
  );
}
