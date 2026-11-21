"""Moderation engine: audio in, alerts and clips out.

Flow per speaker:  PCM -> ring buffer + VAD segmenter -> utterance queue -> ASR (one worker)
-> PII rules over the last few seconds of words -> alert -> clip finalised once the
post-incident audio has arrived -> admin notified.  Nothing here acts on the user: it only reports.
"""
import json
import queue
import threading
import time
from collections import deque

import numpy as np

from . import config
from .audio.clipper import build_clip, window
from .audio.ringbuffer import RingBuffer
from .audio.segmenter import Segmenter, make_vad
from .audio.transcriber import Transcript, make_transcriber
from .pii.detect import detect_text, detect_words
from .store import Store, jdump

SR = config.SAMPLE_RATE
CONTEXT_S = 8.0          # words from the last N seconds are re-scanned, so numbers spoken in pieces join up


class SpeakerStream:
    def __init__(self, room, name, role, vad_kind="silero"):
        self.room, self.name, self.role = room, name, role
        self.key = f"{room}:{name}"
        self.ring = RingBuffer(config.RING_SECONDS, SR)
        self.seg = Segmenter(make_vad(vad_kind), SR, min_silence_ms=config.MIN_SILENCE_MS)
        self.t0_wall = time.time()
        self.closed = False
        self.words = []              # recent Word objects
        self.case = None             # eval tag: dict(id,label,pii,start,end)
        self.last_alert = {}         # pii -> wall time

    def wall(self, stream_s):
        return self.t0_wall + stream_s


class Engine:
    def __init__(self, store: Store, emit=lambda ev: None, transcriber=None, vad_kind=None):
        self.store, self.emit, self.vad_kind = store, emit, vad_kind or config.VAD_KIND
        self.asr = transcriber or make_transcriber()
        self.streams = {}                       # key -> SpeakerStream
        self.chat_history = {}                  # room -> deque
        self.jobs = queue.Queue()
        self.pending_clips = []                 # dicts
        self._chat_last = {}                    # (room:sender, pii) -> wall time
        self.last_error = ""
        self.lock = threading.Lock()
        self.metrics = {"utterances": 0, "asr_s": 0.0, "audio_s": 0.0, "queue_ms": deque(maxlen=500),
                        "asr_ms": deque(maxlen=500)}
        self._stop = False
        threading.Thread(target=self._worker, daemon=True, name="asr-worker").start()
        threading.Thread(target=self._clip_loop, daemon=True, name="clip-loop").start()

    # ------------------------------------------------------------ streams
    def open_stream(self, room, name, role):
        s = SpeakerStream(room, name, role, self.vad_kind)
        with self.lock:
            self.streams[s.key] = s
        return s

    def _enqueue(self, s, u):
        # Copy the audio now. The model may be slower than real time, and by the time it reaches this
        # utterance the ring buffer could have been overwritten.
        audio, _, _ = s.ring.get(u.start, u.end)
        self.jobs.put((s, u, audio, time.time()))

    def close_stream(self, s):
        s.closed = True
        for u in s.seg.flush():
            self._enqueue(s, u)
        with self.lock:
            self.streams.pop(s.key, None)

    def feed(self, s, pcm):
        s.ring.write(pcm)
        for u in s.seg.feed(pcm):
            self._enqueue(s, u)

    def peers(self, room):
        with self.lock:
            return [x for x in self.streams.values() if x.room == room]

    # ------------------------------------------------------------ eval tags
    def set_case(self, s, case_id, label, pii):
        s.case = {"id": case_id, "label": label, "pii": pii, "start": s.ring.head, "end": None}

    def clear_case(self, s):
        if s.case:
            s.case["end"] = s.ring.head + SR            # one extra second of tolerance

    def _case_for(self, s, a, b):
        c = s.case
        if c and a < (c["end"] if c["end"] is not None else 10 ** 12) and b > c["start"] - SR:
            return c["id"]
        return None

    # ------------------------------------------------------------ audio worker
    def _worker(self):
        while not self._stop:
            try:
                s, u, audio_i16, queued_at = self.jobs.get(timeout=0.5)
            except queue.Empty:
                continue
            try:
                self._process(s, u, audio_i16, queued_at)
            except Exception as exc:                 # keep the worker alive, but make the failure visible
                import traceback
                traceback.print_exc()
                self.last_error = f"{type(exc).__name__}: {exc}"[:300]
                self.emit({"type": "engine_error", "error": self.last_error})

    def _process(self, s, u, audio_i16, queued_at):
        audio = audio_i16.astype(np.float32) / 32768.0
        q_ms = (time.time() - queued_at) * 1000
        if len(audio) and float(np.sqrt((audio ** 2).mean())) < 0.002:
            tr = Transcript(skipped="near_silence")          # nothing to hear: do not let the model guess
        else:
            tr = self.asr.transcribe(audio, u.start / SR, s.name)
        a_s = len(audio) / SR
        self.metrics["utterances"] += 1
        self.metrics["asr_s"] += tr.asr_s
        self.metrics["audio_s"] += a_s
        self.metrics["queue_ms"].append(q_ms)
        self.metrics["asr_ms"].append(tr.asr_s * 1000)

        new = tr.words
        s.words = [w for w in s.words if w.end >= u.end / SR - CONTEXT_S] + new
        dets = detect_words([w.text for w in s.words]) if new else []
        first_new = len(s.words) - len(new)
        fresh = [(f, span) for f, span in dets if span[1] >= first_new]
        max_conf = max([f.conf for f, _ in fresh], default=0.0)

        if config.STORE_ALL_TRANSCRIPTS or fresh or tr.skipped:
            self.store.insert(
                "utterances", room=s.room, speaker=s.name, role=s.role, source="voice",
                start_s=u.start / SR, end_s=u.end / SR, text=tr.text, lang=tr.lang,
                lang_probs=jdump(tr.lang_probs), findings=jdump([f.as_dict() for f, _ in fresh]),
                max_conf=max_conf, skipped=tr.skipped, asr_ms=round(tr.asr_s * 1000), queue_ms=round(q_ms),
                audio_s=round(a_s, 2), case_id=self._case_for(s, u.start, u.end))
        self.emit({"type": "utterance", "room": s.room, "speaker": s.name, "role": s.role, "text": tr.text,
                   "lang": tr.lang, "skipped": tr.skipped, "max_conf": round(max_conf, 2),
                   "findings": [f.as_dict() for f, _ in fresh], "threshold": config.ALERT_THRESHOLD,
                   "asr_ms": round(tr.asr_s * 1000), "audio_s": round(a_s, 1)})

        for f, (a, b) in fresh:
            if f.conf < config.ALERT_THRESHOLD:
                continue
            self._raise_voice_alert(s, f, s.words[a].start, s.words[b].end, tr.text)

    # ------------------------------------------------------------ alerts
    def _raise_voice_alert(self, s, f, t_s, t_e, utt_text):
        now = time.time()
        last = s.last_alert.get(f.pii)
        if last and now - last < config.COOLDOWN_S:
            row = self.store.rows("SELECT id, merged_count FROM alerts WHERE speaker=? AND room=? AND pii=? "
                                  "ORDER BY created DESC LIMIT 1", (s.name, s.room, f.pii))
            if row:
                self.store.update("alerts", row[0]["id"], merged_count=(row[0]["merged_count"] or 0) + 1)
                self.emit({"type": "alert_merged", "id": row[0]["id"]})
            return
        s.last_alert[f.pii] = now
        ws, we, trunc = window(t_s, t_e)
        ctx_words = " ".join(w.text for w in s.words if ws - 1 <= w.start <= we)
        aid = self.store.insert(
            "alerts", room=s.room, speaker=s.name, role=s.role, source="voice", pii=f.pii, kind=f.kind,
            conf=f.conf, rule=f.rule, matched=f.text, text=ctx_words or utt_text, context="",
            clip_start_s=ws, clip_end_s=we, incident_start_s=t_s, incident_end_s=t_e,
            detect_latency_s=round(now - s.wall(t_e), 2), status="pending_clip",
            case_id=self._case_for(s, int(t_s * SR), int(t_e * SR)),
            clip_flags=jdump({"truncated": trunc}))
        with self.lock:
            self.pending_clips.append({"id": aid, "stream": s, "ws": ws, "we": we, "t_e": t_e,
                                       "deadline": now + max(0.0, we - s.ring.head / SR) + 10})
        self.emit({"type": "alert", "alert": self.store.get("alerts", aid)})

    def handle_chat(self, room, sender, role, text, case_id=None):
        _, findings = detect_text(text)
        max_conf = max([f.conf for f in findings], default=0.0)
        hist = self.chat_history.setdefault(room, deque(maxlen=6))
        alert_id = None
        for f in findings:
            if f.conf < config.ALERT_THRESHOLD:
                continue
            key = f"{room}:{sender}"
            ls = self._chat_last.get((key, f.pii))
            if ls and time.time() - ls < config.COOLDOWN_S:
                continue
            self._chat_last[(key, f.pii)] = time.time()
            alert_id = self.store.insert(
                "alerts", room=room, speaker=sender, role=role, source="chat", pii=f.pii, kind=f.kind,
                conf=f.conf, rule=f.rule, matched=f.text, text=text,
                context=jdump(list(hist)), status="new", case_id=case_id, clip_flags="{}")
            self.emit({"type": "alert", "alert": self.store.get("alerts", alert_id)})
            break
        mid = self.store.insert("chat", room=room, sender=sender, role=role, text=text,
                                findings=jdump([f.as_dict() for f in findings]), max_conf=max_conf,
                                alert_id=alert_id, case_id=case_id)
        hist.append({"from": sender, "role": role, "text": text})
        return {"id": mid, "alert_id": alert_id, "max_conf": max_conf}

    # ------------------------------------------------------------ clip finalisation
    def _clip_loop(self):
        while not self._stop:
            time.sleep(0.25)
            with self.lock:
                todo = list(self.pending_clips)
            for p in todo:
                s = p["stream"]
                have = s.ring.head / SR >= p["we"]
                if have or s.closed or time.time() > p["deadline"]:
                    # the worker may still be writing audio for a closed stream; that is fine
                    try:
                        self._finish_clip(p)
                    except Exception as exc:
                        import traceback
                        traceback.print_exc()
                        self.last_error = f"clip: {type(exc).__name__}: {exc}"[:300]
                        self.store.update("alerts", p["id"], status="clip_error", review_note=str(exc))
                    with self.lock:
                        if p in self.pending_clips:
                            self.pending_clips.remove(p)

    def _finish_clip(self, p):
        s = p["stream"]
        others = [o for o in self.peers(s.room) if o is not s]
        path = config.CLIP_DIR / f"{p['id']}.wav"
        info = build_clip(s, others, p["ws"], p["we"], path)
        flags = json.loads(self.store.get("alerts", p["id"])["clip_flags"] or "{}")
        flags.update({k: info[k] for k in ("missing_before_s", "missing_after_s", "others", "duration_s")})
        self.store.update("alerts", p["id"], clip_file=path.name, clip_sha256=info["sha256"],
                          ready_latency_s=round(time.time() - s.wall(p["t_e"]), 2), status="new",
                          clip_flags=jdump(flags))
        alert_row = self.store.get("alerts", p["id"])
        self.emit({"type": "alert_update", "alert": alert_row})
        self._notify_lms_webhook(alert_row, path.name)

    def _notify_lms_webhook(self, alert_row, clip_filename):
        def _post():
            if not config.LMS_API_URL:
                return
            try:
                import urllib.request
                url = f"{config.LMS_API_URL.rstrip('/')}/api/admin/moderation/webhook"
                clip_url = f"{config.AI_SERVICE_URL.rstrip('/')}/api/clips/{alert_row['id']}"
                payload = json.dumps({
                    "secret": config.LMS_WEBHOOK_SECRET,
                    "sessionId": alert_row.get("case_id"),
                    "roomId": alert_row.get("room"),
                    "speakerName": alert_row.get("speaker"),
                    "speakerType": alert_row.get("role"),
                    "category": alert_row.get("pii"),
                    "riskLevel": "high" if (alert_row.get("conf") or 0) >= 0.85 else "medium",
                    "intent": f"{str(alert_row.get('kind', 'violation')).title()} of {alert_row.get('pii', 'info')}",
                    "text": alert_row.get("text"),
                    "confidence": alert_row.get("conf"),
                    "clipUrl": clip_url,
                    "clipSha256": alert_row.get("clip_sha256")
                }).encode("utf-8")
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json", "x-ai-webhook-secret": config.LMS_WEBHOOK_SECRET}
                )
                with urllib.request.urlopen(req, timeout=3) as resp:
                    pass
            except Exception:
                pass
        threading.Thread(target=_post, daemon=True, name="webhook-post").start()

    # ------------------------------------------------------------ metrics
    def snapshot(self):
        def pct(d, q):
            v = sorted(d)
            return round(v[min(len(v) - 1, int(len(v) * q))]) if v else 0
        m = self.metrics
        return {"streams": len(self.streams), "queue_len": self.jobs.qsize(), "utterances": m["utterances"],
                "audio_s": round(m["audio_s"], 1), "asr_s": round(m["asr_s"], 1),
                "rtf": round(m["asr_s"] / m["audio_s"], 3) if m["audio_s"] else 0,
                "queue_ms_p50": pct(m["queue_ms"], 0.5), "queue_ms_p95": pct(m["queue_ms"], 0.95),
                "asr_ms_p50": pct(m["asr_ms"], 0.5), "asr_ms_p95": pct(m["asr_ms"], 0.95),
                "pending_clips": len(self.pending_clips),
                "queue_ms_last": round(m["queue_ms"][-1]) if m["queue_ms"] else 0,
                "last_error": self.last_error}
