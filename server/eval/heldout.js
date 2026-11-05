#!/usr/bin/env node
/**
 * What does the ML model add on top of the keyword engine?
 *
 * Scores three things on the held-out 20% split that ml/train.py never trained on (and that the
 * keyword lexicon was never tuned on, unlike dataset.json):
 *   - keyword engine alone
 *   - ToxiFilter ML alone (probability >= the threshold stored in ml/metrics.json)
 *   - keyword OR ML  (what the running pipeline does)
 *
 *   python ml/train.py            # writes ml/data/heldout_predictions.json + metrics.json
 *   npm run eval:heldout
 *
 * The ML predictions come from the 80%-split model (not the refit deployed one), so they are honest.
 */
const fs = require("fs");
const path = require("path");
const { analyzeKeywords } = require("../moderation/keywordEngine");

const ML_DIR = path.join(__dirname, "..", "..", "ml");
const predsPath = path.join(ML_DIR, "data", "heldout_predictions.json");
const metricsPath = path.join(ML_DIR, "metrics.json");

if (!fs.existsSync(predsPath) || !fs.existsSync(metricsPath)) {
  console.error("Missing ml/data/heldout_predictions.json or ml/metrics.json. Train first:  cd ml && python train.py");
  process.exit(1);
}

const rows = JSON.parse(fs.readFileSync(predsPath, "utf8"));
const meta = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const thr = meta.threshold ?? 0.5;

const metrics = (items, pred) => {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  items.forEach((r, i) => {
    const p = pred[i];
    if (p && r.toxic) tp++;
    else if (p && !r.toxic) fp++;
    else if (!p && !r.toxic) tn++;
    else fn++;
  });
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { n: items.length, precision, recall, f1, fp, fn, accuracy: (tp + tn) / items.length };
};

const kw = rows.map((r) => analyzeKeywords(r.text).isToxic);
const ml = rows.map((r) => r.p >= thr);
const both = rows.map((_, i) => kw[i] || ml[i]);

const LANGS = ["en", "hinglish", "kannada", "hi"];
const pct = (x) => `${(x * 100).toFixed(1)}%`.padStart(6);
const result = { threshold: thr, n: rows.length, overall: {}, per_language: {} };

const systems = [
  ["Keyword engine alone", kw],
  [`ToxiFilter ML alone (>= ${thr})`, ml],
  ["Keyword OR ML (the pipeline)", both],
];

console.log(`Held-out split: ${rows.length} comments (never trained on; the keyword lexicon was not tuned on them either)\n`);
console.log(`${"".padEnd(32)} ${"Prec".padStart(6)} ${"Recall".padStart(6)} ${"F1".padStart(6)} ${"False alarms".padStart(13)}`);
for (const [name, pred] of systems) {
  const m = metrics(rows, pred);
  result.overall[name] = m;
  console.log(`${name.padEnd(32)} ${pct(m.precision)} ${pct(m.recall)} ${pct(m.f1)} ${String(m.fp).padStart(13)}`);
}

console.log("\nF1 per language");
console.log(`${"".padEnd(32)} ${LANGS.map((l) => l.padStart(9)).join(" ")}`);
for (const [name, pred] of systems) {
  const cells = LANGS.map((l) => {
    const idx = rows.map((r, i) => (r.lang === l ? i : -1)).filter((i) => i >= 0);
    const m = metrics(idx.map((i) => rows[i]), idx.map((i) => pred[i]));
    (result.per_language[name] ||= {})[l] = { n: m.n, f1: m.f1, precision: m.precision, recall: m.recall };
    return pct(m.f1).padStart(9);
  });
  console.log(`${name.padEnd(32)} ${cells.join(" ")}`);
}
console.log(`${"n".padEnd(32)} ${LANGS.map((l) => String(rows.filter((r) => r.lang === l).length).padStart(9)).join(" ")}`);

fs.writeFileSync(path.join(ML_DIR, "pipeline_on_heldout.json"), JSON.stringify(result, null, 2));
console.log("\nSaved ml/pipeline_on_heldout.json");
