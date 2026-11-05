#!/usr/bin/env python
"""Train and evaluate ToxiFilter's own toxicity classifier.

    python prepare_data.py          # once: builds data/combined.csv from public datasets
    python train.py                 # trains on data/combined.csv, tests on server/eval/dataset.json

Features: TF-IDF character n-grams (2-5, char_wb) + word n-grams (1-2), on normalised text.
Two classifiers are compared: Logistic Regression (class_weight=balanced) and a calibrated
LinearSVC. For each, decision thresholds 0.5 / 0.6 / 0.7 are tried. The winner is the row with the
best held-out F1 among those that keep false alarms low on the CLEAN rows of the independent test
set (server/eval/dataset.json, which is never trained on).

If data/combined.csv does not exist, it falls back to the tiny server/eval/dataset.json (demo only).

Outputs (next to this file): model.joblib, metrics.json, confusion_matrix.png, per_language_f1.png
"""
import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.svm import LinearSVC

from textnorm import normalize_text, tokenize

HERE = Path(__file__).resolve().parent
COMBINED = HERE / "data" / "combined.csv"
TINY_DATASET_FILE = HERE.parent / "server" / "eval" / "dataset.json"  # also our independent test set
TINY_DATASET = 500  # below this many rows the numbers are not trustworthy
THRESHOLDS = (0.5, 0.6, 0.7)
MAX_FALSE_ALARMS = 1  # allowed false alarms on the clean rows of the independent set
TIE_TOLERANCE = 0.005  # held-out F1 differences smaller than this are treated as a tie
LANG_ORDER = ["en", "hinglish", "kannada", "hi"]
LANG_ALIASES = {"kn": "kannada"}

# label spellings found in public datasets -> 0 / 1
LABEL_MAP = {
    "1": 1, "toxic": 1, "hate": 1, "hof": 1, "offensive": 1, "abusive": 1, "hostile": 1, "true": 1, "yes": 1,
    "0": 0, "clean": 0, "non-toxic": 0, "nontoxic": 0, "not": 0, "non-hate": 0, "nothate": 0, "false": 0, "no": 0,
}


def default_data_paths():
    return [str(COMBINED if COMBINED.exists() else TINY_DATASET_FILE)]


# --------------------------------------------------------------------------- data


def to_label(value):
    key = str(value).strip().lower()
    if key not in LABEL_MAP:
        raise ValueError(
            f"Unknown label {value!r}. Use 0/1 or one of: {sorted(LABEL_MAP)}. "
            "Convert your file to columns text,label[,lang] (see data/README.md)."
        )
    return LABEL_MAP[key]


def load_data(paths, text_col="text", label_col="label"):
    """Load CSV files (text,label[,lang]) and/or dataset.json ([{text, toxic, lang}, ...])."""
    frames = []
    for p in paths:
        p = Path(p)
        if not p.exists():
            sys.exit(f"Data file not found: {p}" + ("  (run: python prepare_data.py)" if p == COMBINED else ""))
        if p.suffix.lower() == ".json":
            df = pd.read_json(p)
            label_src = "toxic" if "toxic" in df.columns else label_col
        else:
            df = pd.read_csv(p)
            label_src = label_col
        if text_col not in df.columns or label_src not in df.columns:
            sys.exit(f"{p} needs the columns '{text_col}' and '{label_col}' (found {list(df.columns)}).")
        out = pd.DataFrame({"text": df[text_col], "label": df[label_src]})
        out["lang"] = df["lang"] if "lang" in df.columns else "unknown"
        out["source"] = p.name
        frames.append(out)

    data = pd.concat(frames, ignore_index=True).dropna(subset=["text", "label"])
    data["text"] = data["text"].astype(str).str.strip()
    data = data[data["text"] != ""]
    data["label"] = data["label"].map(to_label)
    data["lang"] = data["lang"].astype(str).replace(LANG_ALIASES)
    return data.drop_duplicates(subset="text").reset_index(drop=True)


def text_key(t):
    return re.sub(r"\W+", " ", str(t).lower()).strip()


# --------------------------------------------------------------------------- models


def build_features(min_df=2):
    return FeatureUnion(
        [
            (
                "char",
                TfidfVectorizer(
                    analyzer="char_wb", ngram_range=(2, 5), preprocessor=normalize_text, sublinear_tf=True, min_df=min_df
                ),
            ),
            (
                "word",
                TfidfVectorizer(
                    analyzer="word",
                    ngram_range=(1, 2),
                    preprocessor=normalize_text,
                    tokenizer=tokenize,
                    token_pattern=None,
                    sublinear_tf=True,
                    min_df=min_df,
                ),
            ),
        ]
    )


def build_pipeline(kind, C, min_df):
    if kind == "logreg":
        clf = LogisticRegression(class_weight="balanced", C=C, max_iter=3000)
    elif kind == "svc":
        # LinearSVC has no probabilities, so wrap it in a calibrator (sigmoid / Platt scaling)
        clf = CalibratedClassifierCV(LinearSVC(class_weight="balanced", C=0.5), cv=3, method="sigmoid")
    else:
        raise ValueError(kind)
    return Pipeline([("features", build_features(min_df)), ("clf", clf)])


MODEL_NAMES = {"logreg": "Logistic Regression", "svc": "Calibrated LinearSVC"}


# --------------------------------------------------------------------------- metrics


def prf(y_true, pred):
    y_true, pred = np.asarray(y_true), np.asarray(pred)
    tp = int(((pred == 1) & (y_true == 1)).sum())
    fp = int(((pred == 1) & (y_true == 0)).sum())
    fn = int(((pred == 0) & (y_true == 1)).sum())
    tn = int(((pred == 0) & (y_true == 0)).sum())
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return {
        "n": int(len(y_true)),
        "accuracy": round((tp + tn) / max(len(y_true), 1), 4),
        "precision": round(p, 4),
        "recall": round(r, 4),
        "f1": round(f1, 4),
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
    }


def per_language(df, proba, thr):
    out = {}
    pred = (np.asarray(proba) >= thr).astype(int)
    langs = [l for l in LANG_ORDER if l in set(df["lang"])] + sorted(set(df["lang"]) - set(LANG_ORDER))
    for lang in langs:
        mask = (df["lang"] == lang).to_numpy()
        out[lang] = prf(df["label"].to_numpy()[mask], pred[mask])
    return out


def split_key(df):
    key = df["lang"] + "|" + df["label"].astype(str)
    return key if key.value_counts().min() >= 2 else df["label"]


# --------------------------------------------------------------------------- plots


def save_confusion_matrix(y_true, y_pred, path, subtitle):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import ConfusionMatrixDisplay

    fig, ax = plt.subplots(figsize=(4.6, 4.2))
    ConfusionMatrixDisplay.from_predictions(
        y_true, y_pred, labels=[0, 1], display_labels=["clean", "toxic"], cmap="Purples", ax=ax, colorbar=False
    )
    ax.set_title(f"ToxiFilter ML: confusion matrix\n{subtitle}", fontsize=10)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def save_per_language_chart(test_pl, indep_pl, path, subtitle):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    langs = list(test_pl)
    x = np.arange(len(langs))
    has_indep = bool(indep_pl)
    width = 0.38 if has_indep else 0.55
    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    b1 = ax.bar(x - (width / 2 if has_indep else 0), [test_pl[l]["f1"] for l in langs], width, color="#8b5cf6", label="held-out test split")
    bars = [b1]
    if has_indep:
        vals = [indep_pl.get(l, {}).get("f1", 0) for l in langs]
        bars.append(ax.bar(x + width / 2, vals, width, color="#ec4899", label="independent set (dataset.json)"))
    for group, key in zip(bars, ["test", "indep"]):
        for rect, l in zip(group, langs):
            src = test_pl if key == "test" else indep_pl
            n = src.get(l, {}).get("n")
            ax.annotate(f"{rect.get_height():.2f}\n(n={n})" if n else "", (rect.get_x() + rect.get_width() / 2, rect.get_height()),
                        ha="center", va="bottom", fontsize=7)
    ax.set_xticks(x)
    ax.set_xticklabels([{"en": "English", "hinglish": "Hinglish", "kannada": "Kannada", "hi": "Hindi"}.get(l, l) for l in langs])
    ax.set_ylim(0, 1.18)
    ax.set_ylabel("F1 (toxic class)")
    ax.set_title(f"ToxiFilter ML: F1 per language\n{subtitle}", fontsize=10)
    ax.legend(loc="upper right", fontsize=8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


# --------------------------------------------------------------------------- main


def table(rows, headers):
    widths = [max(len(str(h)), *(len(str(r[i])) for r in rows)) for i, h in enumerate(headers)]
    line = " | ".join(str(h).ljust(w) for h, w in zip(headers, widths))
    print(line)
    print("-+-".join("-" * w for w in widths))
    for r in rows:
        print(" | ".join(str(c).ljust(w) for c, w in zip(r, widths)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", nargs="+", default=default_data_paths(), help="CSV (text,label[,lang]) and/or dataset.json files")
    ap.add_argument("--eval-set", default=str(TINY_DATASET_FILE), help="independent test set (never trained on); 'none' to skip")
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--label-col", default="label")
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--C", type=float, default=10.0, help="Logistic Regression inverse regularisation")
    ap.add_argument("--min-df", type=int, default=2, help="ignore n-grams seen in fewer documents than this")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--no-refit", action="store_true", help="save the model trained on the 80%% split only")
    ap.add_argument("--out", default=str(HERE))
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    data = load_data(args.data, args.text_col, args.label_col)

    # independent test set: never trained on
    indep = None
    if args.eval_set.lower() != "none" and Path(args.eval_set).exists():
        if any(Path(p).resolve() == Path(args.eval_set).resolve() for p in args.data):
            print("(the independent test set is also the training file, so it is not used for testing)")
        else:
            indep = load_data([args.eval_set])
            keys = set(indep["text"].map(text_key))
            leaked = data["text"].map(text_key).isin(keys)
            if leaked.any():
                print(f"Removed {int(leaked.sum())} training rows that also appear in the independent test set.")
                data = data[~leaked].reset_index(drop=True)

    by_lang = data.groupby("lang")["label"].agg(rows="count", toxic="sum")
    print(f"Loaded {len(data)} unique comments from {len(args.data)} file(s); toxic share {data['label'].mean():.1%}")
    print(by_lang.to_string(), "\n")
    if data["label"].value_counts().min() < 2:
        sys.exit("Need at least 2 examples of each class to train.")

    tiny = len(data) < TINY_DATASET
    if tiny:
        print("!" * 72 + f"\n WARNING: only {len(data)} training examples: a TINY dataset, scores are NOT trustworthy."
              "\n Run  python prepare_data.py  to build a real one (see data/README.md).\n" + "!" * 72 + "\n")

    X_train, X_test, y_train, y_test = train_test_split(
        data, data["label"], test_size=args.test_size, stratify=split_key(data), random_state=args.seed
    )
    train_df, test_df = X_train.reset_index(drop=True), X_test.reset_index(drop=True)
    print(f"Stratified (language x label) split: {len(train_df)} train / {len(test_df)} test (random_state={args.seed})\n")

    # ---- fit both models, score every threshold ------------------------------------------------
    fitted, proba_test, proba_indep, candidates = {}, {}, {}, []
    for kind in ("logreg", "svc"):
        model = build_pipeline(kind, args.C, args.min_df)
        model.fit(train_df["text"], train_df["label"])
        fitted[kind] = model
        proba_test[kind] = model.predict_proba(test_df["text"])[:, 1]
        if indep is not None:
            proba_indep[kind] = model.predict_proba(indep["text"])[:, 1]
        for thr in THRESHOLDS:
            cand = {
                "model": kind,
                "threshold": thr,
                "test": prf(test_df["label"], proba_test[kind] >= thr),
                "independent": None,
            }
            if indep is not None:
                m = prf(indep["label"], proba_indep[kind] >= thr)
                m["clean_rows"] = int((indep["label"] == 0).sum())
                m["false_alarms"] = m["fp"]
                cand["independent"] = m
            candidates.append(cand)

    print("=== Model and threshold comparison ===")
    rows = []
    for c in candidates:
        t, i = c["test"], c["independent"]
        rows.append([
            MODEL_NAMES[c["model"]], c["threshold"], f"{t['precision']:.3f}", f"{t['recall']:.3f}", f"{t['f1']:.3f}",
            f"{i['f1']:.3f}" if i else "-", f"{i['false_alarms']}/{i['clean_rows']}" if i else "-",
        ])
    table(rows, ["model", "thr", "test P", "test R", "test F1", "indep F1", "indep false alarms"])

    # ---- pick the best: highest held-out F1 among rows with few false alarms on clean independent rows
    ok = [c for c in candidates if c["independent"] is None or c["independent"]["false_alarms"] <= MAX_FALSE_ALARMS]
    if ok:
        pool = ok
    else:
        pool = [min(candidates, key=lambda c: (c["independent"]["false_alarms"], -c["test"]["f1"]))]
    # options within TIE_TOLERANCE of the best F1 count as tied: prefer the simpler model (logistic
    # regression), then the higher threshold (fewer false alarms)
    top_f1 = max(c["test"]["f1"] for c in pool)
    tied = [c for c in pool if top_f1 - c["test"]["f1"] <= TIE_TOLERANCE]
    best = max(tied, key=lambda c: (c["model"] == "logreg", c["threshold"]))
    kind, thr = best["model"], best["threshold"]
    print(f"\nSelected: {MODEL_NAMES[kind]} at threshold {thr}  "
          f"(best held-out F1 among options with <= {MAX_FALSE_ALARMS} false alarm(s) on the clean independent rows; "
          f"{len(tied)} option(s) within {TIE_TOLERANCE} F1 of the best)")

    # ---- detailed report for the winner ----------------------------------------------------------
    test_overall = best["test"]
    test_pl = per_language(test_df, proba_test[kind], thr)
    print(f"\n=== Held-out test split ({len(test_df)} comments), {MODEL_NAMES[kind]} @ {thr} ===")
    print(f"precision {test_overall['precision']:.3f}  recall {test_overall['recall']:.3f}  F1 {test_overall['f1']:.3f}  "
          f"accuracy {test_overall['accuracy']:.3f}")
    table([[l, v["n"], f"{v['precision']:.3f}", f"{v['recall']:.3f}", f"{v['f1']:.3f}"] for l, v in test_pl.items()],
          ["language", "n", "precision", "recall", "F1"])

    indep_overall, indep_pl = None, None
    if indep is not None:
        indep_overall = best["independent"]
        indep_pl = per_language(indep, proba_indep[kind], thr)
        print(f"\n=== Independent test set: {Path(args.eval_set).name} ({len(indep)} comments, never trained on) ===")
        print(f"precision {indep_overall['precision']:.3f}  recall {indep_overall['recall']:.3f}  F1 {indep_overall['f1']:.3f}  "
              f"false alarms {indep_overall['false_alarms']}/{indep_overall['clean_rows']}")
        table([[l, v["n"], f"{v['precision']:.3f}", f"{v['recall']:.3f}", f"{v['f1']:.3f}"] for l, v in indep_pl.items()],
              ["language", "n", "precision", "recall", "F1"])

    # ---- cross-validation (all data, both models, default 0.5 decision rule) -----------------------
    k = max(2, min(args.folds, int(split_key(data).value_counts().min())))
    cv_scores = {}
    print(f"\n=== {k}-fold stratified cross-validation (F1, toxic class, all data) ===")
    skf = StratifiedKFold(k, shuffle=True, random_state=args.seed)
    for kd in ("logreg", "svc"):
        s = cross_val_score(build_pipeline(kd, args.C, args.min_df), data["text"], data["label"],
                            cv=list(skf.split(data["text"], split_key(data))), scoring="f1", n_jobs=-1)
        cv_scores[kd] = {"folds": int(k), "f1_mean": round(float(s.mean()), 4), "f1_std": round(float(s.std()), 4)}
        print(f"  {MODEL_NAMES[kd]:22} {s.mean():.3f} +/- {s.std():.3f}")

    # ---- save the held-out predictions of the model that never saw them (used by server/eval/heldout.js
    #      to measure what the ML model adds on top of the keyword engine) --------------------------------
    heldout = test_df[["text", "label", "lang"]].rename(columns={"label": "toxic"}).assign(p=np.round(proba_test[kind], 4))
    (out / "data").mkdir(exist_ok=True)
    (out / "data" / "heldout_predictions.json").write_text(
        json.dumps(heldout.to_dict(orient="records"), ensure_ascii=False), encoding="utf-8"
    )

    # ---- charts -----------------------------------------------------------------------------------
    pred_test = (proba_test[kind] >= thr).astype(int)
    save_confusion_matrix(test_df["label"], pred_test, out / "confusion_matrix.png",
                          f"{MODEL_NAMES[kind]} @ {thr}, held-out test split, n={len(test_df)}")
    save_per_language_chart(test_pl, indep_pl, out / "per_language_f1.png", f"{MODEL_NAMES[kind]} @ {thr}")

    # ---- deploy: refit the chosen model on ALL the data ---------------------------------------------
    if args.no_refit:
        final = fitted[kind]
    else:
        final = build_pipeline(kind, args.C, args.min_df)
        final.fit(data["text"], data["label"])
    joblib.dump(final, out / "model.joblib", compress=3)

    cm = confusion_matrix(test_df["label"], pred_test, labels=[0, 1])
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": MODEL_NAMES[kind] + ": TF-IDF char_wb 2-5 + word 1-2 (class_weight=balanced)",
        "selected_model": kind,
        "threshold": thr,
        "data_files": [Path(p).name for p in args.data],
        "n_samples": int(len(data)),
        "n_train": int(len(train_df)),
        "n_test": int(len(test_df)),
        "by_language": {l: {"rows": int(r["rows"]), "toxic": int(r["toxic"])} for l, r in by_lang.iterrows()},
        "deployed_model_refit_on_all_data": not args.no_refit,
        "selection_rule": f"highest held-out F1 among (model, threshold) options with <= {MAX_FALSE_ALARMS} false alarm(s) "
                          f"on the clean rows of the independent test set; options within {TIE_TOLERANCE} F1 of the best are "
                          "tied and resolved in favour of logistic regression, then the higher threshold",
        "candidates": candidates,
        "test": {**test_overall, "confusion_matrix": {"labels": ["clean", "toxic"], "matrix": cm.tolist()},
                 "note": "scored on a split the evaluated model never saw"},
        "per_language_test": test_pl,
        "independent_set": None if indep is None else {
            "file": Path(args.eval_set).name, **indep_overall, "per_language": indep_pl,
            "note": "never trained on; but its CLEAN rows were used as a false-alarm guard when choosing the threshold",
        },
        "cross_validation": cv_scores,
        "tiny_dataset_warning": bool(tiny),
    }
    (out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print("\nSaved:")
    for name in ("model.joblib", "metrics.json", "confusion_matrix.png", "per_language_f1.png"):
        print(f"  {out / name}")

    probe = ["Great post, thanks for sharing!", "you are an idiot", "tu bewakoof hai", "Gandhi had great skill",
             "complete waste of space honestly", "I hate Mondays"]
    probs = final.predict_proba(probe)[:, 1]
    print(f"\nSanity check (probability toxic; the service flags >= {thr}):")
    for text, p in zip(probe, probs):
        print(f"  {p:5.2f} {'TOXIC' if p >= thr else 'clean'}  {text}")


if __name__ == "__main__":
    main()
