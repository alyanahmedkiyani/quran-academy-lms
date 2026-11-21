import numpy as np
from app.audio.clipper import window
from app.audio.ringbuffer import RingBuffer


def test_window_centres_short_incident():
    s, e, trunc = window(100.0, 102.0)
    assert e - s == 15 and not trunc
    assert abs((100.0 - s) - (e - 102.0)) < 1e-9 and 100.0 - s >= 4


def test_window_long_incident_truncated_but_keeps_min_pad():
    s, e, trunc = window(50.0, 70.0)
    assert trunc and e - s == 15 and 50.0 - s >= 3


def test_ring_returns_exact_samples_across_wrap():
    r = RingBuffer(2.0, 16000)           # 32000 samples
    data = np.arange(80000, dtype=np.int64) % 30000
    for i in range(0, 80000, 1600):
        r.write(data[i:i + 1600].astype(np.int16))
    out, mb, ma = r.get(70000, 72000)
    assert mb == 0 and ma == 0 and (out == data[70000:72000]).all()


def test_ring_marks_missing_audio():
    r = RingBuffer(1.0, 16000)
    r.write(np.ones(16000, dtype=np.int16))
    out, mb, ma = r.get(-8000, 24000)
    assert mb == 8000 and ma == 8000 and len(out) == 32000
    assert out[:8000].sum() == 0 and out[8000:24000].sum() == 16000
