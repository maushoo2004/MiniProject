# ToxiFilter ML: our own trained model

A small Python service that scores how toxic a comment is. The Node API calls it next to the keyword
engine, and either one can flag a comment. It is **optional**: if it isn't running, ToxiFilter still works with
the keyword engine alone.

```
ml/
  prepare_data.py          download public datasets -> data/combined.csv (text,label,lang)
  train.py                 train, compare 2 models x 3 thresholds, write model.joblib + metrics.json + charts
  serve.py                 FastAPI service on :8000   (GET /health, POST /predict)
  textnorm.py              text normalisation shared by training and serving
  train_transformer.py     optional: fine-tune MuRIL on a GPU (Google Colab)
  data/README.md           data sources, format, how to add your own data
../docs/EVALUATION.md      the full evaluation write-up (datasets, licences, results, limitations, citations)
```

**The model:** text is normalised (lowercase, `sh1t -> shit`, `a$$hole -> asshole`, `fuuuck -> fuck`) and turned
into TF-IDF features (character n-grams 2-5 plus word n-grams 1-2). A classifier is trained on top: logistic
regression or a calibrated linear SVM, whichever scores better (they currently tie, so logistic regression wins).
Character n-grams are what let it cope with misspellings and Hinglish transliteration.

It is trained on 10,660 comments in English, Hinglish, Hindi and Kannada. Current held-out F1 is about 0.77
(English 0.92, Hinglish 0.69, Kannada 0.57, Hindi 0.48). See [../docs/EVALUATION.md](../docs/EVALUATION.md)
for the numbers, their limits, and the dataset licences (**one of the datasets is non-commercial, so this is for academic use**).

## Set up (Windows, PowerShell)

Needs Python 3.10 or newer (`python --version`).

```powershell
cd ml
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-data.txt      # includes requirements.txt
python prepare_data.py                    # downloads the datasets (about 10 MB), builds data/combined.csv
python train.py                           # about a minute; writes model.joblib, metrics.json, 2 charts
```

If PowerShell refuses to run `activate`, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
On macOS / Linux use `source .venv/bin/activate`.

`python train.py` prints a comparison of Logistic Regression and a calibrated LinearSVC at thresholds 0.5 / 0.6 / 0.7,
per-language scores, 5-fold cross-validation, and the result on `server/eval/dataset.json` (which is never trained on).
It keeps the best option that causes few false alarms on that file's clean comments, and saves the threshold in
`metrics.json`; `serve.py` uses it. Without `data/combined.csv` it falls back to the 64-comment `dataset.json`
(a demo only; it prints a warning).

Outputs: `model.joblib`, `metrics.json`, `confusion_matrix.png`, `per_language_f1.png`
(and `data/heldout_predictions.json`, used by `npm run eval:heldout`).

## Run it

The easiest way: **`npm run dev`** from the project root starts the API, the web app and this service together.
If Python or `model.joblib` is missing, it prints a clear message and the rest keeps running.
To start only this service: `npm run ml` (from the root) or `python serve.py` (from `ml/`).

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post http://127.0.0.1:8000/predict -ContentType 'application/json' `
  -Body '{"text":"tu bewakoof hai"}'
# toxic_probability label label_name threshold
#              0.98     1 toxic            0.7
```

The service listens on `127.0.0.1` only and has no login, so **do not expose it to the internet**.

## Connect it to the app

1. In the project's `.env`: `ML_SERVICE_URL=http://127.0.0.1:8000`
2. Restart the API (`npm run dev`).
3. `http://localhost:3001/api/health` shows `"custom": true`, the ToxiFilter Lab shows "ToxiFilter ML (our model)"
   as active, and flagged results can carry the source "🧠 ToxiFilter ML (our model)".

How it merges: the service decides toxic / not with the threshold chosen in training (`label` in the response),
the keyword engine always runs, and either one can flag a comment. A low ML score never un-flags something the
keyword engine caught. The API waits at most 1.5 seconds (`ML_TIMEOUT_MS`) for the service; if it is down or slow, the
request carries on with the keyword engine alone.

Compare everything:

```powershell
npm run eval:heldout                         # keyword engine vs ML vs both, on the held-out split (honest)
npm run eval -- --full                       # on server/eval/dataset.json (the keyword lexicon was tuned there)
npm run eval -- --file my_test.json --full   # on a labelled file of your own
```

## Optional: a transformer (Google Colab GPU)

`train_transformer.py` fine-tunes `google/muril-base-cased`, a model pre-trained on Indian languages
including Hindi, Kannada and transliterated text. It is future work: it has not been run in this project.

1. Open Google Colab, Runtime -> Change runtime type -> **T4 GPU**.
2. Upload this `ml/` folder (with `data/combined.csv`), then run:
   ```
   !pip install -q transformers accelerate scikit-learn pandas
   %cd ml
   !python train_transformer.py --epochs 4
   ```
3. Download the `transformer_model/` folder into `ml/` on your machine.
4. `pip install -r requirements-transformer.txt`, then `python serve.py --transformer`.

(If the model download asks you to accept terms or log in, follow the prompt on the model's page.) The service
answers the same `/predict` requests either way, so the Node side doesn't change.

## Honest limits

- The model reads one comment at a time as a bag of n-grams: no context, no sarcasm, and insults without
  abusive vocabulary are often missed ("complete waste of space honestly" scores 0.22).
- Recall is low for Kannada and Hindi (0.44 and 0.39); Hinglish and Hindi have only 620 and 783 training comments.
- The training data is tweets and YouTube comments, not blog comments, and labels in code-mixed corpora are noisy.
- It will occasionally flag harmless text (about 1 in 9 of the comments it flags, on the held-out split).
