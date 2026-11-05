#!/usr/bin/env python
"""OPTIONAL: fine-tune a multilingual transformer (default google/muril-base-cased) for toxicity.

MuRIL was pre-trained on Indian languages including Hindi, Kannada and transliterated (Latin-script)
text, so it suits ToxiFilter's languages much better than an English-only model. Use a GPU: on Google
Colab choose Runtime -> Change runtime type -> T4 GPU, then:

    !pip install -q transformers accelerate scikit-learn pandas
    # upload the ml/ folder (and your CSVs), then:
    %cd ml
    !python train_transformer.py --data data/your_dataset.csv --epochs 4

It saves the model to ml/transformer_model/ (download that folder) and metrics_transformer.json.
Then, on your own machine:   python serve.py --transformer

NOTE: this script needs torch + transformers (see requirements-transformer.txt). The default dataset is
tiny, so with it the result is only a smoke test; fine-tuning only makes sense with thousands of rows.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split

from train import default_data_paths, load_data

HERE = Path(__file__).resolve().parent


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", nargs="+", default=default_data_paths())
    ap.add_argument("--text-col", default="text")
    ap.add_argument("--label-col", default="label")
    ap.add_argument("--model", default="google/muril-base-cased")
    ap.add_argument("--epochs", type=int, default=4)
    ap.add_argument("--batch-size", type=int, default=16)
    ap.add_argument("--lr", type=float, default=2e-5)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--test-size", type=float, default=0.2)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default=str(HERE / "transformer_model"))
    args = ap.parse_args()

    try:
        import torch
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
            Trainer,
            TrainingArguments,
            set_seed,
        )
    except ImportError:
        sys.exit("This script needs torch and transformers:  pip install -r requirements-transformer.txt")

    set_seed(args.seed)
    data = load_data(args.data, args.text_col, args.label_col)
    print(f"Loaded {len(data)} comments ({int(data['label'].sum())} toxic)")
    if len(data) < 500:
        print("WARNING: tiny dataset, so this fine-tune is only a smoke test.")

    X_train, X_test, y_train, y_test = train_test_split(
        data["text"].tolist(), data["label"].tolist(), test_size=args.test_size, stratify=data["label"], random_state=args.seed
    )

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(args.model, num_labels=2)

    class TextDataset(torch.utils.data.Dataset):
        def __init__(self, texts, labels):
            self.enc = tokenizer(texts, truncation=True, max_length=args.max_len, padding=True)
            self.labels = labels

        def __len__(self):
            return len(self.labels)

        def __getitem__(self, i):
            item = {k: torch.tensor(v[i]) for k, v in self.enc.items()}
            item["labels"] = torch.tensor(self.labels[i])
            return item

    train_ds, test_ds = TextDataset(X_train, y_train), TextDataset(X_test, y_test)

    training_args = TrainingArguments(
        output_dir=str(Path(args.out) / "checkpoints"),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size * 2,
        learning_rate=args.lr,
        weight_decay=0.01,
        warmup_ratio=0.1,
        save_strategy="no",
        logging_steps=10,
        report_to="none",
        seed=args.seed,
    )
    trainer = Trainer(model=model, args=training_args, train_dataset=train_ds)
    trainer.train()

    # evaluate on the held-out split (scored after training, so it works across transformers versions)
    logits = trainer.predict(test_ds).predictions
    pred = logits.argmax(axis=-1)
    print("\n=== Classification report (held-out test split) ===")
    print(classification_report(y_test, pred, target_names=["clean", "toxic"], digits=3, zero_division=0))

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(out))
    tokenizer.save_pretrained(str(out))
    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model": args.model,
        "n_samples": len(data),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "epochs": args.epochs,
        "test": {"f1": round(float(f1_score(y_test, pred, zero_division=0)), 4)},
        "tiny_dataset_warning": len(data) < 500,
    }
    (HERE / "metrics_transformer.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    print(f"\nSaved model to {out}\nNext:  python serve.py --transformer")


if __name__ == "__main__":
    main()
