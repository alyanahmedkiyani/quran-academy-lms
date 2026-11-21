"""Score the text detector against labelled cases.   python eval/run_text_eval.py [threshold] [--unseen]"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.pii.detect import detect_text  # noqa: E402


def run(threshold=0.75, verbose=False, unseen=False):
    here = Path(__file__).parent
    if unseen:      # phrasings written after the rules, never used to tune them
        cases = json.loads((here / "unseen_cases.json").read_text(encoding="utf-8"))
    else:
        cases = [json.loads(l) for l in (here / "text_cases.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
    tp = fp = fn = tn = 0
    bad = []
    by_lang = {}
    for c in cases:
        _, fs = detect_text(c["text"])
        hit = [f for f in fs if f.conf >= threshold]
        alert = bool(hit)
        want = c["label"] == "pii"
        ok_type = (not want) or any(f.pii == c["pii"] for f in hit)
        g = by_lang.setdefault(c["lang"], [0, 0])
        g[1] += 1
        if want and alert and ok_type:
            tp += 1; g[0] += 1
        elif want:
            fn += 1
            bad.append(("MISSED", c, fs))
        elif alert:
            fp += 1
            bad.append(("FALSE ALERT", c, fs))
        else:
            tn += 1; g[0] += 1
    prec = tp / (tp + fp) if tp + fp else 1.0
    rec = tp / (tp + fn) if tp + fn else 1.0
    print(f"threshold {threshold}: cases {len(cases)}  TP {tp}  FP {fp}  FN {fn}  TN {tn}")
    print(f"precision {prec:.3f}   recall {rec:.3f}")
    print("accuracy by language:", {k: f"{v[0]}/{v[1]}" for k, v in by_lang.items()})
    for kind, c, fs in bad:
        print(f"  {kind} [{c['id']}] {c['text']!r}  -> {[f.as_dict() for f in fs]}")
    return prec, rec, bad


if __name__ == "__main__":
    thr = next((float(a) for a in sys.argv[1:] if not a.startswith("-")), 0.75)
    run(thr, "-v" in sys.argv, "--unseen" in sys.argv)
