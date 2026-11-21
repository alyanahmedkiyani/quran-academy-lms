"""CPU cost of the audio front end (ring buffer + voice-activity detection + segmenting) for N live streams.
Speech model excluded (it is the GPU part).   python tools/load_frontend.py 100 20"""
import os
import sys
import time

os.environ.setdefault("ASR_BACKEND", "scripted")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tempfile, json, wave  # noqa: E402
import numpy as np  # noqa: E402

n_streams = int(sys.argv[1]) if len(sys.argv) > 1 else 100
seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 20
tmp = tempfile.mkdtemp()
open(os.path.join(tmp, "s.json"), "w").write("{}")
os.environ["SCRIPT_FILE"] = os.path.join(tmp, "s.json")
os.environ["DATA_DIR"] = tmp
from app.engine import Engine  # noqa: E402
from app.store import Store  # noqa: E402
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))
from make_test_audio import speak  # noqa: E402
from sim_client import read_wav  # noqa: E402

speak(os.path.join(tmp, "sp.wav"), "assalam o alaikum, today we will read the lesson together, please open your book and listen carefully")
sp = read_wav(os.path.join(tmp, "sp.wav"))
rng = np.random.default_rng(1)
loop_audio = np.concatenate([sp, np.zeros(16000 * 3, dtype=np.int16)])
eng = Engine(Store(os.path.join(tmp, "t.db")), vad_kind="silero")
streams = [eng.open_stream("r", f"u{i}", "student") for i in range(n_streams)]
offs = [int(rng.integers(0, len(loop_audio))) for _ in streams]
CH = 1600
cpu0, t0 = time.process_time(), time.time()
ticks = int(seconds * 10)
late = 0
for k in range(ticks):
    for s, o in zip(streams, offs):
        idx = (o + k * CH) % len(loop_audio)
        chunk = np.take(loop_audio, np.arange(idx, idx + CH), mode="wrap")
        eng.feed(s, chunk)
    target = t0 + (k + 1) * 0.1
    d = target - time.time()
    if d > 0:
        time.sleep(d)
    else:
        late += 1
wall = time.time() - t0
cpu = time.process_time() - cpu0
print(f"{n_streams} streams, {seconds:.0f}s of audio each: wall {wall:.1f}s, cpu {cpu:.1f}s "
      f"=> {cpu / wall:.2f} cores busy; ticks that ran late: {late}/{ticks}; utterances cut: {eng.metrics['utterances']}")
