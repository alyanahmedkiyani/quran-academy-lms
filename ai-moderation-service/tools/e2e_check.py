"""End-to-end check with scripted transcripts (no speech model needed).

Starts the server, streams a 'teacher' and a 'student' in real time, then verifies the alert,
the chat alert, and that the 15 s clip holds exactly the right audio.   python tools/e2e_check.py
"""
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np
import httpx

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from make_test_audio import speak            # noqa: E402
from sim_client import build, read_wav, run  # noqa: E402

PORT = 8765
tmp = Path(tempfile.mkdtemp())
SR = 16000


def main():
    speak(str(tmp / "student.wav"), "my number is zero three zero zero one two three four five six seven")
    speak(str(tmp / "teacher.wav"), "please tell me your number")
    s_pcm = build(str(tmp / "student.wav"), lead=14, tail=14)
    t_pcm = build(str(tmp / "teacher.wav"), lead=10, tail=14 + 4)
    s_dur = len(read_wav(str(tmp / "student.wav"))) / SR
    t_dur = len(read_wav(str(tmp / "teacher.wav"))) / SR
    script = {"Sana": [[14.0, 14.0 + s_dur, "my number is zero three zero zero one two three four five six seven"]],
              "Ahmed": [[10.0, 10.0 + t_dur, "please tell me your number"]]}
    (tmp / "script.json").write_text(json.dumps(script))
    env = dict(os.environ, ASR_BACKEND="scripted", SCRIPT_FILE=str(tmp / "script.json"), DATA_DIR=str(tmp / "data"),
               PORT=str(PORT), PYTHONPATH=str(ROOT))
    srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT), "--log-level", "warning"],
                           cwd=ROOT, env=env)
    try:
        base = f"http://127.0.0.1:{PORT}"
        for _ in range(60):
            try:
                httpx.get(base + "/api/metrics", timeout=1); break
            except Exception:
                time.sleep(0.5)
        url = f"ws://127.0.0.1:{PORT}/ws/room"

        async def go():
            chat = [(2.0, "call me on 0345-1234567"), (4.0, "open page number 25")]
            await asyncio.gather(run(url, "Sana", "student", "room-e2e", s_pcm, chat),
                                 run(url, "Ahmed", "teacher", "room-e2e", t_pcm))
        asyncio.run(go())
        time.sleep(2)
        alerts = httpx.get(base + "/api/alerts").json()
        print(f"alerts: {len(alerts)}")
        for a in alerts:
            print(f"  {a['source']:5} {a['speaker']:6} {a['pii']}:{a['kind']} conf={a['conf']} rule={a['rule']} "
                  f"status={a['status']} detect_lat={a['detect_latency_s']} ready_lat={a['ready_latency_s']}")
        ok = True

        def check(name, cond, detail=""):
            nonlocal ok
            ok &= bool(cond)
            print(("PASS " if cond else "FAIL ") + name, detail)

        voice = [a for a in alerts if a["source"] == "voice"]
        chat_a = [a for a in alerts if a["source"] == "chat"]
        check("one voice alert, for the student only", len(voice) == 1 and voice[0]["speaker"] == "Sana")
        check("teacher's ambiguous request raised no alert", not any(a["speaker"] == "Ahmed" for a in alerts))
        check("one chat alert for the typed number, none for 'page number 25'", len(chat_a) == 1 and "0345" in chat_a[0]["text"])
        a = voice[0]
        check("clip is ready", a["status"] == "new" and a["clip_url"])
        clip = httpx.get(base + a["clip_url"]).content
        p = tmp / "clip.wav"
        p.write_bytes(clip)
        with wave.open(str(p), "rb") as w:
            ch, sr, n = w.getnchannels(), w.getframerate(), w.getnframes()
            raw = np.frombuffer(w.readframes(n), dtype="<i2").reshape(-1, ch)
        check("clip is 15.00 s stereo 16 kHz", ch == 2 and sr == SR and n == 15 * SR, f"({n / sr:.2f}s)")
        ws0 = a["clip_start_s"]
        a0 = int(round(ws0 * SR))
        expect = s_pcm[a0:a0 + 15 * SR]
        check("left channel is exactly the student's audio for the window", (raw[:, 0] == expect[:len(raw)]).all())
        pre = a["incident_start_s"] - ws0
        post = ws0 + 15 - a["incident_end_s"]
        check("3-4 s or more before and after the incident", pre >= 3 and post >= 3, f"(before {pre:.2f}s, after {post:.2f}s)")
        check("incident sits inside the clip", ws0 < a["incident_start_s"] and a["incident_end_s"] < ws0 + 15)
        # right channel: teacher audio, alignment error
        right = raw[:, 1].astype(np.float32)
        t_ref = t_pcm.astype(np.float32)
        lo = max(0, a0 - SR)
        seg = t_ref[lo:a0 + 15 * SR + SR]
        corr = np.correlate(seg - seg.mean(), right[: 6 * SR] - right[: 6 * SR].mean(), mode="valid")
        best = int(np.argmax(corr)) + lo
        err = (best - a0) / SR
        check("other participants are on the right channel, aligned within 0.3 s", abs(err) < 0.3 and abs(right).max() > 500,
              f"(offset error {err * 1000:.0f} ms)")
        print("flags:", a["clip_flags"], "sha256:", a["clip_sha256"][:16], "...")
        m = httpx.get(base + "/api/metrics").json()
        print("metrics:", {k: m[k] for k in ("utterances", "asr_ms_p50", "queue_ms_p95")})
    finally:
        srv.terminate()
        srv.wait(10)
    print("\nALL PASS" if ok else "\nSOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
