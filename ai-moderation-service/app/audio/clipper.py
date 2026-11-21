"""15-second clip logic: where the window goes, and writing the file."""
import hashlib
import wave

import numpy as np

from .. import config


def window(t_start: float, t_end: float, total=None, min_pad=None):
    """Return (win_start_s, win_end_s, truncated) for an incident spanning [t_start, t_end].

    The incident is centred. Padding before and after is (total - incident) / 2, which is 4 s or
    more for incidents up to 7 s, and never less than min_pad. Incidents longer than
    total - 2*min_pad are cut to their first part and flagged as truncated.
    """
    total = total or config.CLIP_TOTAL_S
    min_pad = config.CLIP_MIN_PAD_S if min_pad is None else min_pad
    length = max(0.0, t_end - t_start)
    cap = total - 2 * min_pad
    truncated = length > cap
    if truncated:
        length = cap
    pad = (total - length) / 2
    start = float(t_start - pad)
    return start, start + float(total), bool(truncated)


def _wav_bytes_stereo(left: np.ndarray, right: np.ndarray, sr: int, path):
    inter = np.empty(len(left) * 2, dtype=np.int16)
    inter[0::2], inter[1::2] = left, right
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(inter.tobytes())


def mix(arrays):
    if not arrays:
        return None
    acc = np.zeros(len(arrays[0]), dtype=np.int32)
    for a in arrays:
        acc += a
    return np.clip(acc, -32768, 32767).astype(np.int16)


def build_clip(stream, others, win_start_s, win_end_s, out_path):
    """Cut the window from the speaker's ring buffer (left channel) and the other
    participants' mix (right channel). Returns a dict with hash and any missing audio."""
    sr = config.SAMPLE_RATE
    a, b = int(round(win_start_s * sr)), int(round(win_end_s * sr))
    left, miss_before, miss_after = stream.ring.get(a, b)
    parts = []
    for o in others:
        off = (stream.t0_wall + win_start_s) - o.t0_wall      # wall-clock alignment
        oa = int(round(off * sr))
        seg, _, _ = o.ring.get(oa, oa + (b - a))
        parts.append(seg)
    right = mix(parts)
    if right is None:
        right = np.zeros_like(left)
    _wav_bytes_stereo(left, right, sr, out_path)
    h = hashlib.sha256(open(out_path, "rb").read()).hexdigest()
    return {"sha256": h, "missing_before_s": round(miss_before / sr, 2),
            "missing_after_s": round(miss_after / sr, 2), "duration_s": round((b - a) / sr, 2),
            "others": len(parts)}
