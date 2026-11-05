#!/usr/bin/env node
/**
 * Evaluates the moderation engines on a labelled dataset and prints
 * accuracy / precision / recall / F1, per language, plus every mistake.
 *
 *   npm run eval            → baseline (v1) vs new keyword engine
 *   npm run eval -- --full  → also the full pipeline (uses our ML model if ML_SERVICE_URL is set in .env)
 *   npm run eval -- --file my_data.json
 */
const fs = require("fs");
const path = require("path");
const { analyzeKeywords } = require("../moderation/keywordEngine");
const { enhancedKeywordModeration: baseline } = require("./baseline");

const args = process.argv.slice(2);
const fileArg = args.includes("--file") ? args[args.indexOf("--file") + 1] : null;
const dataset = JSON.parse(fs.readFileSync(fileArg || path.join(__dirname, "dataset.json"), "utf8"));

function metrics(rows) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of rows) {
    if (r.pred && r.toxic) tp++;
    else if (r.pred && !r.toxic) fp++;
    else if (!r.pred && !r.toxic) tn++;
    else fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { n: rows.length, accuracy: (tp + tn) / rows.length, precision, recall, f1, tp, fp, tn, fn };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`.padStart(7);

function report(name, rows) {
  const m = metrics(rows);
  console.log(`\n━━ ${name} ━━`);
  console.log(
    `Accuracy ${pct(m.accuracy)} | Precision ${pct(m.precision)} | Recall ${pct(m.recall)} | F1 ${pct(m.f1)}   (TP ${m.tp}  FP ${m.fp}  TN ${m.tn}  FN ${m.fn})`
  );
  const langs = [...new Set(rows.map((r) => r.lang))];
  for (const lang of langs) {
    const lm = metrics(rows.filter((r) => r.lang === lang));
    console.log(`   ${lang.padEnd(9)} n=${String(lm.n).padStart(3)}  acc ${pct(lm.accuracy)}  F1 ${pct(lm.f1)}`);
  }
  const mistakes = rows.filter((r) => r.pred !== Boolean(r.toxic));
  if (mistakes.length) {
    console.log("   Mistakes:");
    for (const r of mistakes) console.log(`     ${r.toxic ? "MISSED   " : "FALSE ALARM"}  ${r.text}`);
  }
  return m;
}

/** Side-by-side table of every engine that was evaluated. */
function printSummary(rows) {
  console.log("\n━━ Comparison ━━");
  console.log(`${"Engine".padEnd(32)} ${"Acc".padStart(7)} ${"Prec".padStart(7)} ${"Recall".padStart(7)} ${"F1".padStart(7)}  False alarms`);
  for (const { name, m, note } of rows) {
    console.log(
      `${name.padEnd(32)} ${pct(m.accuracy)} ${pct(m.precision)} ${pct(m.recall)} ${pct(m.f1)}  ${String(m.fp).padStart(6)}${note ? "  *" : ""}`
    );
  }
  if (rows.some((r) => r.note)) {
    console.log("* the ML model was trained on this same file, so its score here is optimistic (see the held-out numbers above)");
  } else if (rows.some((r) => r.name.startsWith("ToxiFilter ML"))) {
    console.log("(the ML model never saw this file: these ML numbers are an independent test)");
  }
}

/** What ml/train.py recorded about the deployed model (null if there is no metrics.json yet). */
function mlMeta() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "ml", "metrics.json"), "utf8"));
  } catch {
    return null;
  }
}

/** True when the model was trained on the very file being evaluated, which makes its score here meaningless. */
function mlSawThisFile() {
  const meta = mlMeta();
  const name = path.basename(fileArg || path.join(__dirname, "dataset.json"));
  return Boolean(meta && (meta.data_files || []).includes(name));
}

/** The honest ML number: scored on a split the model never saw (written by ml/train.py). */
function mlHoldout() {
  const t = mlMeta();
  if (!t) return;
  console.log(
    `   Held-out score from training (${t.n_test} comments the model never saw): ` +
      `F1 ${pct(t.test.f1)}, precision ${pct(t.test.precision)}, recall ${pct(t.test.recall)}` +
      (t.threshold != null ? `   [decision threshold ${t.threshold}]` : "") +
      (t.tiny_dataset_warning ? `   ⚠️ tiny dataset (${t.n_samples} rows)` : "")
  );
}

async function main() {
  console.log(`Dataset: ${dataset.length} comments (${dataset.filter((d) => d.toxic).length} toxic)`);

  const timed = (fn) => {
    const t = process.hrtime.bigint();
    const rows = dataset.map((d) => ({ ...d, pred: Boolean(fn(d.text).isToxic) }));
    const ms = Number(process.hrtime.bigint() - t) / 1e6 / dataset.length;
    return { rows, ms };
  };

  const summary = []; // { name, m } rows for the comparison table at the end

  const base = timed(baseline);
  const mb = report("v1 baseline (original substring matcher)", base.rows);
  console.log(`   avg time per comment: ${base.ms.toFixed(3)} ms`);
  summary.push({ name: "v1 substring matcher", m: mb });

  const kw = timed(analyzeKeywords);
  const mk = report("v2 ToxiFilter keyword engine", kw.rows);
  console.log(`   avg time per comment: ${kw.ms.toFixed(3)} ms`);
  summary.push({ name: "Keyword engine", m: mk });

  if (args.includes("--full")) {
    const { moderate } = require("../moderation");
    const { PROVIDERS } = require("../moderation/providers");
    const custom = PROVIDERS.custom;

    // (a) our ML model on its own
    if (custom.enabled()) {
      try {
        const rows = [];
        let total = 0;
        for (const d of dataset) {
          const t = Date.now();
          const r = await custom.run(d.text);
          total += Date.now() - t;
          rows.push({ ...d, pred: r.isToxic });
        }
        const mc = report("ToxiFilter ML alone (our own trained model)", rows);
        console.log(`   avg latency per comment: ${(total / dataset.length).toFixed(0)} ms`);
        summary.push({ name: "ToxiFilter ML alone", m: mc, note: mlSawThisFile() });
        mlHoldout();
      } catch (err) {
        console.log(`\n━━ ToxiFilter ML alone ━━\n   skipped: ${err.message}\n   Is the service running?  (cd ml && python serve.py)`);
      }
    } else {
      console.log(
        "\n━━ ToxiFilter ML alone ━━\n   not enabled. Train and start it (see ml/README.md), set ML_SERVICE_URL in .env, then re-run."
      );
    }

    // (b) the real pipeline: keyword engine + ML merged, exactly what comments go through
    const rows = [];
    let total = 0;
    for (const d of dataset) {
      const r = await moderate(d.text);
      total += r.latencyMs;
      rows.push({ ...d, pred: r.isToxic });
    }
    const mf = report(`Full pipeline (keyword engine${custom.enabled() ? " + ToxiFilter ML" : " only, ML not enabled"})`, rows);
    console.log(`   avg latency per comment: ${(total / dataset.length).toFixed(0)} ms`);
    summary.push({ name: custom.enabled() ? "Full pipeline (keyword + ML)" : "Full pipeline (keyword only)", m: mf });

    printSummary(summary);
  }

  console.log(
    `\nImprovement in F1: ${pct(mb.f1)} → ${pct(mk.f1)}   false alarms: ${mb.fp} → ${mk.fp}`
  );
  if (!fileArg) {
    console.log(
      "\n⚠️  dataset.json is a DEVELOPMENT set: the lexicon was tuned on it, so v2 scores here are optimistic." +
        "\n   For an honest number, collect comments the engine has never seen (e.g. 200+ real comments" +
        "\n   labelled by 2-3 people) and run:  npm run eval -- --file held_out.json --full\n"
    );
  }
}

main();
