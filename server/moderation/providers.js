/**
 * ML moderation providers that run next to the always-on keyword engine.
 *
 * A provider is { enabled(): boolean, run(text): Promise<result> }, where the result is
 * { isToxic, score, severity, categories, categoryScores, source, supportNeeded? }.
 * moderation/index.js tries the names in config.providerOrder and uses the first one that
 * is enabled and answers. A provider that throws is skipped (the keyword engine still decides).
 */

const { CATEGORIES } = require("./lexicon");
const config = require("../config");

const ML_THRESHOLD = 0.5;

function severityFromScore(score) {
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

/* ----------------- "custom": our own trained model (ml/serve.py) ----------------- */

/**
 * POST {ML_SERVICE_URL}/predict { text } -> { toxic_probability, label, threshold }
 * The model only says "toxic or not", so a positive result is filed under the generic
 * "harassment" category; the keyword engine supplies the specific categories.
 * `label` uses the decision threshold chosen when the model was trained (ml/metrics.json).
 * Times out after config.mlTimeoutMs (~1.5 s): the caller then carries on with the keyword engine alone.
 */
async function moderateWithCustomModel(text) {
  const res = await fetch(`${config.mlServiceUrl}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(config.mlTimeoutMs),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ML service ${res.status}: ${detail.slice(0, 120)}`);
  }

  const { toxic_probability: p, label, threshold } = await res.json();
  if (typeof p !== "number" || Number.isNaN(p)) throw new Error("ML service returned no toxic_probability");

  const score = Math.min(1, Math.max(0, p));
  // trust the service's own decision; fall back to 0.5 only if an older service sends no label
  const isToxic = typeof label === "number" ? label === 1 : score >= ML_THRESHOLD;
  return {
    isToxic,
    score,
    severity: isToxic ? severityFromScore(score) : null,
    categories: isToxic ? [CATEGORIES.HARASSMENT] : [],
    categoryScores: { [CATEGORIES.HARASSMENT]: score },
    source: "custom",
    // shown in the Lab: "ToxiFilter ML: 72% toxic"
    ml: { probability: score, flagged: isToxic, threshold: typeof threshold === "number" ? threshold : ML_THRESHOLD },
  };
}

const PROVIDERS = {
  custom: { enabled: () => Boolean(config.mlServiceUrl), run: moderateWithCustomModel },
};

module.exports = { PROVIDERS, moderateWithCustomModel, severityFromScore, ML_THRESHOLD };
