"""Real-browser check: Chromium joins with a fake microphone that plays a WAV, uses the chat box and the
guided test, and the admin page receives the alerts.  Needs playwright + chromium.  python tools/e2e_browser.py"""
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from make_test_audio import speak  # noqa: E402
from sim_client import build  # noqa: E402
import wave  # noqa: E402
import numpy as np  # noqa: E402

PORT = 8766
tmp = Path(tempfile.mkdtemp())
speak(str(tmp / "p.wav"), "my number is zero three zero zero one two three four five six seven")
pcm = build(str(tmp / "p.wav"), lead=5, tail=14)
with wave.open(str(tmp / "mic.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000); w.writeframes(pcm.astype("<i2").tobytes())
(tmp / "script.json").write_text(json.dumps({"*": [[None, None, "my number is zero three zero zero one two three four five six seven"]]}))
env = dict(os.environ, ASR_BACKEND="scripted", SCRIPT_FILE=str(tmp / "script.json"), DATA_DIR=str(tmp / "data"), PYTHONPATH=str(ROOT))
srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(PORT), "--log-level", "warning"], cwd=ROOT, env=env)
base = f"http://127.0.0.1:{PORT}"
ok = True


def check(name, cond, detail=""):
    global ok
    ok &= bool(cond)
    print(("PASS " if cond else "FAIL ") + name, detail)


try:
    for _ in range(60):
        try:
            httpx.get(base + "/api/metrics", timeout=1); break
        except Exception:
            time.sleep(0.5)
    with sync_playwright() as pw:
        br = pw.chromium.launch(executable_path="/opt/pw-browsers/chromium", args=[
            "--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
            f"--use-file-for-fake-audio-capture={tmp / 'mic.wav'}%noloop", "--autoplay-policy=no-user-gesture-required"])
        ctx = br.new_context(permissions=["microphone"])
        admin = ctx.new_page(); admin.goto(base + "/admin")
        page = ctx.new_page(); errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto(base + "/")
        page.fill("#name", "Browser1"); page.fill("#room", "room-b")
        page.click("#joinBtn")
        page.wait_for_selector("#roomUI:not([hidden])", timeout=10000)
        check("joined the room", True)
        page.wait_for_selector("#case-L02")
        page.click("button[data-s='L02']")             # guided test: line with spoken digits, should alert
        page.fill("#chatIn", "call me on 0345-1234567"); page.click("#chatSend")
        page.fill("#chatIn", "open page number 25"); page.click("#chatSend")
        page.wait_for_selector("#heard div", timeout=40000)
        check("server transcript echoed to the speaker", True, page.inner_text("#heard")[:90].replace("\n", " "))
        page.wait_for_function("document.querySelectorAll('#a-x, .alert audio').length > 0", timeout=40000) if False else None
        admin.wait_for_selector(".alert audio", timeout=40000)
        check("admin page shows a voice alert with a playable clip", True)
        time.sleep(1)
        page.click("#doneBtn")
        admin.reload(); admin.wait_for_selector(".alert", timeout=5000)
        n_alerts = admin.locator(".alert").count()
        srcs = admin.locator(".alert .tag").all_inner_texts()
        check("admin sees one voice and one chat alert (and not the 'page number 25' message)", n_alerts == 2 and sorted(srcs) == ["chat", "voice"], str(srcs))
        admin.click("button[data-t='eval']"); admin.wait_for_selector("#eval table", timeout=5000)
        txt = admin.inner_text("#eval")
        summ = httpx.get(base + "/api/eval/summary").json()["summary"]
        check("guided test counted the voice line as caught", summ["voice"]["tp"] == 1, str(summ["voice"]))
        check("no JavaScript errors on the room page", not errs, str(errs))
        a = httpx.get(base + "/api/alerts").json()
        v = [x for x in a if x["source"] == "voice"][0]
        wav = httpx.get(base + v["clip_url"]).content
        check("clip downloads as a 15 s WAV", len(wav) > 15 * 16000 * 4 - 100, f"{len(wav)} bytes")
        # Is the audio the browser captured really the speech that was played into the fake microphone?
        import io
        with wave.open(io.BytesIO(wav), "rb") as w:
            left = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2)[:, 0].astype(np.float32)
        src = pcm[5 * 16000: 5 * 16000 + 4 * 16000].astype(np.float32)        # first 4 s of the spoken line
        def env(x):                                                            # loudness envelope, 20 ms steps
            x = np.abs(x[: len(x) // 320 * 320]).reshape(-1, 320).mean(axis=1)
            return (x - x.mean()) / (x.std() + 1e-9)
        e_src, e_left = env(src), env(left)
        cc = np.correlate(e_left, e_src, mode="valid") / len(e_src)
        check("browser-captured audio matches the spoken line (loudness-pattern match score > 0.8)", cc.max() > 0.8, f"({cc.max():.2f})")
        print("voice alert:", v["pii"], v["kind"], v["conf"], "detect", v["detect_latency_s"], "ready", v["ready_latency_s"], "case", v["case_id"])
        if os.getenv("SHOT_DIR"):
            admin.click("button[data-t='alerts']"); admin.set_viewport_size({"width": 1100, "height": 900})
            admin.screenshot(path=os.path.join(os.environ["SHOT_DIR"], "admin.png"))
            page.set_viewport_size({"width": 1100, "height": 1000}); page.screenshot(path=os.path.join(os.environ["SHOT_DIR"], "room.png"))
        br.close()
finally:
    srv.terminate(); srv.wait(10)
print("\nALL PASS" if ok else "\nSOME CHECKS FAILED")
sys.exit(0 if ok else 1)
