import React, { useEffect, useState } from "react";
import { api, apiUrl } from "../lib/api";
import { Skeleton } from "./Skeleton";
import "./ModelPerformance.css";

const LANG_ORDER = ["en", "hinglish", "kannada", "hi"];
const LANG_NAMES = { en: "English", hinglish: "Hinglish", kannada: "Kannada", hi: "Hindi" };

const f3 = (x) => (x == null ? "—" : Number(x).toFixed(3));
const f2 = (x) => (x == null ? "—" : Number(x).toFixed(2));
const pct = (x) => (x == null ? "—" : `${(Number(x) * 100).toFixed(1)}%`);
const orderLangs = (obj) => [
  ...LANG_ORDER.filter((l) => obj && l in obj),
  ...Object.keys(obj || {}).filter((l) => !LANG_ORDER.includes(l)),
];

/**
 * "Model performance" section of the ToxiFilter Lab. Every number comes from the server
 * (GET /api/ml/performance, which reads ml/metrics.json and ml/pipeline_on_heldout.json
 * written by the training run): nothing here is hard-coded.
 */
const ModelPerformance = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/ml/performance", { auth: false })
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  let body;
  if (error) {
    body = <p className="mp-note">Couldn't load the model's results: {error}</p>;
  } else if (!data) {
    body = (
      <div className="mp-skeleton" role="status" aria-busy="true">
        <span className="sr-only">Loading model performance…</span>
        <div className="mp-kpis">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} h="76px" r="12px" />
          ))}
        </div>
        <Skeleton h="220px" r="12px" />
      </div>
    );
  } else if (!data.available) {
    body = (
      <p className="mp-note">
        No results yet. They appear here after the ML model has been trained (<code>python ml/train.py</code>, see
        ml/README.md).
      </p>
    );
  } else {
    const { test, perLanguageTest, crossValidation, independentSet, pipelineOnHeldout, byLanguage } = data;
    const langs = orderLangs(perLanguageTest);
    const indepLang = independentSet?.perLanguage;
    const pipelineNames = pipelineOnHeldout ? Object.keys(pipelineOnHeldout.overall) : [];
    const bestF1 = pipelineNames.length ? Math.max(...pipelineNames.map((n) => pipelineOnHeldout.overall[n].f1)) : 0;
    const smallest = langs
      .map((l) => ({ l, n: perLanguageTest[l].n }))
      .sort((a, b) => a.n - b.n)
      .slice(0, 2);

    body = (
      <>
        <div className="mp-kpis">
          <div className="mp-kpi mp-kpi-main">
            <span className="mp-kpi-value">{f3(test.f1)}</span>
            <span className="mp-kpi-label">Held-out F1</span>
          </div>
          <div className="mp-kpi">
            <span className="mp-kpi-value">{f3(test.precision)}</span>
            <span className="mp-kpi-label">Precision</span>
          </div>
          <div className="mp-kpi">
            <span className="mp-kpi-value">{f3(test.recall)}</span>
            <span className="mp-kpi-label">Recall</span>
          </div>
          {crossValidation && (
            <div className="mp-kpi">
              <span className="mp-kpi-value">
                {f3(crossValidation.f1_mean)} <small>± {f3(crossValidation.f1_std)}</small>
              </span>
              <span className="mp-kpi-label">{crossValidation.folds}-fold CV F1</span>
            </div>
          )}
          {independentSet && (
            <div className="mp-kpi">
              <span className="mp-kpi-value">{f3(independentSet.f1)}</span>
              <span className="mp-kpi-label">
                Independent set F1 ({independentSet.falseAlarms}/{independentSet.cleanRows} false alarms)
              </span>
            </div>
          )}
        </div>

        <div className="mp-grid">
          <div className="mp-card">
            <h3>F1 per language</h3>
            <div
              className="mp-chart"
              role="img"
              aria-label={`F1 per language: ${langs.map((l) => `${LANG_NAMES[l] || l} ${f2(perLanguageTest[l].f1)}`).join(", ")}`}
            >
              {langs.map((l) => (
                <div className="mp-group" key={l}>
                  <div className="mp-bars">
                    <div className="mp-bar-wrap">
                      <span className="mp-val">{f2(perLanguageTest[l].f1)}</span>
                      <div className="mp-bar held" style={{ height: `${perLanguageTest[l].f1 * 100}%` }} />
                    </div>
                    {indepLang && (
                      <div className="mp-bar-wrap">
                        <span className="mp-val">{indepLang[l] ? f2(indepLang[l].f1) : "–"}</span>
                        <div className="mp-bar indep" style={{ height: `${(indepLang[l]?.f1 || 0) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="mp-label">{LANG_NAMES[l] || l}</div>
                  <div className="mp-n">
                    n={perLanguageTest[l].n}
                    {indepLang ? ` · ${indepLang[l]?.n ?? 0}` : ""}
                  </div>
                </div>
              ))}
            </div>
            <div className="mp-legend">
              <span>
                <i className="held" /> held-out test split ({data.nTest.toLocaleString()} comments)
              </span>
              {indepLang && (
                <span>
                  <i className="indep" /> independent set ({independentSet.n} comments)
                </span>
              )}
            </div>
            {indepLang && (
              <p className="mp-footnote">
                The independent set is tiny, so its bars are noisy: the second number under each language is how many
                comments they rest on.
              </p>
            )}
          </div>

          {pipelineOnHeldout && (
            <div className="mp-card">
              <h3>Keyword engine vs ML vs both</h3>
              <p className="mp-sub">On the {pipelineOnHeldout.n.toLocaleString()} held-out comments that neither was tuned on.</p>
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th />
                      <th>Precision</th>
                      <th>Recall</th>
                      <th>F1</th>
                      <th>False alarms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineNames.map((name) => {
                      const m = pipelineOnHeldout.overall[name];
                      return (
                        <tr key={name} className={m.f1 === bestF1 ? "best" : ""}>
                          <th scope="row">{name}</th>
                          <td>{pct(m.precision)}</td>
                          <td>{pct(m.recall)}</td>
                          <td>
                            <strong>{pct(m.f1)}</strong>
                          </td>
                          <td>{m.fp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mp-scroll-hint">Swipe a table sideways to see every column.</p>

              <h4>F1 per language</h4>
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th />
                      {langs.map((l) => (
                        <th key={l}>{LANG_NAMES[l] || l}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pipelineNames.map((name) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        {langs.map((l) => (
                          <td key={l}>{pct(pipelineOnHeldout.perLanguage?.[name]?.[l]?.f1)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <p className="mp-footnote">
          Trained {new Date(data.trainedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })} on{" "}
          {data.nSamples.toLocaleString()} public comments (
          {orderLangs(byLanguage)
            .map((l) => `${LANG_NAMES[l] || l} ${byLanguage[l].rows.toLocaleString()}`)
            .join(", ")}
          ). Decision threshold {data.threshold}. {LANG_NAMES[smallest[0].l]} and {LANG_NAMES[smallest[1].l]} have the
          fewest test comments (n={smallest[0].n} and n={smallest[1].n}), so differences of a few points there are not
          significant.
          {data.tinyDatasetWarning && " ⚠️ This model was trained on a tiny dataset: do not trust these numbers."}
        </p>
      </>
    );
  }

  return (
    <section className="mp glass" aria-labelledby="mp-title">
      <header className="mp-head">
        <div>
          <h2 id="mp-title">Model performance</h2>
          <p>Measured on comments the model never trained on. These numbers come straight from the last training run.</p>
        </div>
        <a className="btn btn-ghost btn-sm" href={apiUrl("/api/docs/evaluation")} target="_blank" rel="noopener noreferrer">
          Read the full evaluation ↗
        </a>
      </header>
      {body}
    </section>
  );
};

export default ModelPerformance;
