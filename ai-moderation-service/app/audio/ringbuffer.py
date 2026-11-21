"""Per-speaker PCM ring buffer addressed by absolute sample index.

Stream time is the sample count since the stream started, so a position in
the buffer is a position in audio time, not wall-clock time.
"""
import threading
import numpy as np


class RingBuffer:
    def __init__(self, seconds: float, sample_rate: int = 16000):
        self.sr = sample_rate
        self.cap = int(seconds * sample_rate)
        self.buf = np.zeros(self.cap, dtype=np.int16)
        self.head = 0  # total samples ever written (absolute index of next sample)
        self._lock = threading.Lock()

    @property
    def oldest(self) -> int:
        return max(0, self.head - self.cap)

    def write(self, pcm: np.ndarray) -> None:
        n = len(pcm)
        if n == 0:
            return
        with self._lock:
            if n >= self.cap:
                self.buf[:] = pcm[-self.cap:]
            else:
                pos = self.head % self.cap
                first = min(n, self.cap - pos)
                self.buf[pos:pos + first] = pcm[:first]
                if first < n:
                    self.buf[:n - first] = pcm[first:]
            self.head += n

    def get(self, start: int, end: int):
        """Return (int16 samples for [start, end), missing_before, missing_after).

        Samples older than the buffer, or not yet written, are returned as
        silence and counted in the two missing_* values (in samples).
        """
        if end <= start:
            return np.zeros(0, dtype=np.int16), 0, 0
        with self._lock:
            head, oldest = self.head, max(0, self.head - self.cap)
            out = np.zeros(end - start, dtype=np.int16)
            lo, hi = max(start, oldest), min(end, head)
            if hi > lo:
                idx = (np.arange(lo, hi) % self.cap)
                out[lo - start:hi - start] = self.buf[idx]
        missing_before = max(0, min(end, oldest) - start) if start < oldest else 0
        missing_after = max(0, end - max(start, head)) if end > head else 0
        return out, missing_before, missing_after
