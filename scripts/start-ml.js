#!/usr/bin/env node
/**
 * Starts the ToxiFilter ML service (ml/serve.py) for `npm run dev` / `npm run ml`.
 *
 * The ML service is optional, so this script NEVER fails the dev run: if Python or the trained
 * model is missing it prints what to do and exits with code 0 (the API and web app keep running
 * with the keyword engine only). `npm run dev` uses `concurrently --kill-others-on-fail`, so a
 * clean exit here does not stop the other processes.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ML_DIR = path.join(__dirname, "..", "ml");
const isWin = process.platform === "win32";
const venvPython = path.join(ML_DIR, ".venv", isWin ? "Scripts" : "bin", isWin ? "python.exe" : "python");
const say = (msg) => console.log(`[ml] ${msg}`);

const python = fs.existsSync(venvPython) ? venvPython : isWin ? "python" : "python3";

const probe = spawnSync(python, ["--version"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) {
  say("Python was not found, so the ToxiFilter ML service is NOT running.");
  say("Install Python 3.10+ (https://www.python.org/downloads/), then see ml/README.md.");
  say("Everything else keeps working: comments are still checked by the keyword engine.");
  process.exit(0);
}

if (!fs.existsSync(path.join(ML_DIR, "model.joblib"))) {
  say("ml/model.joblib is missing, so the ToxiFilter ML service is NOT running.");
  say("Train it once (details in ml/README.md):");
  say("  cd ml && python -m venv .venv && .venv\\Scripts\\activate && pip install -r requirements-data.txt");
  say("  python prepare_data.py && python train.py");
  say("Everything else keeps working: comments are still checked by the keyword engine.");
  process.exit(0);
}

say(`starting ml/serve.py with ${path.relative(path.join(__dirname, ".."), python) || python}`);
const child = spawn(python, ["serve.py"], {
  cwd: ML_DIR,
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
});

child.on("error", (err) => {
  say(`could not start the ML service: ${err.message}`);
  process.exit(0);
});

child.on("exit", (code, signal) => {
  if (signal || code === 0) process.exit(0);
  say(`the ML service stopped (exit code ${code}). Is port 8000 free, and are the packages installed`);
  say("(pip install -r ml/requirements.txt)? The app keeps running with the keyword engine only.");
  process.exit(0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill();
    process.exit(0);
  });
}
