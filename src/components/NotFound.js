import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./NotFound.css";

const NotFound = () => {
  const { pathname } = useLocation();
  return (
    <div className="nf">
      <div className="nf-code" aria-hidden="true">
        404
      </div>
      <h1>This page wandered off</h1>
      <p>
        We couldn't find <code>{pathname}</code>. It may have been moved, deleted, or never existed.
      </p>
      <div className="nf-actions">
        <Link to="/" className="btn btn-primary">
          ← Back to Home
        </Link>
        <Link to="/lab" className="btn btn-ghost">
          Try the ToxiFilter Lab
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
