#!/usr/bin/env python
"""Download public datasets and build ml/data/combined.csv (columns: text,label,lang).

    pip install -r requirements-data.txt
    python prepare_data.py

Sources (all downloaded without a login; see ../docs/EVALUATION.md for citations and licences):
  kannada   HF community-datasets/offenseval_dravidian  (config "kannada")  CC-BY-4.0
              label 0 -> 0, labels 1-4 (Offensive_*) -> 1, label 5 (not-Kannada) -> dropped
  en        HF tdavidson/hate_speech_offensive           (Davidson et al., 2017)
              class 0 hate + 1 offensive -> 1, class 2 neither -> 0
  hi/hinglish  HF nikitadesai/hasoc = HASOC 2021 Task 2 (Hindi-English conversational tweets)
              text = the item that carries the label (the part after the last COMMENT:: / REPLY-COMMENT marker); SHOF -> 1, NONE -> 0,
              CHOF (hateful only given the parent post) -> dropped, because ToxiFilter reads one comment alone

Then: strip @mentions / URLs / RT, drop empty and duplicate rows (and texts with conflicting labels),
cap English at ~40% of the data, and make sure nothing from ../server/eval/dataset.json (our
independent test set) leaks into training.

Raw downloads go to ml/data/raw/ and the result to ml/data/combined.csv. Both are git-ignored.
"""
import html
import json
import re
import sys
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

HERE = Path(__file__).resolve().parent
RAW = HERE / "data" / "raw"
OUT = HERE / "data" / "combined.csv"
STATS = HERE / "data" / "dataset_stats.json"
EVAL_SET = HERE.parent / "server" / "eval" / "dataset.json"

MAX_ENGLISH_SHARE = 0.40
SEED = 42

# ----------------------------------------------------------------------------- cleaning

_URL = re.compile(r"(?:https?://|www\.)\S+|\b\w+\.(?:co|com|in|org)/\S+", re.I)
_MENTION = re.compile(r"@\w+")
_RT = re.compile(r"\bRT\b:?", re.I)
_SPACES = re.compile(r"\s+")
_LEAD_JUNK = re.compile(r"^[\s!:.\-,;|>~*]+")
# HASOC 2021 task 2 rows look like "PARENT COMMENT:: comment REPLY-COMMENT reply"; the label belongs
# to the LAST item, so we keep only the text after the last marker.
_COMMENT_MARKER = re.compile(r"(?:COMMENT::|REPLY-COMMENT(?::{1,2})?|REPLY::)")
_DEVANAGARI = re.compile(r"[ऀ-ॿ]")

# Romanised-Hindi function words that are NOT also common English words (used to tell Hinglish from English)
HINGLISH_WORDS = set(
    """hai hain nahi nahin kya kyun kyu kyon ki ko ka mai mein yeh woh wo aur bhi toh tum tu tera teri tere mera
    meri mere apna apne hum karo kaise kaun lekin magar tha thi hoga hota raha rahe rahi abhi sab log desh bhai
    sirf bahut accha acha kuch koi jab wala wale wali gaya gaye chahiye karna karte kisi unka unki saath sath
    liye isko usko inko unko hamare tumhare aapka aapki bol bolo dekho dekh samjha samajh pata nhi kr krna
    ek iss uss tarah mulk yaad kitne kitna itna itni jaise waise baat zyada jyada aaj kal humko tumko mujhe tujhe
    unhe inhe hoon rha rhe yaar yar arey chalo jao sahi galat thik theek achha kabhi kyunki isliye phir bhaiya""".split()
)


def clean_text(text):
    t = html.unescape(str(text))
    t = _URL.sub(" ", t)
    t = _MENTION.sub(" ", t)
    t = _RT.sub(" ", t)
    t = t.replace("#", " ")
    t = _SPACES.sub(" ", t).strip()
    t = _LEAD_JUNK.sub("", t)
    return t.strip()


def is_usable(t):
    return len(t) >= 3 and re.search(r"[^\W\d_]", t) is not None


def guess_hinglish_or_english(t):
    """Heuristic language tag for Latin-script text: Hinglish if it has 2+ distinct romanised-Hindi
    function words, or 1 such word making up >= 15% of the words. Otherwise English. Not perfect."""
    words = re.findall(r"[a-z]+", t.lower())
    hits = len(set(words) & HINGLISH_WORDS)
    return "hinglish" if hits >= 2 or (hits >= 1 and hits / max(len(words), 1) >= 0.15) else "en"


def fetch(repo, filename):
    return hf_hub_download(repo, filename, repo_type="dataset", local_dir=RAW / repo.replace("/", "__"))


# ----------------------------------------------------------------------------- loaders


def load_kannada():
    frames = []
    for split in ("train", "validation"):
        frames.append(pd.read_parquet(fetch("community-datasets/offenseval_dravidian", f"kannada/{split}-00000-of-00001.parquet")))
    df = pd.concat(frames, ignore_index=True)
    raw_n = len(df)
    df = df[df["label"] != 5]  # "not-Kannada"
    out = pd.DataFrame({"text": df["text"], "label": (df["label"] > 0).astype(int), "lang": "kannada"})
    return out, {"raw_rows": raw_n, "dropped_not_kannada": int(raw_n - len(df))}


def load_english():
    df = pd.read_parquet(fetch("tdavidson/hate_speech_offensive", "data/train-00000-of-00001.parquet"))
    out = pd.DataFrame({"text": df["tweet"], "label": (df["class"] != 2).astype(int), "lang": "en"})
    return out, {"raw_rows": int(len(df))}


def load_hasoc():
    df = pd.read_csv(fetch("nikitadesai/hasoc", "traindata-basic.csv"))
    df.columns = ["raw", "binary", "context", "clean"]
    raw_n = len(df)
    df = df[df["context"].isin(["NONE", "SHOF"])].copy()  # drop CHOF: hateful only with the parent post
    dropped_chof = raw_n - len(df)
    df["text"] = df["raw"].map(lambda s: _COMMENT_MARKER.split(str(s))[-1])
    df["label"] = (df["context"] == "SHOF").astype(int)
    return df[["text", "label"]], {"raw_rows": raw_n, "dropped_context_dependent_CHOF": int(dropped_chof)}


# ----------------------------------------------------------------------------- main


def normalise_key(t):
    return re.sub(r"\W+", " ", t.lower()).strip()


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    stats = {"sources": {}}

    kn, s = load_kannada()
    stats["sources"]["offenseval_dravidian (kannada)"] = s
    en, s = load_english()
    stats["sources"]["tdavidson/hate_speech_offensive"] = s
    hasoc, s = load_hasoc()
    stats["sources"]["HASOC 2021 task 2 (nikitadesai/hasoc)"] = s

    # split HASOC rows into Hindi (Devanagari) / Hinglish (romanised) / English, by script
    def hasoc_lang(t):
        if _DEVANAGARI.search(t):
            return "hi"
        return guess_hinglish_or_english(t)

    hasoc["text"] = hasoc["text"].map(clean_text)
    hasoc["lang"] = hasoc["text"].map(hasoc_lang)

    data = pd.concat([kn, en, hasoc], ignore_index=True)
    data["text"] = data["text"].map(clean_text)
    before = len(data)
    data = data[data["text"].map(is_usable)]
    stats["dropped_empty_or_too_short"] = int(before - len(data))

    # duplicates; and texts that appear with conflicting labels are unreliable, so drop all copies
    data["key"] = data["text"].map(normalise_key)
    conflict_keys = set(data.groupby("key")["label"].nunique().loc[lambda s: s > 1].index)
    before = len(data)
    data = data[~data["key"].isin(conflict_keys)]
    stats["dropped_conflicting_labels"] = int(before - len(data))
    before = len(data)
    data = data.drop_duplicates(subset="key")
    stats["dropped_duplicates"] = int(before - len(data))

    # keep our independent test set OUT of training
    if EVAL_SET.exists():
        eval_keys = {normalise_key(r["text"]) for r in json.loads(EVAL_SET.read_text(encoding="utf-8"))}
        before = len(data)
        data = data[~data["key"].isin(eval_keys)]
        stats["removed_because_in_independent_test_set"] = int(before - len(data))
    data = data.drop(columns="key")

    stats["before_english_cap"] = {k: int(v) for k, v in data["lang"].value_counts().items()}

    # cap English at ~40% of the final data; inside the cap use equal toxic / clean so the English
    # "offensive" tweets (83% of Davidson) don't teach the model that English text means toxic
    non_en = data[data["lang"] != "en"]
    english = data[data["lang"] == "en"]
    max_en = int(MAX_ENGLISH_SHARE / (1 - MAX_ENGLISH_SHARE) * len(non_en))
    if len(english) > max_en:
        half = max_en // 2
        clean_en = english[english["label"] == 0]
        toxic_en = english[english["label"] == 1]
        n_clean = min(len(clean_en), half)
        n_toxic = min(len(toxic_en), max_en - n_clean)
        english = pd.concat(
            [clean_en.sample(n_clean, random_state=SEED), toxic_en.sample(n_toxic, random_state=SEED)]
        )
    data = pd.concat([non_en, english], ignore_index=True).sample(frac=1, random_state=SEED).reset_index(drop=True)

    data.to_csv(OUT, index=False, encoding="utf-8")

    stats["final_rows"] = int(len(data))
    stats["final_by_language"] = {
        lang: {
            "rows": int(g.shape[0]),
            "toxic": int(g["label"].sum()),
            "clean": int((g["label"] == 0).sum()),
            "share": round(g.shape[0] / len(data), 3),
        }
        for lang, g in data.groupby("lang")
    }
    stats["final_toxic_share"] = round(float(data["label"].mean()), 3)
    STATS.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Wrote {OUT}  ({len(data)} rows)\n")
    print(f"{'language':10} {'rows':>7} {'toxic':>7} {'clean':>7} {'share':>7}")
    for lang, v in stats["final_by_language"].items():
        print(f"{lang:10} {v['rows']:7d} {v['toxic']:7d} {v['clean']:7d} {v['share']:7.1%}")
    print(f"\noverall toxic share: {stats['final_toxic_share']:.1%}")
    print("cleaning:", {k: v for k, v in stats.items() if k.startswith(('dropped', 'removed'))})
    print(f"stats saved to {STATS}")


if __name__ == "__main__":
    sys.exit(main())
