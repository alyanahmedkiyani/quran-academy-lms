"""Rule-based personal-information detector for English, Urdu (Arabic script) and Roman Urdu.

Two kinds of finding:
  share   - the speaker gives their own contact/location details
  request - the speaker asks someone else for them

Every finding carries a confidence. Only findings at or above ALERT_THRESHOLD
raise an alert; weaker ones are logged so thresholds can be tuned from data.
"""
import re
from dataclasses import dataclass
import phonenumbers
from .normalize import norm
from .numbers import find_digit_runs


@dataclass
class Finding:
    pii: str        # phone | email | social | address | photo
    kind: str       # share | request
    conf: float
    rule: str
    start: int      # char span in the normalised text
    end: int
    text: str

    def as_dict(self):
        return {"pii": self.pii, "kind": self.kind, "conf": round(self.conf, 2),
                "rule": self.rule, "text": self.text}


_ESC = re.compile(r"(\\[A-Za-z]|\(\?P<|\(\?P=)")


def P(pattern: str):
    """Compile a pattern after normalising its literal text. Regex escapes (\\S, \\d, (?P<...) are kept as written."""
    parts = _ESC.split(pattern)
    return re.compile("".join(p if i % 2 else norm_keep(p) for i, p in enumerate(parts)))


def norm_keep(s: str) -> str:
    # same as norm() but keeps leading/trailing spaces, which matter next to regex escapes
    lead = " " if s[:1] == " " else ""
    trail = " " if s[-1:] == " " and len(s) > 1 else ""
    return lead + norm(s) + trail


def alt(*words):
    return "(?:" + "|".join(norm(w) for w in words) + ")"


# ---------------------------------------------------------------- vocabulary
PLAT = alt(r"whats\s?app", "whatsapp", r"insta(?:gram)?", "facebook", "fb", r"snap(?:chat)?",
           "telegram", r"tik\s?tok", "imo", "twitter",
           r"واٹس\s?ایپ", r"واٹس\s?اپ", r"وٹس\s?ایپ", r"وٹس\s?اپ", r"انسٹا\s?گرام", "انسٹا",
           r"فیس\s?بک", r"سنیپ\s?چیٹ", r"ٹیلی\s?گرام", r"ٹک\s?ٹاک", "ایمو")
PLAT_SOC = alt(r"insta(?:gram)?", "facebook", "fb", r"snap(?:chat)?", "telegram", r"tik\s?tok", "imo",
               "twitter", r"انسٹا\s?گرام", "انسٹا", r"فیس\s?بک", r"سنیپ\s?چیٹ", r"ٹیلی\s?گرام",
               r"ٹک\s?ٹاک", "ایمو")   # WhatsApp is treated as a phone number, not a social handle
POSS = alt("your", "ur", r"apn[aiey]", r"aa?p\s?k[aiey]", r"t[uo]?mh?ar[aiey]", r"ter[aiey]",
           "اپنا", "اپنی", "اپنے", r"آپ\s?کا", r"آپ\s?کی", r"آپ\s?کے", "تمہارا", "تمہاری",
           "تمہارے", "تیرا", "تیری", "تیرے")
NUMWORD = alt("number", "no", "num", "nambar", "نمبر")
PHONE_NOUN = alt("phone", "mobile", r"cell\s?phone", "cell", "telephone", "landline",
                 "فون", "موبائل", "سیل", r"ٹیلی\s?فون")
SOCIAL_NOUN = alt("contact", "رابطہ", "rabta", "raabta")
EMAIL_NOUN = alt(r"e-?mail", r"mail\s?id", r"ای\s?میل", "ایمیل")
ADDR_NOUN = alt("address", "ایڈریس", "pata", "پتہ", "پتا")
LOC_NOUN = alt("location", "لوکیشن")
PHOTO_NOUN = alt("photo", "picture", "pic", "image", "tasveer", "selfie", "تصویر", "فوٹو", "پک", "سیلفی")

EN_STRONG = alt("give", "send", "share", "text", "drop", "provide", "write", "gimme", "get",
                "have", "show", "post", "upload")
EN_WEAK = alt("tell", "what", "whats", "know")
UR_STRONG = alt("دو", "دیں", "دیجیے", "دیجئے", r"دے\s?دو", r"دے\s?دیں", "بھیجو", "بھیجیں",
                r"بھیج\s?دو", r"بھیج\s?دیں", "بھیجیے", "بھیجئے", "شیئر", "لکھو", "لکھیں",
                r"لکھ\s?دو", r"لکھ\s?دیں", "دکھاؤ", "دکھائیں",
                "do", "dein", "den", r"d[ey]\s?do", r"d[ey]\s?dein", r"d[ey]\s?den", "dy", "de", "dena",
                "dijiye", "dijye", "dijiay", r"bh[ae]i?jo", r"bh[ae]i?jein", r"bh[ae]i?j\s?do",
                r"bh[ae]i?j\s?dein", r"bh[ae]i?jiye", "likho", "likhein", r"likh\s?do", "dikhao",
                "dikhayen", "share", "send")
UR_WEAK = alt("بتاؤ", "بتائیں", r"بتا\s?دو", r"بتا\s?دیں", "بتایئے", "بتائیے", r"کیا\s?ہے",
              r"کیا\s?ہیں", "batao", "batain", "bataein", r"bata\s?do", r"bata\s?dein",
              "batayen", "bataiye", r"kya\s?h[ae]i?", "btao", r"bta\s?do", r"bta\s?dein", r"bata\s?den",
              "batana", "btana")

CLASS_CTX = P(r"(?<!\w)" + alt(
    "page", "ayah", "ayat", "aayat", "verse", "surah", "surat", "soorat", "para", "juz",
    "chapter", "lesson", "roll", "line", "question", "exercise", "grade", "class", "row",
    "sabaq", "safha", "safa", "sawal", "marks", "ruku", "rukoo", "turn",
    "صفحہ", "صفحے", "آیت", "سورہ", "سورت", "سبق", "پارہ", "رول", "سوال", "لائن", "رکوع",
    "باب", "کلاس", "نمبرز", "ٹرن") + r"(?!\w)")

STREET = alt("street", "st", "gali", "road", "rd", "sector", "block", "phase", "colony", "town",
             "mohalla", "mohallah", "society", "avenue", "lane", "nagar", "chowk", "market",
             "محلہ", "گلی", "سٹریٹ", "روڈ", "سیکٹر", "بلاک", "فیز", "کالونی", "ٹاؤن", "سوسائٹی",
             "ایونیو", "چوک", "مارکیٹ")
HOUSE = alt("house", "home", "ghar", "makan", "flat", "plot", "ہاؤس", "گھر", "مکان", "فلیٹ", "پلاٹ")
LANDMARK = alt("market", "mosque", "masjid", "chowk", "school", "park", "hospital", "bazar",
               "bazaar", "مسجد", "چوک", "اسکول", "پارک", "ہسپتال", "بازار", "مارکیٹ")

W0, W1 = r"(?<!\w)", r"(?!\w)"
RX_POSS_PHONE = P(W0 + POSS + r"\s" + f"(?P<n>{PHONE_NOUN}(?:\\s?{NUMWORD})?|{SOCIAL_NOUN}(?:\\s?{NUMWORD})?|{PLAT}(?:\\s?{NUMWORD})?)" + W1)
RX_POSS_BARE = P(W0 + POSS + r"\s" + f"(?P<n>{NUMWORD})" + W1)
RX_PLAIN_QUAL = P(W0 + f"(?P<n>(?:{PHONE_NOUN}|{PLAT})\\s?{NUMWORD})" + W1)   # "whatsapp number do"
RX_POSS_EMAIL = P(W0 + POSS + r"\s" + f"(?P<n>{EMAIL_NOUN}(?:\\s(?:address|id|ایڈریس))?)" + W1)
RX_POSS_ADDR = P(W0 + POSS + r"\s" + f"(?:(?:home|house|full|current|ghar\\s?ka|گھر\\s?کا)\\s)?(?P<n>{ADDR_NOUN}|{LOC_NOUN})" + W1)
RX_POSS_SOCIAL = P(W0 + POSS + r"\s" + f"(?P<n>{PLAT_SOC}(?:\\s(?:id|account|handle|username|user\\s?name|name))?)" + W1)
RX_POSS_PHOTO = P(W0 + POSS + r"\s" + f"(?P<n>{PHOTO_NOUN})" + W1)
RX_SEND_PHOTO = P(W0 + alt("send", "share", "show", "give", "post", "upload", "bhejo", "dikhao") +
                  r"\s(?:me\s|mujhe\s)?(?:a\s)?(?P<n>selfie|" + alt("photo", "pic", "picture") + r")(?!\s(?:of|ki|ka|ke|کی|کا|کے))")
RX_WHERE_LIVE = P(W0 + alt(r"where\sdo\syou\slive", r"where\sdo\syou\sstay", r"kahan\srehte\shain",
                           r"kahan\srehte\sho", r"kahan\srehti\sho", r"کہاں\sرہتے\sہو", r"کہاں\sرہتی\sہو",
                           r"کہاں\sرہتے\sہیں") + W1)
RX_ARE_YOU_ON = P(W0 + r"are\syou\son\s" + PLAT + W1)

RX_EMAIL = P(r"[a-z0-9._%+\-]+@[a-z0-9\-]+(?:\.[a-z0-9\-]+)+")
RX_EMAIL_SPOKEN = P(r"(?<!\w)(?:[a-z0-9_.]+|\S+)\s" +
                    alt(r"at\sthe\srate(?:\sof)?", "at", r"ایٹ\sدی\sریٹ", "ایٹ") + r"\s" +
                    alt("gmail", r"g\smail", "yahoo", "hotmail", "outlook", "icloud",
                        r"جی\s?میل", "یاہو", r"ہاٹ\s?میل", r"آؤٹ\s?لک", "ایکلاؤڈ") + W1)
RX_HANDLE = P(r"(?<![\w@.])@[a-z0-9_.]{3,30}(?![\w@]|\.[a-z])")
RX_SOCIAL_SHARE = P(W0 + alt("my", "mera", "meri", "mere", "میرا", "میری", "میرے") + r"\s" + PLAT +
                    r"\s(?:id|account|handle|username|user\s?name|number|no|نمبر|آئی\s?ڈی)\b")
RX_SOCIAL_IS = P(W0 + alt("my", "mera", "meri", "mere", "میرا", "میری", "میرے") + r"\s" + PLAT +
                 r"\s(?:id\s|account\s|username\s|user\s?name\s)?(?:is|hai|ہے|:)\s\S+")
RX_SOCIAL_OFFER = P(W0 + alt("add", "follow", "message", "text", "dm", "contact", "find", "ping",
                             "call", r"msg", r"send\sme\sa\srequest") + r"\s(?:me\s)?(?:on|at|in)\s" + PLAT + W1)
RX_SOCIAL_OFFER_UR = P(W0 + alt("mujhe", "mujhay", "مجھے", "ہمیں") + r"\s" + PLAT +
                       r"\s" + alt("pe", "par", "per", "پر", "پہ") + r"\s" +
                       alt("add", "message", "msg", "text", "contact", "follow", "رابطہ", "میسج",
                           "ایڈ", "فالو") + W1)

RX_ADDR_HOUSE = P(W0 + f"(?P<h>{HOUSE})\\s?(?:no\\.?|number|#|نمبر)?\\s?(?P<n>[a-z]?-?\\d+[a-z]?)" + W1)
RX_ADDR_MY = P(W0 + alt("my", "our", "mera", "hamara", "میرا", "ہمارا") +
               r"\s(?:home\s|house\s|full\s|current\s|ghar\ska\s|گھر\sکا\s)?" + ADDR_NOUN +
               r"\s(?:is|hai|ye\shai|یہ\sہے|ہے|:)\s(?P<rest>\S+(?:\s\S+){1,})")
RX_ADDR_LIVE = P(W0 + alt("i", "we", "main", "hum") + r"\slive\s(?:at|on|near|in\sfront\sof|in|opposite|behind)\s(?P<rest>\S+(?:\s\S+){0,6})")

_TOKEN_SPLIT = re.compile(r"[^\n]+?(?:[.?!](?=\s|$)|$)")


def _sentences(text):
    for m in _TOKEN_SPLIT.finditer(text):
        if m.group().strip():
            yield m.start(), m.group()


def _cue(sentence, start, end, which):
    """Return 'strong'/'weak'/None. English verbs come before the noun, Urdu/Roman verbs after it."""
    before = sentence[max(0, start - 55):start]
    after = sentence[end:end + 45]
    en_s = re.search(W0 + EN_STRONG + W1, norm(before))
    en_w = re.search(W0 + EN_WEAK + W1, norm(before))
    ur_s = re.search(W0 + UR_STRONG + W1, norm(after))
    ur_w = re.search(W0 + UR_WEAK + W1, norm(after))
    # "do" before the noun is the English verb ("do not use your phone"), never a cue
    if en_s or ur_s:
        return "strong"
    if en_w or ur_w:
        return "weak"
    return None


def _requests(text):
    out = []
    for off, sent in _sentences(text):
        def add(m, pii, conf, rule, g="n"):
            out.append(Finding(pii, "request", conf, rule, off + m.start(), off + m.end(), m.group()))

        # --- phone / whatsapp / contact
        for m in RX_POSS_PHONE.finditer(sent):
            noun = m.group("n")
            has_num = bool(re.search(NUMWORD + r"$", noun))
            plat_like = bool(re.fullmatch(PLAT, noun)) or bool(re.fullmatch(SOCIAL_NOUN, noun))
            c = _cue(sent, m.start(), m.end(), "phone")
            if c and has_num:
                add(m, "phone", 0.85, "req.phone_number")
            elif c == "strong" and plat_like:
                add(m, "phone", 0.8, "req.whatsapp_contact")
            elif c == "weak" and plat_like:
                add(m, "phone", 0.78, "req.whatsapp_contact_weak")
            elif c:
                add(m, "phone", 0.6, "req.phone_noun_only")
        for m in RX_PLAIN_QUAL.finditer(sent):
            if _cue(sent, m.start(), m.end(), "phone") == "strong" and not CLASS_CTX.search(sent):
                add(m, "phone", 0.78, "req.plain_qualified_number")
        for m in RX_POSS_BARE.finditer(sent):
            if CLASS_CTX.search(sent):
                continue
            c = _cue(sent, m.start(), m.end(), "bare")
            if c == "strong":
                add(m, "phone", 0.8, "req.bare_number_strong")
            elif c == "weak":
                add(m, "phone", 0.5, "req.bare_number_weak")
        # --- email
        for m in RX_POSS_EMAIL.finditer(sent):
            c = _cue(sent, m.start(), m.end(), "email")
            if c:
                add(m, "email", 0.85, "req.email")
        # --- address / location
        for m in RX_POSS_ADDR.finditer(sent):
            c = _cue(sent, m.start(), m.end(), "addr")
            is_loc = bool(re.fullmatch(LOC_NOUN, m.group("n")))
            if c and not is_loc:
                add(m, "address", 0.85, "req.address")
            elif c == "strong" and is_loc:
                add(m, "address", 0.8, "req.location_strong")
            elif c:
                add(m, "address", 0.55, "req.location_weak")
        for m in RX_WHERE_LIVE.finditer(sent):
            add(m, "address", 0.6, "req.where_live")
        # --- social handles
        for m in RX_POSS_SOCIAL.finditer(sent):
            if _cue(sent, m.start(), m.end(), "social"):
                add(m, "social", 0.85, "req.social")
        for m in RX_ARE_YOU_ON.finditer(sent):
            add(m, "social", 0.7, "req.are_you_on")
        # --- photo
        for m in RX_POSS_PHOTO.finditer(sent):
            if _cue(sent, m.start(), m.end(), "photo") == "strong":
                add(m, "photo", 0.85, "req.photo")
        for m in RX_SEND_PHOTO.finditer(sent):
            add(m, "photo", 0.8, "req.send_photo")
    return out


_CTX_PHONE = P(W0 + alt("phone", "mobile", "cell", "number", "no", "whatsapp", r"whats\s?app", "call",
                        "contact", "text", "msg", "message", "فون", "موبائل", "نمبر", r"واٹس\s?ایپ",
                        r"واٹس\s?اپ", "کال", "رابطہ", "rabta", "raabta") + W1)


def _phone_valid(d: str, plus: bool):
    cands = []
    if plus:
        cands.append("+" + d)
    else:
        if d.startswith("00") and len(d) >= 11:
            cands.append("+" + d[2:])
        cands.append(d)
        if d.startswith("92") and len(d) >= 12:
            cands.append("+" + d)
    for c in cands:
        try:
            num = phonenumbers.parse(c, "PK")
        except phonenumbers.NumberParseException:
            continue
        if not phonenumbers.is_valid_number(num):
            continue
        t = phonenumbers.number_type(num)
        if num.country_code == 92 and t == phonenumbers.PhoneNumberType.MOBILE:
            return 0.95, "share.phone_pk_mobile"
        if t in (phonenumbers.PhoneNumberType.MOBILE, phonenumbers.PhoneNumberType.FIXED_LINE_OR_MOBILE):
            return 0.9, "share.phone_valid_mobile"
        return 0.8, "share.phone_valid_other"
    return None


def _is_counting(d: str) -> bool:
    """1234567 / 9876543: children counting aloud, not a phone number."""
    if len(d) < 6:
        return False
    up = all((int(b) - int(a)) % 10 == 1 for a, b in zip(d, d[1:]))
    down = all((int(a) - int(b)) % 10 == 1 for a, b in zip(d, d[1:]))
    return up or down


def _shares(text):
    out = []
    for run in find_digit_runs(text):
        d, n = run.digits, len(run.digits)
        if n < 7 or _is_counting(d):
            continue
        lo, hi = max(0, run.char_start - 60), run.char_end + 60
        ctx = bool(_CTX_PHONE.search(text[lo:hi]))
        v = _phone_valid(d, run.has_plus) if n >= 10 else None
        if v:
            conf, rule = v
        elif n >= 10:
            if ctx:
                conf, rule = 0.8, "share.digits_with_context"
            elif n <= 13 and len(set(d)) >= 4:
                # 10-13 digits in a row is a phone number in practice, even if mistyped or misheard
                conf, rule = 0.76, "share.long_digits"
            else:
                conf, rule = 0.5, "share.digits_no_context"
        elif ctx:
            conf, rule = 0.78, "share.short_digits_with_context"
        else:
            continue
        out.append(Finding("phone", "share", conf, rule, run.char_start, run.char_end,
                           text[run.char_start:run.char_end]))

    for m in RX_EMAIL.finditer(text):
        out.append(Finding("email", "share", 0.95, "share.email", m.start(), m.end(), m.group()))
    for m in RX_EMAIL_SPOKEN.finditer(text):
        out.append(Finding("email", "share", 0.9, "share.email_spoken", m.start(), m.end(), m.group()))
    for m in RX_HANDLE.finditer(text):
        out.append(Finding("social", "share", 0.8, "share.handle", m.start(), m.end(), m.group()))
    for rx, conf, rule in ((RX_SOCIAL_SHARE, 0.8, "share.social_id"), (RX_SOCIAL_IS, 0.8, "share.social_is"),
                           (RX_SOCIAL_OFFER, 0.78, "share.social_offer"),
                           (RX_SOCIAL_OFFER_UR, 0.78, "share.social_offer_ur")):
        for m in rx.finditer(text):
            out.append(Finding("social", "share", conf, rule, m.start(), m.end(), m.group()))

    for off, sent in _sentences(text):
        for m in RX_ADDR_HOUSE.finditer(sent):
            tail = sent[m.end():m.end() + 60]
            sm = re.search(W0 + STREET + r"(?:\s[\w\-]+)?" + W1, tail)
            if sm or re.search(W0 + STREET + W1, sent[:m.start()][-30:]):
                end = m.end() + (sm.end() if sm else 0)
                out.append(Finding("address", "share", 0.88, "share.house_street", off + m.start(),
                                   off + end, sent[m.start():end]))
        for m in RX_ADDR_MY.finditer(sent):
            out.append(Finding("address", "share", 0.85, "share.my_address", off + m.start(),
                               off + m.end(), m.group()))
        for m in RX_ADDR_LIVE.finditer(sent):
            if re.search(W0 + "(?:" + STREET + "|" + LANDMARK + ")" + W1, m.group("rest")):
                out.append(Finding("address", "share", 0.78, "share.live_near", off + m.start(),
                                   off + m.end(), m.group()))
    return out


def _dedupe(findings):
    findings = sorted(findings, key=lambda f: -f.conf)
    kept = []
    for f in findings:
        if any(k.kind == f.kind and f.start < k.end and k.start < f.end for k in kept):
            continue
        kept.append(f)
    return sorted(kept, key=lambda f: f.start)


def detect_normalised(text: str):
    findings = _shares(text) + _requests(text)
    try:
        from .intent import predict_intent
        res = predict_intent(text, threshold=0.78)
        if res.get("is_suspicious"):
            findings.append(Finding(
                pii=res["category"],
                kind="intent",
                conf=res["confidence"],
                rule=f"intent.{res['category']}",
                start=0,
                end=len(text),
                text=text
            ))
    except Exception:
        pass
    return _dedupe(findings)


def detect_text(raw: str):
    """Detect in chat text. Returns (normalised_text, findings)."""
    t = norm(raw)
    return t, detect_normalised(t)


def detect_words(words):
    """Detect in a list of transcribed words.

    Returns (findings, spans) where each finding is paired with (first_word, last_word)
    indexes, so the caller can map a finding back to audio time.
    """
    toks = [norm(w) for w in words]
    idx = [i for i, t in enumerate(toks) if t]
    text, spans, pos = "", [], 0
    for i in idx:
        if text:
            text += " "
        spans.append((len(text), len(text) + len(toks[i]), i))
        text += toks[i]
    out = []
    for f in detect_normalised(text):
        hit = [w for (s, e, w) in spans if s < f.end and f.start < e]
        if hit:
            out.append((f, (min(hit), max(hit))))
    return out
