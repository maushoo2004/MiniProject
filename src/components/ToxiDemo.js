import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import {
  CATEGORY_INFO,
  formatScore,
  getCategoryColor,
  getCategoryDisplayName,
  getScoreColor,
  getScoreLevel,
  getSeverityColor,
  getSourceLabel,
} from "../utils/moderationLabels";
import "./ToxiDemo.css";

export const SAMPLES = [
  "Great post, thanks!",
  "you are an idiot",
  "tu bewakoof hai",
  "f*ck this",
  "Gandhi had great skill",
  "तू चूतिया है",
];

const DEBOUNCE_MS = 500;
const ARC_LENGTH = Math.PI * 50; // semicircle of radius 50

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Splits text into plain / highlighted parts using the words the server matched. */
function highlightParts(text, terms) {
  const list = (terms || []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length) return [{ text, hit: false }];
  const re = new RegExp(`(${list.map(escapeRegExp).join("|")})`, "gi");
  return text
    .split(re)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, hit: list.some((t) => t.toLowerCase() === part.toLowerCase()) }));
}

function Gauge({ score }) {
  const pct = Math.round(score * 100);
  const color = getScoreColor(score);
  return (
    <div className="toxi-gauge" role="img" aria-label={`Toxicity score ${pct} percent`}>
      <svg viewBox="0 0 120 70" aria-hidden="true">
        <path d="M 10 62 A 50 50 0 0 1 110 62" className="toxi-gauge-track" />
        <path
          d="M 10 62 A 50 50 0 0 1 110 62"
          className="toxi-gauge-fill"
          style={{
            stroke: color,
            strokeDasharray: ARC_LENGTH,
            strokeDashoffset: ARC_LENGTH * (1 - Math.min(1, Math.max(0, score))),
          }}
        />
      </svg>
      <div className="toxi-gauge-value" style={{ color }}>
        {pct}%
      </div>
    </div>
  );
}

/** One horizontal bar per category (Lab only). Highest first; zero scores are dimmed. */
function CategoryBars({ categoryScores }) {
  const rows = Object.keys(CATEGORY_INFO)
    .map((key) => ({ key, score: categoryScores?.[key] || 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="toxi-bars">
      <h4 className="toxi-block-title">Score per category</h4>
      {rows.map(({ key, score }) => (
        <div key={key} className={`toxi-bar-row${score === 0 ? " zero" : ""}`}>
          <span className="toxi-bar-name">{getCategoryDisplayName(key)}</span>
          <div
            className="toxi-bar-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(score * 100)}
            aria-label={`${getCategoryDisplayName(key)} score`}
          >
            <div
              className="toxi-bar-fill"
              style={{ width: `${Math.round(score * 100)}%`, background: getCategoryColor(key) }}
            />
          </div>
          <span className="toxi-bar-pct">{Math.round(score * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Live ToxiFilter demo. Every call goes to the server (POST /api/moderate);
 * nothing is moderated in the browser.
 *
 *   <ToxiDemo compact />                      small card (home page hero)
 *   <ToxiDemo full value={t} onChange={setT}/> big card with per-category bars + technical details (Lab)
 *
 * `value` / `onChange` are optional: pass them to control the text from outside.
 */
const ToxiDemo = ({ compact = false, value, onChange }) => {
  const [innerText, setInnerText] = useState("");
  const controlled = value !== undefined && onChange;
  const text = controlled ? value : innerText;
  const setText = controlled ? onChange : setInnerText;

  const [result, setResult] = useState(null); // moderation payload for `analysedText`
  const [analysedText, setAnalysedText] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const requestId = useRef(0);

  // Debounced moderation call. Stale responses are ignored via requestId.
  useEffect(() => {
    const trimmed = text.trim();
    setSuggestion(null);
    requestId.current += 1;
    const myId = requestId.current;

    if (!trimmed) {
      setResult(null);
      setChecking(false);
      setError("");
      return undefined;
    }

    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const data = await api("/api/moderate", { method: "POST", body: { text: trimmed }, auth: false });
        if (myId !== requestId.current) return;
        setResult(data.moderation);
        setAnalysedText(trimmed);
        setError("");
      } catch (err) {
        if (myId !== requestId.current) return;
        setError(err.message);
        setResult(null);
      } finally {
        if (myId === requestId.current) setChecking(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [text]);

  const getRewrite = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSuggesting(true);
    try {
      const data = await api("/api/moderate", {
        method: "POST",
        body: { text: trimmed, suggest: true },
        auth: false,
      });
      setSuggestion(data.suggestion || { text: "No rewrite needed — this looks fine." });
    } catch (err) {
      setError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const parts = useMemo(
    () => (result ? highlightParts(analysedText, result.matchedTerms) : []),
    [result, analysedText]
  );

  const score = result?.score || 0;
  const level = getScoreLevel(score);
  const verdict = !result
    ? ""
    : result.isToxic
    ? "Would be flagged — the writer gets a warning and a rewrite"
    : result.supportNeeded
    ? "Not flagged — a support message would be shown"
    : level === "mid"
    ? "Borderline — not flagged, but close"
    : "Looks respectful — would be posted";

  const inputId = `toxi-input-${compact ? "c" : "f"}`;

  /* ---- the building blocks of the result panel ---- */
  const top = result && (
    <div className="toxi-analysis-top">
      <Gauge score={score} />
      <div className="toxi-verdict-box">
        <p className="toxi-verdict" style={{ color: getScoreColor(score) }}>
          {verdict}
        </p>
        <div className="toxi-meta">
          <span>Score {formatScore(score)}</span>
          {result.severity && (
            <span className="toxi-severity" style={{ color: getSeverityColor(result.severity) }}>
              {result.severity} severity
            </span>
          )}
          {!compact &&
            (result.ml ? (
              <span className="toxi-ml-chip">
                🧠 ToxiFilter ML: <strong>{Math.round(result.ml.probability * 100)}% toxic</strong>
              </span>
            ) : (
              <span className="toxi-ml-chip off">🧠 ToxiFilter ML: not enabled</span>
            ))}
        </div>
        {result.categories.length > 0 && (
          <div className="toxi-pills">
            {result.categories.map((c) => (
              <span
                key={c}
                className="toxi-pill"
                style={{ borderColor: getCategoryColor(c), color: getCategoryColor(c) }}
              >
                {getCategoryDisplayName(c)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const marked = result && result.matchedTerms.length > 0 && (
    <div className="toxi-marked" aria-label="Text with problem words highlighted">
      {parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="toxi-mark">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </div>
  );

  const rewrite = result && result.isToxic && (
    <div className="toxi-rewrite">
      {!suggestion ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={getRewrite} disabled={suggesting}>
          {suggesting ? "Writing a rewrite…" : "✨ Get polite rewrite"}
        </button>
      ) : (
        <div className="toxi-suggestion">
          <span className="toxi-suggestion-label">
            ✨ Polite rewrite
            {!compact && suggestion.source && (
              <em> · {suggestion.source === "groq" ? "Groq LLM" : "offline fallback"}</em>
            )}
          </span>
          <p>{suggestion.text}</p>
        </div>
      )}
    </div>
  );

  const details = result && !compact && (
    <dl className="toxi-details">
      <div>
        <dt>Severity</dt>
        <dd className="cap" style={{ color: result.severity ? getSeverityColor(result.severity) : undefined }}>
          {result.severity || "none"}
        </dd>
      </div>
      <div>
        <dt>Toxicity score</dt>
        <dd>{formatScore(result.score)}</dd>
      </div>
      <div>
        <dt>Detected by</dt>
        <dd>{result.isToxic ? getSourceLabel(result.source) : "Nothing flagged"}</dd>
      </div>
      <div>
        <dt>Latency</dt>
        <dd>{result.latencyMs != null ? `${result.latencyMs} ms` : "—"}</dd>
      </div>
      <div className="wide">
        <dt>ToxiFilter ML (our model)</dt>
        <dd>
          {result.ml ? (
            <>
              <strong>{Math.round(result.ml.probability * 100)}% toxic</strong>
              <span className="toxi-ml-note">
                {result.ml.flagged
                  ? `at or above its ${Math.round(result.ml.threshold * 100)}% flag threshold, so ML flags it`
                  : `below its ${Math.round(result.ml.threshold * 100)}% flag threshold, so ML does not flag it`}
              </span>
            </>
          ) : (
            <span className="toxi-none">not enabled</span>
          )}
        </dd>
      </div>
      <div className="wide">
        <dt>Providers used</dt>
        <dd>
          {(result.providers || []).map((p) => (
            <span key={p} className="toxi-provider">
              {getSourceLabel(p)}
            </span>
          ))}
        </dd>
      </div>
      <div className="wide">
        <dt>Problem words</dt>
        <dd>
          {result.matchedTerms.length ? (
            result.matchedTerms.map((t) => (
              <span key={t} className="toxi-term">
                {t}
              </span>
            ))
          ) : (
            <span className="toxi-none">none</span>
          )}
        </dd>
      </div>
    </dl>
  );

  return (
    <div className={`toxi-demo glass ${compact ? "compact" : "full"}`}>
      <div className="toxi-demo-head">
        <span className="toxi-demo-title">Try ToxiFilter live</span>
        <span className="toxi-demo-note">Runs on our server, nothing is saved</span>
      </div>

      <label htmlFor={inputId} className="sr-only">
        Type a comment to check
      </label>
      <textarea
        id={inputId}
        className="toxi-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a comment in English, Hindi, Hinglish or Kannada…"
        rows={compact ? 3 : 4}
        maxLength={2000}
      />

      <div className="toxi-chips" aria-label="Sample comments">
        {SAMPLES.map((s) => (
          <button key={s} type="button" className="toxi-chip" onClick={() => setText(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="toxi-result" aria-live="polite">
        {!text.trim() && <p className="toxi-hint">Pick a sample above or type your own to see the analysis.</p>}

        {text.trim() && !result && !error && <p className="toxi-hint">{checking ? "Analysing…" : ""}</p>}

        {error && <p className="toxi-error">{error}</p>}

        {result && (
          <div className={`toxi-analysis${checking ? " stale" : ""}`}>
            {compact ? (
              <>
                {top}
                {marked}
                {rewrite}
              </>
            ) : (
              <div className="toxi-cols">
                <div className="toxi-col">
                  {top}
                  {marked}
                  {rewrite}
                </div>
                <div className="toxi-col">
                  <CategoryBars categoryScores={result.categoryScores} />
                  {details}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ToxiDemo;
