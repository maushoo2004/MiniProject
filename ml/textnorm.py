"""Text normalisation shared by training (train.py) and serving (serve.py).

Both sides MUST use the exact same function, otherwise the model sees different text at
prediction time than it saw during training. That is why it lives in its own module: the
saved model.joblib refers to `textnorm.normalize_text` by name.
"""
import re
import unicodedata

# leetspeak / symbol look-alikes -> the letter they stand for
LEET = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s"})

_ZERO_WIDTH = re.compile("[​-‍⁠﻿]")  # used to dodge filters
_REPEATS = re.compile(r"([^\W\d_])\1{2,}")  # the same letter 3+ times in a row
_SPACES = re.compile(r"\s+")

# Letters, digits, plus the Devanagari (Hindi) and Kannada blocks. The default word tokenizer of
# scikit-learn splits Hindi / Kannada words at their vowel signs, so we use our own.
_TOKEN = re.compile(r"[\wऀ-ॿಀ-೿]+")


def normalize_text(text: str) -> str:
    """lowercase, undo leetspeak (0->o 1->i 3->e 4->a 5->s @->a $->s), collapse stretched letters.

    "F*CK"      -> "f*ck"
    "sh1t"      -> "shit"
    "a$$hole"   -> "asshole"
    "fuuuuck"   -> "fuck"       (3+ repeats become one; "good" / "too" are left alone)
    """
    text = unicodedata.normalize("NFKC", str(text))
    text = _ZERO_WIDTH.sub("", text).lower()
    text = text.translate(LEET)
    text = _REPEATS.sub(r"\1", text)
    return _SPACES.sub(" ", text).strip()


def tokenize(text: str):
    """Word tokenizer that keeps Hindi / Kannada words in one piece."""
    return _TOKEN.findall(text)
