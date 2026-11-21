"""Streaming voice-activity segmenter. Turns a PCM stream into utterances.

An utterance is a [start, end) pair of absolute sample indexes. It closes after
`min_silence_ms` of silence, or is force-cut at `max_utt_s` with a short overlap
so no word is lost at the cut.
"""
from dataclasses import dataclass
import numpy as np

FRAME = 512  # 32 ms at 16 kHz, required by Silero


@dataclass
class Utterance:
    start: int
    end: int
    forced_cut: bool = False


class SileroVAD:
    """Silero VAD run as a true stream: the model's memory and audio context carry over between calls."""
    name = "silero"
    CTX = 64

    def __init__(self):
        from faster_whisper.vad import get_vad_model
        self.session = get_vad_model().session
        self.h = np.zeros((1, 1, 128), dtype=np.float32)
        self.c = np.zeros((1, 1, 128), dtype=np.float32)
        self.ctx = np.zeros(self.CTX, dtype=np.float32)

    def probs(self, frames: np.ndarray) -> np.ndarray:
        f = frames.reshape(-1, FRAME)
        prev = np.vstack([self.ctx[None, :], f[:-1, -self.CTX:]])
        batch = np.concatenate([prev, f], axis=1).astype(np.float32)
        out, self.h, self.c = self.session.run(None, {"input": batch, "h": self.h, "c": self.c})
        self.ctx = f[-1, -self.CTX:].copy()
        return np.asarray(out).reshape(-1)


class EnergyVAD:
    """Fallback and test VAD: speech = frame RMS above a threshold."""
    name = "energy"

    def __init__(self, threshold: float = 0.01):
        self.t = threshold

    def probs(self, frames: np.ndarray) -> np.ndarray:
        f = frames.reshape(-1, FRAME)
        rms = np.sqrt((f ** 2).mean(axis=1))
        return (rms > self.t).astype(np.float32)


def make_vad(kind: str = "silero"):
    if kind == "energy":
        return EnergyVAD()
    try:
        return SileroVAD()
    except Exception as exc:  # pragma: no cover
        print(f"[vad] silero unavailable ({exc}); using energy VAD")
        return EnergyVAD()


class Segmenter:
    def __init__(self, vad, sample_rate=16000, thr=0.5, neg_thr=0.35,
                 min_silence_ms=900, min_speech_ms=250, max_utt_s=12.0,
                 overlap_s=1.0, preroll_ms=500, postroll_ms=300):
        self.vad, self.sr = vad, sample_rate
        self.thr, self.neg_thr = thr, neg_thr
        fms = FRAME * 1000 / sample_rate
        self.min_sil = max(1, int(min_silence_ms / fms))
        self.min_speech = max(1, int(min_speech_ms / fms))
        self.max_frames = int(max_utt_s * sample_rate / FRAME)
        self.overlap = int(overlap_s * sample_rate / FRAME)
        self.pre = int(preroll_ms / fms)
        self.post = int(postroll_ms / fms)
        self._pend = np.zeros(0, dtype=np.float32)
        self.frame_idx = 0  # frames consumed so far
        self.in_speech = False
        self.start_f = 0
        self.last_speech_f = 0
        self.sil = 0

    def feed(self, pcm_i16: np.ndarray):
        x = np.concatenate([self._pend, pcm_i16.astype(np.float32) / 32768.0])
        n = (len(x) // FRAME) * FRAME
        self._pend = x[n:]
        if n == 0:
            return []
        probs = self.vad.probs(x[:n])
        out = []
        for p in probs:
            i = self.frame_idx
            self.frame_idx += 1
            if not self.in_speech:
                if p >= self.thr:
                    self.in_speech = True
                    self.start_f = max(0, i - self.pre)
                    self.last_speech_f = i
                    self.sil = 0
                continue
            if p >= self.neg_thr:
                self.last_speech_f, self.sil = i, 0
            else:
                self.sil += 1
            if self.sil >= self.min_sil:
                end_f = self.last_speech_f + 1 + self.post
                if self.last_speech_f - self.start_f + 1 >= self.min_speech:
                    out.append(Utterance(self.start_f * FRAME, end_f * FRAME))
                self.in_speech = False
            elif i + 1 - self.start_f >= self.max_frames:
                out.append(Utterance(self.start_f * FRAME, (i + 1) * FRAME, forced_cut=True))
                self.start_f = max(0, i + 1 - self.overlap)
                self.sil = 0
        return out

    def flush(self):
        if self.in_speech and self.last_speech_f - self.start_f + 1 >= self.min_speech:
            u = Utterance(self.start_f * FRAME, (self.last_speech_f + 1 + self.post) * FRAME)
            self.in_speech = False
            return [u]
        self.in_speech = False
        return []
