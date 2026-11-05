import React, { useCallback, useEffect, useRef, useState } from "react";
import "./Toast.css";

const ICONS = { success: "✓", error: "!", warning: "!", info: "i" };
const LEAVE_MS = 220;

/** Slides in at the bottom-right, shows a progress bar for its lifetime, slides out when closed. */
const Toast = ({ message, type = "info", onClose, duration = 4000 }) => {
  const [leaving, setLeaving] = useState(false);
  const leaveTimer = useRef(null);

  const close = useCallback(() => {
    setLeaving(true);
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(onClose, LEAVE_MS);
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(close, duration);
    return () => clearTimeout(timer);
  }, [close, duration]);

  // If a newer toast replaces this one, never let our pending "leave" close the new toast
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  return (
    <div
      className={`toast toast-${type}${leaving ? " leaving" : ""}`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span className="toast-icon" aria-hidden="true">
        {ICONS[type] || ICONS.info}
      </span>
      <span className="toast-message">{message}</span>
      <button type="button" className="toast-close" onClick={close} aria-label="Dismiss notification">
        ×
      </button>
      <span className="toast-progress" style={{ animationDuration: `${duration}ms` }} aria-hidden="true" />
    </div>
  );
};

export default Toast;
