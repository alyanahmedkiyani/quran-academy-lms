import json
from pathlib import Path
from app.pii.detect import detect_text, detect_words


def alerts(t, thr=0.75):
    return [f for f in detect_text(t)[1] if f.conf >= thr]


def test_labelled_cases():
    cases = [json.loads(l) for l in (Path(__file__).parent.parent / "eval/text_cases.jsonl").read_text(encoding="utf-8").splitlines()]
    for c in cases:
        assert bool(alerts(c["text"])) == (c["label"] == "pii"), c


def test_number_split_across_words_maps_to_word_range():
    words = "ok my number is zero three zero zero one two three four five six seven thanks".split()
    (f, (a, b)), = detect_words(words)
    assert f.pii == "phone" and words[a] == "zero" and words[b] == "seven"


def test_counting_is_not_a_phone_number():
    assert not alerts("one two three four five six seven eight nine ten")
    assert not alerts("صفر ایک دو تین چار پانچ چھ سات آٹھ نو")
