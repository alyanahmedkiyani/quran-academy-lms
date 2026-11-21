"""Speech-to-text backends. All return word timings in absolute stream seconds."""
import threading
import time
from dataclasses import dataclass, field

import numpy as np

from .. import config


@dataclass
class Word:
    text: str
    start: float
    end: float
    prob: float = 1.0


@dataclass
class Transcript:
    words: list = field(default_factory=list)
    lang: str = ""
    lang_probs: dict = field(default_factory=dict)
    skipped: str = ""
    asr_s: float = 0.0

    @property
    def text(self):
        return " ".join(w.text for w in self.words)


HALLUCINATIONS = {"thanks for watching", "thank you for watching", "subtitles by", "please subscribe",
                  "ترجمہ", "شکریہ"}


class WhisperTranscriber:
    """faster-whisper. The model loads on first use (first run downloads it)."""

    def __init__(self):
        self._model = None
        self.error = ""
        self._lock = threading.Lock()
        self.arabic_gate = float(__import__("os").getenv("ARABIC_GATE", "0.7"))

    def _load(self):
        if self._model is None:
            from faster_whisper import WhisperModel
            print(f"[asr] loading {config.WHISPER_MODEL} ({config.WHISPER_DEVICE}, {config.WHISPER_COMPUTE}) ...")
            self._model = WhisperModel(config.WHISPER_MODEL, device=config.WHISPER_DEVICE,
                                       compute_type=config.WHISPER_COMPUTE,
                                       cpu_threads=config.WHISPER_THREADS)
            print("[asr] model ready")
        return self._model

    def preload(self):
        def run():
            try:
                self._load()
            except Exception as exc:     # e.g. no internet for the first model download
                self.error = f"{type(exc).__name__}: {exc}"[:300]
                print(f"[asr] could not load model: {self.error}")
        threading.Thread(target=run, daemon=True, name="asr-preload").start()

    @property
    def ready(self):
        return self._model is not None

    def _language(self, model, audio):
        if config.LANG_MODE in ("en", "ur"):
            return config.LANG_MODE, {}
        try:
            _, _, all_probs = model.detect_language(audio)
            probs = dict(all_probs)
        except Exception:
            return "ur", {}
        keep = {k: round(float(probs.get(k, 0)), 3) for k in ("en", "ur", "ar", "hi", "pa")}
        return ("en" if keep["en"] >= keep["ur"] else "ur"), keep

    def transcribe(self, audio, abs_start_s, speaker=""):
        t0 = time.time()
        with self._lock:
            model = self._load()
            lang, probs = self._language(model, audio)
            if probs and probs.get("ar", 0) >= self.arabic_gate and probs["ar"] > max(probs["en"], probs["ur"]):
                return Transcript(lang="ar", lang_probs=probs, skipped="recitation_suspect",
                                  asr_s=time.time() - t0)
            segs, _ = model.transcribe(audio, language=lang, word_timestamps=True, beam_size=1,
                                       temperature=0.0, condition_on_previous_text=False,
                                       vad_filter=False, no_speech_threshold=0.6,
                                       log_prob_threshold=-1.0, compression_ratio_threshold=2.4)
            words, dropped = [], []
            for s in segs:
                low = (s.no_speech_prob > 0.6 and s.avg_logprob < -1.0) or s.avg_logprob < -1.6
                if low or s.text.strip().lower().strip(".! ") in HALLUCINATIONS:
                    dropped.append(f"{s.text.strip()} (logprob {s.avg_logprob:.2f}, no-speech {s.no_speech_prob:.2f})")
                    continue
                for w in (s.words or []):
                    t = w.word.strip()
                    if t:
                        # plain floats: faster-whisper returns numpy numbers, which break JSON and SQLite later
                        words.append(Word(t, float(abs_start_s + w.start), float(abs_start_s + w.end), float(w.probability)))
        note = ("low_confidence: " + " | ".join(dropped)) if dropped and not words else ""
        return Transcript(words, lang, probs, note, time.time() - t0)


class ScriptedTranscriber:
    """Tests only. Returns pre-written text at known stream times instead of listening.

    script: {speaker: [(start_s, end_s, "text"), ...]} in stream seconds.
    """

    def __init__(self, script):
        self.script = script

    def transcribe(self, audio, abs_start_s, speaker=""):
        abs_end = abs_start_s + len(audio) / config.SAMPLE_RATE
        words = []
        entries = self.script.get(speaker) or self.script.get("*", [])
        for (s, e, text) in entries:
            if s is None:                      # "say this over every utterance" (browser tests)
                s, e = abs_start_s, abs_end
            if abs_start_s - 0.01 <= (s + e) / 2 <= abs_end + 0.01:
                toks = text.split()
                step = (e - s) / max(1, len(toks))
                for i, t in enumerate(toks):
                    words.append(Word(t, s + i * step, s + (i + 1) * step))
        return Transcript(words, "en", {}, "", 0.01)


def make_transcriber():
    if config.ASR_BACKEND == "scripted":
        import json
        import os
        path = os.getenv("SCRIPT_FILE", str(config.DATA_DIR / "script.json"))
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
        return ScriptedTranscriber({k: [tuple(x) for x in v] for k, v in raw.items()})
    return WhisperTranscriber()
