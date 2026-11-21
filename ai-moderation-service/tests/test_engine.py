"""Regression: a slow speech model must still receive the right audio (found in the 12 Nov live test)."""
import time

import numpy as np

from app import config
from app.audio.transcriber import Transcript, Word
from app.engine import Engine
from app.store import Store

SR = 16000


class SlowAsr:
    def __init__(self, delay):
        self.delay, self.seen = delay, []

    def transcribe(self, audio, abs_start_s, speaker=""):
        time.sleep(self.delay)
        self.seen.append((abs_start_s, float(np.abs(audio).max())))
        return Transcript([Word("hello", abs_start_s, abs_start_s + 0.3)], "en")


def test_slow_model_still_gets_the_spoken_audio(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "RING_SECONDS", 2)           # tiny buffer: wraps long before the model catches up
    asr = SlowAsr(0.6)
    eng = Engine(Store(tmp_path / "t.db"), transcriber=asr, vad_kind="energy")
    s = eng.open_stream("r", "u", "student")
    tone = (np.sin(np.arange(SR // 2) * 0.3) * 9000).astype(np.int16)     # 0.5 s "speech"
    gap = np.zeros(SR, dtype=np.int16)                                    # 1 s silence
    stream = np.concatenate([np.concatenate([tone, gap]) for _ in range(4)])   # 6 s, 4 utterances
    for i in range(0, len(stream), 1600):
        eng.feed(s, stream[i:i + 1600])                    # fed instantly: far faster than the model
    deadline = time.time() + 10
    while len(asr.seen) < 4 and time.time() < deadline:
        time.sleep(0.1)
    eng._stop = True
    assert len(asr.seen) == 4
    assert all(peak > 0.2 for _, peak in asr.seen), asr.seen     # every utterance carries the tone, none is silence


class NumpyTimesAsr:
    """Mimics faster-whisper, which returns word times as numpy numbers (bug found in the 12 Nov live test)."""

    def transcribe(self, audio, abs_start_s, speaker=""):
        toks = "My number is 0 3 0 0 1 2 3 4 5 6".split()
        return Transcript([Word(t, np.float64(abs_start_s) + np.float64(0.3 * i),
                                np.float64(abs_start_s) + np.float64(0.3 * i + 0.25), np.float32(0.9))
                           for i, t in enumerate(toks)], "en")


def test_alert_is_stored_when_word_times_are_numpy(tmp_path):
    events = []
    eng = Engine(Store(tmp_path / "t.db"), emit=events.append, transcriber=NumpyTimesAsr(), vad_kind="energy")
    s = eng.open_stream("class-1", "Tester", "student")
    tone = (np.sin(np.arange(SR * 3) * 0.3) * 9000).astype(np.int16)
    pcm = np.concatenate([np.zeros(SR * 2, np.int16), tone, np.zeros(SR * 12, np.int16)])
    for i in range(0, len(pcm), 1600):
        eng.feed(s, pcm[i:i + 1600])
    deadline = time.time() + 10
    while time.time() < deadline and not eng.store.rows("SELECT id FROM alerts WHERE status='new'"):
        time.sleep(0.2)
    eng._stop = True
    rows = eng.store.rows("SELECT * FROM alerts")
    assert len(rows) == 1 and rows[0]["pii"] == "phone" and rows[0]["status"] == "new" and rows[0]["clip_file"]
    assert eng.last_error == ""
