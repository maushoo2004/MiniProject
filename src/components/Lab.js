import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import ToxiDemo from "./ToxiDemo";
import ModelPerformance from "./ModelPerformance";
import "./Lab.css";

// Always-on engine first, then the optional pieces reported by /api/health.
// `env` is only shown to admins; everyone else just sees "optional, not enabled".
const PROVIDER_ROWS = [
  { key: "keyword", label: "Keyword engine", note: "multilingual, always on", always: true },
  { key: "custom", label: "ToxiFilter ML (our model)", note: "our own trained classifier", env: "ML_SERVICE_URL" },
  { key: "groq", label: "Groq LLM rewrites", note: "polite rewrites of flagged comments", env: "GROQ_API_KEY" },
];

const PIPELINE = [
  {
    title: "1. Normalise",
    text: "The text is lower-cased, repeated letters are collapsed (fuuuck → fuck) and look-alike symbols are mapped back (sh1t → shit, a$$hole → asshole). Hindi and Kannada are kept in their own scripts.",
  },
  {
    title: "2. Keyword engine (always runs)",
    text: "Whole-word, Unicode-aware matching against a weighted multilingual lexicon, so “Gandhi” and “skill” are safe. Insults get a boost when aimed at a person (“you are stupid” vs “this bug is stupid”). Scores combine per category with a noisy-OR.",
  },
  {
    title: "3. ToxiFilter ML (our own model)",
    text: "When its service is running, our own trained classifier (character and word n-grams with logistic regression) adds a statistical score that can catch abuse the word list doesn't know. The keyword engine never switches off, so Hindi, Hinglish and Kannada stay covered either way.",
  },
  {
    title: "4. Merge",
    text: "The stronger signal wins per category. A comment is toxic when a non-self-harm category reaches the 50% threshold. Threats are always high severity.",
  },
  {
    title: "5. Warn, rewrite, report",
    text: "Toxic comments are not saved straight away. The writer sees why, gets a polite rewrite (Groq LLM, re-checked by the engine), and can edit or post anyway, which hides the comment and files a report. Enough reports block the account.",
  },
];

const LANGUAGES = [
  {
    name: "English",
    script: "Latin script",
    flagged: ["you are an idiot"],
    clean: ["Great post, thanks!"],
  },
  {
    name: "Hindi",
    script: "देवनागरी (Devanagari)",
    flagged: ["तू चूतिया है", "तुम बेवकूफ हो"],
    clean: ["यह बहुत अच्छा लेख है"],
  },
  {
    name: "Hinglish",
    script: "Hindi written in Latin letters",
    flagged: ["tu bewakoof hai", "tu chutiya hai"],
    clean: ["Bahut badhiya post hai"],
  },
  {
    name: "Kannada",
    script: "ಕನ್ನಡ (Kannada)",
    flagged: ["ನೀನು ಸೂಳೆಮಗ"],
    clean: ["ಈ ಲೇಖನ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ"],
  },
];

const DISGUISED = ["f*ck this", "you are an a$$hole", "fuuuuck you", "sh1t take honestly"];

const Lab = () => {
  const { isAdmin } = useAuth();
  const [text, setText] = useState("");
  const [health, setHealth] = useState(null);
  const [healthError, setHealthError] = useState("");
  const demoRef = useRef(null);

  useEffect(() => {
    api("/api/health", { auth: false })
      .then(setHealth)
      .catch((err) => setHealthError(err.message));
  }, []);

  const tryExample = (example) => {
    setText(example);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    demoRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const providerState = (row) => {
    if (row.always) return "on";
    if (!health) return "unknown";
    return health.providers?.[row.key] ? "on" : "off";
  };

  // An unconfigured optional piece is not a failure: say so calmly, and only admins see env names
  const providerNote = (row, state) => {
    if (state === "unknown") return "Checking…";
    if (state === "on") return row.always ? row.note : `Active · ${row.note}`;
    return isAdmin ? `Optional, not enabled (set ${row.env})` : "Optional, not enabled";
  };

  return (
    <div className="lab">
      <header className="lab-head">
        <span className="hm-badge">🧪 ToxiFilter Lab</span>
        <h1>See exactly how a comment gets judged</h1>
        <p>
          Type anything below. The text goes to our server, runs through the same pipeline that protects every
          comment on BlogX, and you see every score, word and decision. Nothing here is saved.
        </p>
      </header>

      <section className="lab-providers glass" aria-label="Active providers">
        <h2>Active providers</h2>
        {healthError ? (
          <p className="lab-error">{healthError}</p>
        ) : (
          <ul>
            {PROVIDER_ROWS.map((row) => {
              const state = providerState(row);
              return (
                <li key={row.key} className={`lab-provider ${state}`}>
                  <span className="lab-dot" aria-hidden="true" />
                  <div>
                    <strong>{row.label}</strong>
                    <span>{providerNote(row, state)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {health && (
          <p className="lab-threshold">
            Accounts are blocked from commenting after <strong>{health.blockThreshold}</strong> reports.
          </p>
        )}
      </section>

      <div ref={demoRef} className="lab-demo">
        <ToxiDemo full value={text} onChange={setText} />
      </div>

      <ModelPerformance />

      <section className="lab-section">
        <h2>How the pipeline works</h2>
        <ol className="lab-pipeline">
          {PIPELINE.map((step) => (
            <li key={step.title} className="glass">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lab-section">
        <h2>Languages</h2>
        <p className="lab-sub">Click any example to load it into the checker above.</p>
        <div className="lab-langs">
          {LANGUAGES.map((lang) => (
            <article key={lang.name} className="lab-lang glass">
              <header>
                <h3>{lang.name}</h3>
                <span>{lang.script}</span>
              </header>
              <div className="lab-examples">
                {lang.flagged.map((ex) => (
                  <button key={ex} type="button" className="lab-example bad" onClick={() => tryExample(ex)}>
                    <i aria-hidden="true">⚠️</i> {ex}
                  </button>
                ))}
                {lang.clean.map((ex) => (
                  <button key={ex} type="button" className="lab-example good" onClick={() => tryExample(ex)}>
                    <i aria-hidden="true">✓</i> {ex}
                  </button>
                ))}
              </div>
            </article>
          ))}

          <article className="lab-lang glass">
            <header>
              <h3>Disguised spellings</h3>
              <span>Leetspeak, masking, stretched letters</span>
            </header>
            <div className="lab-examples">
              {DISGUISED.map((ex) => (
                <button key={ex} type="button" className="lab-example bad" onClick={() => tryExample(ex)}>
                  <i aria-hidden="true">⚠️</i> {ex}
                </button>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="lab-section lab-limits glass">
        <h2>Honest limits</h2>
        <p>
          Rule-based matching can't understand sarcasm or context, and it only knows the words in its lexicon, so
          some insults slip through. That's what our own trained ML model is for: it learns patterns from labelled
          examples instead of a fixed list. See the README for measured accuracy.
        </p>
        <Link to="/" className="btn btn-ghost btn-sm">
          ← Back to BlogX
        </Link>
      </section>
    </div>
  );
};

export default Lab;
