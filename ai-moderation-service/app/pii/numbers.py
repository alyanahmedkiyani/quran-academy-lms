"""Find digit runs in text, including digits spoken as words (English, Urdu, Roman Urdu)."""
import re
from dataclasses import dataclass
from .normalize import norm

_WORDS_RAW = {
    # English
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9",
    # Urdu (Arabic script)
    "صفر": "0", "ایک": "1", "دو": "2", "تین": "3", "چار": "4", "پانچ": "5",
    "چھ": "6", "چھے": "6", "چھہ": "6", "سات": "7", "آٹھ": "8", "نو": "9",
    # Roman Urdu
    "sifar": "0", "aik": "1", "ek": "1", "ik": "1", "teen": "3", "char": "4",
    "chaar": "4", "paanch": "5", "panch": "5", "chay": "6", "chhe": "6",
    "chhay": "6", "che": "6", "saat": "7", "aath": "8", "aat": "8", "nau": "9",
    "do": "2",
}
WORDS = {norm(k): v for k, v in _WORDS_RAW.items()}
_AMBIG_ZERO = {"o", "oh", "اوہ"}          # count as 0 only next to other digit words
# Mis-hearings of spoken digits ("three" heard as "to"). Used only between other digits, so the
# exact digit may be wrong but the run length, which is what flags a phone number, stays right.
_SOUNDALIKE = {"to": "2", "too": "2", "tu": "2", "for": "4", "fore": "4", "ate": "8", "won": "1",
               "tree": "3", "free": "3", "sex": "6", "sax": "6", "fife": "5", "nein": "9"}
_MULT = {"double": 2, "triple": 3, "ڈبل": 2, "ٹرپل": 3}
_PLUS = {"plus", "پلس", "+"}
_DIGIT_TOK = re.compile(r"^\+?\d[\d\-\.]*$")
_STRIP_EDGE = ".,;:!?()[]{}\"'"


@dataclass
class DigitRun:
    digits: str
    has_plus: bool
    char_start: int
    char_end: int
    spoken: bool   # True when at least one digit came from a spoken word


def _tokens(text: str):
    return [(m.start(), m.end(), m.group().strip(_STRIP_EDGE)) for m in re.finditer(r"\S+", text)]


def _classify(toks):
    """Tag each token: D definite digit(s), A ambiguous (counts only inside a run), M multiplier, P plus, X other."""
    out = []
    for (s, e, tok) in toks:
        if _DIGIT_TOK.match(tok):
            out.append(("D", re.sub(r"\D", "", tok), False, tok.startswith("+")))
        elif tok in WORDS:
            out.append(("D", WORDS[tok], True, False))
        elif tok in _AMBIG_ZERO:
            out.append(("A", "0", True, False))
        elif tok in _SOUNDALIKE:
            out.append(("A", _SOUNDALIKE[tok], True, False))
        elif tok in _MULT:
            out.append(("M", _MULT[tok], True, False))
        elif tok in _PLUS:
            out.append(("P", "", tok != "+", False))
        else:
            out.append(("X", "", False, False))
    return out


def find_digit_runs(text: str):
    """text must already be normalised. Returns a list of DigitRun.

    A run is a stretch of digit tokens. Ambiguous words ("oh", "to", "for", "tree") join a run only
    when the stretch holds at least 3 definite digits, so normal talk like "one to two" stays apart.
    """
    toks = _tokens(text)
    cls = _classify(toks)
    runs, i, n = [], 0, len(toks)
    while i < n:
        kind = cls[i][0]
        if kind not in ("D", "A", "M", "P"):
            i += 1
            continue
        j = i
        while j < n and cls[j][0] in ("D", "A", "M") or (j == i and kind == "P"):
            j += 1
        span = list(range(i, j))
        body = [k for k in span if cls[k][0] != "P"]
        definite = sum(1 for k in body if cls[k][0] == "D")
        if definite >= 3:
            # drop sound-alike words hanging off either end ("... six seven for you")
            while body and cls[body[-1]][0] == "A" and toks[body[-1]][2] in _SOUNDALIKE:
                body.pop()
            while body and cls[body[0]][0] == "A" and toks[body[0]][2] in _SOUNDALIKE:
                body.pop(0)
            groups = [body]
        else:
            # not enough evidence: keep only the definite digits, each stretch on its own
            groups, cur = [], []
            for k in body:
                if cls[k][0] == "D" or (cls[k][0] == "M" and k + 1 in body and cls[k + 1][0] == "D"):
                    cur.append(k)
                else:
                    if cur:
                        groups.append(cur)
                    cur = []
            if cur:
                groups.append(cur)
        for g in groups:
            digits, spoken, mult = "", False, 1
            for k in g:
                c, val, sp, _ = cls[k]
                if c == "M":
                    mult = val
                    spoken = True
                    continue
                digits += val * mult
                mult = 1
                spoken = spoken or sp
            if not digits:
                continue
            plus = cls[g[0]][3] or (g[0] - 1 >= i and cls[g[0] - 1][0] == "P") or \
                (g[0] - 1 >= 0 and cls[g[0] - 1][0] == "P")
            start = toks[g[0] - 1][0] if (g[0] - 1 >= 0 and cls[g[0] - 1][0] == "P") else toks[g[0]][0]
            runs.append(DigitRun(digits, plus, start, toks[g[-1]][1], spoken))
        i = max(j, i + 1)
    return runs
