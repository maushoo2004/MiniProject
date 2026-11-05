import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import "./LiveMeter.css";

const DEBOUNCE_MS = 700;
const MIN_CHARS = 3;

/** Maps a server result to a label + colour level. */
function describe(result) {
  if (result.isToxic) return { level: "high", label: "Likely to be flagged" };
  if ((result.score || 0) >= 0.3) return { level: "mid", label: "Might come across as hurtful" };
  return { level: "low", label: "Looks respectful ✓" };
}

/**
 * Thin "as you type" indicator under the comment box.
 * Debounced, skips very short text, and calls the server (no rewrite requested).
 * Failures (rate limit, server down) just hide the meter; posting still works.
 */
const LiveMeter = ({ text, disabled = false }) => {
  const [result, setResult] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    const value = text.trim();
    requestId.current += 1;
    const myId = requestId.current;

    if (disabled || value.length < MIN_CHARS) {
      setResult(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await api("/api/moderate", { method: "POST", body: { text: value }, auth: false });
        if (myId === requestId.current) setResult(data.moderation);
      } catch (err) {
        if (myId === requestId.current) setResult(null);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text, disabled]);

  if (!result) return null;

  const { level, label } = describe(result);
  const pct = Math.max(4, Math.round((result.score || 0) * 100));

  return (
    <div className={`live-meter ${level}`} role="status" aria-live="polite">
      <div className="live-meter-track">
        <div className="live-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="live-meter-label">{label}</span>
    </div>
  );
};

export default LiveMeter;
