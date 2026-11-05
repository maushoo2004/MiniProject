import React from "react";
import { Link } from "react-router-dom";
import Logo from "../assets/logo-trimmed.png";
import "./Footer.css";

const Footer = () => (
  <footer className="site-footer">
    <div className="footer-inner">
      <div className="footer-brand">
        <Link to="/" className="footer-logo" aria-label="BlogX home">
          <img src={Logo} alt="BlogX" />
        </Link>
        <p className="footer-tagline">Write freely. Discuss safely.</p>
        <span className="footer-shield">🛡️ Protected by ToxiFilter</span>
      </div>

      <nav className="footer-links" aria-label="Footer">
        <Link to="/">Home</Link>
        <Link to="/lab">ToxiFilter Lab</Link>
        <Link to="/create">Write</Link>
        <Link to="/analytics">My Analytics</Link>
      </nav>
    </div>

    <div className="footer-bottom">
      <span>© {new Date().getFullYear()} BlogX × ToxiFilter</span>
      <span>
        Made with <span aria-label="love">❤️</span> by <strong>Innovative D</strong>
      </span>
    </div>
  </footer>
);

export default Footer;
