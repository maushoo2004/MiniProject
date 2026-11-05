import React from "react";

// Shown instead of a blank crash when .env hasn't been filled in yet.
const SetupNotice = () => (
  <div className="setup-notice">
    <div className="setup-card">
      <h1>🛡️ BlogX × ToxiFilter</h1>
      <h2>Almost there — the app isn't connected to Supabase yet.</h2>
      <ol>
        <li>
          Copy <code>.env.example</code> to <code>.env</code> in the project root.
        </li>
        <li>
          Fill in <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_ANON_KEY</code>{" "}
          (Supabase → Project Settings → API).
        </li>
        <li>
          Also add <code>SUPABASE_SERVICE_ROLE_KEY</code> for the backend server.
        </li>
        <li>
          Run <code>supabase/schema.sql</code> in the Supabase SQL editor.
        </li>
        <li>
          Restart with <code>npm run dev</code>.
        </li>
      </ol>
      <p>
        Full guide: <code>docs/SETUP.md</code>
      </p>
    </div>
  </div>
);

export default SetupNotice;
