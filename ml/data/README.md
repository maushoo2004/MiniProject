# Training data

**`python prepare_data.py` builds everything you need**: it downloads three public datasets from the Hugging Face
Hub (no login), cleans them and writes `combined.csv` (columns `text,label,lang`) plus `dataset_stats.json`.
The raw downloads go to `raw/`. The CSV and `raw/` are git-ignored; only the scripts are committed.

| Language | Dataset | Licence |
|---|---|---|
| Kannada-English | [`community-datasets/offenseval_dravidian`](https://huggingface.co/datasets/community-datasets/offenseval_dravidian) (config `kannada`) | CC-BY-4.0 |
| English | [`tdavidson/hate_speech_offensive`](https://huggingface.co/datasets/tdavidson/hate_speech_offensive) (Davidson et al., 2017) | MIT (original repository) |
| Hindi + Hinglish | [`nikitadesai/hasoc`](https://huggingface.co/datasets/nikitadesai/hasoc), a re-upload of HASOC 2021 task 2 | CC-BY-NC-4.0 as stated on the re-upload (**non-commercial**; unofficial copy) |

Details, sizes, the preparation steps, rejected datasets and citations are in [../../docs/EVALUATION.md](../../docs/EVALUATION.md).
**Check each licence before you reuse the data or the trained model outside this project.**

`server/eval/dataset.json` (64 hand-written comments) is deliberately **not** part of the training data: it is the
independent test set. `prepare_data.py` removes any overlap.

## Using your own data

`train.py` accepts any CSV with a header row, UTF-8, and these columns:

```csv
text,label,lang
"Great post, thanks!",0,en
"you are an idiot",1,en
"तू चूतिया है",1,hi
```

`label` is `1` for toxic / hateful / offensive and `0` for clean. `lang` is optional (`en`, `hinglish`, `kannada`, `hi`);
with it, the split is stratified by language and the report shows per-language scores. These label spellings are also
accepted and converted: `toxic, hate, hof, offensive, abusive, hostile` (= 1) and `clean, non-toxic, not, non-hate,
nothate` (= 0). Use `--text-col` / `--label-col` for other column names:

```powershell
python train.py --data data\combined.csv data\my_extra.csv
```

Tips

- Keep a **separate test file** you never train on (`train.py --eval-set my_test.json`; the format is
  `[{"text": "...", "toxic": 0 or 1, "lang": "en"}]`).
- Aim for thousands of rows, a reasonable mix of both labels, and include Hinglish in Latin letters, not only Devanagari.
- Do not commit datasets you are not allowed to redistribute.
