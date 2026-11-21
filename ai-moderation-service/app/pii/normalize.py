"""Text normalisation shared by every detector.

Whisper writes Urdu in Arabic script with inconsistent letter variants, so the
same word can arrive spelled several ways. Patterns are run through norm() too,
so both sides always match.
"""
import re
import unicodedata

_DIGITS = {ord(c): str(i) for i, c in enumerate("٠١٢٣٤٥٦٧٨٩")}
_DIGITS.update({ord(c): str(i) for i, c in enumerate("۰۱۲۳۴۵۶۷۸۹")})
_CHARS = {
    "ي": "ی", "ى": "ی", "ې": "ی", "ك": "ک", "ڪ": "ک",
    "ه": "ہ", "ھ": "ہ", "ۃ": "ہ", "ۀ": "ہ", "ة": "ہ",
    "أ": "ا", "إ": "ا", "ٱ": "ا",
    "۔": ".", "،": ",", "؟": "?", "؛": ";",
}
_CHAR_TABLE = {ord(k): v for k, v in _CHARS.items()}
_STRIP = re.compile("[ً-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ"
                    "ـ​‌‍‎‏⁠﻿]")
_WS = re.compile(r"\s+")


def norm(text: str) -> str:
    t = unicodedata.normalize("NFKC", text or "")
    t = t.translate(_DIGITS).translate(_CHAR_TABLE)
    t = _STRIP.sub("", t)
    t = t.lower()
    return _WS.sub(" ", t).strip()
