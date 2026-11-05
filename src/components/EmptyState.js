import React from "react";
import "./EmptyState.css";

/**
 * Friendly "nothing here" panel: an icon, a title, one line of help and (optionally) a call to action.
 *   <EmptyState icon="📝" title="No posts yet" action={<Link className="btn btn-primary btn-sm" to="/create">Write one</Link>}>
 *     Be the first to share something.
 *   </EmptyState>
 */
const EmptyState = ({ icon = "📭", title, children, action, compact = false }) => (
  <div className={`es${compact ? " es-compact" : ""}`} role="status">
    <div className="es-icon" aria-hidden="true">
      {icon}
    </div>
    <h3 className="es-title">{title}</h3>
    {children && <p className="es-text">{children}</p>}
    {action && <div className="es-action">{action}</div>}
  </div>
);

export default EmptyState;
