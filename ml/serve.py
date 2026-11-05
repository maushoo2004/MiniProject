#!/usr/bin/env python
"""ToxiFilter ML service: a tiny HTTP API around the trained model.

    python serve.py                  # scikit-learn model from model.joblib  (port 8000)
    python serve.py --transformer    # fine-tuned transformer from transformer_model/

    GET  /health                -> { status, model, ... }
    POST /predict {"text": "…"} -> { "toxic_probability": 0.93, "label": 1, "label_name": "toxic", "threshold": 0.5 }

`label` is 1 when the probability reaches the threshold stored in metrics.json by train.py.

The Node API calls this over HTTP (ML_SERVICE_URL). It listens on 127.0.0.1 only by default
because it has no authentication: do not expose it to the internet.
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))  # so the pickled model can import textnorm

import uvicorn  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

DEFAULT_THRESHOLD = 0.5  # used when metrics.json has no "threshold" (e.g. an old model)


class PredictIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)


class SklearnModel:
    name = "tfidf-logreg"

    def __init__(self, path: Path):
        import joblib

        self.pipeline = joblib.load(path)

    def predict_proba(self, text: str) -> float:
        return float(self.pipeline.predict_proba([text])[0][1])


class TransformerModel:
    name = "transformer"

    def __init__(self, folder: Path):
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self.torch = torch
        self.tokenizer = AutoTokenizer.from_pretrained(folder)
        self.model = AutoModelForSequenceClassification.from_pretrained(folder)
        self.model.eval()

    def predict_proba(self, text: str) -> float:
        enc = self.tokenizer(text, truncation=True, max_length=128, return_tensors="pt")
        with self.torch.no_grad():
            logits = self.model(**enc).logits
        return float(self.torch.softmax(logits, dim=-1)[0][1])


def load_model(use_transformer: bool):
    if use_transformer:
        folder = HERE / "transformer_model"
        if not folder.exists():
            sys.exit(f"No transformer found at {folder}. Train one first (see train_transformer.py / README).")
        return TransformerModel(folder)
    path = HERE / "model.joblib"
    if not path.exists():
        sys.exit(f"No model found at {path}. Run:  python train.py")
    return SklearnModel(path)


def build_app(use_transformer: bool = False) -> FastAPI:
    model = load_model(use_transformer)
    metrics_file = HERE / ("metrics_transformer.json" if use_transformer else "metrics.json")
    metrics = json.loads(metrics_file.read_text(encoding="utf-8")) if metrics_file.exists() else None
    # the decision threshold chosen during training (train.py compares 0.5 / 0.6 / 0.7)
    threshold = float((metrics or {}).get("threshold", DEFAULT_THRESHOLD))

    app = FastAPI(title="ToxiFilter ML", version="1.1")

    @app.get("/health")
    def health():
        info = {"status": "ok", "model": model.name, "threshold": threshold}
        if metrics:
            info.update(
                trained_at=metrics.get("trained_at"),
                n_samples=metrics.get("n_samples"),
                test_f1=(metrics.get("test") or {}).get("f1"),
                tiny_dataset_warning=metrics.get("tiny_dataset_warning"),
            )
        return info

    @app.post("/predict")
    def predict(body: PredictIn):
        p = model.predict_proba(body.text)
        label = int(p >= threshold)
        return {
            "toxic_probability": round(p, 4),
            "label": label,
            "label_name": "toxic" if label else "clean",
            "threshold": threshold,
        }

    return app


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--transformer", action="store_true", help="serve the fine-tuned transformer instead of model.joblib")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8000)
    args = ap.parse_args()

    app = build_app(args.transformer)
    print(f"ToxiFilter ML ({'transformer' if args.transformer else 'tfidf-logreg'}) on http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
