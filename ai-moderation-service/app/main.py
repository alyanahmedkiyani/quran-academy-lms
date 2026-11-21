import asyncio
import json
import os
import re
import time
from pathlib import Path

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import config
from .engine import Engine
from .pii.detect import detect_text
from .pii.intent import predict_intent
from .store import Store

STATIC = Path(__file__).parent / "static"
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

app = FastAPI(title="QALMS AI Moderation Service")
store = Store()
engine: Engine = None
loop: asyncio.AbstractEventLoop = None
admins = set()
rooms = {}                      # room -> {ws: {"name","role"}}
speaker_ws = {}                 # (room, name) -> ws, so a tester sees what the server heard


def require_admin(token: str = Query(default="")):
    if ADMIN_TOKEN and token != ADMIN_TOKEN:
        raise HTTPException(401, "admin token required (?token=...)")


def emit(ev):
    if loop is None:
        return
    asyncio.run_coroutine_threadsafe(_to_admins(ev), loop)


async def _to_admins(ev):
    if ev.get("type") == "utterance":
        ws = speaker_ws.get((ev["room"], ev["speaker"]))
        if ws is not None:
            try:
                await ws.send_text(json.dumps({**ev, "type": "heard"}, ensure_ascii=False))
            except Exception:
                pass
    dead = []
    for ws in list(admins):
        try:
            await ws.send_text(json.dumps(ev, ensure_ascii=False))
        except Exception:
            dead.append(ws)
    for ws in dead:
        admins.discard(ws)


@app.on_event("startup")
async def startup():
    global engine, loop
    loop = asyncio.get_running_loop()
    engine = Engine(store, emit=emit)
    if hasattr(engine.asr, "preload"):
        engine.asr.preload()


# ------------------------------------------------------------------ pages
@app.get("/")
def page_index():
    return FileResponse(STATIC / "index.html")


@app.get("/admin")
def page_admin():
    return FileResponse(STATIC / "admin.html")


app.mount("/static", StaticFiles(directory=STATIC), name="static")


# ------------------------------------------------------------------ websockets
async def _room_broadcast(room, payload, skip=None):
    for ws in list(rooms.get(room, {})):
        if ws is skip:
            continue
        try:
            await ws.send_text(json.dumps(payload, ensure_ascii=False))
        except Exception:
            pass


def _clean(s, n=30):
    return re.sub(r"[^\w .\-]", "", s or "", flags=re.UNICODE).strip()[:n]


@app.websocket("/ws/room")
async def ws_room(ws: WebSocket):
    await ws.accept()
    try:
        join = json.loads(await ws.receive_text())
    except Exception:
        await ws.close()
        return
    room = _clean(join.get("room"), 40) or "class-1"
    name = _clean(join.get("name")) or "guest"
    role = join.get("role") if join.get("role") in ("teacher", "student") else "student"
    members = rooms.setdefault(room, {})
    taken = {m["name"] for m in members.values()}
    base, i = name, 2
    while name in taken:
        name, i = f"{base}{i}", i + 1
    members[ws] = {"name": name, "role": role}
    speaker_ws[(room, name)] = ws
    stream = engine.open_stream(room, name, role)
    await ws.send_text(json.dumps({"type": "joined", "name": name, "room": room, "role": role,
                                   "model_ready": getattr(engine.asr, "ready", True)}))
    await _room_broadcast(room, {"type": "peers", "peers": list(members.values())})
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                b = msg["bytes"]
                if len(b) >= 2:
                    engine.feed(stream, np.frombuffer(b[: len(b) // 2 * 2], dtype="<i2"))
            elif msg.get("text") is not None:
                d = json.loads(msg["text"])
                t = d.get("type")
                if t == "chat" and str(d.get("text", "")).strip():
                    text = str(d["text"])[:1000]
                    res = engine.handle_chat(room, name, role, text, d.get("case_id"))
                    await _room_broadcast(room, {"type": "chat", "from": name, "role": role, "text": text,
                                                 "ts": time.time()})
                elif t == "expect":
                    engine.set_case(stream, d.get("case_id"), d.get("label"), d.get("pii", ""))
                elif t == "clear":
                    engine.clear_case(stream)
    except WebSocketDisconnect:
        pass
    finally:
        members.pop(ws, None)
        speaker_ws.pop((room, name), None)
        engine.close_stream(stream)
        if members:
            await _room_broadcast(room, {"type": "peers", "peers": list(members.values())})
        else:
            rooms.pop(room, None)


@app.websocket("/ws/admin")
async def ws_admin(ws: WebSocket, token: str = ""):
    if ADMIN_TOKEN and token != ADMIN_TOKEN:
        await ws.close(code=4401)
        return
    await ws.accept()
    admins.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        admins.discard(ws)


# ------------------------------------------------------------------ REST
def _alert_view(a):
    a = dict(a)
    a["clip_url"] = f"/api/clips/{a['id']}" if a.get("clip_file") else None
    for k in ("clip_flags", "context"):
        try:
            a[k] = json.loads(a[k]) if a.get(k) else ({} if k == "clip_flags" else [])
        except Exception:
            pass
    return a


@app.get("/api/alerts", dependencies=[Depends(require_admin)])
def api_alerts(status: str = "", limit: int = 200):
    sql, args = "SELECT * FROM alerts", ()
    if status:
        sql, args = sql + " WHERE status=?", (status,)
    return [_alert_view(a) for a in store.rows(sql + " ORDER BY created DESC LIMIT ?", (*args, limit))]


@app.post("/api/alerts/{aid}/review", dependencies=[Depends(require_admin)])
def api_review(aid: str, body: dict):
    if not store.get("alerts", aid):
        raise HTTPException(404)
    fields = {}
    if body.get("status") in ("true_alarm", "false_alarm", "new"):
        fields["status"] = body["status"]
    if "note" in body:
        fields["review_note"] = str(body["note"])[:500]
    if body.get("clip_ok") in (0, 1, None):
        fields["clip_ok"] = body.get("clip_ok")
    store.update("alerts", aid, **fields)
    return _alert_view(store.get("alerts", aid))


@app.get("/api/clips/{aid}", dependencies=[Depends(require_admin)])
def api_clip(aid: str, mono: int = 0):
    a = store.get("alerts", aid)
    if not a or not a.get("clip_file"):
        raise HTTPException(404, "clip not ready")
    p = config.CLIP_DIR / Path(a["clip_file"]).name
    if not mono:
        return FileResponse(p, media_type="audio/wav")
    import wave
    with wave.open(str(p), "rb") as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(np.int32)
        sr = w.getframerate()
    m = np.clip(raw.sum(axis=1), -32768, 32767).astype("<i2")
    import io
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(m.tobytes())
    return Response(buf.getvalue(), media_type="audio/wav")


@app.get("/api/utterances", dependencies=[Depends(require_admin)])
def api_utts(limit: int = 100):
    return store.rows("SELECT * FROM utterances ORDER BY created DESC LIMIT ?", (limit,))


@app.get("/api/metrics")
def api_metrics():
    m = engine.snapshot()
    m["model_ready"] = getattr(engine.asr, "ready", True)
    m["model_error"] = getattr(engine.asr, "error", "")
    m["model"] = config.WHISPER_MODEL if config.ASR_BACKEND == "whisper" else "scripted"
    m["threshold"] = config.ALERT_THRESHOLD
    return m


@app.get("/health")
@app.get("/api/moderation/health")
def api_health():
    return {
        "status": "healthy",
        "service": "qalms-ai-moderation",
        "model_ready": getattr(engine.asr, "ready", True) if engine else True,
        "whisper_model": config.WHISPER_MODEL,
        "device": config.WHISPER_DEVICE,
        "timestamp": time.time(),
    }


@app.post("/api/moderation/check-text")
def api_moderation_check_text(body: dict):
    raw_text = str(body.get("text", "")).strip()
    if not raw_text:
        return {
            "alert": False,
            "text": "",
            "category": "none",
            "risk_level": "none_or_contextual",
            "intent": "",
            "confidence": 0.0,
            "findings": []
        }
    t, fs = detect_text(raw_text)
    alert_findings = [f for f in fs if f.conf >= config.ALERT_THRESHOLD]
    is_alert = bool(alert_findings)
    top_f = alert_findings[0] if alert_findings else (fs[0] if fs else None)
    
    intent_res = predict_intent(raw_text, threshold=config.ALERT_THRESHOLD)
    category = top_f.pii if top_f else (intent_res.get("category") if intent_res.get("is_suspicious") else "none")
    risk_level = "high" if any(f.conf >= 0.85 for f in alert_findings) else ("medium" if is_alert else "none")
    if intent_res.get("is_suspicious"):
        is_alert = True
        category = intent_res.get("category", category)
        risk_level = intent_res.get("risk_level", risk_level)

    return {
        "alert": is_alert,
        "text": raw_text,
        "normalised": t,
        "category": category,
        "risk_level": risk_level,
        "intent": intent_res.get("intent", ""),
        "confidence": round(float(top_f.conf if top_f else intent_res.get("confidence", 0.0)), 3),
        "findings": [f.as_dict() for f in fs]
    }


@app.post("/api/text-check")
def api_text_check(body: dict):
    t, fs = detect_text(str(body.get("text", "")))
    return {"normalised": t, "findings": [f.as_dict() for f in fs],
            "alert": any(f.conf >= config.ALERT_THRESHOLD for f in fs)}


@app.post("/api/reset", dependencies=[Depends(require_admin)])
def api_reset():
    store.reset()
    for f in config.CLIP_DIR.glob("*.wav"):
        f.unlink()
    return {"ok": True}


# ------------------------------------------------------------------ live accuracy tests
CASES_FILE = Path(__file__).resolve().parent.parent / "eval" / "live_cases.json"


@app.get("/api/eval/cases")
def api_cases():
    return json.loads(CASES_FILE.read_text(encoding="utf-8"))


@app.get("/api/eval/summary", dependencies=[Depends(require_admin)])
def api_eval_summary():
    cases = json.loads(CASES_FILE.read_text(encoding="utf-8"))
    alerts = store.rows("SELECT * FROM alerts WHERE case_id IS NOT NULL")
    utts = store.rows("SELECT * FROM utterances WHERE case_id IS NOT NULL ORDER BY created")
    chats = store.rows("SELECT * FROM chat WHERE case_id IS NOT NULL ORDER BY created")
    out, tally = [], {"voice": dict(tp=0, fp=0, fn=0, tn=0, lat=[], clip_ok=0, clip_bad=0),
                      "chat": dict(tp=0, fp=0, fn=0, tn=0, lat=[], clip_ok=0, clip_bad=0)}
    for c in cases:
        row = {"case": c}
        for ch in ("voice", "chat"):
            heard = [u["text"] for u in utts if u["case_id"] == c["id"]] if ch == "voice" else \
                    [m["text"] for m in chats if m["case_id"] == c["id"]]
            al = [a for a in alerts if a["case_id"] == c["id"] and a["source"] == ch]
            if not heard and not al:
                row[ch] = None
                continue
            want = c["label"] == "pii"
            hit = bool(al) and (not want or any(a["pii"] == c["pii"] for a in al) or not c.get("pii"))
            res = ("tp" if hit else "fn") if want else ("fp" if al else "tn")
            t = tally[ch]
            t[res] += 1
            if res == "tp" and ch == "voice":
                lat = [a["ready_latency_s"] for a in al if a["ready_latency_s"] is not None]
                t["lat"] += lat
                for a in al:
                    if a["clip_ok"] == 1: t["clip_ok"] += 1
                    if a["clip_ok"] == 0: t["clip_bad"] += 1
            row[ch] = {"heard": heard, "result": res,
                       "alerts": [{"id": a["id"], "pii": a["pii"], "conf": a["conf"], "rule": a["rule"],
                                   "clip_ok": a["clip_ok"]} for a in al]}
        out.append(row)
    summ = {}
    for ch, t in tally.items():
        p = t["tp"] / (t["tp"] + t["fp"]) if t["tp"] + t["fp"] else None
        r = t["tp"] / (t["tp"] + t["fn"]) if t["tp"] + t["fn"] else None
        lat = sorted(t["lat"])
        summ[ch] = {"tp": t["tp"], "fp": t["fp"], "fn": t["fn"], "tn": t["tn"],
                    "precision": None if p is None else round(p, 3), "recall": None if r is None else round(r, 3),
                    "clip_ready_median_s": lat[len(lat) // 2] if lat else None,
                    "clip_ok": t["clip_ok"], "clip_bad": t["clip_bad"]}
    return {"summary": summ, "cases": out}
