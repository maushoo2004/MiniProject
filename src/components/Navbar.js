import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Logo from "../assets/logo-trimmed.png";
import "./Navbar.css";

const Navbar = ({ onAuthClick, onSignOut }) => {
  const { user, profile, isAdmin, isBlocked, userReportCount, blockThreshold } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false); // dropdown under the avatar
  const [mobileOpen, setMobileOpen] = useState(false); // hamburger panel
  const menuRef = useRef(null);

  const displayName = profile?.name || user?.email?.split("@")[0] || "User";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  const closeAll = useCallback(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, []);

  // Close menus when the page changes
  useEffect(() => {
    closeAll();
  }, [location.pathname, closeAll]);

  // Close the avatar dropdown on outside click, and everything on Esc
  useEffect(() => {
    if (!menuOpen && !mobileOpen) return undefined;

    const onPointerDown = (e) => {
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, mobileOpen, closeAll]);

  const goTo = (path) => {
    closeAll();
    navigate(path);
  };

  // "Write" needs an account: logged-out visitors get the sign-in modal instead
  const handleWrite = (e) => {
    if (!user) {
      e.preventDefault();
      closeAll();
      onAuthClick();
    }
  };

  const linkClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  const reportLabel = isBlocked ? "Blocked" : `${userReportCount}/${blockThreshold} reports`;

  return (
    <nav className="navbar" aria-label="Main">
      <div className="navbar-inner">
        <Link to="/" className="nav-logo" aria-label="BlogX home">
          <img src={Logo} alt="BlogX" />
        </Link>

        <div className={`nav-links${mobileOpen ? " open" : ""}`} id="nav-links">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/lab" className={linkClass}>
            ToxiFilter Lab
          </NavLink>
          <NavLink to="/create" className={linkClass} onClick={handleWrite}>
            Write
          </NavLink>

          {/* On small screens the "Log in" button lives inside the hamburger panel */}
          {!user && (
            <button
              type="button"
              className="btn btn-ghost btn-sm nav-login-mobile"
              onClick={() => {
                closeAll();
                onAuthClick();
              }}
            >
              Log in
            </button>
          )}
        </div>

        <div className="nav-actions">
          {user ? (
            <div className="nav-user" ref={menuRef}>
              <button
                type="button"
                className="nav-avatar"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Account menu for ${displayName}`}
              >
                {initial}
              </button>

              {menuOpen && (
                <div className="nav-dropdown glass" role="menu">
                  <div className="nav-dropdown-head">
                    <div className="nav-avatar nav-avatar-lg" aria-hidden="true">
                      {initial}
                    </div>
                    <div className="nav-dropdown-id">
                      <strong>{displayName}</strong>
                      <span title={user.email}>{user.email}</span>
                    </div>
                  </div>

                  <div className={`nav-status${isBlocked ? " blocked" : ""}`}>
                    <span className="nav-status-dot" aria-hidden="true" />
                    {reportLabel}
                  </div>

                  <button type="button" role="menuitem" className="nav-item" onClick={() => goTo("/analytics")}>
                    📊 My Analytics
                  </button>
                  {isAdmin && (
                    <button type="button" role="menuitem" className="nav-item" onClick={() => goTo("/admin")}>
                      🛡️ Admin
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    className="nav-item nav-item-danger"
                    onClick={() => {
                      closeAll();
                      onSignOut();
                    }}
                  >
                    ↩ Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button type="button" className="btn btn-ghost btn-sm nav-login" onClick={onAuthClick}>
                Log in
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={onAuthClick}>
                Get started
              </button>
            </>
          )}

          <button
            type="button"
            className="nav-burger"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="nav-links"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
