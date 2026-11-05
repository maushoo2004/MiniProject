/**
 * ToxiFilter moderation pipeline.
 *
 * 1. The multilingual keyword engine ALWAYS runs (fast, offline, catches Hinglish /
 *    Devanagari / Kannada abuse that English-only models would miss).
 * 2. Our own trained ML model ("custom" provider, when ML_SERVICE_URL is set) adds a
 *    statistical score that can catch abuse the word list doesn't know.
 * 3. Results are merged: the stronger signal wins, categories are combined.
 */

const { analyzeKeywords, TOXIC_THRESHOLD, CATEGORIES } = require("./keywordEngine");
const { PROVIDERS, severityFromScore } = require("./providers");
const config = require("../config");

function mergeResults(keyword, ai) {
  if (!ai) return { ...keyword, providers: ["keyword"], ml: null };

  const categoryScores = { ...keyword.categoryScores };
  for (const [cat, s] of Object.entries(ai.categoryScores || {})) {
    categoryScores[cat] = Math.max(categoryScores[cat] || 0, s);
  }
  const categories = [...new Set([...keyword.categories, ...ai.categories])];
  const toxicCats = categories.filter((c) => c !== CATEGORIES.SELF_HARM);
  const score = Math.max(keyword.score, ai.score);
  const isToxic = toxicCats.length > 0 && score >= TOXIC_THRESHOLD;

  let severity = null;
  if (isToxic) {
    severity = severityFromScore(score);
    if (toxicCats.includes(CATEGORIES.THREAT)) severity = "high";
  }

  return {
    isToxic,
    score: Math.round(score * 1000) / 1000,
    severity,
    categories,
    categoryScores,
    matches: keyword.matches,
    targeted: keyword.targeted,
    supportNeeded: Boolean(keyword.supportNeeded || ai.supportNeeded),
    // the source that produced the deciding score
    source: ai.score >= keyword.score ? ai.source : "keyword",
    providers: [ai.source, "keyword"],
    ml: ai.ml || null,
  };
}

async function moderate(text) {
  const started = Date.now();
  const keyword = analyzeKeywords(text);
  let ai = null;
  const errors = [];

  for (const name of config.providerOrder) {
    const provider = PROVIDERS[name];
    if (!provider || !provider.enabled()) continue;
    try {
      ai = await provider.run(text);
      break;
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      console.warn(`[moderation] ${name} failed → trying next.`, err.message);
    }
  }

  const result = mergeResults(keyword, ai);
  result.latencyMs = Date.now() - started;
  if (errors.length) result.providerErrors = errors;
  return result;
}

/** Shape safe to send to the browser (drops internal fields). */
function publicResult(r) {
  return {
    isToxic: r.isToxic,
    score: r.score,
    severity: r.severity,
    categories: r.categories,
    categoryScores: r.categoryScores,
    matchedTerms: [...new Set((r.matches || []).map((m) => m.text))],
    supportNeeded: r.supportNeeded,
    source: r.source,
    providers: r.providers,
    latencyMs: r.latencyMs,
    // what our own ML model said (null when the ML service is off or didn't answer)
    ml: r.ml || null,
  };
}

module.exports = { moderate, mergeResults, publicResult };
